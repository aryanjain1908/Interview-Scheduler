import threading
from datetime import timedelta

import pytest

from app.core.errors import RuleViolation
from app.models import DisputeResolution, InterviewStatus, JourneyStatus as S, Notification, OutcomeResult, Role, Slot
from app.services import attendance, availability, booking, interview_rules as rules, interviews
from tests.conftest import NO_SHOW_NOTE, NOW, TestSession

SCORES = {"fundamentals": 4, "problem_solving": 4, "communication": 4}


@pytest.fixture
def booked(db, make):
    student, interviewer, badge = make.user(), make.user(Role.INTERVIEWER), make.badge()
    make.clear_all(student, badge)
    slot = make.slot(interviewer, NOW + timedelta(days=2))
    interview = booking.book(db, student=student, badge_id=badge.id, slot_id=slot.id, now=NOW)
    return student, interviewer, interview


def _no_show(db, interviewer, interview, minutes=16, note=NO_SHOW_NOTE):
    return interviews.mark_no_show(
        db, interviewer=interviewer, interview_id=interview.id, note=note, now=interview.start_at + timedelta(minutes=minutes)
    )


def _pass(db, interviewer, interview, now):
    return interviews.record_outcome(
        db,
        interviewer=interviewer,
        interview_id=interview.id,
        result=OutcomeResult.PASS,
        scores=SCORES,
        feedback_to_student="",
        internal_notes="",
        retake_after=None,
        now=now,
    )


def test_no_show_only_after_the_15_minute_wait(db, booked):
    _, interviewer, interview = booked
    with pytest.raises(RuleViolation, match="Give the student 15 minutes"):
        _no_show(db, interviewer, interview, minutes=-60)  # before the interview even starts
    with pytest.raises(RuleViolation, match="Give the student 15 minutes"):
        _no_show(db, interviewer, interview, minutes=14)
    _no_show(db, interviewer, interview, minutes=15)
    assert interview.status == InterviewStatus.NO_SHOW
    assert interview.no_show_note == NO_SHOW_NOTE


def test_no_show_needs_a_note(db, booked):
    _, interviewer, interview = booked
    with pytest.raises(RuleViolation, match="note"):
        _no_show(db, interviewer, interview, note="gone")


def test_no_show_refused_once_the_interview_was_started(db, booked):
    _, interviewer, interview = booked
    interviews.start(db, interviewer=interviewer, interview_id=interview.id, now=interview.start_at)
    with pytest.raises(RuleViolation, match="Record an outcome instead"):
        _no_show(db, interviewer, interview)


def test_no_show_closes_with_the_slot(db, booked):
    _, interviewer, interview = booked
    with pytest.raises(RuleViolation, match="slot is over"):
        _no_show(db, interviewer, interview, minutes=30 + 16)


def test_start_opens_10_minutes_before(db, booked):
    _, interviewer, interview = booked
    with pytest.raises(RuleViolation, match="You can start this interview from"):
        interviews.start(db, interviewer=interviewer, interview_id=interview.id, now=interview.start_at - timedelta(hours=3))
    interviews.start(db, interviewer=interviewer, interview_id=interview.id, now=interview.start_at - timedelta(minutes=10))
    assert interview.status == InterviewStatus.IN_PROGRESS


def test_outcome_cannot_be_recorded_before_the_interview(db, booked):
    _, interviewer, interview = booked
    with pytest.raises(RuleViolation, match="record the outcome from"):
        _pass(db, interviewer, interview, now=NOW)
    assert interview.status == InterviewStatus.SCHEDULED
    _pass(db, interviewer, interview, now=interview.start_at + timedelta(minutes=25))
    assert interview.journey.status == S.PASSED


def test_actions_tell_the_ui_when_buttons_open(db, booked):
    _, _, interview = booked
    before = rules.interviewer_actions(interview, interview.start_at + timedelta(minutes=5))
    assert before["start"]["allowed"] is True
    assert before["no_show"]["allowed"] is False
    assert before["no_show"]["available_at"] == interview.start_at + timedelta(minutes=15)
    student = rules.student_actions(interview, interview.start_at + timedelta(minutes=5))
    assert student["report_interviewer_absent"]["available_at"] == interview.start_at + timedelta(minutes=15)


