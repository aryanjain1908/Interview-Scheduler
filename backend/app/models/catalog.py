import uuid
from datetime import datetime
from typing import List

from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base
from app.models.base import timestamp, uuid_pk


class Badge(Base):
    __tablename__ = "badges"

    id: Mapped[uuid.UUID] = uuid_pk()
    slug: Mapped[str] = mapped_column(String(60), unique=True)
    name: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(Text, default="")
    color: Mapped[str] = mapped_column(String(20), default="indigo")
    max_attempts: Mapped[int] = mapped_column(Integer, default=3)
    interview_minutes: Mapped[int] = mapped_column(Integer, default=30)

    badge_skills: Mapped[List["BadgeSkill"]] = relationship(
        back_populates="badge", order_by="BadgeSkill.position", cascade="all, delete-orphan"
    )


class Skill(Base):
    __tablename__ = "skills"

    id: Mapped[uuid.UUID] = uuid_pk()
    name: Mapped[str] = mapped_column(String(120), unique=True)


class BadgeSkill(Base):
    """A skill can count towards several badges (e.g. SQL for Backend and Data Analyst)."""

    __tablename__ = "badge_skills"

    badge_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("badges.id", ondelete="CASCADE"), primary_key=True)
    skill_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("skills.id", ondelete="CASCADE"), primary_key=True)
    position: Mapped[int] = mapped_column(Integer, default=0)

    badge: Mapped[Badge] = relationship(back_populates="badge_skills")
    skill: Mapped[Skill] = relationship(lazy="joined")


class StudentSkillClear(Base):
    __tablename__ = "student_skill_clears"

    student_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    skill_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("skills.id", ondelete="CASCADE"), primary_key=True)
    cleared_at: Mapped[datetime] = timestamp()


class InterviewerBadge(Base):
    __tablename__ = "interviewer_badges"

    interviewer_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    badge_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("badges.id", ondelete="CASCADE"), primary_key=True)
