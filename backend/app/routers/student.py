import uuid
from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app import schemas
from app.core.clock import utcnow
from app.db import get_db
from app.deps import student_only
from app.models import Notification, StudentBadge, User
from app.services import attendance, booking, change_requests, student_views
from app.services.availability import sync_all

router = APIRouter(prefix="/student", tags=["student"])


@router.get("/dashboard", response_model=schemas.DashboardOut)
def dashboard(user: User = Depends(student_only), db: Session = Depends(get_db)):
    view = student_views.dashboard(db, user, utcnow())
    db.commit()  # lazy eligibility/cooldown transitions may have happened
    return view


@router.get("/slots", response_model=List[schemas.SlotOut])
def slots(badge_id: uuid.UUID, user: User = Depends(student_only), db: Session = Depends(get_db)):
    now = utcnow()
    sync_all(db, now)  # roll the 14-day horizon forward
    db.commit()
    return booking.bookable_slots(db, badge_id=badge_id, now=now)


@router.post("/interviews", response_model=schemas.InterviewOut, status_code=201)
def book(body: schemas.BookIn, user: User = Depends(student_only), db: Session = Depends(get_db)):
    interview = booking.book(db, student=user, badge_id=body.badge_id, slot_id=body.slot_id, now=utcnow())
    db.commit()
    return interview


@router.get("/interviews/{interview_id}", response_model=schemas.InterviewDetailOut)
def interview_detail(interview_id: uuid.UUID, user: User = Depends(student_only), db: Session = Depends(get_db)):
    return student_views.interview_detail(db, user, interview_id, utcnow())


@router.post("/interviews/{interview_id}/reschedule", response_model=schemas.InterviewOut)
def reschedule(
    interview_id: uuid.UUID, body: schemas.RescheduleIn, user: User = Depends(student_only), db: Session = Depends(get_db)
):
    interview = booking.reschedule(db, student=user, interview_id=interview_id, new_slot_id=body.slot_id, now=utcnow())
    db.commit()
    return interview


@router.post("/interviews/{interview_id}/cancel", response_model=schemas.InterviewOut)
def cancel(interview_id: uuid.UUID, user: User = Depends(student_only), db: Session = Depends(get_db)):
    interview = booking.cancel_by_student(db, student=user, interview_id=interview_id, now=utcnow())
    db.commit()
    return interview


@router.post("/interviews/{interview_id}/interviewer-absent", response_model=schemas.InterviewOut)
def interviewer_absent(interview_id: uuid.UUID, user: User = Depends(student_only), db: Session = Depends(get_db)):
    interview = attendance.report_interviewer_absent(db, student=user, interview_id=interview_id, now=utcnow())
    db.commit()
    return interview


@router.post("/interviews/{interview_id}/dispute", response_model=schemas.InterviewOut)
def dispute_no_show(
    interview_id: uuid.UUID, body: schemas.DisputeIn, user: User = Depends(student_only), db: Session = Depends(get_db)
):
    interview = attendance.dispute_no_show(db, student=user, interview_id=interview_id, reason=body.reason, now=utcnow())
    db.commit()
    return interview


@router.get("/badges", response_model=List[schemas.StudentBadgeOut])
def my_badges(user: User = Depends(student_only), db: Session = Depends(get_db)):
    return db.scalars(
        select(StudentBadge).where(StudentBadge.student_id == user.id).order_by(StudentBadge.awarded_at.desc())
    ).all()


@router.post("/notifications/read-all", status_code=204)
def read_all(user: User = Depends(student_only), db: Session = Depends(get_db)):
    db.execute(
        update(Notification)
        .where(Notification.user_id == user.id, Notification.read_at.is_(None))
        .values(read_at=utcnow())
    )
    db.commit()


@router.post("/interviews/{interview_id}/emergency-change", response_model=schemas.ChangeRequestOut, status_code=201)
def emergency_change(
    interview_id: uuid.UUID,
    body: schemas.EmergencyChangeIn,
    user: User = Depends(student_only),
    db: Session = Depends(get_db),
):
    request = change_requests.emergency_change(
        db, student=user, interview_id=interview_id, reason=body.reason, new_slot_id=body.slot_id, now=utcnow()
    )
    db.commit()
    return request
