import uuid
from datetime import date, datetime, timedelta
from typing import Dict, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from loguru import logger

from app.core.clock import local_midnight_utc, local_today
from app.core.config import settings
from app.core.errors import NotFound, RuleViolation
from app.models import (
    Interview,
    InterviewOutcome,
    InterviewStatus,
    JourneyStatus as S,
    OutcomeResult,
    StudentBadge,
    StudentBadgeStatus,
    User,
)
from app.core.clock import fmt_datetime
from app.models import SlotStatus
from app.services import interview_rules as rules
from app.services import messages
from app.services.booking import cancel_by_interviewer, flush_or_conflict, lock_open_slot, move_interview
from app.services.locks import lock_interview, lock_journey
from app.services.notifications import notify, notify_team_leads
from app.services.state_machine import transition

RUBRIC = ("fundamentals", "problem_solving", "communication")


def get_own_interview(db: Session, interviewer: User, interview_id: uuid.UUID) -> Interview:
    """The interviewer's own interview, row-locked so concurrent actions are serialised."""
    interview = lock_interview(db, interview_id)
    if interview is None or interview.interviewer_id != interviewer.id:
        raise NotFound("Interview not found in your schedule.")
    return interview


def start(db: Session, *, interviewer: User, interview_id: uuid.UUID, now: datetime) -> Interview:
    interview = get_own_interview(db, interviewer, interview_id)
    _start(db, interview, interviewer.id, now)
    db.flush()
    logger.info("Interviewer {} started interview {}", interviewer.id, interview.id)
    return interview


def mark_no_show(db: Session, *, interviewer: User, interview_id: uuid.UUID, note: str, now: datetime) -> Interview:
    interview = get_own_interview(db, interviewer, interview_id)
    rules.can_mark_no_show(interview, now).enforce("no_show_not_allowed")
    note = (note or "").strip()
    if len(note) < 10:
        raise RuleViolation(
            "Add a short note for the team, e.g. how long you waited (10+ characters).", code="note_required"
        )

    journey = lock_journey(db, interview.journey_id)
    interview.status = InterviewStatus.NO_SHOW
    interview.no_show_note = note[:300]
    interview.cancelled_at = now
    journey.attempts_used += 1
    journey.reschedules_used = 0
    journey.eligible_again_at = now + timedelta(days=settings.no_show_cooldown_days)
    transition(journey, S.NO_SHOW, at=now, actor_id=interviewer.id, reason="Student did not join")
    notify(
        db,
        interview.student_id,
        messages.no_show(
            interview.badge.name, interview.start_at, journey.attempts_used, journey.badge.max_attempts, journey.eligible_again_at
        ),
        at=now,
    )
    db.flush()
    logger.info("Interviewer {} marked interview {} a no-show", interviewer.id, interview.id)
    return interview


def _require_reason(reason: str, what: str) -> str:
    reason = (reason or "").strip()
    if len(reason) < 10:
        raise RuleViolation(f"Give a reason the student and the team will see ({what}, 10+ characters).", code="reason_required")
    return reason


def _ensure_unmoved(interview: Interview, from_slot_id: Optional[uuid.UUID]) -> None:
    if from_slot_id is not None and interview.slot_id != from_slot_id:
        raise RuleViolation(
            f"This interview was just moved to {fmt_datetime(interview.start_at)}. Refresh and check it again.",
            code="interview_moved",
        )


def reschedule(
    db: Session,
    *,
    interviewer: User,
    interview_id: uuid.UUID,
    new_slot_id: uuid.UUID,
    reason: str,
    now: datetime,
    from_slot_id: Optional[uuid.UUID] = None,
) -> Interview:
    """Move a booking to another of the interviewer's own open slots.

    The old time is blocked (the interviewer can't make it); the student is told why
    and may then reschedule or cancel for free until the interview starts.
    """
    interview = get_own_interview(db, interviewer, interview_id)
    rules.can_interviewer_reschedule(interview, now).enforce("reschedule_not_allowed")
    _ensure_unmoved(interview, from_slot_id)
    reason = _require_reason(reason, "why you're moving it")
    new_slot = lock_open_slot(db, new_slot_id, interview.badge_id, now)
    if new_slot.interviewer_id != interviewer.id:
        raise RuleViolation("Pick one of your own open slots.", code="not_your_slot")

    journey = lock_journey(db, interview.journey_id)
    old_start = interview.start_at
    move_interview(interview, new_slot, release_old=SlotStatus.BLOCKED)
    interview.moved_by_interviewer_at = now
    interview.move_reason = reason[:300]
    transition(
        journey,
        S.BOOKED,
        at=now,
        actor_id=interviewer.id,
        reason=f"Interviewer moved it from {fmt_datetime(old_start)} to {fmt_datetime(new_slot.start_at)}: {reason}"[:300],
    )
    notify(
        db,
        interview.student_id,
        messages.interviewer_rescheduled(interview.badge.name, old_start, new_slot.start_at, interviewer.name, reason),
        at=now,
    )
    notify_team_leads(
        db,
        messages.interviewer_rescheduled_staff(interviewer.name, interview.student.name, old_start, new_slot.start_at, reason),
        at=now,
    )
    flush_or_conflict(db)
    logger.info("Interviewer {} moved interview {} to {}", interviewer.id, interview.id, new_slot.start_at)
    return interview


