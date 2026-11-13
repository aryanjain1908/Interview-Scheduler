import uuid
from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import schemas
from app.core.clock import local_day_bounds, local_today, utcnow
from app.db import get_db
from app.deps import interviewer_only
from app.models import Interview, InterviewStatus, Slot, User
from app.services import admin, availability, interviewers, interviews
from app.services.interviewer_views import availability_view, calendar_view

router = APIRouter(prefix="/interviewer", tags=["interviewer"])


@router.get("/availability", response_model=schemas.AvailabilityOut)
def get_availability(user: User = Depends(interviewer_only), db: Session = Depends(get_db)):
    now = utcnow()
    availability.sync_slots(db, user.id, now)
    db.commit()
    return availability_view(db, user.id, now)


@router.put("/badges", response_model=schemas.AvailabilityOut)
def set_badges(body: schemas.BadgesIn, user: User = Depends(interviewer_only), db: Session = Depends(get_db)):
    interviewers.set_badges(db, interviewer_id=user.id, badge_ids=body.badge_ids)
    db.commit()
    return availability_view(db, user.id, utcnow())


@router.post("/availability/windows", response_model=schemas.AvailabilityOut, status_code=201)
def add_window(body: schemas.WindowIn, user: User = Depends(interviewer_only), db: Session = Depends(get_db)):
    now = utcnow()
    availability.add_window(db, interviewer_id=user.id, now=now, **body.model_dump())
    db.commit()
    return availability_view(db, user.id, now)


@router.delete("/availability/windows/{window_id}", response_model=schemas.AvailabilityOut)
def delete_window(window_id: uuid.UUID, user: User = Depends(interviewer_only), db: Session = Depends(get_db)):
    now = utcnow()
    availability.delete_window(db, interviewer_id=user.id, window_id=window_id, now=now)
    db.commit()
    return availability_view(db, user.id, now)


@router.post("/slots/{slot_id}/block", response_model=schemas.AvailabilityOut)
def block_slot(
    slot_id: uuid.UUID, body: schemas.BlockSlotIn, user: User = Depends(interviewer_only), db: Session = Depends(get_db)
):
    now = utcnow()
    availability.set_slot_blocked(db, interviewer=user, slot_id=slot_id, blocked=body.blocked, reason=body.reason, now=now)
    db.commit()
    return availability_view(db, user.id, now)


@router.post("/slots/short-notice", response_model=schemas.AvailabilityOut)
def short_notice(body: schemas.ShortNoticeIn, user: User = Depends(interviewer_only), db: Session = Depends(get_db)):
    now = utcnow()
    availability.set_short_notice(db, interviewer=user, slot_ids=body.slot_ids, allowed=body.allowed, now=now)
    db.commit()
    return availability_view(db, user.id, now)


@router.post("/block-day", response_model=schemas.AvailabilityOut)
def block_day(body: schemas.BlockDayIn, user: User = Depends(interviewer_only), db: Session = Depends(get_db)):
    now = utcnow()
    availability.block_day(db, interviewer=user, day=body.day, reason=body.reason, now=now)
    db.commit()
    return availability_view(db, user.id, now)


@router.get("/calendar", response_model=List[schemas.CalendarEntryOut])
def calendar(
    start: date,
    days: int = Query(default=7, ge=1, le=31),
    user: User = Depends(interviewer_only),
    db: Session = Depends(get_db),
):
    now = utcnow()
    availability.sync_slots(db, user.id, now)
    db.commit()
    return calendar_view(db, start=start, days=days, now=now, interviewer_id=user.id)


@router.get("/schedule", response_model=List[schemas.ScheduleItemOut])
def schedule(day: Optional[date] = None, user: User = Depends(interviewer_only), db: Session = Depends(get_db)):
    start, end = local_day_bounds(day or local_today(utcnow()))
    items = db.scalars(
        select(Interview)
        .join(Slot, Interview.slot_id == Slot.id)
        .where(
            Interview.interviewer_id == user.id,
            Slot.start_at >= start,
            Slot.start_at < end,
            Interview.status != InterviewStatus.CANCELLED_STUDENT,
        )
        .order_by(Slot.start_at)
    ).unique()
    return [_schedule_item(iv) for iv in items]


