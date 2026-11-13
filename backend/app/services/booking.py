"""Concurrency: the journey row and then the slot row are locked with
SELECT ... FOR UPDATE, so two students racing for one slot are serialised and
the loser gets a clean 409. Partial unique indexes on `interviews` are the
second line of defence.
"""

import secrets
import uuid
from datetime import datetime, timedelta
from typing import List, Optional

from sqlalchemy import and_, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from loguru import logger

from app.core.clock import fmt_datetime
from app.core.config import settings
from app.core.errors import Conflict, NotFound, RuleViolation
from app.models import (
    Badge,
    Interview,
    InterviewerBadge,
    InterviewStatus,
    JourneyStatus as S,
    Slot,
    SlotStatus,
    User,
)
from app.services import interview_rules as rules
from app.services import messages
from app.services.eligibility import booking_block_reason, get_or_create_journey
from app.services.locks import lock_interview, lock_journey
from app.services.notifications import notify, notify_team_leads
from app.services.state_machine import transition

SLOT_TAKEN = "That slot was just taken — pick another one."


def bookable_slots(db: Session, *, badge_id: uuid.UUID, now: datetime) -> List[Slot]:
    earliest = now + timedelta(minutes=settings.min_booking_lead_minutes)
    short_notice_earliest = now + timedelta(minutes=settings.short_notice_min_minutes)
    return list(
        db.scalars(
            select(Slot)
            .join(InterviewerBadge, InterviewerBadge.interviewer_id == Slot.interviewer_id)
            .where(
                InterviewerBadge.badge_id == badge_id,
                Slot.status == SlotStatus.OPEN,
                or_(Slot.start_at >= earliest, and_(Slot.short_notice, Slot.start_at >= short_notice_earliest)),
                Slot.start_at < now + timedelta(days=settings.booking_horizon_days + 1),
            )
            .order_by(Slot.start_at)
        ).unique()
    )


def book(db: Session, *, student: User, badge_id: uuid.UUID, slot_id: uuid.UUID, now: datetime) -> Interview:
    badge = db.get(Badge, badge_id)
    if badge is None:
        raise NotFound("Badge not found.")
    journey = lock_journey(db, get_or_create_journey(db, student.id, badge, now).id)

    reason = booking_block_reason(journey, now)
    if reason:
        raise RuleViolation(reason, code="not_bookable")

    slot = lock_open_slot(db, slot_id, badge.id, now)
    interview = Interview(
        journey=journey,
        slot=slot,
        student_id=student.id,
        interviewer_id=slot.interviewer_id,
        badge_id=badge.id,
        attempt_no=journey.attempts_used + 1,
        status=InterviewStatus.SCHEDULED,
        meeting_link=_meeting_link(),
        booked_at=now,
    )
    db.add(interview)
    slot.status = SlotStatus.BOOKED
    journey.priority_rebook = False
    transition(journey, S.BOOKED, at=now, actor_id=student.id, reason=f"Booked {fmt_datetime(slot.start_at)}")
    notify(db, student.id, messages.booking_confirmed(badge.name, slot.start_at, slot.interviewer.name), at=now)
    flush_or_conflict(db)
    logger.info("Booked interview {} for student {} on badge {} at {}", interview.id, student.id, badge.id, slot.start_at)
    return interview


def reschedule(db: Session, *, student: User, interview_id: uuid.UUID, new_slot_id: uuid.UUID, now: datetime) -> Interview:
    interview = student_interview(db, student, interview_id)
    rules.can_reschedule(interview, now).enforce("not_changeable")
    journey = lock_journey(db, interview.journey_id)
    # A change forced on the student by the interviewer doesn't use one of theirs.
    free = interview.moved_by_interviewer_at is not None

    new_slot = lock_open_slot(db, new_slot_id, interview.badge_id, now)
    old_start = interview.slot.start_at
    move_interview(interview, new_slot, release_old=SlotStatus.OPEN)
    if not free:
        journey.reschedules_used += 1
    transition(
        journey,
        S.BOOKED,
        at=now,
        actor_id=student.id,
        reason=f"Rescheduled from {fmt_datetime(old_start)} to {fmt_datetime(new_slot.start_at)}",
    )
    notify(db, student.id, messages.rescheduled(interview.badge.name, new_slot.start_at, new_slot.interviewer.name), at=now)
    flush_or_conflict(db)
    logger.info("Student {} rescheduled interview {} to {}", student.id, interview.id, new_slot.start_at)
    return interview


