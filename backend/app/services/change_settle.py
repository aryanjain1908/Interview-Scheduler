"""Closing emergency changes that no longer need the team's review."""

from datetime import datetime

from loguru import logger
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import ChangeRequest, ChangeRequestStatus, InterviewJourney
from app.services import messages
from app.services.notifications import notify


def settle_pending(db: Session, journey: InterviewJourney, *, why: str, now: datetime) -> int:
    """Approve the journey's pending emergency change when the interviewer then cancelled
    or didn't turn up: the booking fell through for a reason that wasn't the student's,
    so the change mustn't be able to cost them an attempt."""
    pending = db.scalars(
        select(ChangeRequest)
        .where(ChangeRequest.journey_id == journey.id, ChangeRequest.status == ChangeRequestStatus.PENDING)
        .with_for_update()
    ).all()
    for request in pending:
        request.status = ChangeRequestStatus.APPROVED
        request.resolved_at = now
        request.resolution_note = f"Closed automatically: {why}. No attempt used."[:300]
        notify(db, request.student_id, messages.emergency_settled(journey.badge.name, why), at=now)
        logger.info("Emergency change {} closed automatically: {}", request.id, why)
    if pending:
        db.flush()
        db.expire(journey, ["change_requests"])
    return len(pending)
