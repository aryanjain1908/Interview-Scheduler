"""Interview-team tools for an individual student's record.

Skill clears normally arrive from the GRIT contest system; the team can also
record or correct them here. They can also let a student rebook before a
cooldown ends (e.g. a documented emergency on interview day).
"""

import uuid
from datetime import datetime
from typing import List, Tuple

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.errors import NotFound, RuleViolation
from app.models import (
    BadgeSkill,
    InterviewJourney,
    JourneyStatus as S,
    Role,
    Skill,
    StudentSkillClear,
    User,
)
from app.services import messages
from app.services.eligibility import ACTIVE_BOOKING_STATES, COOLDOWN_STATES, ensure_journeys
from app.services.locks import lock_journey
from app.services.notifications import notify
from app.services.state_machine import transition


def list_students(db: Session, *, search: str, limit: int, offset: int) -> Tuple[List[User], int]:
    query = select(User).where(User.role == Role.STUDENT)
    if search.strip():
        term = f"%{search.strip()}%"
        query = query.where(or_(User.name.ilike(term), User.email.ilike(term), User.college.ilike(term)))
    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    students = db.scalars(query.order_by(User.name).limit(limit).offset(offset)).all()
    return list(students), total


def journeys_by_student(db: Session, student_ids: List[uuid.UUID]) -> dict:
    rows = db.scalars(select(InterviewJourney).where(InterviewJourney.student_id.in_(student_ids))).unique()
    grouped: dict = {sid: [] for sid in student_ids}
    for journey in rows:
        grouped[journey.student_id].append(journey)
    for journeys in grouped.values():
        journeys.sort(key=lambda j: j.badge.name)
    return grouped


def get_student(db: Session, student_id: uuid.UUID) -> User:
    student = db.get(User, student_id)
    if student is None or student.role != Role.STUDENT:
        raise NotFound("Student not found.")
    return student


def set_skill_cleared(
    db: Session, *, admin: User, student_id: uuid.UUID, skill_id: uuid.UUID, cleared: bool, now: datetime
) -> None:
    student = get_student(db, student_id)
    if db.get(Skill, skill_id) is None:
        raise NotFound("Skill not found.")
    existing = db.get(StudentSkillClear, (student.id, skill_id))

    if cleared:
        if existing is None:
            db.add(StudentSkillClear(student_id=student.id, skill_id=skill_id, cleared_at=now))
            db.flush()
        ensure_journeys(db, student.id, now)  # may unlock a badge and notify the student
        return

    if existing is None:
        return
    affected = _journeys_needing_skill(db, student.id, skill_id)
    if any(j.status in ACTIVE_BOOKING_STATES for j in affected):
        raise RuleViolation(
            "This student has an interview booked that depends on this skill. Cancel the booking first.",
            code="skill_in_use",
        )
    db.delete(existing)
    db.flush()
    for journey in affected:
        if journey.status == S.ELIGIBLE:
            journey = lock_journey(db, journey.id)
            transition(journey, S.NOT_ELIGIBLE, at=now, actor_id=admin.id, reason="Skill clear corrected by the GRIT team")
            journey.eligible_since = None


def allow_early_rebooking(db: Session, *, admin: User, journey_id: uuid.UUID, reason: str, now: datetime) -> InterviewJourney:
    journey = db.get(InterviewJourney, journey_id)
    if journey is None:
        raise NotFound("Journey not found.")
    journey = lock_journey(db, journey.id)
    if journey.status not in COOLDOWN_STATES:
        raise RuleViolation("Only a student who is waiting after a result can be allowed to rebook early.")
    if journey.attempts_left == 0:
        raise RuleViolation("This student has used every attempt for this badge.")
    if len(reason.strip()) < 10:
        raise RuleViolation("Record why you're allowing this (10+ characters).", code="reason_required")
    journey.eligible_again_at = now
    transition(journey, S.ELIGIBLE, at=now, actor_id=admin.id, reason=f"Early rebooking allowed: {reason.strip()[:200]}")
    notify(db, journey.student_id, messages.rebooking_opened(journey.badge.name), at=now)
    db.flush()
    return journey


def _journeys_needing_skill(db: Session, student_id: uuid.UUID, skill_id: uuid.UUID) -> List[InterviewJourney]:
    badge_ids = select(BadgeSkill.badge_id).where(BadgeSkill.skill_id == skill_id)
    return list(
        db.scalars(
            select(InterviewJourney).where(
                InterviewJourney.student_id == student_id, InterviewJourney.badge_id.in_(badge_ids)
            )
        ).unique()
    )

