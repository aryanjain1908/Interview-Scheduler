import uuid
from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import schemas
from app.core.clock import utcnow
from app.db import get_db
from app.deps import admin_only
from app.models import InterviewStatus, Role, User
from app.services import admin, attendance, availability, change_requests, interviewers, student_records
from app.services.interviewer_views import availability_view, calendar_view
from app.services.eligibility import ensure_journeys
from app.services.student_views import journey_view

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/interviewers", response_model=List[schemas.Person])
def list_interviewers(_: User = Depends(admin_only), db: Session = Depends(get_db)):
    return db.scalars(select(User).where(User.role == Role.INTERVIEWER).order_by(User.name)).all()


@router.get("/overview", response_model=schemas.OverviewOut)
def overview(_: User = Depends(admin_only), db: Session = Depends(get_db)):
    data = admin.overview(db, utcnow())
    db.commit()
    return schemas.OverviewOut(**data.__dict__)


@router.get("/interviews", response_model=List[schemas.StaffInterviewOut])
def interviews(
    status: Optional[InterviewStatus] = None,
    day: Optional[date] = None,
    interviewer_id: Optional[uuid.UUID] = None,
    disputed: bool = False,
    emergency: bool = False,
    _: User = Depends(admin_only),
    db: Session = Depends(get_db),
):
    return admin.list_interviews(
        db, status=status, day=day, interviewer_id=interviewer_id, disputed=disputed, emergency=emergency
    )


@router.get("/badge-holders", response_model=List[schemas.BadgeHolderOut])
def badge_holders(_: User = Depends(admin_only), db: Session = Depends(get_db)):
    return admin.badge_holders(db)


@router.get("/flags", response_model=List[schemas.FlagOut])
def flags(_: User = Depends(admin_only), db: Session = Depends(get_db)):
    return admin.list_flags(db)


@router.post("/flags", response_model=schemas.FlagOut, status_code=201)
def raise_flag(body: schemas.FlagIn, user: User = Depends(admin_only), db: Session = Depends(get_db)):
    flag = admin.raise_flag(db, reporter=user, now=utcnow(), **body.model_dump())
    db.commit()
    return flag


@router.patch("/flags/{flag_id}", response_model=schemas.FlagOut)
def resolve_flag(
    flag_id: uuid.UUID, body: schemas.FlagResolveIn, user: User = Depends(admin_only), db: Session = Depends(get_db)
):
    flag = admin.resolve_flag(db, admin=user, flag_id=flag_id, resolution=body.resolution, now=utcnow())
    db.commit()
    return flag


@router.get("/students", response_model=schemas.StudentPageOut)
def students(
    search: str = "",
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    _: User = Depends(admin_only),
    db: Session = Depends(get_db),
):
    items, total = student_records.list_students(db, search=search, limit=limit, offset=offset)
    journeys = student_records.journeys_by_student(db, [s.id for s in items])
    return schemas.StudentPageOut(
        total=total,
        items=[
            schemas.StudentRowOut(
                student=schemas.UserOut.model_validate(s),
                journeys=[
                    schemas.StudentJourneySummary(
                        journey_id=j.id, badge=schemas.BadgeOut.model_validate(j.badge), status=j.status
                    )
                    for j in journeys[s.id]
                ],
            )
            for s in items
        ],
    )


def _record(db: Session, student_id: uuid.UUID) -> schemas.StudentRecordOut:
    now = utcnow()
    student = student_records.get_student(db, student_id)
    journeys = ensure_journeys(db, student.id, now)
    return schemas.StudentRecordOut(
        student=schemas.UserOut.model_validate(student), journeys=[journey_view(db, j, now) for j in journeys]
    )


@router.get("/students/{student_id}", response_model=schemas.StudentRecordOut)
def student_record(student_id: uuid.UUID, _: User = Depends(admin_only), db: Session = Depends(get_db)):
    record = _record(db, student_id)
    db.commit()
    return record


@router.post("/students/{student_id}/skills", response_model=schemas.StudentRecordOut)
def set_skill(
    student_id: uuid.UUID, body: schemas.SkillClearIn, user: User = Depends(admin_only), db: Session = Depends(get_db)
):
    student_records.set_skill_cleared(
        db, admin=user, student_id=student_id, skill_id=body.skill_id, cleared=body.cleared, now=utcnow()
    )
    record = _record(db, student_id)
    db.commit()
    return record


