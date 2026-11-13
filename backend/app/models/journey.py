"""One journey per (student, badge). Its status is the student's interview state."""

import uuid
from datetime import datetime
from typing import List, Optional

from sqlalchemy import Boolean, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.base import timestamp, uuid_pk
from app.models.catalog import Badge
from app.models.enums import JourneyStatus, str_enum
from app.models.user import User


class InterviewJourney(Base):
    __tablename__ = "interview_journeys"
    __table_args__ = (UniqueConstraint("student_id", "badge_id", name="uq_journey_student_badge"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    student_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    badge_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("badges.id", ondelete="CASCADE"), index=True)
    status: Mapped[JourneyStatus] = mapped_column(
        str_enum(JourneyStatus), default=JourneyStatus.NOT_ELIGIBLE, index=True
    )
    # Fails and no-shows use up attempts; "retake later" does not.
    attempts_used: Mapped[int] = mapped_column(Integer, default=0)
    reschedules_used: Mapped[int] = mapped_column(Integer, default=0)
    eligible_since: Mapped[Optional[datetime]] = timestamp(nullable=True, default=None)
    eligible_again_at: Mapped[Optional[datetime]] = timestamp(nullable=True, default=None)
    priority_rebook: Mapped[bool] = mapped_column(Boolean, default=False)
    last_nudged_at: Mapped[Optional[datetime]] = timestamp(nullable=True, default=None)
    created_at: Mapped[datetime] = timestamp()
    updated_at: Mapped[datetime] = timestamp()

    student: Mapped[User] = relationship()
    badge: Mapped[Badge] = relationship(lazy="joined")
    events: Mapped[List["JourneyEvent"]] = relationship(
        back_populates="journey", order_by="JourneyEvent.created_at", cascade="all, delete-orphan"
    )
    # Emergency changes across every booking of this journey (one allowed per attempt).
    change_requests: Mapped[List["ChangeRequest"]] = relationship(  # noqa: F821
        viewonly=True, order_by="ChangeRequest.created_at", lazy="selectin"
    )

    # Every booking made on this journey, oldest first.
    interviews: Mapped[List["Interview"]] = relationship(  # noqa: F821
        viewonly=True, order_by="Interview.booked_at"
    )

    @property
    def attempts_left(self) -> int:
        return max(self.badge.max_attempts - self.attempts_used, 0)


class JourneyEvent(Base):
    """Audit trail: every state change, who made it and why."""

    __tablename__ = "interview_events"

    id: Mapped[uuid.UUID] = uuid_pk()
    journey_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("interview_journeys.id", ondelete="CASCADE"), index=True
    )
    from_status: Mapped[Optional[JourneyStatus]] = mapped_column(str_enum(JourneyStatus), nullable=True)
    to_status: Mapped[JourneyStatus] = mapped_column(str_enum(JourneyStatus))
    actor_id: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    reason: Mapped[str] = mapped_column(String(300), default="")
    created_at: Mapped[datetime] = timestamp()

    journey: Mapped[InterviewJourney] = relationship(back_populates="events")
