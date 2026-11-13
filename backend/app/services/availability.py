"""Interviewer availability rules and the bookable slots generated from them.

Windows are the source of truth; slots are materialised for the next
`booking_horizon_days` days. Syncing only ever adds missing slots or removes
*open* future slots that no window covers any more — booked or blocked slots
are never touched.
"""

import uuid
from datetime import date, datetime, time, timedelta, timezone
from typing import Iterable, List, Optional, Set

from sqlalchemy import delete, select, true
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.core.clock import LOCAL_TZ, local_day_bounds, local_today
from app.core.config import settings
from app.core.errors import NotFound, RuleViolation
from app.models import ACTIVE_INTERVIEW_STATUSES, AvailabilityWindow, Interview, Role, Slot, SlotStatus, User
from app.services.booking import cancel_by_interviewer

SLOT = timedelta(minutes=settings.slot_minutes)
MIDNIGHT = time(0, 0)


def minutes_of(t: time, *, is_end: bool = False) -> int:
    """Minutes since midnight. An end time of 00:00 means the end of the day (24:00)."""
    if is_end and t == MIDNIGHT:
        return 24 * 60
    return t.hour * 60 + t.minute


def list_windows(db: Session, interviewer_id: uuid.UUID) -> List[AvailabilityWindow]:
    return list(
        db.scalars(
            select(AvailabilityWindow)
            .where(AvailabilityWindow.interviewer_id == interviewer_id)
            .order_by(AvailabilityWindow.specific_date.nulls_first(), AvailabilityWindow.weekday, AvailabilityWindow.start_time)
        )
    )


def add_window(
    db: Session,
    *,
    interviewer_id: uuid.UUID,
    weekday: Optional[int],
    specific_date: Optional[date],
    start_time: time,
    end_time: time,
    now: datetime,
) -> AvailabilityWindow:
    if (weekday is None) == (specific_date is None):
        raise RuleViolation("Choose either a weekday (repeats weekly) or a specific date.")
    if weekday is not None and not 0 <= weekday <= 6:
        raise RuleViolation("Weekday must be between Monday (0) and Sunday (6).")
    if specific_date is not None and specific_date < local_today(now):
        raise RuleViolation("You can't add availability in the past.")
    start_min, end_min = minutes_of(start_time), minutes_of(end_time, is_end=True)
    if start_min >= end_min:
        raise RuleViolation("End time must be after start time.")
    if any(t.minute % settings.slot_minutes or t.second for t in (start_time, end_time)):
        raise RuleViolation(f"Times must be on {settings.slot_minutes}-minute boundaries (e.g. 10:00, 10:30).")

    for other in list_windows(db, interviewer_id):
        same_day = other.weekday == weekday if weekday is not None else other.specific_date == specific_date
        overlaps = start_min < minutes_of(other.end_time, is_end=True) and minutes_of(other.start_time) < end_min
        if same_day and overlaps:
            raise RuleViolation("This overlaps a window you already have on that day.", code="window_overlap")

    window = AvailabilityWindow(
        interviewer_id=interviewer_id,
        weekday=weekday,
        specific_date=specific_date,
        start_time=start_time,
        end_time=end_time,
        created_at=now,
    )
    db.add(window)
    db.flush()
    sync_slots(db, interviewer_id, now)
    return window


def delete_window(db: Session, *, interviewer_id: uuid.UUID, window_id: uuid.UUID, now: datetime) -> None:
    window = db.get(AvailabilityWindow, window_id)
    if window is None or window.interviewer_id != interviewer_id:
        raise NotFound("Availability window not found.")
    db.delete(window)
    db.flush()
    sync_slots(db, interviewer_id, now)


def expected_slot_starts(windows: Iterable[AvailabilityWindow], now: datetime) -> Set[datetime]:
    today = local_today(now)
    starts: Set[datetime] = set()
    for offset in range(settings.booking_horizon_days + 1):
        day = today + timedelta(days=offset)
        for w in windows:
            if w.specific_date != day and not (w.specific_date is None and w.weekday == day.weekday()):
                continue
            cursor = datetime.combine(day, w.start_time, tzinfo=LOCAL_TZ)
            end = datetime.combine(day, MIDNIGHT, tzinfo=LOCAL_TZ) + timedelta(minutes=minutes_of(w.end_time, is_end=True))
            while cursor + SLOT <= end:
                if cursor > now:
                    starts.add(cursor.astimezone(timezone.utc))
                cursor += SLOT
    return starts