def test_no_show_and_student_report_race_exactly_one_wins(db, booked):
    student, interviewer, interview = booked
    db.commit()
    when = interview.start_at + timedelta(minutes=20)
    barrier, results = threading.Barrier(2), []

    def run(action):
        session = TestSession()
        try:
            barrier.wait()
            action(session)
            session.commit()
            results.append("ok")
        except RuleViolation:
            session.rollback()
            results.append("refused")
        finally:
            session.close()

    no_show = lambda s: interviews.mark_no_show(  # noqa: E731
        s, interviewer=s.merge(interviewer), interview_id=interview.id, note=NO_SHOW_NOTE, now=when
    )
    report = lambda s: attendance.report_interviewer_absent(  # noqa: E731
        s, student=s.merge(student), interview_id=interview.id, now=when
    )
    threads = [threading.Thread(target=run, args=(a,)) for a in (no_show, report)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert sorted(results) == ["ok", "refused"]


def test_student_disputes_and_team_excuses(db, make, booked):
    student, interviewer, interview = booked
    lead = make.user(Role.ADMIN)
    _no_show(db, interviewer, interview)
    with pytest.raises(RuleViolation, match="20\\+ characters"):
        attendance.dispute_no_show(db, student=student, interview_id=interview.id, reason="I was there", now=interview.end_at)
    attendance.dispute_no_show(
        db, student=student, interview_id=interview.id,
        reason="I joined at the start and waited in the lobby for 20 minutes.", now=interview.end_at,
    )
    assert interview.disputed_at is not None
    assert db.query(Notification).filter_by(user_id=lead.id, kind="no_show_disputed").count() == 1
    with pytest.raises(RuleViolation, match="already disputed"):
        attendance.dispute_no_show(
            db, student=student, interview_id=interview.id, reason="Disputing a second time for some reason", now=interview.end_at
        )

    attendance.excuse_no_show(db, admin=lead, interview_id=interview.id, reason="Lobby was locked by mistake", now=interview.end_at)
    assert interview.status == InterviewStatus.EXCUSED
    assert interview.dispute_resolution == DisputeResolution.EXCUSED
    assert interview.journey.attempts_used == 0
    assert interview.journey.status == S.ELIGIBLE


def test_team_rejects_a_dispute(db, make, booked):
    student, interviewer, interview = booked
    lead = make.user(Role.ADMIN)
    _no_show(db, interviewer, interview)
    attendance.dispute_no_show(
        db, student=student, interview_id=interview.id,
        reason="I joined at the start and waited in the lobby for 20 minutes.", now=interview.end_at,
    )
    attendance.reject_dispute(
        db, admin=lead, interview_id=interview.id, reason="The meeting log shows nobody else joined.", now=interview.end_at
    )
    assert interview.status == InterviewStatus.NO_SHOW
    assert interview.dispute_resolution == DisputeResolution.REJECTED
    assert interview.journey.attempts_used == 1
    assert db.query(Notification).filter_by(user_id=student.id, kind="dispute_rejected").count() == 1
    with pytest.raises(RuleViolation, match="already been resolved"):
        attendance.reject_dispute(db, admin=lead, interview_id=interview.id, reason="Rejecting a second time", now=interview.end_at)


def test_dispute_window_closes_after_48_hours(db, booked):
    student, interviewer, interview = booked
    _no_show(db, interviewer, interview)
    with pytest.raises(RuleViolation, match="Disputes close"):
        attendance.dispute_no_show(
            db, student=student, interview_id=interview.id,
            reason="I joined at the start and waited in the lobby for 20 minutes.",
            now=interview.end_at + timedelta(hours=49),
        )


def test_30_minute_notice_and_slot_labels(db, make):
    interviewer = make.user(Role.INTERVIEWER)
    badge = make.badge()
    past = make.slot(interviewer, NOW - timedelta(minutes=10))
    soon = make.slot(interviewer, NOW + timedelta(minutes=20))
    ok = make.slot(interviewer, NOW + timedelta(minutes=30))
    assert [availability.booking_state(s, NOW) for s in (past, soon, ok)] == ["expired", "too_soon", "open"]
    bookable = booking.bookable_slots(db, badge_id=badge.id, now=NOW)
    assert [s.id for s in bookable] == [ok.id]
    assert isinstance(bookable[0], Slot)


def test_interviewer_can_open_a_too_soon_slot_at_short_notice(db, make):
    student, interviewer, badge = make.user(), make.user(Role.INTERVIEWER), make.badge()
    make.clear_all(student, badge)
    soon = make.slot(interviewer, NOW + timedelta(minutes=20))
    last_minute = make.slot(interviewer, NOW + timedelta(minutes=3))
    assert availability.booking_state(soon, NOW) == "too_soon"
    assert booking.bookable_slots(db, badge_id=badge.id, now=NOW) == []

    with pytest.raises(RuleViolation, match="under 5 minutes"):
        availability.set_short_notice(db, interviewer=interviewer, slot_ids=[last_minute.id], allowed=True, now=NOW)
    other = make.user(Role.INTERVIEWER)
    with pytest.raises(Exception, match="not found"):
        availability.set_short_notice(db, interviewer=other, slot_ids=[soon.id], allowed=True, now=NOW)

    availability.set_short_notice(db, interviewer=interviewer, slot_ids=[soon.id], allowed=True, now=NOW)
    assert availability.booking_state(soon, NOW) == "open"
    assert [s.id for s in booking.bookable_slots(db, badge_id=badge.id, now=NOW)] == [soon.id]
    interview = booking.book(db, student=student, badge_id=badge.id, slot_id=soon.id, now=NOW)
    assert interview.status == InterviewStatus.SCHEDULED
    # Still too late once it's under 5 minutes away.
    assert availability.booking_state(soon, soon.start_at - timedelta(minutes=2)) == "booked"