@router.post("/journeys/{journey_id}/allow-rebooking", response_model=schemas.StudentRecordOut)
def allow_rebooking(
    journey_id: uuid.UUID, body: schemas.ReasonIn, user: User = Depends(admin_only), db: Session = Depends(get_db)
):
    journey = student_records.allow_early_rebooking(db, admin=user, journey_id=journey_id, reason=body.reason, now=utcnow())
    record = _record(db, journey.student_id)
    db.commit()
    return record


@router.post("/student-badges/{student_badge_id}/nullify", response_model=schemas.FlagOut)
def nullify_badge(
    student_badge_id: uuid.UUID, body: schemas.ReportIn, user: User = Depends(admin_only), db: Session = Depends(get_db)
):
    flag = admin.nullify_badge(db, admin=user, student_badge_id=student_badge_id, now=utcnow(), **body.model_dump())
    db.commit()
    return flag


@router.get("/interviewers/overview", response_model=List[schemas.InterviewerOverviewOut])
def interviewers_overview(_: User = Depends(admin_only), db: Session = Depends(get_db)):
    now = utcnow()
    availability.sync_all(db, now)
    db.commit()
    return [
        schemas.InterviewerOverviewOut(
            interviewer=schemas.UserOut.model_validate(s.interviewer),
            badges=[schemas.BadgeOut.model_validate(b) for b in s.badges],
            windows=[schemas.WindowOut.model_validate(w) for w in s.windows],
            open_next_7=s.open_next_7,
            booked_next_7=s.booked_next_7,
            blocked_next_7=s.blocked_next_7,
            interviews_today=s.interviews_today,
            next_interview_at=s.next_interview_at,
        )
        for s in interviewers.overview(db, now)
    ]


@router.get("/interviewers/{interviewer_id}/availability", response_model=schemas.AvailabilityOut)
def interviewer_availability(interviewer_id: uuid.UUID, _: User = Depends(admin_only), db: Session = Depends(get_db)):
    person = interviewers.get_interviewer(db, interviewer_id)
    now = utcnow()
    availability.sync_slots(db, person.id, now)
    db.commit()
    return availability_view(db, person.id, now)


@router.get("/calendar", response_model=List[schemas.CalendarEntryOut])
def calendar(
    start: date,
    days: int = Query(default=7, ge=1, le=31),
    interviewer_id: Optional[uuid.UUID] = None,
    _: User = Depends(admin_only),
    db: Session = Depends(get_db),
):
    now = utcnow()
    availability.sync_all(db, now)
    db.commit()
    return calendar_view(db, start=start, days=days, now=now, interviewer_id=interviewer_id)


@router.post("/interviews/{interview_id}/excuse-no-show", response_model=schemas.StaffInterviewOut)
def excuse_no_show(
    interview_id: uuid.UUID, body: schemas.ReasonIn, user: User = Depends(admin_only), db: Session = Depends(get_db)
):
    interview = attendance.excuse_no_show(db, admin=user, interview_id=interview_id, reason=body.reason, now=utcnow())
    db.commit()
    return interview


@router.post("/interviews/{interview_id}/reject-dispute", response_model=schemas.StaffInterviewOut)
def reject_dispute(
    interview_id: uuid.UUID, body: schemas.ReasonIn, user: User = Depends(admin_only), db: Session = Depends(get_db)
):
    interview = attendance.reject_dispute(db, admin=user, interview_id=interview_id, reason=body.reason, now=utcnow())
    db.commit()
    return interview


@router.post("/change-requests/{request_id}/approve", response_model=schemas.ChangeRequestOut)
def approve_change(
    request_id: uuid.UUID, body: schemas.NoteIn, user: User = Depends(admin_only), db: Session = Depends(get_db)
):
    request = change_requests.approve(db, admin=user, request_id=request_id, note=body.reason, now=utcnow())
    db.commit()
    return request


@router.post("/change-requests/{request_id}/reject", response_model=schemas.ChangeRequestOut)
def reject_change(
    request_id: uuid.UUID, body: schemas.ReasonIn, user: User = Depends(admin_only), db: Session = Depends(get_db)
):
    request = change_requests.reject(db, admin=user, request_id=request_id, note=body.reason, now=utcnow())
    db.commit()
    return request
