from datetime import timedelta

import pytest

from app.core.errors import RuleViolation
from app.models import InterviewStatus, JourneyStatus as S, Notification, OutcomeResult, Role
from app.services import attendance, booking, interviews, reminders
from tests.conftest import NO_SHOW_NOTE, NOW


@pytest.fixture
def booked(db, make):
    student, interviewer, badge = make.user(), make.user(Role.INTERVIEWER), make.badge()
    make.clear_all(student, badge)
    slot = make.slot(interviewer, NOW + timedelta(days=2))
    interview = booking.book(db, student=student, badge_id=badge.id, slot_id=slot.id, now=NOW)
    return student, interviewer, interview


def _kinds(db, user_id):
    return [n.kind for n in db.query(Notification).filter(Notification.user_id == user_id)]


def test_student_must_wait_15_minutes_before_reporting_interviewer_absent(db, booked):
    student, _, interview = booked
    with pytest.raises(RuleViolation, match="Give your interviewer until"):
        attendance.report_interviewer_absent(
            db, student=student, interview_id=interview.id, now=interview.start_at + timedelta(minutes=12)
        )


def test_interviewer_absent_costs_no_attempt_and_prioritises(db, booked):
    student, interviewer, interview = booked
    attendance.report_interviewer_absent(
        db, student=student, interview_id=interview.id, now=interview.start_at + timedelta(minutes=16)
    )
    journey = interview.journey
    assert interview.status == InterviewStatus.INTERVIEWER_ABSENT
    assert journey.status == S.ELIGIBLE
    assert journey.attempts_used == 0
    assert journey.priority_rebook is True
    assert "reported_absent" in _kinds(db, interviewer.id)
    # The interviewer can no longer mark the student absent afterwards.
    with pytest.raises(RuleViolation):
        interviews.mark_no_show(
            db, interviewer=interviewer, interview_id=interview.id, note=NO_SHOW_NOTE, now=interview.end_at
        )


def test_cannot_report_absent_once_a_result_is_recorded(db, booked):
    student, interviewer, interview = booked
    interviews.record_outcome(
        db,
        interviewer=interviewer,
        interview_id=interview.id,
        result=OutcomeResult.PASS,
        scores={"fundamentals": 4, "problem_solving": 4, "communication": 4},
        feedback_to_student="",
        internal_notes="",
        retake_after=None,
        now=interview.start_at + timedelta(minutes=30),
    )
    with pytest.raises(RuleViolation, match="already been closed"):
        attendance.report_interviewer_absent(db, student=student, interview_id=interview.id, now=interview.end_at)


def test_untouched_interview_is_marked_missed_after_the_slot(db, make, booked):
    student, interviewer, interview = booked
    lead = make.user(Role.ADMIN)
    assert attendance.close_missed(db, interview.end_at + timedelta(minutes=10)) == []
    assert attendance.close_missed(db, interview.end_at + timedelta(minutes=16)) == [interview]
    assert interview.status == InterviewStatus.MISSED
    assert interview.journey.status == S.ELIGIBLE
    assert interview.journey.attempts_used == 0
    assert interview.journey.priority_rebook is True
    assert "missed" in _kinds(db, student.id)
    assert "missed_staff" in _kinds(db, interviewer.id)
    assert "missed_staff" in _kinds(db, lead.id)


def test_started_but_unrecorded_interview_is_missed_after_grace(db, booked):
    _, interviewer, interview = booked
    interviews.start(db, interviewer=interviewer, interview_id=interview.id, now=interview.start_at)
    assert attendance.close_missed(db, interview.end_at + timedelta(hours=3)) == []
    assert attendance.close_missed(db, interview.end_at + timedelta(hours=25)) == [interview]
    assert interview.status == InterviewStatus.MISSED
    assert interview.journey.status == S.ELIGIBLE


def test_team_can_excuse_a_no_show(db, make, booked):
    student, interviewer, interview = booked
    interviews.mark_no_show(
        db, interviewer=interviewer, interview_id=interview.id, note=NO_SHOW_NOTE, now=interview.start_at + timedelta(minutes=15)
    )
    assert interview.journey.attempts_used == 1
    lead = make.user(Role.ADMIN)
    with pytest.raises(RuleViolation, match="why"):
        attendance.excuse_no_show(db, admin=lead, interview_id=interview.id, reason="ok", now=NOW + timedelta(days=3))
    attendance.excuse_no_show(
        db, admin=lead, interview_id=interview.id, reason="Meeting link was broken", now=NOW + timedelta(days=3)
    )
    assert interview.status == InterviewStatus.EXCUSED
    assert interview.journey.status == S.ELIGIBLE
    assert interview.journey.attempts_used == 0
    assert "no_show_excused" in _kinds(db, student.id)


def test_reminders_fire_once_at_24h_and_1h(db, booked):
    student, interviewer, interview = booked
    start = interview.start_at
    assert reminders.send_due(db, start - timedelta(hours=30)) == 0
    assert reminders.send_due(db, start - timedelta(hours=23)) == 1
    assert reminders.send_due(db, start - timedelta(hours=22)) == 0  # never twice
    assert reminders.send_due(db, start - timedelta(minutes=50)) == 2  # student + interviewer
    assert reminders.send_due(db, start - timedelta(minutes=10)) == 0
    assert _kinds(db, student.id).count("reminder_day_before") == 1
    assert _kinds(db, student.id).count("reminder_hour_before") == 1
    assert _kinds(db, interviewer.id).count("reminder_staff") == 1


def test_late_booking_skips_day_before_reminder(db, make):
    student, interviewer, badge = make.user(), make.user(Role.INTERVIEWER), make.badge()
    make.clear_all(student, badge)
    slot = make.slot(interviewer, NOW + timedelta(hours=5))
    booking.book(db, student=student, badge_id=badge.id, slot_id=slot.id, now=NOW)
    reminders.send_due(db, NOW + timedelta(minutes=1))
    assert "reminder_day_before" not in _kinds(db, student.id)


def test_reschedule_resets_reminders(db, make, booked):
    student, interviewer, interview = booked
    reminders.send_due(db, interview.start_at - timedelta(hours=20))
    assert interview.reminded_day_before_at is not None
    new_slot = make.slot(interviewer, NOW + timedelta(days=5))
    booking.reschedule(db, student=student, interview_id=interview.id, new_slot_id=new_slot.id, now=NOW)
    assert interview.reminded_day_before_at is None
