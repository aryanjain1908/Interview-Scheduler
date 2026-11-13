"""Who can book what, and when.

There is no background scheduler: cooldowns are stored as `eligible_again_at`
and journeys are re-evaluated lazily whenever they are read or acted on.
"""

import uuid
from datetime import datetime
from typing import List, Optional, Sequence, Tuple

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.clock import fmt_date
from app.models import Badge, InterviewJourney, JourneyEvent, JourneyStatus as S, Skill, StudentSkillClear
from app.services import messages
from app.services.notifications import notify
from app.services.state_machine import transition

COOLDOWN_STATES = frozenset({S.FAILED, S.RETAKE_LATER, S.NO_SHOW})
ACTIVE_BOOKING_STATES = frozenset({S.BOOKED, S.IN_PROGRESS})


def skill_progress(db: Session, student_id: uuid.UUID, badge: Badge) -> List[Tuple[Skill, bool]]:
    cleared = set(db.scalars(select(StudentSkillClear.skill_id).where(StudentSkillClear.student_id == student_id)))
    return [(bs.skill, bs.skill_id in cleared) for bs in badge.badge_skills]


def has_cleared_all_skills(db: Session, student_id: uuid.UUID, badge: Badge) -> bool:
    progress = skill_progress(db, student_id, badge)
    return bool(progress) and all(done for _, done in progress)


def get_or_create_journey(db: Session, student_id: uuid.UUID, badge: Badge, now: datetime) -> InterviewJourney:
    journey = db.scalar(
        select(InterviewJourney).where(
            InterviewJourney.student_id == student_id, InterviewJourney.badge_id == badge.id
        )
    )
    if journey is None:
        journey = InterviewJourney(
            student_id=student_id, badge=badge, status=S.NOT_ELIGIBLE, created_at=now, updated_at=now
        )
        journey.events.append(
            JourneyEvent(from_status=None, to_status=S.NOT_ELIGIBLE, reason="Started working on this badge", created_at=now)
        )
        db.add(journey)
        db.flush()
    return sync_journey(db, journey, now)


def ensure_journeys(db: Session, student_id: uuid.UUID, now: datetime) -> List[InterviewJourney]:
    badges: Sequence[Badge] = db.scalars(select(Badge).order_by(Badge.name)).unique().all()
    return [get_or_create_journey(db, student_id, badge, now) for badge in badges]


def sync_journey(db: Session, journey: InterviewJourney, now: datetime) -> InterviewJourney:
    """Apply any time- or progress-driven transitions that are due."""
    if journey.status == S.NOT_ELIGIBLE and has_cleared_all_skills(db, journey.student_id, journey.badge):
        transition(journey, S.ELIGIBLE, at=now, reason="Cleared every required skill")
        journey.eligible_since = now
        notify(db, journey.student_id, messages.became_eligible(journey.badge.name), at=now)
    elif (
        journey.status in COOLDOWN_STATES
        and journey.attempts_left > 0
        and journey.eligible_again_at is not None
        and now >= journey.eligible_again_at
    ):
        transition(journey, S.ELIGIBLE, at=now, reason="Cooldown ended")
    return journey


def booking_block_reason(journey: InterviewJourney, now: datetime) -> Optional[str]:
    """None if the student may book right now, otherwise a student-readable reason."""
    status = journey.status
    if status == S.ELIGIBLE:
        if journey.attempts_left == 0:  # e.g. a rejected late change used the final attempt
            return f"You've used all {journey.badge.max_attempts} attempts for this badge this season."
        return None
    if status == S.NOT_ELIGIBLE:
        return "Clear every required skill to unlock this interview."
    if status in ACTIVE_BOOKING_STATES:
        return "You already have an interview booked for this badge."
    if status == S.PASSED:
        return "You've already earned this badge."
    if status == S.BADGE_REVOKED:
        return "This badge was revoked after a malpractice review."
    if journey.attempts_left == 0:
        return f"You've used all {journey.badge.max_attempts} attempts for this badge this season."
    if journey.eligible_again_at and now < journey.eligible_again_at:
        return f"You can book your next interview from {fmt_date(journey.eligible_again_at)}."
    return None
