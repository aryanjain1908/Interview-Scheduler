import uuid
from datetime import date, datetime
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from app import schemas
from app.core.config import settings
from app.models import ACTIVE_INTERVIEW_STATUSES, Interview
from app.services import availability, interviewers


def availability_view(db: Session, interviewer_id: uuid.UUID, now: datetime) -> schemas.AvailabilityOut:
    slots = availability.upcoming_slots(db, interviewer_id, now)
    active = {
        iv.slot_id: iv
        for iv in db.scalars(
            select(Interview).where(
                Interview.slot_id.in_([s.id for s in slots]), Interview.status.in_(ACTIVE_INTERVIEW_STATUSES)
            )
        ).unique()
    }
    return schemas.AvailabilityOut(
        min_booking_lead_minutes=settings.min_booking_lead_minutes,
        windows=[schemas.WindowOut.model_validate(w) for w in availability.list_windows(db, interviewer_id)],
        slots=[
            schemas.InterviewerSlotOut(
                id=s.id,
                start_at=s.start_at,
                end_at=s.end_at,
                status=s.status,
                bookable_state=availability.booking_state(s, now),
                student_name=active[s.id].student.name if s.id in active else None,
                badge_name=active[s.id].badge.name if s.id in active else None,
            )
            for s in slots
        ],
        badge_ids=interviewers.badge_ids_for(db, interviewer_id),
    )


def calendar_view(
    db: Session, *, start: date, days: int, now: datetime, interviewer_id: Optional[uuid.UUID] = None
) -> List[schemas.CalendarEntryOut]:
    entries = interviewers.calendar(db, start=start, days=days, now=now, interviewer_id=interviewer_id)
    return [
        schemas.CalendarEntryOut(
            slot_id=e.slot.id,
            start_at=e.slot.start_at,
            end_at=e.slot.end_at,
            status=e.slot.status,
            bookable_state=availability.booking_state(e.slot, now),
            interviewer=schemas.Person.model_validate(e.slot.interviewer),
            interview=(
                schemas.CalendarInterviewOut(
                    id=e.interview.id,
                    status=e.interview.status,
                    attempt_no=e.interview.attempt_no,
                    meeting_link=e.interview.meeting_link,
                    student=schemas.Person.model_validate(e.interview.student),
                    badge=schemas.BadgeOut.model_validate(e.interview.badge),
                    result=e.interview.outcome.result if e.interview.outcome else None,
                )
                if e.interview
                else None
            ),
        )
        for e in entries
    ]
