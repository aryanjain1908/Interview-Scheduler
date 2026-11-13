import uuid
from collections import Counter
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Dict, List, Optional

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from loguru import logger

from app.core.clock import local_day_bounds, local_today
from app.core.errors import NotFound, RuleViolation
from app.models import (
    ACTIVE_INTERVIEW_STATUSES,
    ChangeRequest,
    ChangeRequestStatus,
    FlagResolution,
    Interview,
    InterviewJourney,
    InterviewStatus,
    JourneyStatus as S,
    MalpracticeFlag,
    OutcomeResult,
    InterviewOutcome,
    Slot,
    SlotStatus,
    StudentBadge,
    StudentBadgeStatus,
    User,
)
from app.services import messages
from app.services.eligibility import COOLDOWN_STATES, sync_journey
from app.services.locks import lock_journey
from app.services.notifications import notify
from app.services.state_machine import transition

READY_STATES = (S.ELIGIBLE, S.BOOKED, S.IN_PROGRESS)
BOOKED_STATES = (S.BOOKED, S.IN_PROGRESS)


def refresh_due_journeys(db: Session, now: datetime) -> None:
    """Reopen any cooldowns that have expired so counts are accurate."""
    due = db.scalars(
        select(InterviewJourney).where(
            InterviewJourney.status.in_(COOLDOWN_STATES), InterviewJourney.eligible_again_at <= now
        )
    ).unique()
    for journey in due:
        sync_journey(db, journey, now)
    db.flush()


@dataclass
class Overview:
    by_status: Dict[str, int]
    eligible_total: int
    booked: int
    not_booked: int
    interviews_today: int
    completed: int
    pass_rate: Optional[float]
    slots_next_7_days: int
    slots_booked_next_7_days: int
    pending_flags: int


def overview(db: Session, now: datetime) -> Overview:
    refresh_due_journeys(db, now)
    by_status = Counter({s.value: 0 for s in S})
    for status, count in db.execute(select(InterviewJourney.status, func.count()).group_by(InterviewJourney.status)):
        by_status[status.value] = count

    results = Counter(
        dict(db.execute(select(InterviewOutcome.result, func.count()).group_by(InterviewOutcome.result)).all())
    )
    completed = sum(results.values())
    week = select(func.count()).select_from(Slot).where(Slot.start_at > now, Slot.start_at < now + timedelta(days=7))
    today_start, today_end = local_day_bounds(local_today(now))
    booked = by_status[S.BOOKED.value] + by_status[S.IN_PROGRESS.value]

    return Overview(
        by_status=dict(by_status),
        eligible_total=booked + by_status[S.ELIGIBLE.value],
        booked=booked,
        not_booked=by_status[S.ELIGIBLE.value],
        interviews_today=db.scalar(
            select(func.count())
            .select_from(Interview)
            .join(Slot, Interview.slot_id == Slot.id)
            .where(
                Slot.start_at >= today_start,
                Slot.start_at < today_end,
                Interview.status.not_in([InterviewStatus.CANCELLED_STUDENT, InterviewStatus.CANCELLED_INTERVIEWER]),
            )
        )
        or 0,
        completed=completed,
        pass_rate=round(results[OutcomeResult.PASS] / completed, 2) if completed else None,
        slots_next_7_days=db.scalar(week.where(Slot.status != SlotStatus.BLOCKED)) or 0,
        slots_booked_next_7_days=db.scalar(week.where(Slot.status == SlotStatus.BOOKED)) or 0,
        pending_flags=db.scalar(
            select(func.count()).select_from(MalpracticeFlag).where(MalpracticeFlag.resolution == FlagResolution.PENDING)
        )
        or 0,
    )


@dataclass
class EligibleRow:
    journey: InterviewJourney
    interview: Optional[Interview]


