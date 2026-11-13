"""Demo data: every journey state, produced by running the real services
with simulated timestamps, so history, notifications and audit events are
all genuine.

    python -m app.seed           # seed if the database is empty
    python -m app.seed --reset   # wipe and reseed
"""

import sys
from datetime import date, datetime, time, timedelta
from typing import Dict, List

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from loguru import logger

from app.core.clock import LOCAL_TZ, local_today, to_local, utcnow
from app.core.config import settings
from app.core.logging import setup_logging
from app.core.security import hash_password
from app.db import Base, SessionLocal, engine
from app.models import (
    AvailabilityWindow,
    Badge,
    BadgeSkill,
    FlagResolution,
    InterviewJourney,
    OutcomeResult,
    Role,
    Skill,
    Slot,
    SlotStatus,
    StudentSkillClear,
    User,
)
from app.services import admin, attendance, availability, booking, change_requests, interviewers, interviews
from app.services.eligibility import ensure_journeys

PASSWORD = "demo1234"

BADGES = [
    (
        "frontend",
        "Frontend Developer",
        "indigo",
        "Build responsive, accessible interfaces with modern JavaScript and React.",
        ["HTML & CSS", "JavaScript Essentials", "Responsive Web Design", "React Fundamentals", "Web APIs & Async JS"],
    ),
    (
        "backend",
        "Backend Developer",
        "emerald",
        "Design APIs, model data and ship secure, reliable services.",
        ["Python Fundamentals", "SQL & Databases", "REST API Design", "Node.js & Express", "Auth & Security"],
    ),
    (
        "data-analyst",
        "Data Analyst",
        "amber",
        "Turn raw data into decisions with SQL, Python and clear visuals.",
        ["Spreadsheets", "SQL & Databases", "Python for Data", "Statistics Basics", "Data Visualization"],
    ),
]

STAFF = [
    ("Ananya Rao", "admin@grit.demo", Role.ADMIN),
    ("Priya Sharma", "priya@grit.demo", Role.INTERVIEWER),
    ("Rahul Verma", "rahul@grit.demo", Role.INTERVIEWER),
    ("Meera Iyer", "meera@grit.demo", Role.INTERVIEWER),
]

# weekday 0 = Monday. Priya covers every day so students always find a slot.
WINDOWS = {
    "priya@grit.demo": [(d, time(10), time(13)) for d in range(7)] + [(d, time(15), time(20)) for d in range(7)],
    "rahul@grit.demo": [(d, time(14), time(18)) for d in range(6)],
    "meera@grit.demo": [(d, time(9), time(12)) for d in (1, 3, 5)] + [(d, time(18), time(21)) for d in range(5)],
}

TRACKS = {
    "priya@grit.demo": ["frontend", "backend", "data-analyst"],
    "rahul@grit.demo": ["backend", "frontend"],
    "meera@grit.demo": ["data-analyst", "backend"],
}

STUDENTS = [
    ("Arjun Reddy", "arjun", "NIAT Hyderabad"),
    ("Sneha Patil", "sneha", "NIAT Pune"),
    ("Kiran Kumar", "kiran", "NIAT Bengaluru"),
    ("Divya Nair", "divya", "NIAT Chennai"),
    ("Rohan Mehta", "rohan", "NIAT Hyderabad"),
    ("Aisha Khan", "aisha", "NIAT Bengaluru"),
    ("Meghana S", "meghana", "NIAT Hyderabad"),
    ("Vikram Singh", "vikram", "NIAT Pune"),
    ("Neha Gupta", "neha", "NIAT Chennai"),
    ("Sai Teja", "sai", "NIAT Hyderabad"),
    ("Farhan Ali", "farhan", "NIAT Bengaluru"),
    ("Tanvi Joshi", "tanvi", "NIAT Pune"),
    ("Pooja Reddy", "pooja", "NIAT Hyderabad"),
    ("Nikhil Das", "nikhil", "NIAT Chennai"),
    ("Ishita Rao", "ishita", "NIAT Pune"),
    ("Aditya Menon", "aditya", "NIAT Bengaluru"),
]

