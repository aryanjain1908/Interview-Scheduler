import uuid
from datetime import date, datetime, time
from typing import List, Optional

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    Date,
    ForeignKey,
    Index,
    Integer,
    SmallInteger,
    String,
    Text,
    Time,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.base import timestamp, uuid_pk
from app.models.catalog import Badge
from app.models.enums import ChangeRequestStatus, DisputeResolution, InterviewStatus, OutcomeResult, SlotStatus, str_enum
from app.models.journey import InterviewJourney
from app.models.user import User

_ACTIVE = "status IN ('scheduled', 'in_progress')"


class AvailabilityWindow(Base):
    """An interviewer's rule: a recurring weekday window, or a one-off date. Times are IST."""

    __tablename__ = "availability_windows"
    __table_args__ = (
        # end_time 00:00 means midnight at the end of the day.
        CheckConstraint("start_time < end_time OR end_time = '00:00'", name="ck_window_time_order"),
        CheckConstraint(
            "(weekday IS NULL) <> (specific_date IS NULL)", name="ck_window_weekday_xor_date"
        ),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    interviewer_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    weekday: Mapped[Optional[int]] = mapped_column(SmallInteger)  # 0 = Monday
    specific_date: Mapped[Optional[date]] = mapped_column(Date)
    start_time: Mapped[time] = mapped_column(Time)
    end_time: Mapped[time] = mapped_column(Time)
    created_at: Mapped[datetime] = timestamp()


class Slot(Base):
    """A concrete bookable 30-minute block generated from availability windows."""

    __tablename__ = "slots"
    __table_args__ = (
        UniqueConstraint("interviewer_id", "start_at", name="uq_slot_interviewer_start"),
        Index("ix_slots_start_status", "start_at", "status"),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    interviewer_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    start_at: Mapped[datetime] = timestamp(default=None)
    end_at: Mapped[datetime] = timestamp(default=None)
    status: Mapped[SlotStatus] = mapped_column(str_enum(SlotStatus), default=SlotStatus.OPEN)
    # The interviewer accepted bookings at shorter notice than the usual minimum.
    short_notice: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    created_at: Mapped[datetime] = timestamp()

    interviewer: Mapped[User] = relationship(lazy="joined")


class Interview(Base):
    """One booking. A journey can have many (reschedules keep the row; cancels close it)."""

    __tablename__ = "interviews"
    __table_args__ = (
        # The database itself guarantees a slot is never double-booked and a
        # student never holds two live bookings for the same badge.
        Index("uq_interviews_active_slot", "slot_id", unique=True, postgresql_where=text(_ACTIVE)),
        Index("uq_interviews_active_journey", "journey_id", unique=True, postgresql_where=text(_ACTIVE)),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    journey_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("interview_journeys.id", ondelete="CASCADE"), index=True)
    slot_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("slots.id"))
    student_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    interviewer_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    badge_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("badges.id"))
    attempt_no: Mapped[int] = mapped_column(Integer, default=1)
    status: Mapped[InterviewStatus] = mapped_column(
        str_enum(InterviewStatus), default=InterviewStatus.SCHEDULED, index=True
    )
    meeting_link: Mapped[str] = mapped_column(String(255))
    booked_at: Mapped[datetime] = timestamp()
    started_at: Mapped[Optional[datetime]] = timestamp(nullable=True, default=None)
    cancelled_at: Mapped[Optional[datetime]] = timestamp(nullable=True, default=None)
    cancel_reason: Mapped[Optional[str]] = mapped_column(String(300))
    reminded_day_before_at: Mapped[Optional[datetime]] = timestamp(nullable=True, default=None)
    reminded_hour_before_at: Mapped[Optional[datetime]] = timestamp(nullable=True, default=None)
    no_show_note: Mapped[Optional[str]] = mapped_column(String(300))
    disputed_at: Mapped[Optional[datetime]] = timestamp(nullable=True, default=None)
    dispute_reason: Mapped[Optional[str]] = mapped_column(String(500))
    dispute_resolution: Mapped[Optional[DisputeResolution]] = mapped_column(str_enum(DisputeResolution), nullable=True)
    dispute_resolved_at: Mapped[Optional[datetime]] = timestamp(nullable=True, default=None)
    # Set when the interviewer moved the interview; the student may then change it freely.
    moved_by_interviewer_at: Mapped[Optional[datetime]] = timestamp(nullable=True, default=None)
    move_reason: Mapped[Optional[str]] = mapped_column(String(300))

    journey: Mapped[InterviewJourney] = relationship()
    slot: Mapped[Slot] = relationship(lazy="joined")
    student: Mapped[User] = relationship(foreign_keys=[student_id], lazy="joined")
    interviewer: Mapped[User] = relationship(foreign_keys=[interviewer_id], lazy="joined")
    badge: Mapped[Badge] = relationship(lazy="joined")
    change_requests: Mapped[List["ChangeRequest"]] = relationship(
        back_populates="interview", order_by="ChangeRequest.created_at", lazy="selectin"
    )
    outcome: Mapped[Optional["InterviewOutcome"]] = relationship(
        back_populates="interview", uselist=False, lazy="joined", foreign_keys="InterviewOutcome.interview_id"
    )

    @property
    def start_at(self) -> datetime:
        return self.slot.start_at

    @property
    def end_at(self) -> datetime:
        return self.slot.end_at

    @property
    def student_actions(self) -> dict:
        from app.core.clock import utcnow
        from app.services.interview_rules import student_actions

        return student_actions(self, utcnow())

    @property
    def staff_actions(self) -> dict:
        from app.core.clock import utcnow
        from app.services.interview_rules import interviewer_actions

        return interviewer_actions(self, utcnow())

    @property
    def dispute_deadline(self) -> datetime:
        from app.services.interview_rules import dispute_deadline

        return dispute_deadline(self)


