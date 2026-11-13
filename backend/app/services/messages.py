"""Every student-facing message in the interview flow, in one place.

The three headline messages from the write-up are `booking_confirmed`,
`passed` and `retake_suggested`. Title + body together read as the exact copy.
"""

from dataclasses import dataclass
from datetime import date, datetime

from app.core.clock import fmt_date, fmt_datetime
from app.core.config import settings


def _q(text: str) -> str:
    """Quote someone's free-text reason without doubling the full stop: “I'm unwell”."""
    return "“" + text.strip().rstrip(".") + "”"


@dataclass(frozen=True)
class Message:
    kind: str
    title: str
    body: str
    tone: str = "info"  # info | success | warning | danger


def booking_confirmed(badge: str, start_at: datetime, interviewer: str) -> Message:
    return Message(
        "booking_confirmed",
        "You're booked!",
        f"Your {badge} badge interview is on {fmt_datetime(start_at)} with {interviewer}. "
        f"Join from your dashboard 5 minutes early. Need to change it? You can reschedule "
        f"or cancel up to {settings.change_cutoff_hours} hours before.",
        "info",
    )


def passed(badge: str) -> Message:
    return Message(
        "passed",
        "Congratulations — you passed!",
        f"Your {badge} Track Badge is now live on your GRIT profile. "
        "Your interviewer's feedback is on your dashboard.",
        "success",
    )


def retake_suggested(badge: str, retake_from: date) -> Message:
    return Message(
        "retake_suggested",
        "You're almost there.",
        f"Your interviewer suggested a retake for the {badge} badge. Review the feedback on "
        f"your dashboard — you can book your next interview from {fmt_date(retake_from)}. "
        "This won't count against you.",
        "warning",
    )


def failed(badge: str, attempts_used: int, max_attempts: int, retry_from: "datetime | None") -> Message:
    if retry_from is None:
        return Message(
            "failed",
            "Not this time.",
            f"You didn't clear the {badge} badge interview, and you've used all {max_attempts} "
            "attempts this season. Your interviewer's feedback is on your dashboard. Reach out "
            "to the GRIT team if you think something went wrong.",
            "danger",
        )
    return Message(
        "failed",
        "Not this time — keep going.",
        f"You didn't clear the {badge} badge interview. Your interviewer's feedback is on your "
        f"dashboard. You can book attempt {attempts_used + 1} of {max_attempts} from "
        f"{fmt_date(retry_from)}.",
        "danger",
    )


def no_show(badge: str, start_at: datetime, attempts_used: int, max_attempts: int, retry_from: datetime) -> Message:
    return Message(
        "no_show",
        "We missed you.",
        f"You didn't join your {badge} badge interview on {fmt_datetime(start_at)}. This counts "
        f"as attempt {attempts_used} of {max_attempts}. You can book a new slot from "
        f"{fmt_date(retry_from)}. If you were in the meeting, you can dispute this from your dashboard "
        f"within {settings.dispute_window_hours} hours.",
        "warning",
    )


def became_eligible(badge: str) -> Message:
    return Message(
        "eligible",
        f"You're eligible for the {badge} interview",
        f"You've cleared every skill for the {badge} Track Badge. "
        "Book your live interview slot from your dashboard.",
        "info",
    )


def rescheduled(badge: str, start_at: datetime, interviewer: str) -> Message:
    return Message(
        "rescheduled",
        "Interview rescheduled",
        f"Your {badge} badge interview is now on {fmt_datetime(start_at)} with {interviewer}.",
    )


def cancelled_by_student(badge: str, start_at: datetime) -> Message:
    return Message(
        "cancelled",
        "Interview cancelled",
        f"Your {badge} badge interview on {fmt_datetime(start_at)} is cancelled. "
        "You can book a new slot from your dashboard whenever you're ready.",
    )


def cancelled_by_interviewer(badge: str, start_at: datetime, reason: str = "") -> Message:
    why = f" Their reason: {_q(reason)}." if reason.strip() else ""
    return Message(
        "cancelled_by_interviewer",
        "Your interview needs a new time",
        f"Sorry — your interviewer can't make your {badge} badge interview on "
        f"{fmt_datetime(start_at)}.{why} This isn't on you and won't use an attempt. Pick a new slot "
        "from your dashboard; the GRIT team has been told to prioritise you.",
        "warning",
    )