def eligible_students(
    db: Session, *, booked: Optional[bool], badge_id: Optional[uuid.UUID], search: str, now: datetime
) -> List[EligibleRow]:
    refresh_due_journeys(db, now)
    states = READY_STATES if booked is None else (BOOKED_STATES if booked else (S.ELIGIBLE,))
    query = (
        select(InterviewJourney)
        .join(User, InterviewJourney.student_id == User.id)
        .where(InterviewJourney.status.in_(states))
        .order_by(InterviewJourney.priority_rebook.desc(), InterviewJourney.eligible_since.asc().nulls_last())
    )
    if badge_id:
        query = query.where(InterviewJourney.badge_id == badge_id)
    if search.strip():
        term = f"%{search.strip()}%"
        query = query.where(or_(User.name.ilike(term), User.email.ilike(term), User.college.ilike(term)))
    # A student with no attempts left isn't waiting to book.
    journeys = [j for j in db.scalars(query).unique().all() if not (j.status == S.ELIGIBLE and j.attempts_left == 0)]

    active = {
        iv.journey_id: iv
        for iv in db.scalars(
            select(Interview).where(
                Interview.journey_id.in_([j.id for j in journeys]), Interview.status.in_(ACTIVE_INTERVIEW_STATUSES)
            )
        ).unique()
    }
    return [EligibleRow(journey=j, interview=active.get(j.id)) for j in journeys]


def nudge(db: Session, *, journey_ids: List[uuid.UUID], now: datetime) -> int:
    journeys = db.scalars(
        select(InterviewJourney).where(InterviewJourney.id.in_(journey_ids), InterviewJourney.status == S.ELIGIBLE)
    ).unique().all()
    for journey in journeys:
        journey.last_nudged_at = now
        notify(db, journey.student_id, messages.nudge(journey.badge.name), at=now)
    db.flush()
    logger.info("Sent booking reminders to {} student(s)", len(journeys))
    return len(journeys)


def list_interviews(
    db: Session,
    *,
    status: Optional[InterviewStatus],
    day: Optional[date],
    interviewer_id: Optional[uuid.UUID],
    disputed: bool = False,
    emergency: bool = False,
) -> List[Interview]:
    query = select(Interview).join(Slot, Interview.slot_id == Slot.id).order_by(Slot.start_at.desc())
    if emergency:
        query = query.where(
            select(ChangeRequest.id)
            .where(ChangeRequest.interview_id == Interview.id, ChangeRequest.status == ChangeRequestStatus.PENDING)
            .exists()
        )
    if disputed:
        query = query.where(
            Interview.status == InterviewStatus.NO_SHOW,
            Interview.disputed_at.is_not(None),
            Interview.dispute_resolution.is_(None),
        )
    if status:
        query = query.where(Interview.status == status)
    if day:
        start, end = local_day_bounds(day)
        query = query.where(Slot.start_at >= start, Slot.start_at < end)
    if interviewer_id:
        query = query.where(Interview.interviewer_id == interviewer_id)
    return list(db.scalars(query.limit(300)).unique())


def badge_holders(db: Session) -> List[StudentBadge]:
    return list(db.scalars(select(StudentBadge).order_by(StudentBadge.awarded_at.desc())).unique())


def list_flags(db: Session) -> List[MalpracticeFlag]:
    return list(db.scalars(select(MalpracticeFlag).order_by(MalpracticeFlag.created_at.desc())).unique())


def raise_flag(
    db: Session,
    *,
    reporter: User,
    student_id: uuid.UUID,
    badge_id: uuid.UUID,
    reason: str,
    evidence_url: Optional[str],
    now: datetime,
) -> MalpracticeFlag:
    held = _student_badge(db, student_id, badge_id)
    if held is None:
        raise RuleViolation("Flags can only be raised against a badge the student has earned.")
    if len(reason.strip()) < 10:
        raise RuleViolation("Describe what happened (10+ characters).")
    open_flag = db.scalar(
        select(MalpracticeFlag).where(
            MalpracticeFlag.student_id == student_id,
            MalpracticeFlag.badge_id == badge_id,
            MalpracticeFlag.resolution == FlagResolution.PENDING,
        )
    )
    if open_flag:
        raise RuleViolation("There's already an open flag for this badge.", code="flag_exists")
    flag = MalpracticeFlag(
        student_id=student_id,
        badge_id=badge_id,
        reason=reason.strip(),
        evidence_url=evidence_url or None,
        flagged_by=reporter.id,
        created_at=now,
    )
    db.add(flag)
    db.flush()
    return flag