def sync_slots(db: Session, interviewer_id: uuid.UUID, now: datetime) -> None:
    expected = expected_slot_starts(list_windows(db, interviewer_id), now)
    if expected:
        db.execute(
            pg_insert(Slot)
            .values(
                [
                    {
                        "id": uuid.uuid4(),
                        "interviewer_id": interviewer_id,
                        "start_at": start,
                        "end_at": start + SLOT,
                        "status": SlotStatus.OPEN.value,
                        "created_at": now,
                    }
                    for start in expected
                ]
            )
            .on_conflict_do_nothing(index_elements=["interviewer_id", "start_at"])
        )
    stale = select(Slot.id).where(
        Slot.interviewer_id == interviewer_id,
        Slot.status == SlotStatus.OPEN,
        Slot.start_at > now,
        Slot.start_at.not_in(expected) if expected else true(),
        ~select(Interview.id).where(Interview.slot_id == Slot.id).exists(),
    )
    db.execute(delete(Slot).where(Slot.id.in_(stale)).execution_options(synchronize_session=False))
    db.flush()


def sync_all(db: Session, now: datetime) -> None:
    for interviewer_id in db.scalars(select(User.id).where(User.role == Role.INTERVIEWER)):
        sync_slots(db, interviewer_id, now)


def booking_state(slot: Slot, now: datetime) -> str:
    """How a slot looks to students right now: open, too_soon, expired, booked or blocked."""
    if slot.status != SlotStatus.OPEN:
        return slot.status.value
    if slot.start_at <= now:
        return "expired"
    if slot.start_at < now + timedelta(minutes=settings.min_booking_lead_minutes):
        opened = slot.short_notice and slot.start_at >= now + timedelta(minutes=settings.short_notice_min_minutes)
        return "open" if opened else "too_soon"
    return "open"


def set_short_notice(db: Session, *, interviewer: User, slot_ids: List[uuid.UUID], allowed: bool, now: datetime) -> int:
    """Let students book these open slots at short notice (or take that back)."""
    changed = 0
    for slot_id in slot_ids:
        slot = db.get(Slot, slot_id)
        if slot is None or slot.interviewer_id != interviewer.id:
            raise NotFound("Slot not found.")
        if slot.status != SlotStatus.OPEN:
            raise RuleViolation("Only an open slot can be opened at short notice.", code="slot_not_open")
        if allowed and slot.start_at < now + timedelta(minutes=settings.short_notice_min_minutes):
            raise RuleViolation(
                f"This slot starts in under {settings.short_notice_min_minutes} minutes — too late for a student to book and join.",
                code="too_late",
            )
        slot.short_notice = allowed
        changed += 1
    db.flush()
    return changed


def upcoming_slots(db: Session, interviewer_id: uuid.UUID, now: datetime) -> List[Slot]:
    return list(
        db.scalars(
            select(Slot)
            .where(
                Slot.interviewer_id == interviewer_id,
                Slot.start_at > now,
                Slot.start_at < now + timedelta(days=settings.booking_horizon_days + 1),
            )
            .order_by(Slot.start_at)
        ).unique()
    )


def set_slot_blocked(
    db: Session, *, interviewer: User, slot_id: uuid.UUID, blocked: bool, reason: str, now: datetime
) -> Slot:
    slot = db.get(Slot, slot_id)
    if slot is None or slot.interviewer_id != interviewer.id:
        raise NotFound("Slot not found.")
    if slot.start_at <= now:
        raise RuleViolation("You can only change future slots.")
    if not _apply_block(db, slot, blocked, interviewer.id, reason, now):
        raise RuleViolation("This interview has already started, so it can't be cancelled.", code="already_started")
    db.flush()
    return slot


def block_day(db: Session, *, interviewer: User, day: date, reason: str, now: datetime) -> int:
    """Take a day off. Booked interviews that day are cancelled and the students prioritised."""
    start, end = local_day_bounds(day)
    slots = db.scalars(
        select(Slot).where(
            Slot.interviewer_id == interviewer.id,
            Slot.start_at >= max(start, now),
            Slot.start_at < end,
            Slot.status != SlotStatus.BLOCKED,
        )
    ).unique().all()
    changed = sum(_apply_block(db, slot, True, interviewer.id, reason, now) for slot in slots)
    db.flush()
    return changed


def _apply_block(db: Session, slot: Slot, blocked: bool, actor_id: uuid.UUID, reason: str, now: datetime) -> bool:
    """Block or reopen one slot. Returns False if it was left alone (its interview is under way)."""
    if not blocked:
        if slot.status == SlotStatus.BLOCKED:
            slot.status = SlotStatus.OPEN
        return True
    interview = db.scalar(
        select(Interview).where(Interview.slot_id == slot.id, Interview.status.in_(ACTIVE_INTERVIEW_STATUSES))
    )
    if interview is not None:
        cancelled = cancel_by_interviewer(
            db, interview=interview, actor_id=actor_id, reason=reason or "Interviewer unavailable", now=now, slot_id=slot.id
        )
        if not cancelled and interview.status in ACTIVE_INTERVIEW_STATUSES and interview.slot_id == slot.id:
            return False  # already started: leave it to run
    slot.status = SlotStatus.BLOCKED
    return True