def interviewer_cancelled_staff(interviewer: str, student: str, start_at: datetime, reason: str) -> Message:
    return Message(
        "interviewer_cancelled_staff",
        "An interviewer cancelled an interview",
        f"{interviewer} cancelled {student}'s interview on {fmt_datetime(start_at)}: {_q(reason)}. "
        "The student was prioritised to rebook and keeps their attempt.",
        "warning",
    )


def interviewer_rescheduled(badge: str, old: datetime, new: datetime, interviewer: str, reason: str) -> Message:
    return Message(
        "interviewer_rescheduled",
        "Your interviewer moved your interview",
        f"{interviewer} moved your {badge} badge interview from {fmt_datetime(old)} to {fmt_datetime(new)}: "
        f"{_q(reason)}. If the new time doesn't work for you, reschedule or cancel it from your "
        "dashboard — it's free and won't count against you.",
        "warning",
    )


def interviewer_rescheduled_staff(interviewer: str, student: str, old: datetime, new: datetime, reason: str) -> Message:
    return Message(
        "interviewer_rescheduled_staff",
        "An interviewer moved an interview",
        f"{interviewer} moved {student}'s interview from {fmt_datetime(old)} to {fmt_datetime(new)}: "
        f"{_q(reason)}.",
        "info",
    )


def emergency_change_ack(badge: str, new_start: "datetime | None") -> Message:
    what = (
        f"Your {badge} badge interview is now on {fmt_datetime(new_start)}."
        if new_start
        else f"Your {badge} badge interview is cancelled; book a new slot whenever you're ready."
    )
    return Message(
        "emergency_change",
        "Emergency change made — under review",
        f"{what} Because it was within {settings.change_cutoff_hours} hours of the interview, the GRIT team will "
        "review your reason. If it's approved, no attempt is used; if not, it counts as one attempt.",
        "warning",
    )


def emergency_change_interviewer(student: str, start_at: datetime) -> Message:
    return Message(
        "emergency_change_interviewer",
        "A student made an emergency change",
        f"{student} won't attend the interview on {fmt_datetime(start_at)} because of an emergency. "
        "It's off your schedule and the slot is open again.",
        "info",
    )


def emergency_change_review(student: str, badge: str, start_at: datetime, reason: str) -> Message:
    return Message(
        "emergency_change_review",
        "Emergency change to review",
        f"{student} changed their {badge} interview on {fmt_datetime(start_at)} at short notice: "
        f"{_q(reason)}. Approve it (no attempt used) or reject it (counts as an attempt) under "
        "Interviews → Emergency changes.",
        "warning",
    )


def emergency_approved(badge: str) -> Message:
    return Message(
        "emergency_approved",
        "Your emergency change was approved",
        f"The GRIT team approved your emergency change to the {badge} badge interview. It doesn't use an attempt.",
        "success",
    )


def emergency_rejected(badge: str, note: str, attempts_used: int, max_attempts: int, cancelled: bool) -> Message:
    tail = (
        " That was your last attempt for this season, so your upcoming booking has been cancelled."
        if cancelled
        else (
            f" You've used {attempts_used} of {max_attempts} attempts."
            if attempts_used < max_attempts
            else f" You've used all {max_attempts} attempts for this season."
        )
    )
    return Message(
        "emergency_rejected",
        "Your emergency change wasn't approved",
        f"The GRIT team reviewed your late change to the {badge} badge interview and it counts as an attempt: "
        f"{_q(note)}.{tail}",
        "danger",
    )


def nudge(badge: str) -> Message:
    return Message(
        "nudge",
        f"Your {badge} interview is waiting",
        f"You're eligible for the {badge} badge interview but haven't booked yet. "
        "Slots fill up quickly — pick one from your dashboard.",
    )


def rebooking_opened(badge: str) -> Message:
    return Message(
        "rebooking_opened",
        "You can book again",
        f"The GRIT team has reopened booking for your {badge} badge interview. "
        "Pick a new slot from your dashboard.",
    )


