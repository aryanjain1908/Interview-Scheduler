"""Emergency changes: a student reschedules or cancels inside the change window.

The change happens straight away (it's an emergency, and the interviewer's slot is
freed at once). The GRIT team then reviews the reason:
- approved → nothing else changes; no attempt is used
- rejected → the late change counts as one attempt. If that was the student's last
  attempt, any upcoming booking for the badge is cancelled.
"""

import uuid
from datetime import datetime
from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from loguru import logger

from app.core.clock import fmt_datetime
from app.core.errors import NotFound, RuleViolation
from app.models import (
    ACTIVE_INTERVIEW_STATUSES,
    ChangeRequest,
    ChangeRequestStatus,
    Interview,
    InterviewStatus,
    JourneyEvent,
    JourneyStatus as S,
    SlotStatus,
    User,
)
from app.services import interview_rules as rules
from app.services import messages
from app.services.booking import ensure_new_time, flush_or_conflict, lock_open_slot, move_interview, student_interview
from app.services.locks import lock_journey
from app.services.notifications import notify, notify_team_leads
from app.services.state_machine import transition

MIN_REASON = 20


def emergency_change(
    db: Session, *, student: User, interview_id: uuid.UUID, reason: str, new_slot_id: Optional[uuid.UUID], now: datetime
) -> ChangeRequest:
    interview = student_interview(db, student, interview_id)
    lock_journey(db, interview.journey_id)  # also refreshes its emergency-change history
    rules.can_request_emergency(interview, now).enforce("emergency_not_allowed")
    reason = (reason or "").strip()
    if len(reason) < MIN_REASON:
        raise RuleViolation(
            f"Tell the team what happened so they can approve it ({MIN_REASON}+ characters).", code="reason_required"
        )
    journey = lock_journey(db, interview.journey_id)
    old_start, old_interviewer_id = interview.start_at, interview.interviewer_id

    request = ChangeRequest(
        interview_id=interview.id,
        journey_id=journey.id,
        student_id=student.id,
        reason=reason[:500],
        attempt_no=interview.attempt_no,
        from_start_at=old_start,
        status=ChangeRequestStatus.PENDING,
        created_at=now,
    )
    if new_slot_id is not None:
        new_slot = lock_open_slot(db, new_slot_id, interview.badge_id, now)
        ensure_new_time(interview, new_slot)
        move_interview(interview, new_slot, release_old=SlotStatus.OPEN)
        request.to_start_at = new_slot.start_at
        transition(
            journey,
            S.BOOKED,
            at=now,
            actor_id=student.id,
            reason=f"Emergency reschedule from {fmt_datetime(old_start)} to {fmt_datetime(new_slot.start_at)} (pending review)",
        )
    else:
        interview.status = InterviewStatus.CANCELLED_STUDENT
        interview.cancelled_at = now
        interview.cancel_reason = "Emergency cancellation by the student"
        interview.slot.status = SlotStatus.OPEN
        journey.reschedules_used = 0
        transition(journey, S.ELIGIBLE, at=now, actor_id=student.id, reason="Emergency cancellation (pending review)")
    db.add(request)

    notify(db, student.id, messages.emergency_change_ack(interview.badge.name, request.to_start_at), at=now)
    notify(db, old_interviewer_id, messages.emergency_change_interviewer(student.name, old_start), at=now)
    notify_team_leads(db, messages.emergency_change_review(student.name, interview.badge.name, old_start, reason), at=now)
    flush_or_conflict(db)
    db.expire(journey, ["change_requests"])
    logger.info("Student {} made an emergency change to interview {} ({})", student.id, interview.id, "moved" if new_slot_id else "cancelled")
    return request


def pending(db: Session) -> List[ChangeRequest]:
    return list(
        db.scalars(
            select(ChangeRequest).where(ChangeRequest.status == ChangeRequestStatus.PENDING).order_by(ChangeRequest.created_at)
        )
    )


def approve(db: Session, *, admin: User, request_id: uuid.UUID, note: str, now: datetime) -> ChangeRequest:
    request = _lock_pending(db, request_id)
    request.status = ChangeRequestStatus.APPROVED
    _resolve(request, admin, note.strip() or "Approved", now)
    notify(db, request.student_id, messages.emergency_approved(request.journey.badge.name), at=now)
    db.flush()
    logger.info("Admin {} approved emergency change {}", admin.id, request.id)
    return request


def reject(db: Session, *, admin: User, request_id: uuid.UUID, note: str, now: datetime) -> ChangeRequest:
    note = (note or "").strip()
    if len(note) < 10:
        raise RuleViolation("Tell the student why it counts as an attempt (10+ characters).", code="reason_required")
    request = _lock_pending(db, request_id)
    request.status = ChangeRequestStatus.REJECTED
    _resolve(request, admin, note, now)

    journey = lock_journey(db, request.journey_id)
    # If that attempt was already counted (the interview went ahead, or the student
    # didn't show), rejecting the change mustn't count it a second time.
    if journey.attempts_used < request.attempt_no:
        journey.attempts_used = min(journey.attempts_used + 1, journey.badge.max_attempts)
    live = db.scalar(
        select(Interview).where(Interview.journey_id == journey.id, Interview.status.in_(ACTIVE_INTERVIEW_STATUSES))
    )
    cancelled = False
    if journey.attempts_left == 0:
        journey.priority_rebook = False
        journey.eligible_again_at = None
        if live is not None and live.status == InterviewStatus.SCHEDULED:
            live.status = InterviewStatus.CANCELLED_STUDENT
            live.cancelled_at = now
            live.cancel_reason = "Cancelled: the emergency change counted as the final attempt"
            live.slot.status = SlotStatus.OPEN
            transition(journey, S.ELIGIBLE, at=now, actor_id=admin.id, reason="Final attempt used by a late change")
            notify(db, live.interviewer_id, messages.emergency_change_interviewer(live.student.name, live.start_at), at=now)
            cancelled = True
    elif live is not None and live.status == InterviewStatus.SCHEDULED:
        live.attempt_no = journey.attempts_used + 1
    # Audit the penalty even when the journey's state doesn't change.
    journey.events.append(
        JourneyEvent(
            from_status=journey.status,
            to_status=journey.status,
            actor_id=admin.id,
            reason=f"Emergency change rejected — counted as an attempt: {note}"[:300],
            created_at=now,
        )
    )
    notify(
        db,
        request.student_id,
        messages.emergency_rejected(journey.badge.name, note, journey.attempts_used, journey.badge.max_attempts, cancelled),
        at=now,
    )
    db.flush()
    logger.info("Admin {} rejected emergency change {}; attempt counted", admin.id, request.id)
    return request


def _lock_pending(db: Session, request_id: uuid.UUID) -> ChangeRequest:
    db.flush()
    request = db.scalars(
        select(ChangeRequest)
        .where(ChangeRequest.id == request_id)
        .with_for_update(of=ChangeRequest)
        .execution_options(populate_existing=True)
    ).one_or_none()
    if request is None:
        raise NotFound("Request not found.")
    if request.status != ChangeRequestStatus.PENDING:
        raise RuleViolation("This request has already been reviewed.", code="already_reviewed")
    return request


def _resolve(request: ChangeRequest, admin: User, note: str, now: datetime) -> None:
    request.resolved_by = admin.id
    request.resolved_at = now
    request.resolution_note = note[:300]