class InterviewOutcome(Base):
    __tablename__ = "interview_outcomes"

    interview_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("interviews.id", ondelete="CASCADE"), primary_key=True)
    result: Mapped[OutcomeResult] = mapped_column(str_enum(OutcomeResult))
    scores: Mapped[dict] = mapped_column(JSON, default=dict)  # rubric name -> 1..5
    feedback_to_student: Mapped[str] = mapped_column(Text, default="")
    internal_notes: Mapped[str] = mapped_column(Text, default="")
    retake_after: Mapped[Optional[date]] = mapped_column(Date)
    recorded_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    recorded_at: Mapped[datetime] = timestamp()

    interview: Mapped[Interview] = relationship(back_populates="outcome", foreign_keys=[interview_id])


class ChangeRequest(Base):
    """A student's emergency reschedule/cancel inside the change window.

    The change happens straight away (it's an emergency); the team then approves it
    (no attempt used) or rejects it (it counts as an attempt).
    """

    __tablename__ = "change_requests"

    id: Mapped[uuid.UUID] = uuid_pk()
    interview_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("interviews.id", ondelete="CASCADE"), index=True)
    journey_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("interview_journeys.id", ondelete="CASCADE"), index=True)
    student_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    reason: Mapped[str] = mapped_column(String(500))
    # The attempt this change was made on; one emergency change per attempt.
    attempt_no: Mapped[int] = mapped_column(Integer)
    from_start_at: Mapped[datetime] = timestamp(default=None)
    # None when the student cancelled without picking a new time.
    to_start_at: Mapped[Optional[datetime]] = timestamp(nullable=True, default=None)
    status: Mapped[ChangeRequestStatus] = mapped_column(
        str_enum(ChangeRequestStatus), default=ChangeRequestStatus.PENDING, index=True
    )
    created_at: Mapped[datetime] = timestamp()
    resolved_by: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    resolved_at: Mapped[Optional[datetime]] = timestamp(nullable=True, default=None)
    resolution_note: Mapped[Optional[str]] = mapped_column(String(300))

    interview: Mapped[Interview] = relationship(back_populates="change_requests")
    journey: Mapped[InterviewJourney] = relationship()