def badge_revoked(badge: str) -> Message:
    return Message(
        "badge_revoked",
        f"Your {badge} badge has been revoked",
        f"After a review, your {badge} Track Badge has been nullified due to a malpractice "
        "finding. Contact the GRIT team if you'd like to appeal.",
        "danger",
    )


def badge_reinstated(badge: str) -> Message:
    return Message(
        "badge_reinstated",
        f"Your {badge} badge is back",
        f"Your appeal was accepted and your {badge} Track Badge is live on your profile again.",
        "success",
    )


def interviewer_absent_ack(badge: str) -> Message:
    return Message(
        "interviewer_absent",
        "Sorry your interviewer didn't join",
        f"We've closed your {badge} badge interview. It won't use an attempt, and the GRIT team has been told to "
        "prioritise you. Pick a new slot from your dashboard whenever you're ready.",
        "warning",
    )


def interviewer_marked_absent(student: str, start_at: datetime) -> Message:
    return Message(
        "reported_absent",
        "A student reported you didn't join",
        f"{student} reported that you didn't join the interview on {fmt_datetime(start_at)}. The interview was "
        "closed and the student can rebook. Contact the GRIT team if this is wrong.",
        "danger",
    )


def interview_missed(badge: str, start_at: datetime) -> Message:
    return Message(
        "missed",
        "Your interview was missed",
        f"Your {badge} badge interview on {fmt_datetime(start_at)} never started, so we've marked it as missed. "
        "It won't use an attempt — pick a new slot from your dashboard and you'll be first in line.",
        "warning",
    )


def interview_missed_staff(student: str, start_at: datetime, *, started: bool) -> Message:
    detail = (
        "was started but no result was recorded within 24 hours"
        if started
        else "was never started"
    )
    return Message(
        "missed_staff",
        "An interview was marked as missed",
        f"{student}'s interview on {fmt_datetime(start_at)} {detail}, so it was closed as missed. The student can "
        "rebook without using an attempt.",
        "warning",
    )


def no_show_disputed_staff(student: str, start_at: datetime) -> Message:
    return Message(
        "no_show_disputed",
        "A student disputed a no-show",
        f"{student} says they were in the interview on {fmt_datetime(start_at)}. Review it under Interviews → Disputed.",
        "warning",
    )


def no_show_dispute_received(badge: str) -> Message:
    return Message(
        "dispute_received",
        "We've got your dispute",
        f"The GRIT team will review your {badge} badge no-show, usually within a working day. If it's excused, "
        "the attempt is given back.",
        "info",
    )


def dispute_rejected(badge: str, reason: str) -> Message:
    return Message(
        "dispute_rejected",
        "Your no-show dispute wasn't accepted",
        f"The GRIT team reviewed your {badge} badge no-show and it stands: {reason}",
        "danger",
    )


def no_show_excused(badge: str) -> Message:
    return Message(
        "no_show_excused",
        "Your missed interview has been excused",
        f"After a review, the GRIT team has excused your missed {badge} badge interview. The attempt has been "
        "given back — book a new slot from your dashboard.",
        "success",
    )


def reminder_day_before(badge: str, start_at: datetime, interviewer: str) -> Message:
    return Message(
        "reminder_day_before",
        "Your interview is tomorrow",
        f"Your {badge} badge interview is on {fmt_datetime(start_at)} with {interviewer}. Check your camera and "
        "microphone, and join from your dashboard 5 minutes early.",
    )


def reminder_hour_before(badge: str, start_at: datetime, interviewer: str) -> Message:
    return Message(
        "reminder_hour_before",
        "Your interview starts in 1 hour",
        f"Your {badge} badge interview with {interviewer} starts at {fmt_datetime(start_at)}. Find a quiet spot "
        "and join from your dashboard 5 minutes early.",
    )


def reminder_hour_before_staff(student: str, badge: str, start_at: datetime) -> Message:
    return Message(
        "reminder_staff",
        "Interview in 1 hour",
        f"{student} · {badge} badge · {fmt_datetime(start_at)}. The join link is on your schedule.",
    )
