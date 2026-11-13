"""When each action on a booked interview is allowed — the single source of truth.

Services enforce these; views send them to the UI as `actions` so buttons are
enabled, disabled or explained without the frontend re-implementing the rules.

    start−10m ── start ── start+15m ──────── end ── end+15m
       │ start ───────────────────────────────────────┤
       │          record outcome (from start) ────────┤ (until end+24h once started)
       │                   no-show (not started) ─────┤
       │                   student: interviewer absent┤
                                        end+15m, still not started → missed (auto)

Changing a booking: the student reschedules/cancels freely until 12h before (max 2
reschedules); after that only an *emergency change* (reason + team review) is possible
until the start. If the interviewer moved the interview, the student may change it
freely until the start.
"""

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Dict, Optional

from app.core.clock import fmt_time
from app.core.config import settings
from app.core.errors import RuleViolation
from app.models import ChangeRequestStatus, Interview, InterviewStatus

S = InterviewStatus


@dataclass(frozen=True)
class Action:
    allowed: bool
    reason: Optional[str] = None
    # When a not-yet-allowed action opens up, so the UI can say "Available from 7:45 PM".
    available_at: Optional[datetime] = None

    def enforce(self, code: str = "not_allowed_now") -> None:
        if not self.allowed:
            raise RuleViolation(self.reason or "That isn't possible for this interview.", code=code)

    def as_dict(self) -> dict:
        return {"allowed": self.allowed, "reason": self.reason, "available_at": self.available_at}


OK = Action(True)


def missed_at(iv: Interview) -> datetime:
    """When an interview still not started is closed as missed."""
    return iv.end_at + timedelta(minutes=settings.missed_grace_minutes)


def join_wait_over_at(iv: Interview) -> datetime:
    return iv.start_at + timedelta(minutes=settings.join_wait_minutes)


def _not_yet(what: str, at: datetime) -> Action:
    return Action(False, f"{what} from {fmt_time(at)}.", at)


def can_start(iv: Interview, now: datetime) -> Action:
    if iv.status != S.SCHEDULED:
        return Action(False, "This interview has already started or finished.")
    opens = iv.start_at - timedelta(minutes=settings.early_start_minutes)
    if now < opens:
        return _not_yet("You can start this interview", opens)
    if now > missed_at(iv):
        return Action(False, "This slot is over.")
    return OK


def can_record(iv: Interview, now: datetime) -> Action:
    if iv.status == S.COMPLETED:
        return Action(False, "An outcome has already been recorded for this interview.")
    if iv.status not in (S.SCHEDULED, S.IN_PROGRESS):
        return Action(False, "This interview can't take an outcome.")
    if now < iv.start_at:
        return _not_yet("You can record the outcome", iv.start_at)
    if iv.status == S.SCHEDULED and now > missed_at(iv):
        return Action(False, "This slot is over and the interview was never started.")
    if now > iv.end_at + timedelta(hours=settings.outcome_grace_hours):
        return Action(
            False,
            f"The {settings.outcome_grace_hours}-hour window to record this outcome has closed. Ask the GRIT team to record it.",
        )
    return OK


def can_mark_no_show(iv: Interview, now: datetime) -> Action:
    if iv.status == S.IN_PROGRESS:
        return Action(False, "You started this interview, so the student was there. Record an outcome instead.")
    if iv.status != S.SCHEDULED:
        return Action(False, "Only an upcoming interview can be marked as a no-show.")
    opens = join_wait_over_at(iv)
    if now < opens:
        return Action(
            False,
            f"Give the student {settings.join_wait_minutes} minutes to join. You can mark a no-show from {fmt_time(opens)}.",
            opens,
        )
    if now > missed_at(iv):
        return Action(False, "This slot is over.")
    return OK


def can_report_interviewer_absent(iv: Interview, now: datetime) -> Action:
    if iv.status not in (S.SCHEDULED, S.IN_PROGRESS):
        return Action(False, "This interview has already been closed.")
    opens = join_wait_over_at(iv)
    if now < opens:
        return Action(
            False,
            f"Give your interviewer until {fmt_time(opens)} to join. Interviewers sometimes run a few minutes late.",
            opens,
        )
    closes = missed_at(iv) if iv.status == S.SCHEDULED else iv.end_at + timedelta(hours=settings.outcome_grace_hours)
    if now > closes:
        return Action(False, "It's too late to report this here. Please contact the GRIT team.")
    return OK