@router.get("/history", response_model=List[schemas.ScheduleItemOut])
def history(user: User = Depends(interviewer_only), db: Session = Depends(get_db)):
    items = db.scalars(
        select(Interview)
        .join(Slot, Interview.slot_id == Slot.id)
        .where(
            Interview.interviewer_id == user.id,
            Interview.status.in_([InterviewStatus.COMPLETED, InterviewStatus.NO_SHOW]),
        )
        .order_by(Slot.start_at.desc())
        .limit(100)
    ).unique()
    return [_schedule_item(iv) for iv in items]


@router.post("/interviews/{interview_id}/start", response_model=schemas.ScheduleItemOut)
def start(interview_id: uuid.UUID, user: User = Depends(interviewer_only), db: Session = Depends(get_db)):
    interview = interviews.start(db, interviewer=user, interview_id=interview_id, now=utcnow())
    db.commit()
    return _schedule_item(interview)


@router.post("/interviews/{interview_id}/no-show", response_model=schemas.ScheduleItemOut)
def no_show(
    interview_id: uuid.UUID, body: schemas.NoShowIn, user: User = Depends(interviewer_only), db: Session = Depends(get_db)
):
    interview = interviews.mark_no_show(db, interviewer=user, interview_id=interview_id, note=body.note, now=utcnow())
    db.commit()
    return _schedule_item(interview)


@router.post("/interviews/{interview_id}/outcome", response_model=schemas.ScheduleItemOut)
def record_outcome(
    interview_id: uuid.UUID, body: schemas.OutcomeIn, user: User = Depends(interviewer_only), db: Session = Depends(get_db)
):
    interview = interviews.record_outcome(db, interviewer=user, interview_id=interview_id, now=utcnow(), **body.model_dump())
    db.commit()
    return _schedule_item(interview)


@router.post("/interviews/{interview_id}/reschedule", response_model=schemas.ScheduleItemOut)
def reschedule(
    interview_id: uuid.UUID,
    body: schemas.InterviewerRescheduleIn,
    user: User = Depends(interviewer_only),
    db: Session = Depends(get_db),
):
    interview = interviews.reschedule(
        db,
        interviewer=user,
        interview_id=interview_id,
        new_slot_id=body.slot_id,
        reason=body.reason,
        from_slot_id=body.from_slot_id,
        now=utcnow(),
    )
    db.commit()
    return _schedule_item(interview)


@router.post("/interviews/{interview_id}/cancel", response_model=schemas.ScheduleItemOut)
def cancel(
    interview_id: uuid.UUID,
    body: schemas.InterviewerCancelIn,
    user: User = Depends(interviewer_only),
    db: Session = Depends(get_db),
):
    interview = interviews.cancel(
        db, interviewer=user, interview_id=interview_id, reason=body.reason, from_slot_id=body.from_slot_id, now=utcnow()
    )
    db.commit()
    return _schedule_item(interview)


@router.post("/interviews/{interview_id}/report", response_model=schemas.CountOut, status_code=201)
def report_malpractice(
    interview_id: uuid.UUID, body: schemas.ReportIn, user: User = Depends(interviewer_only), db: Session = Depends(get_db)
):
    admin.report_malpractice(db, interviewer=user, interview_id=interview_id, now=utcnow(), **body.model_dump())
    db.commit()
    return schemas.CountOut(count=1)


def _schedule_item(interview: Interview) -> schemas.ScheduleItemOut:
    base = schemas.StaffInterviewOut.model_validate(interview)
    return schemas.ScheduleItemOut(
        **base.model_dump(),
        journey_attempts_used=interview.journey.attempts_used,
        max_attempts=interview.badge.max_attempts,
    )