def cancel(
    db: Session,
    *,
    interviewer: User,
    interview_id: uuid.UUID,
    reason: str,
    now: datetime,
    from_slot_id: Optional[uuid.UUID] = None,
) -> Interview:
    interview = get_own_interview(db, interviewer, interview_id)
    rules.can_interviewer_cancel(interview, now).enforce("cancel_not_allowed")
    _ensure_unmoved(interview, from_slot_id)
    reason = _require_reason(reason, "why you can't do it")
    cancel_by_interviewer(db, interview=interview, actor_id=interviewer.id, reason=reason, now=now)
    db.flush()
    logger.info("Interviewer {} cancelled interview {}", interviewer.id, interview.id)
    return interview


def record_outcome(
    db: Session,
    *,
    interviewer: User,
    interview_id: uuid.UUID,
    result: OutcomeResult,
    scores: Dict[str, int],
    feedback_to_student: str,
    internal_notes: str,
    retake_after: Optional[date],
    now: datetime,
) -> Interview:
    interview = get_own_interview(db, interviewer, interview_id)
    if interview.status == InterviewStatus.COMPLETED:
        raise RuleViolation("An outcome has already been recorded for this interview.", code="outcome_exists")
    rules.can_record(interview, now).enforce("outcome_not_allowed")
    _validate_outcome(result, scores, feedback_to_student, retake_after, now)
    if interview.status == InterviewStatus.SCHEDULED:
        _start(db, interview, interviewer.id, now)

    interview.outcome = InterviewOutcome(
        result=result,
        scores=scores,
        feedback_to_student=feedback_to_student.strip(),
        internal_notes=internal_notes.strip(),
        retake_after=retake_after if result == OutcomeResult.RETAKE_LATER else None,
        recorded_by=interviewer.id,
        recorded_at=now,
    )
    interview.status = InterviewStatus.COMPLETED

    journey = lock_journey(db, interview.journey_id)
    journey.reschedules_used = 0
    badge = journey.badge

    if result == OutcomeResult.PASS:
        transition(journey, S.PASSED, at=now, actor_id=interviewer.id, reason="Passed the interview")
        _award_badge(db, interview, now)
        notify(db, interview.student_id, messages.passed(badge.name), at=now)
    elif result == OutcomeResult.FAIL:
        journey.attempts_used += 1
        journey.eligible_again_at = (
            now + timedelta(days=settings.fail_cooldown_days) if journey.attempts_left > 0 else None
        )
        transition(journey, S.FAILED, at=now, actor_id=interviewer.id, reason="Did not pass the interview")
        notify(
            db,
            interview.student_id,
            messages.failed(badge.name, journey.attempts_used, badge.max_attempts, journey.eligible_again_at),
            at=now,
        )
    else:
        journey.eligible_again_at = local_midnight_utc(retake_after)
        transition(journey, S.RETAKE_LATER, at=now, actor_id=interviewer.id, reason="Interviewer suggested a retake")
        notify(db, interview.student_id, messages.retake_suggested(badge.name, retake_after), at=now)

    db.flush()
    logger.info("Interviewer {} recorded {} for interview {}", interviewer.id, result.value, interview.id)
    return interview


def _start(db: Session, interview: Interview, actor_id: uuid.UUID, now: datetime) -> None:
    rules.can_start(interview, now).enforce("start_not_allowed")
    journey = lock_journey(db, interview.journey_id)
    interview.status = InterviewStatus.IN_PROGRESS
    interview.started_at = now
    transition(journey, S.IN_PROGRESS, at=now, actor_id=actor_id, reason="Interview started")


def _validate_outcome(
    result: OutcomeResult, scores: Dict[str, int], feedback: str, retake_after: Optional[date], now: datetime
) -> None:
    missing = [key for key in RUBRIC if key not in scores]
    if missing or any(not 1 <= int(v) <= 5 for v in scores.values()):
        raise RuleViolation("Score every rubric item from 1 to 5.", code="invalid_scores")
    if result != OutcomeResult.PASS and len(feedback.strip()) < 20:
        raise RuleViolation("Give the student at least a sentence of feedback (20+ characters).", code="feedback_required")
    if result == OutcomeResult.RETAKE_LATER:
        today = local_today(now)
        if retake_after is None:
            raise RuleViolation("Pick the date the student can retake from.", code="retake_date_required")
        if not today < retake_after <= today + timedelta(days=settings.max_retake_days):
            raise RuleViolation(
                f"Retake date must be between tomorrow and {settings.max_retake_days} days from now.",
                code="retake_date_invalid",
            )


def _award_badge(db: Session, interview: Interview, now: datetime) -> None:
    existing = db.scalar(
        select(StudentBadge).where(
            StudentBadge.student_id == interview.student_id, StudentBadge.badge_id == interview.badge_id
        )
    )
    if existing:
        existing.status = StudentBadgeStatus.ACTIVE
        existing.interview_id = interview.id
        existing.awarded_at = now
        existing.revoked_at = None
        existing.revoke_reason = None
    else:
        db.add(
            StudentBadge(
                student_id=interview.student_id,
                badge_id=interview.badge_id,
                interview_id=interview.id,
                status=StudentBadgeStatus.ACTIVE,
                awarded_at=now,
            )
        )
