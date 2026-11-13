import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.base import timestamp, uuid_pk
from app.models.catalog import Badge
from app.models.enums import FlagResolution, StudentBadgeStatus, str_enum
from app.models.user import User


class StudentBadge(Base):
    __tablename__ = "student_badges"
    __table_args__ = (UniqueConstraint("student_id", "badge_id", name="uq_student_badge"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    student_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    badge_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("badges.id", ondelete="CASCADE"))
    interview_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("interviews.id"))
    status: Mapped[StudentBadgeStatus] = mapped_column(
        str_enum(StudentBadgeStatus), default=StudentBadgeStatus.ACTIVE
    )
    awarded_at: Mapped[datetime] = timestamp()
    revoked_at: Mapped[Optional[datetime]] = timestamp(nullable=True, default=None)
    revoke_reason: Mapped[Optional[str]] = mapped_column(String(300))

    student: Mapped[User] = relationship(lazy="joined")
    badge: Mapped[Badge] = relationship(lazy="joined")


class MalpracticeFlag(Base):
    __tablename__ = "malpractice_flags"

    id: Mapped[uuid.UUID] = uuid_pk()
    student_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    badge_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("badges.id", ondelete="CASCADE"))
    reason: Mapped[str] = mapped_column(Text)
    evidence_url: Mapped[Optional[str]] = mapped_column(String(500))
    resolution: Mapped[FlagResolution] = mapped_column(
        str_enum(FlagResolution), default=FlagResolution.PENDING, index=True
    )
    flagged_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    resolved_by: Mapped[Optional[uuid.UUID]] = mapped_column(ForeignKey("users.id"))
    resolved_at: Mapped[Optional[datetime]] = timestamp(nullable=True, default=None)
    created_at: Mapped[datetime] = timestamp()

    student: Mapped[User] = relationship(foreign_keys=[student_id], lazy="joined")
    badge: Mapped[Badge] = relationship(lazy="joined")
    flagger: Mapped[User] = relationship(foreign_keys=[flagged_by], lazy="joined")