def cancel_by_student(db: Session, *, student: User, interview_id: uuid.UUID, now: datetime) -> Interview:
    interview = student_interview(db, student, interview_id)
    rules.can_cancel(interview, now).enforce("not_changeable")
    journey = lock_journey(db, interview.journey_id)

    interview.status = InterviewStatus.CANCELLED_STUDENT
    interview.cancelled_at = now
    interview.cancel_reason = "Cancelled by student"
    interview.slot.status = SlotStatus.OPEN
    transition(journey, S.ELIGIBLE, at=now, actor_id=student.id, reason="Student cancelled the booking")
    notify(db, student.id, messages.cancelled_by_student(interview.badge.name, interview.start_at), at=now)
    db.flush()
    logger.info("Student {} cancelled interview {}", student.id, interview.id)
    return interview


def cancel_by_interviewer(
    db: Session, *, interview: Interview, actor_id: uuid.UUID, reason: str, now: datetime, slot_id: Optional[uuid.UUID] = None
) -> bool:
    """Interviewer can't make it: free the student, block the slot, flag for priority rebooking.

    Locks the interview first; if it changed meanwhile (the student moved it, or it
    already closed), nothing is cancelled and False is returned.
    """
    interview = lock_interview(db, interview.id)
    if interview is None or interview.status != InterviewStatus.SCHEDULED:
        return False
    if slot_id is not None and interview.slot_id != slot_id:
        return False
    journey = lock_journey(db, interview.journey_id)
    interview.status = InterviewStatus.CANCELLED_INTERVIEWER
    interview.cancelled_at = now
    interview.cancel_reason = reason[:300]
    interview.slot.status = SlotStatus.BLOCKED
    journey.priority_rebook = True
    journey.reschedules_used = 0
    transition(journey, S.ELIGIBLE, at=now, actor_id=actor_id, reason=f"Interviewer cancelled: {reason}"[:300])
    notify(
        db, interview.student_id, messages.cancelled_by_interviewer(interview.badge.name, interview.start_at, reason), at=now
    )
    notify_team_leads(
        db,
        messages.interviewer_cancelled_staff(interview.interviewer.name, interview.student.name, interview.start_at, reason),
        at=now,
    )
    logger.info("Interviewer cancelled interview {}: {}", interview.id, reason)
    return True


def bookable_in_time(slot: Slot, now: datetime) -> bool:
    """Far enough ahead: the usual notice, or a few minutes if the interviewer opened it at short notice."""
    lead = settings.short_notice_min_minutes if slot.short_notice else settings.min_booking_lead_minutes
    return slot.start_at >= now + timedelta(minutes=lead)


def can_change(interview: Interview, now: datetime) -> bool:
    """Whether the student can reschedule or cancel without an emergency request."""
    return rules.can_cancel(interview, now).allowed


def move_interview(interview: Interview, new_slot: Slot, *, release_old: SlotStatus) -> None:
    """Point a booking at a new slot. The old slot is reopened or blocked; reminders restart."""
    interview.slot.status = release_old
    new_slot.status = SlotStatus.BOOKED
    interview.slot = new_slot
    interview.interviewer_id = new_slot.interviewer_id
    interview.reminded_day_before_at = None
    interview.reminded_hour_before_at = None
    interview.moved_by_interviewer_at = None
    interview.move_reason = None


def lock_open_slot(db: Session, slot_id: uuid.UUID, badge_id: uuid.UUID, now: datetime) -> Slot:
    db.flush()  # don't let populate_existing discard pending changes
    slot: Optional[Slot] = db.scalars(
        select(Slot)
        .where(Slot.id == slot_id)
        .with_for_update(of=Slot)
        .execution_options(populate_existing=True)
    ).unique().one_or_none()
    if slot is None:
        raise NotFound("Slot not found.")
    if slot.status != SlotStatus.OPEN:
        raise Conflict(SLOT_TAKEN, code="slot_taken")
    if not bookable_in_time(slot, now):
        raise RuleViolation("This slot starts too soon to book. Pick a later one.", code="slot_too_soon")
    if db.get(InterviewerBadge, (slot.interviewer_id, badge_id)) is None:
        raise RuleViolation("This interviewer doesn't take interviews for this badge.", code="interviewer_not_qualified")
    return slot


def student_interview(db: Session, student: User, interview_id: uuid.UUID) -> Interview:
    interview = lock_interview(db, interview_id)
    if interview is None or interview.student_id != student.id:
        raise NotFound("Interview not found.")
    return interview


def flush_or_conflict(db: Session) -> None:
    try:
        db.flush()
    except IntegrityError as exc:
        db.rollback()
        raise Conflict(SLOT_TAKEN, code="slot_taken") from exc


def _meeting_link() -> str:
    return f"https://meet.jit.si/grit-interview-{secrets.token_hex(5)}"