def dispute_deadline(iv: Interview) -> datetime:
    return iv.end_at + timedelta(hours=settings.dispute_window_hours)


def can_dispute(iv: Interview, now: datetime) -> Action:
    if iv.status != S.NO_SHOW:
        return Action(False, "Only a no-show can be disputed.")
    if iv.disputed_at is not None:
        return Action(False, "You've already disputed this no-show.")
    if now > dispute_deadline(iv):
        return Action(
            False, f"Disputes close {settings.dispute_window_hours} hours after the interview. Please contact the GRIT team."
        )
    return OK


def _upcoming(iv: Interview, now: datetime) -> Action:
    if iv.status != S.SCHEDULED:
        return Action(False, "Only an upcoming interview can be changed.")
    if now >= iv.start_at:
        return Action(False, "This interview has already started.")
    return OK


def _window_open(iv: Interview, now: datetime) -> bool:
    return iv.start_at - now >= timedelta(hours=settings.change_cutoff_hours)


WINDOW_CLOSED = (
    f"Changes close {settings.change_cutoff_hours} hours before the interview. "
    "If it's an emergency, use Emergency change."
)


def can_reschedule(iv: Interview, now: datetime) -> Action:
    """Student's normal reschedule. Free (any time before the start) if the interviewer moved it."""
    upcoming = _upcoming(iv, now)
    if not upcoming.allowed:
        return upcoming
    if iv.moved_by_interviewer_at is not None:
        return OK
    if not _window_open(iv, now):
        return Action(False, WINDOW_CLOSED)
    if iv.journey.reschedules_used >= settings.max_reschedules:
        return Action(
            False,
            f"You've used all {settings.max_reschedules} reschedules for this attempt. "
            "If it's an emergency, use Emergency change.",
        )
    return OK


def can_cancel(iv: Interview, now: datetime) -> Action:
    upcoming = _upcoming(iv, now)
    if not upcoming.allowed:
        return upcoming
    if iv.moved_by_interviewer_at is None and not _window_open(iv, now):
        return Action(False, WINDOW_CLOSED)
    return OK


def can_request_emergency(iv: Interview, now: datetime) -> Action:
    """Late change with a reason, reviewed by the team. Only when the normal route is closed."""
    upcoming = _upcoming(iv, now)
    if not upcoming.allowed:
        return upcoming
    if can_reschedule(iv, now).allowed:
        return Action(False, "You can still reschedule or cancel this interview normally.")
    requests = iv.journey.change_requests
    if any(r.status == ChangeRequestStatus.PENDING for r in requests):
        return Action(False, "Your last emergency change is still being reviewed by the GRIT team.")
    if any(r.attempt_no == iv.attempt_no for r in requests):
        return Action(False, "You've already made an emergency change for this attempt. Please contact the GRIT team.")
    return OK


def can_interviewer_reschedule(iv: Interview, now: datetime) -> Action:
    return _upcoming(iv, now)


def can_interviewer_cancel(iv: Interview, now: datetime) -> Action:
    if iv.status != S.SCHEDULED:
        return Action(False, "Only an interview that hasn't started can be cancelled.")
    if now >= iv.end_at:
        return Action(False, "This slot is over.")
    return OK


def interviewer_actions(iv: Interview, now: datetime) -> Dict[str, dict]:
    return {
        "start": can_start(iv, now).as_dict(),
        "record": can_record(iv, now).as_dict(),
        "no_show": can_mark_no_show(iv, now).as_dict(),
        "reschedule": can_interviewer_reschedule(iv, now).as_dict(),
        "cancel": can_interviewer_cancel(iv, now).as_dict(),
    }


def student_actions(iv: Interview, now: datetime) -> Dict[str, dict]:
    return {
        "report_interviewer_absent": can_report_interviewer_absent(iv, now).as_dict(),
        "dispute": can_dispute(iv, now).as_dict(),
        "reschedule": can_reschedule(iv, now).as_dict(),
        "cancel": can_cancel(iv, now).as_dict(),
        "emergency_change": can_request_emergency(iv, now).as_dict(),
    }
