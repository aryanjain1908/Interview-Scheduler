import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import schemas
from app.core.config import settings
from app.core.errors import NotFound
from app.models import (
    ACTIVE_INTERVIEW_STATUSES,
    Interview,
    InterviewJourney,
    InterviewStatus,
    Notification,
    StudentBadge,
    User,
)
from app.models import ChangeRequestStatus
from app.services.booking import can_change
from app.services.eligibility import booking_block_reason, ensure_journeys, skill_progress

# Interviews that closed for a reason the student should see (result, no-show, or
# why they were prioritised). A booking the student cancelled themselves isn't one.
FINISHED = (
    InterviewStatus.COMPLETED,
    InterviewStatus.NO_SHOW,
    InterviewStatus.EXCUSED,
    InterviewStatus.MISSED,
    InterviewStatus.INTERVIEWER_ABSENT,
    InterviewStatus.CANCELLED_INTERVIEWER,
)


def dashboard(db: Session, student: User, now: datetime) -> schemas.DashboardOut:
    journeys = ensure_journeys(db, student.id, now)
    notifications = db.scalars(
        select(Notification).where(Notification.user_id == student.id).order_by(Notification.created_at.desc()).limit(20)
    ).all()
    unread = db.scalar(
        select(func.count()).select_from(Notification).where(Notification.user_id == student.id, Notification.read_at.is_(None))
    )
    return schemas.DashboardOut(
        student=schemas.UserOut.model_validate(student),
        journeys=[journey_view(db, j, now) for j in journeys],
        notifications=[schemas.NotificationOut.model_validate(n) for n in notifications],
        unread_count=unread or 0,
        server_time=now,
    )


def interview_detail(db: Session, student: User, interview_id: uuid.UUID, now: datetime) -> schemas.InterviewDetailOut:
    interview = db.get(Interview, interview_id)
    if interview is None or interview.student_id != student.id:
        raise NotFound("Interview not found.")
    return schemas.InterviewDetailOut(
        interview=schemas.InterviewOut.model_validate(interview),
        changeable=can_change(interview, now),
        events=[schemas.EventOut.model_validate(e) for e in reversed(interview.journey.events)],
    )


def journey_view(db: Session, journey: InterviewJourney, now: datetime) -> schemas.BadgeJourneyOut:
    current = _latest_interview(db, journey.id, ACTIVE_INTERVIEW_STATUSES)
    last = _latest_interview(db, journey.id, FINISHED)
    earned = db.scalar(
        select(StudentBadge).where(StudentBadge.student_id == journey.student_id, StudentBadge.badge_id == journey.badge_id)
    )
    block_reason = booking_block_reason(journey, now)
    return schemas.BadgeJourneyOut(
        badge=schemas.BadgeOut.model_validate(journey.badge),
        skills=[
            schemas.SkillProgressOut(id=skill.id, name=skill.name, cleared=done)
            for skill, done in skill_progress(db, journey.student_id, journey.badge)
        ],
        journey=schemas.JourneyOut.model_validate(journey),
        can_book=block_reason is None,
        block_reason=block_reason,
        reschedules_left=max(settings.max_reschedules - journey.reschedules_used, 0),
        current_interview=schemas.InterviewOut.model_validate(current) if current else None,
        current_interview_changeable=bool(current and can_change(current, now)),
        last_interview=schemas.InterviewOut.model_validate(last) if last else None,
        pending_change=next(
            (
                schemas.ChangeRequestOut.model_validate(r)
                for r in reversed(journey.change_requests)
                if r.status == ChangeRequestStatus.PENDING
            ),
            None,
        ),
        earned=schemas.StudentBadgeOut.model_validate(earned) if earned else None,
    )


def _latest_interview(db: Session, journey_id: uuid.UUID, statuses) -> Optional[Interview]:
    return db.scalars(
        select(Interview)
        .where(Interview.journey_id == journey_id, Interview.status.in_(statuses))
        .order_by(Interview.booked_at.desc())
        .limit(1)
    ).unique().first()
