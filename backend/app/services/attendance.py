"""What happens when someone doesn't turn up.

- Student absent      → interviewer marks a no-show from 15 min after the start (uses an attempt).
- Interviewer absent  → student reports it from 15 min after the start; no attempt used, priority rebook.
- Nobody did anything → `close_missed` marks it missed 15 min after the slot; no attempt used, priority rebook.
- Disputed no-show    → the student disputes within 48h; the team excuses it (attempt refunded) or rejects it.

Timing rules live in `interview_rules`.
"""

import uuid
from datetime import datetime, timedelta
from typing import List

from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session

from loguru import logger

from app.core.config import settings
from app.core.errors import NotFound, RuleViolation
from app.models import DisputeResolution, Interview, InterviewStatus, JourneyStatus as S, Slot, User
from app.services import interview_rules as rules
from app.services import messages
from app.services.change_settle import settle_pending
from app.services.locks import lock_interview, lock_journey
from app.services.notifications import notify, notify_team_leads
from app.services.state_machine import transition


def report_interviewer_absent(db: Session, *, student: User, interview_id: uuid.UUID, now: datetime) -> Interview:
    interview = lock_interview(db, interview_id)
    if interview is None or interview.student_id != student.id:
        raise NotFound("Interview not found.")
    rules.can_report_interviewer_absent(interview, now).enforce("report_not_allowed")

    _close_without_attempt(
        db,
        interview,
        status=InterviewStatus.INTERVIEWER_ABSENT,
        reason="Student reported the interviewer didn't join",
        actor_id=student.id,
        now=now,
    )
    settle_pending(db, interview.journey, why="your interviewer didn't join the interview", now=now)
    notify(db, student.id, messages.interviewer_absent_ack(interview.badge.name), at=now)
    notify(db, interview.interviewer_id, messages.interviewer_marked_absent(student.name, interview.start_at), at=now)
    db.flush()
    logger.info("Student {} reported the interviewer absent for interview {}", student.id, interview.id)
    return interview


def close_missed(db: Session, now: datetime) -> List[Interview]:
    """Mark interviews missed once their slot is over and nobody started them
    (or they were started but no result was recorded within the grace period)."""
    never_started = and_(
        Interview.status == InterviewStatus.SCHEDULED,
        Slot.end_at < now - timedelta(minutes=settings.missed_grace_minutes),
    )
    never_recorded = and_(
        Interview.status == InterviewStatus.IN_PROGRESS,
        Slot.end_at < now - timedelta(hours=settings.outcome_grace_hours),
    )
    overdue = db.scalars(
        select(Interview)
        .join(Slot, Interview.slot_id == Slot.id)
        .where(or_(never_started, never_recorded))
        .with_for_update(of=Interview, skip_locked=True)
    ).unique().all()

    for interview in overdue:
        started = interview.status == InterviewStatus.IN_PROGRESS
        _close_without_attempt(
            db,
            interview,
            status=InterviewStatus.MISSED,
            reason="Marked missed: no result was recorded" if started else "Marked missed: the interview never started",
            actor_id=None,
            now=now,
        )
        notify(db, interview.student_id, messages.interview_missed(interview.badge.name, interview.start_at), at=now)
        staff = messages.interview_missed_staff(interview.student.name, interview.start_at, started=started)
        notify(db, interview.interviewer_id, staff, at=now)
        notify_team_leads(db, staff, at=now)
    db.flush()
    if overdue:
        logger.info("Marked {} interview(s) missed", len(overdue))
    return list(overdue)


def dispute_no_show(db: Session, *, student: User, interview_id: uuid.UUID, reason: str, now: datetime) -> Interview:
    interview = lock_interview(db, interview_id)
    if interview is None or interview.student_id != student.id:
        raise NotFound("Interview not found.")
    rules.can_dispute(interview, now).enforce("dispute_not_allowed")
    reason = (reason or "").strip()
    if len(reason) < 20:
        raise RuleViolation(
            "Tell the team what happened, e.g. when you joined and what you saw (20+ characters).",
            code="reason_required",
        )
    interview.disputed_at = now
    interview.dispute_reason = reason[:500]
    notify(db, student.id, messages.no_show_dispute_received(interview.badge.name), at=now)
    notify(db, interview.interviewer_id, messages.no_show_disputed_staff(student.name, interview.start_at), at=now)
    notify_team_leads(db, messages.no_show_disputed_staff(student.name, interview.start_at), at=now)
    db.flush()
    logger.info("Student {} disputed no-show on interview {}", student.id, interview.id)
    return interview


def excuse_no_show(db: Session, *, admin: User, interview_id: uuid.UUID, reason: str, now: datetime) -> Interview:
    interview = lock_interview(db, interview_id)
    if interview is None:
        raise NotFound("Interview not found.")
    if interview.status != InterviewStatus.NO_SHOW:
        raise RuleViolation("Only a no-show can be excused.")
    if len(reason.strip()) < 10:
        raise RuleViolation("Record why you're excusing this (10+ characters).", code="reason_required")
    journey = lock_journey(db, interview.journey_id)
    if journey.status not in (S.NO_SHOW, S.ELIGIBLE):
        raise RuleViolation("The student has already moved on from this interview, so it can't be excused here.")

    interview.status = InterviewStatus.EXCUSED
    interview.cancel_reason = f"No-show excused: {reason.strip()[:250]}"
    if interview.disputed_at is not None:
        interview.dispute_resolution = DisputeResolution.EXCUSED
        interview.dispute_resolved_at = now
    journey.attempts_used = max(journey.attempts_used - 1, 0)
    journey.eligible_again_at = None
    journey.priority_rebook = True
    if journey.status == S.NO_SHOW:
        transition(journey, S.ELIGIBLE, at=now, actor_id=admin.id, reason=f"No-show excused: {reason.strip()[:200]}")
    notify(db, interview.student_id, messages.no_show_excused(interview.badge.name), at=now)
    db.flush()
    logger.info("Admin {} excused no-show on interview {}", admin.id, interview.id)
    return interview


def reject_dispute(db: Session, *, admin: User, interview_id: uuid.UUID, reason: str, now: datetime) -> Interview:
    interview = lock_interview(db, interview_id)
    if interview is None:
        raise NotFound("Interview not found.")
    if interview.status != InterviewStatus.NO_SHOW or interview.disputed_at is None:
        raise RuleViolation("There's no open dispute on this interview.")
    if interview.dispute_resolution is not None:
        raise RuleViolation("This dispute has already been resolved.")
    reason = reason.strip()
    if len(reason) < 10:
        raise RuleViolation("Tell the student why the no-show stands (10+ characters).", code="reason_required")
    interview.dispute_resolution = DisputeResolution.REJECTED
    interview.dispute_resolved_at = now
    interview.cancel_reason = f"Dispute rejected: {reason[:250]}"
    notify(db, interview.student_id, messages.dispute_rejected(interview.badge.name, reason), at=now)
    db.flush()
    logger.info("Admin {} rejected the dispute on interview {}", admin.id, interview.id)
    return interview


def _close_without_attempt(
    db: Session, interview: Interview, *, status: InterviewStatus, reason: str, actor_id, now: datetime
) -> None:
    journey = lock_journey(db, interview.journey_id)
    interview.status = status
    interview.cancelled_at = now
    interview.cancel_reason = reason
    journey.priority_rebook = True
    journey.reschedules_used = 0
    transition(journey, S.ELIGIBLE, at=now, actor_id=actor_id, reason=reason)
