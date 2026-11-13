"""Interview reminders: the student 24h and 1h before, the interviewer 1h before.

Each reminder is claimed with a row lock (SKIP LOCKED) and stamped on the
interview, so it is sent exactly once even with several workers running.
A reminder is skipped if the booking was made inside its window (the booking
confirmation already covers it). Rescheduling clears the stamps.
"""

from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from loguru import logger

from app.models import Interview, InterviewStatus, Slot
from app.services import messages
from app.services.notifications import notify

DAY = timedelta(hours=24)
HOUR = timedelta(hours=1)


def send_due(db: Session, now: datetime) -> int:
    upcoming = db.scalars(
        select(Interview)
        .join(Slot, Interview.slot_id == Slot.id)
        .where(
            Interview.status == InterviewStatus.SCHEDULED,
            Slot.start_at > now,
            Slot.start_at <= now + DAY,
            (Interview.reminded_day_before_at.is_(None)) | (Interview.reminded_hour_before_at.is_(None)),
        )
        .with_for_update(of=Interview, skip_locked=True)
    ).unique().all()

    sent = 0
    for iv in upcoming:
        badge, start, who = iv.badge.name, iv.start_at, iv.interviewer.name
        if iv.reminded_day_before_at is None and start - now <= DAY:
            iv.reminded_day_before_at = now
            if iv.booked_at <= start - DAY:
                notify(db, iv.student_id, messages.reminder_day_before(badge, start, who, now), at=now)
                sent += 1
        if iv.reminded_hour_before_at is None and start - now <= HOUR:
            iv.reminded_hour_before_at = now
            # Booked (or moved here) inside the hour: the booking message already said when.
            if iv.booked_at <= start - HOUR:
                notify(db, iv.student_id, messages.reminder_hour_before(badge, start, who, now), at=now)
                notify(db, iv.interviewer_id, messages.reminder_hour_before_staff(iv.student.name, badge, start, now), at=now)
                sent += 2
    db.flush()
    if sent:
        logger.info("Sent {} interview reminder(s)", sent)
    return sent
