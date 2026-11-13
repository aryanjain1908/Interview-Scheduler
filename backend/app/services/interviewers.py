import uuid
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Dict, List, Optional, Sequence

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.clock import local_day_bounds, local_today
from app.core.errors import NotFound, RuleViolation
from app.models import (
    AvailabilityWindow,
    Badge,
    Interview,
    InterviewerBadge,
    InterviewStatus,
    Role,
    Slot,
    SlotStatus,
    User,
)

CANCELLED = (InterviewStatus.CANCELLED_STUDENT, InterviewStatus.CANCELLED_INTERVIEWER)


def badge_ids_for(db: Session, interviewer_id: uuid.UUID) -> List[uuid.UUID]:
    return list(db.scalars(select(InterviewerBadge.badge_id).where(InterviewerBadge.interviewer_id == interviewer_id)))


def is_qualified(db: Session, interviewer_id: uuid.UUID, badge_id: uuid.UUID) -> bool:
    return db.get(InterviewerBadge, (interviewer_id, badge_id)) is not None


def set_badges(db: Session, *, interviewer_id: uuid.UUID, badge_ids: Sequence[uuid.UUID]) -> List[uuid.UUID]:
    """Replace an interviewer's tracks. Existing bookings are honoured either way."""
    wanted = set(badge_ids)
    if not wanted:
        raise RuleViolation("Choose at least one Track Badge you can interview for.", code="badges_required")
    known = set(db.scalars(select(Badge.id).where(Badge.id.in_(wanted))))
    if known != wanted:
        raise NotFound("One of the selected badges doesn't exist.")
    db.execute(delete(InterviewerBadge).where(InterviewerBadge.interviewer_id == interviewer_id))
    db.add_all(InterviewerBadge(interviewer_id=interviewer_id, badge_id=b) for b in wanted)
    db.flush()
    return sorted(wanted, key=str)


@dataclass
class InterviewerSummary:
    interviewer: User
    badges: List[Badge]
    windows: List[AvailabilityWindow]
    open_next_7: int
    booked_next_7: int
    blocked_next_7: int
    interviews_today: int
    next_interview_at: Optional[datetime]


def overview(db: Session, now: datetime) -> List[InterviewerSummary]:
    interviewers = db.scalars(select(User).where(User.role == Role.INTERVIEWER).order_by(User.name)).all()
    ids = [i.id for i in interviewers]
    badges_by: Dict[uuid.UUID, List[Badge]] = {i: [] for i in ids}
    for row in db.execute(
        select(InterviewerBadge.interviewer_id, Badge).join(Badge, Badge.id == InterviewerBadge.badge_id).order_by(Badge.name)
    ):
        badges_by.setdefault(row[0], []).append(row[1])
    windows_by: Dict[uuid.UUID, List[AvailabilityWindow]] = {i: [] for i in ids}
    for w in db.scalars(
        select(AvailabilityWindow).order_by(AvailabilityWindow.weekday, AvailabilityWindow.start_time)
    ):
        windows_by.setdefault(w.interviewer_id, []).append(w)

    week_slots = db.scalars(
        select(Slot).where(Slot.start_at > now, Slot.start_at < now + timedelta(days=7))
    ).unique().all()
    today_start, today_end = local_day_bounds(local_today(now))
    active = db.scalars(
        select(Interview)
        .join(Slot, Interview.slot_id == Slot.id)
        .where(Interview.status.not_in(CANCELLED), Slot.start_at >= today_start)
        .order_by(Slot.start_at)
    ).unique().all()

    summaries = []
    for person in interviewers:
        mine = [s for s in week_slots if s.interviewer_id == person.id]
        upcoming = [iv for iv in active if iv.interviewer_id == person.id]
        summaries.append(
            InterviewerSummary(
                interviewer=person,
                badges=badges_by.get(person.id, []),
                windows=windows_by.get(person.id, []),
                open_next_7=sum(s.status == SlotStatus.OPEN for s in mine),
                booked_next_7=sum(s.status == SlotStatus.BOOKED for s in mine),
                blocked_next_7=sum(s.status == SlotStatus.BLOCKED for s in mine),
                interviews_today=sum(today_start <= iv.start_at < today_end for iv in upcoming),
                next_interview_at=next(
                    (iv.start_at for iv in upcoming if iv.status == InterviewStatus.SCHEDULED and iv.start_at > now), None
                ),
            )
        )
    return summaries


def get_interviewer(db: Session, interviewer_id: uuid.UUID) -> User:
    person = db.get(User, interviewer_id)
    if person is None or person.role != Role.INTERVIEWER:
        raise NotFound("Interviewer not found.")
    return person


@dataclass
class CalendarEntry:
    slot: Slot
    interview: Optional[Interview]


def calendar(
    db: Session, *, start: date, days: int, now: datetime, interviewer_id: Optional[uuid.UUID] = None
) -> List[CalendarEntry]:
    """Every slot in the range with the interview held in it (if any).

    Past open slots are hidden: availability that nobody used isn't interesting.
    """
    range_start, _ = local_day_bounds(start)
    range_end, _ = local_day_bounds(start + timedelta(days=days))
    query = select(Slot).where(Slot.start_at >= range_start, Slot.start_at < range_end).order_by(Slot.start_at)
    if interviewer_id:
        query = query.where(Slot.interviewer_id == interviewer_id)
    slots = [s for s in db.scalars(query).unique() if not (s.status == SlotStatus.OPEN and s.start_at <= now)]

    by_slot: Dict[uuid.UUID, Interview] = {}
    if slots:
        interviews = db.scalars(
            select(Interview)
            .where(Interview.slot_id.in_([s.id for s in slots]))
            .order_by(Interview.booked_at)
        ).unique()
        for iv in interviews:
            # Prefer the live/finished interview over an earlier cancelled one.
            current = by_slot.get(iv.slot_id)
            if current is None or current.status in CANCELLED or iv.status not in CANCELLED:
                by_slot[iv.slot_id] = iv
    return [CalendarEntry(slot=s, interview=by_slot.get(s.id)) for s in slots]
