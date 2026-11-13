"""Tests run against a real Postgres database (row locks and partial unique
indexes are part of what we're testing), defaulting to `grit_test`."""

import os

os.environ.setdefault("SCHEDULER_ENABLED", "false")  # tests drive jobs explicitly
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import create_engine, select, text
from sqlalchemy.orm import sessionmaker

from app.core.security import hash_password
from app.db import Base, get_db
from app.models import Badge, BadgeSkill, InterviewerBadge, Role, Skill, Slot, SlotStatus, StudentSkillClear, User

TEST_DB_URL = os.environ.get("TEST_DATABASE_URL", "postgresql+psycopg2://grit:grit@localhost:5432/grit_test")
engine = create_engine(TEST_DB_URL)
TestSession = sessionmaker(bind=engine, expire_on_commit=False)
PASSWORD_HASH = hash_password("secret123")

# A fixed "now" well clear of day boundaries: Wed 12 Nov 2025, 10:00 IST.
NOW = datetime(2025, 11, 12, 4, 30, tzinfo=timezone.utc)
NO_SHOW_NOTE = "Waited 15 minutes in the room; the student never joined."


@pytest.fixture(scope="session", autouse=True)
def schema():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    yield
    Base.metadata.drop_all(engine)


@pytest.fixture(autouse=True)
def clean_tables():
    with engine.begin() as conn:
        names = ", ".join(t.name for t in Base.metadata.sorted_tables)
        conn.execute(text(f"TRUNCATE {names} CASCADE"))
    yield


@pytest.fixture
def db():
    session = TestSession()
    yield session
    session.rollback()
    session.close()


class Factory:
    def __init__(self, db):
        self.db = db
        self._n = 0

    def user(self, role: Role = Role.STUDENT, name: str = None) -> User:
        self._n += 1
        user = User(
            name=name or f"{role.value.title()} {self._n}",
            email=f"{role.value}{self._n}@test.dev",
            password_hash=PASSWORD_HASH,
            role=role,
        )
        self.db.add(user)
        self.db.flush()
        return user

    def badge(self, skills: int = 2, max_attempts: int = 3) -> Badge:
        self._n += 1
        badge = Badge(slug=f"badge-{self._n}", name=f"Badge {self._n}", max_attempts=max_attempts)
        for i in range(skills):
            badge.badge_skills.append(BadgeSkill(skill=Skill(name=f"Skill {self._n}.{i}"), position=i))
        self.db.add(badge)
        self.db.flush()
        return badge

    def clear_all(self, student: User, badge: Badge) -> None:
        for bs in badge.badge_skills:
            self.db.add(StudentSkillClear(student_id=student.id, skill_id=bs.skill_id, cleared_at=NOW))
        self.db.flush()

    def slot(self, interviewer: User, start: datetime, qualify: bool = True) -> Slot:
        if qualify:  # by default the interviewer can take every badge that exists so far
            for badge_id in self.db.scalars(select(Badge.id)):
                if self.db.get(InterviewerBadge, (interviewer.id, badge_id)) is None:
                    self.db.add(InterviewerBadge(interviewer_id=interviewer.id, badge_id=badge_id))
        slot = Slot(interviewer_id=interviewer.id, start_at=start, end_at=start + timedelta(minutes=30), status=SlotStatus.OPEN)
        self.db.add(slot)
        self.db.flush()
        return slot


@pytest.fixture
def make(db):
    return Factory(db)


@pytest.fixture
def client():
    from fastapi.testclient import TestClient

    from app.main import app

    def override():
        session = TestSession()
        try:
            yield session
        finally:
            session.close()

    app.dependency_overrides[get_db] = override
    yield TestClient(app)
    app.dependency_overrides.clear()