def resolve_flag(db: Session, *, admin: User, flag_id: uuid.UUID, resolution: FlagResolution, now: datetime) -> MalpracticeFlag:
    flag = db.get(MalpracticeFlag, flag_id)
    if flag is None:
        raise NotFound("Flag not found.")
    if resolution == FlagResolution.PENDING or resolution == flag.resolution:
        raise RuleViolation("Choose a different resolution.")
    if flag.resolution == FlagResolution.DISMISSED:
        raise RuleViolation("A dismissed flag is closed. Raise a new one if there's new evidence.")

    journey = lock_journey(db, _journey_id(db, flag.student_id, flag.badge_id))
    held = _student_badge(db, flag.student_id, flag.badge_id)

    if resolution == FlagResolution.UPHELD:
        transition(journey, S.BADGE_REVOKED, at=now, actor_id=admin.id, reason=f"Malpractice upheld: {flag.reason[:200]}")
        held.status = StudentBadgeStatus.REVOKED
        held.revoked_at = now
        held.revoke_reason = flag.reason
        notify(db, flag.student_id, messages.badge_revoked(flag.badge.name), at=now)
    else:  # dismissing a previously upheld flag = appeal accepted
        if flag.resolution == FlagResolution.UPHELD:
            transition(journey, S.PASSED, at=now, actor_id=admin.id, reason="Appeal accepted; badge reinstated")
            held.status = StudentBadgeStatus.ACTIVE
            held.revoked_at = None
            held.revoke_reason = None
            notify(db, flag.student_id, messages.badge_reinstated(flag.badge.name), at=now)

    flag.resolution = resolution
    flag.resolved_by = admin.id
    flag.resolved_at = now
    db.flush()
    return flag


def nullify_badge(
    db: Session, *, admin: User, student_badge_id: uuid.UUID, reason: str, evidence_url: Optional[str], now: datetime
) -> MalpracticeFlag:
    """One step for the team: record the finding and revoke the badge immediately."""
    held = db.get(StudentBadge, student_badge_id)
    if held is None:
        raise NotFound("Badge not found.")
    if held.status == StudentBadgeStatus.REVOKED:
        raise RuleViolation("This badge has already been nullified.", code="already_revoked")
    flag = db.scalar(
        select(MalpracticeFlag).where(
            MalpracticeFlag.student_id == held.student_id,
            MalpracticeFlag.badge_id == held.badge_id,
            MalpracticeFlag.resolution == FlagResolution.PENDING,
        )
    ) or raise_flag(
        db, reporter=admin, student_id=held.student_id, badge_id=held.badge_id,
        reason=reason, evidence_url=evidence_url, now=now,
    )
    return resolve_flag(db, admin=admin, flag_id=flag.id, resolution=FlagResolution.UPHELD, now=now)


def report_malpractice(
    db: Session, *, interviewer: User, interview_id: uuid.UUID, reason: str, evidence_url: Optional[str], now: datetime
) -> MalpracticeFlag:
    """An interviewer reports a concern about an interview that awarded a badge; the team decides."""
    interview = db.get(Interview, interview_id)
    if interview is None or interview.interviewer_id != interviewer.id:
        raise NotFound("Interview not found in your schedule.")
    if interview.outcome is None or interview.outcome.result != OutcomeResult.PASS:
        raise RuleViolation("Only an interview that awarded a badge can be reported. Otherwise record a Fail.")
    return raise_flag(
        db, reporter=interviewer, student_id=interview.student_id, badge_id=interview.badge_id,
        reason=reason, evidence_url=evidence_url, now=now,
    )


def _student_badge(db: Session, student_id: uuid.UUID, badge_id: uuid.UUID) -> Optional[StudentBadge]:
    return db.scalar(select(StudentBadge).where(StudentBadge.student_id == student_id, StudentBadge.badge_id == badge_id))


def _journey_id(db: Session, student_id: uuid.UUID, badge_id: uuid.UUID) -> uuid.UUID:
    return db.scalar(
        select(InterviewJourney.id).where(InterviewJourney.student_id == student_id, InterviewJourney.badge_id == badge_id)
    )