FEEDBACK = {
    "pass": "Clear fundamentals and a structured approach. You explained trade-offs well — great work.",
    "fail": "You struggled with core async concepts and state management. Practise promises, closures and "
    "component state, then rebuild one small project end to end before your next attempt.",
    "retake": "Strong start, but we ran out of time before the API design section. Revise REST conventions "
    "and pagination and come back — you're close.",
}


INTERNAL_NOTES = {
    OutcomeResult.PASS: "Strong hire-level signal. Solved both problems; clean explanation of re-renders.",
    OutcomeResult.FAIL: "Could not explain the event loop; second problem not attempted. Recommend the async module.",
    OutcomeResult.RETAKE_LATER: "Ran out of time — connection dropped for ~8 min. Fair to give a full retake.",
}


class Seeder:
    def __init__(self, db: Session):
        self.db = db
        self.now = utcnow()
        self.today = local_today(self.now)
        self.users: Dict[str, User] = {}
        self.badges: Dict[str, Badge] = {}

    def at(self, days: int, hour: int, minute: int = 0) -> datetime:
        """A wall-clock IST time `days` from today, as UTC."""
        return datetime.combine(self.today + timedelta(days=days), time(hour, minute), tzinfo=LOCAL_TZ).astimezone(
            tz=self.now.tzinfo
        )

    def slot(self, interviewer: str, start: datetime) -> Slot:
        owner = self.users[interviewer]
        existing = self.db.scalar(select(Slot).where(Slot.interviewer_id == owner.id, Slot.start_at == start))
        if existing:
            return existing
        slot = Slot(interviewer_id=owner.id, start_at=start, end_at=start + timedelta(minutes=30), status=SlotStatus.OPEN)
        self.db.add(slot)
        self.db.flush()
        return slot

    def clear_skills(self, student: str, badge: str, at: datetime, upto: int = 99) -> None:
        for bs in self.badges[badge].badge_skills[:upto]:
            exists = self.db.get(StudentSkillClear, (self.users[student].id, bs.skill_id))
            if not exists:
                self.db.add(StudentSkillClear(student_id=self.users[student].id, skill_id=bs.skill_id, cleared_at=at))
        self.db.flush()
        ensure_journeys(self.db, self.users[student].id, at)

    def book(self, student: str, badge: str, interviewer: str, start: datetime, booked_at: datetime):
        slot = self.slot(interviewer, start)
        return booking.book(
            self.db, student=self.users[student], badge_id=self.badges[badge].id, slot_id=slot.id, now=booked_at
        )

    def outcome(self, interview, result: OutcomeResult, feedback: str, scores: List[int], retake_after: date = None):
        return interviews.record_outcome(
            self.db,
            interviewer=self.db.get(User, interview.interviewer_id),
            interview_id=interview.id,
            result=result,
            scores=dict(zip(interviews.RUBRIC, scores)),
            feedback_to_student=feedback,
            internal_notes=INTERNAL_NOTES[result],
            retake_after=retake_after,
            now=interview.start_at + timedelta(minutes=35),
        )

    def run(self) -> None:
        self.catalog()
        self.people()
        self.journeys()
        self.attendance_cases()
        self.change_cases()
        availability.sync_all(self.db, self.now)
        self.db.commit()

    def catalog(self) -> None:
        skills: Dict[str, Skill] = {}
        for slug, name, color, description, skill_names in BADGES:
            badge = Badge(slug=slug, name=name, color=color, description=description, max_attempts=3, interview_minutes=30)
            for position, skill_name in enumerate(skill_names):
                skill = skills.setdefault(skill_name, Skill(name=skill_name))
                badge.badge_skills.append(BadgeSkill(skill=skill, position=position))
            self.db.add(badge)
            self.badges[slug] = badge
        self.db.flush()

    def people(self) -> None:
        password_hash = hash_password(PASSWORD)
        joined = self.now - timedelta(days=60)
        for name, email, role in STAFF:
            self.users[email] = User(name=name, email=email, role=role, password_hash=password_hash, created_at=joined)
        for name, handle, college in STUDENTS:
            self.users[handle] = User(
                name=name, email=f"{handle}@grit.demo", role=Role.STUDENT, college=college,
                password_hash=password_hash, created_at=joined,
            )
        self.db.add_all(self.users.values())
        self.db.flush()
        for email, slugs in TRACKS.items():
            interviewers.set_badges(
                self.db, interviewer_id=self.users[email].id, badge_ids=[self.badges[s].id for s in slugs]
            )
        for email, windows in WINDOWS.items():
            for weekday, start, end in windows:
                self.db.add(
                    AvailabilityWindow(interviewer_id=self.users[email].id, weekday=weekday, start_time=start, end_time=end)
                )
        for _, handle, _ in STUDENTS:
            ensure_journeys(self.db, self.users[handle].id, joined)
        self.db.flush()

    def journeys(self) -> None:
        now, P, R, M = self.now, "priya@grit.demo", "rahul@grit.demo", "meera@grit.demo"
        days = lambda n: now - timedelta(days=n)  # noqa: E731
        base = now.replace(minute=0 if now.minute < 30 else 30, second=0, microsecond=0)

        # Not eligible: partway through the skills.
        self.clear_skills("arjun", "frontend", days(20), upto=3)
        self.clear_skills("arjun", "backend", days(15), upto=1)

        # Eligible, not booked (the team's follow-up list).
        self.clear_skills("sneha", "frontend", days(6))
        self.clear_skills("divya", "data-analyst", days(10))
        admin.nudge(self.db, journey_ids=[self._journey("divya", "data-analyst").id], now=days(1))

        # Interviewer cancelled -> back to eligible with priority.
        self.clear_skills("kiran", "backend", days(5))
        iv = self.book("kiran", "backend", R, self.at(1, 15), booked_at=days(4))
        availability.set_slot_blocked(
            self.db, interviewer=self.users[R], slot_id=iv.slot_id, blocked=True, reason="Interviewer unwell", now=days(1)
        )

        # Booked, upcoming tomorrow.
        self.clear_skills("rohan", "frontend", days(4))
        self.book("rohan", "frontend", R, self.at(1, 16, 30), booked_at=days(1))

        # Today on Priya's schedule: one done, one happening now (it's marked missed
        # 15 min after its slot if nobody acts — reseed to get a fresh one), one later.
        self.clear_skills("vikram", "frontend", days(9))
        self.clear_skills("vikram", "backend", days(3), upto=4)
        done = self.book("vikram", "frontend", P, base - timedelta(hours=2), booked_at=days(5))
        self.outcome(done, OutcomeResult.PASS, FEEDBACK["pass"], [5, 4, 5])

        self.clear_skills("aisha", "backend", days(6))
        self.book("aisha", "backend", P, base, booked_at=days(3))

        self.clear_skills("meghana", "data-analyst", days(5))
        self.book("meghana", "data-analyst", P, base + timedelta(hours=2), booked_at=days(2))

        # Failed: first attempt used, cooling down.
        self.clear_skills("neha", "frontend", days(12))
        failed = self.book("neha", "frontend", R, self.at(-4, 14), booked_at=days(8))
        self.outcome(failed, OutcomeResult.FAIL, FEEDBACK["fail"], [2, 2, 3])

        # Retake later: doesn't count against attempts.
        self.clear_skills("sai", "backend", days(9))
        retake = self.book("sai", "backend", M, self.at(-2, 10), booked_at=days(6))
        self.outcome(retake, OutcomeResult.RETAKE_LATER, FEEDBACK["retake"], [4, 3, 3], self.today + timedelta(days=8))

        # No-show yesterday.
        self.clear_skills("farhan", "data-analyst", days(7))
        missed = self.book("farhan", "data-analyst", M, self.at(-1, 18), booked_at=days(4))
        interviews.mark_no_show(
            self.db, interviewer=self.users[M], interview_id=missed.id,
            note="Waited 15 minutes in the meeting and messaged the student; they never joined.",
            now=missed.start_at + timedelta(minutes=16),
        )
        # ...and the student disputes it: it waits in the team's Disputed queue.
        attendance.dispute_no_show(
            self.db, student=self.users["farhan"], interview_id=missed.id,
            reason="I joined at 6:02 PM and waited in the lobby until 6:25 PM, but nobody let me in.",
            now=missed.end_at + timedelta(hours=1),
        )

        # Passed weeks ago, badge later revoked for malpractice.
        self.clear_skills("tanvi", "frontend", days(30))
        old = self.book("tanvi", "frontend", P, self.at(-20, 11), booked_at=days(25))
        self.outcome(old, OutcomeResult.PASS, FEEDBACK["pass"], [5, 5, 4])
        flag = admin.raise_flag(
            self.db, reporter=self.users["admin@grit.demo"], student_id=self.users["tanvi"].id,
            badge_id=self.badges["frontend"].id,
            reason="Proctoring review found a second person prompting answers off-camera during the interview.",
            evidence_url=None, now=days(6),
        )
        admin.resolve_flag(self.db, admin=self.users["admin@grit.demo"], flag_id=flag.id, resolution=FlagResolution.UPHELD, now=days(5))

    def attendance_cases(self) -> None:
        now, R, M = self.now, "rahul@grit.demo", "meera@grit.demo"
        # Interviewer never joined; the student reported it 15 minutes in.
        self.clear_skills("nikhil", "data-analyst", now - timedelta(days=6))
        absent = self.book("nikhil", "data-analyst", M, self.at(-2, 19), booked_at=now - timedelta(days=5))
        attendance.report_interviewer_absent(
            self.db, student=self.users["nikhil"], interview_id=absent.id, now=absent.start_at + timedelta(minutes=15)
        )
        # Neither side turned up; the scheduler marked it missed after the slot.
        self.clear_skills("pooja", "backend", now - timedelta(days=7))
        missed = self.book("pooja", "backend", R, self.at(-1, 15), booked_at=now - timedelta(days=4))
        attendance.close_missed(self.db, missed.end_at + timedelta(minutes=20))

    def change_cases(self) -> None:
        now, P, R = self.now, "priya@grit.demo", "rahul@grit.demo"
        base = now.replace(minute=0 if now.minute < 30 else 30, second=0, microsecond=0)
        # Emergency inside the 12h window: moved to a new time, waiting for the team's review.
        self.clear_skills("ishita", "frontend", now - timedelta(days=5))
        iv = self.book("ishita", "frontend", P, self._within_change_cutoff(base), booked_at=now - timedelta(days=3))
        change_requests.emergency_change(
            self.db, student=self.users["ishita"], interview_id=iv.id,
            reason="My father was admitted to hospital this morning and I have to be with him today.",
            new_slot_id=self.slot(P, self.at(3, 11)).id, now=now,
        )
        # The interviewer moved this one, with a reason; the student may now change it freely.
        self.clear_skills("aditya", "backend", now - timedelta(days=6))
        moved = self.book("aditya", "backend", R, self.at(2, 10), booked_at=now - timedelta(days=2))
        interviews.reschedule(
            self.db, interviewer=self.users[R], interview_id=moved.id, new_slot_id=self.slot(R, self.at(3, 15)).id,
            reason="I'm travelling for a campus drive that morning and won't have a stable connection.",
            now=now - timedelta(hours=1),
        )

    def _within_change_cutoff(self, base: datetime) -> datetime:
        """A daytime slot that's 1–12h away, so only an emergency change is possible."""
        tomorrow_nine = self.at(1, 9)
        today_nine = self.at(0, 9)
        candidates = [base + timedelta(hours=h) for h in (3, 2, 4, 1)] + [today_nine, tomorrow_nine]
        for start in candidates:
            ahead = start - self.now
            if timedelta(hours=1) <= ahead < timedelta(hours=settings.change_cutoff_hours) and 8 <= to_local(start).hour < 21:
                return start
        return base + timedelta(hours=3)

    def _journey(self, student: str, badge: str) -> InterviewJourney:
        return self.db.scalar(
            select(InterviewJourney).where(
                InterviewJourney.student_id == self.users[student].id, InterviewJourney.badge_id == self.badges[badge].id
            )
        )


def main() -> None:
    setup_logging()
    reset = "--reset" in sys.argv
    if reset:
        Base.metadata.drop_all(engine)
        Base.metadata.create_all(engine)
    with SessionLocal() as db:
        if db.scalar(select(func.count()).select_from(User)):
            logger.info("Database already has data; skipping seed (use --reset to start over)")
            return
        Seeder(db).run()
    logger.info("Seeded demo data. Every account uses the password '{}'", PASSWORD)


if __name__ == "__main__":
    main()
