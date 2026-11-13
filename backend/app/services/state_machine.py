"""The single writer of InterviewJourney.status.

Every transition is checked against ALLOWED and recorded in interview_events,
so the audit trail and the write-up's state table can never drift apart.
"""

import uuid
from datetime import datetime
from typing import Dict, FrozenSet, Optional

from loguru import logger

from app.core.errors import RuleViolation
from app.models import InterviewJourney, JourneyEvent, JourneyStatus as S

ALLOWED: Dict[S, FrozenSet[S]] = {
    S.NOT_ELIGIBLE: frozenset({S.ELIGIBLE}),
    # ELIGIBLE -> NOT_ELIGIBLE only if the team corrects a wrongly recorded skill clear.
    S.ELIGIBLE: frozenset({S.BOOKED, S.NOT_ELIGIBLE}),
    # BOOKED -> BOOKED is a reschedule.
    S.BOOKED: frozenset({S.BOOKED, S.ELIGIBLE, S.IN_PROGRESS, S.NO_SHOW}),
    # IN_PROGRESS -> ELIGIBLE when the interview never really happened (absent interviewer / missed).
    # No IN_PROGRESS -> NO_SHOW: a started interview means the student was there.
    S.IN_PROGRESS: frozenset({S.PASSED, S.FAILED, S.RETAKE_LATER, S.ELIGIBLE}),
    # Cooldown states reopen once eligible_again_at passes (see eligibility.sync_journey).
    S.FAILED: frozenset({S.ELIGIBLE}),
    S.RETAKE_LATER: frozenset({S.ELIGIBLE}),
    S.NO_SHOW: frozenset({S.ELIGIBLE}),
    S.PASSED: frozenset({S.BADGE_REVOKED}),
    # Reinstated only if an appeal overturns the malpractice finding.
    S.BADGE_REVOKED: frozenset({S.PASSED}),
}


def can_transition(current: S, target: S) -> bool:
    return target in ALLOWED[current]


def transition(
    journey: InterviewJourney,
    target: S,
    *,
    at: datetime,
    actor_id: Optional[uuid.UUID] = None,
    reason: str = "",
) -> None:
    current = journey.status
    if not can_transition(current, target):
        raise RuleViolation(
            f"An interview can't move from '{current.value}' to '{target.value}'.",
            code="invalid_transition",
        )
    journey.events.append(
        JourneyEvent(from_status=current, to_status=target, actor_id=actor_id, reason=reason, created_at=at)
    )
    journey.status = target
    journey.updated_at = at
    logger.debug("Journey {} {} -> {} ({})", journey.id, current.value, target.value, reason or "no reason")
