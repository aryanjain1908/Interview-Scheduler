import threading
from datetime import timedelta

import pytest

from app.core.errors import Conflict, RuleViolation
from app.models import (
    FlagResolution,
    InterviewStatus,
    JourneyStatus as S,
    OutcomeResult,
    Role,
    SlotStatus,
    StudentBadgeStatus,
)
from app.services import admin, availability, booking, interviews
from app.services.eligibility import get_or_create_journey
from tests.conftest import NO_SHOW_NOTE, NOW, TestSession

GOOD_SCORES = {"fundamentals": 4, "problem_solving": 4, "communication": 5}
FEEDBACK = "Solid fundamentals; work on edge cases in your solutions."


@pytest.fixture
def setup(db, make):
    student = make.user(Role.STUDENT)
    interviewer = make.user(Role.INTERVIEWER)
    badge = make.badge()
    make.clear_all(student, badge)
    slot = make.slot(interviewer, NOW + timedelta(days=2))
    return student, interviewer, badge, slot


def _book(db, setup, now=NOW):
    student, _, badge, slot = setup
    return booking.book(db, student=student, badge_id=badge.id, slot_id=slot.id, now=now)


def _outcome(db, interviewer, interview, result, retake_after=None, now=None):
    return interviews.record_outcome(
        db,
        interviewer=interviewer,
        interview_id=interview.id,
        result=result,
        scores=GOOD_SCORES,
        feedback_to_student=FEEDBACK,
        internal_notes="",
        retake_after=retake_after,
        now=now or interview.start_at + timedelta(minutes=30),
    )


def test_student_becomes_eligible_only_after_all_skills(db, make):
    student, badge = make.user(), make.badge(skills=3)
    assert get_or_create_journey(db, student.id, badge, NOW).status == S.NOT_ELIGIBLE
    make.clear_all(student, badge)
    journey = get_or_create_journey(db, student.id, badge, NOW)
    assert journey.status == S.ELIGIBLE
    assert journey.eligible_since == NOW


def test_not_eligible_student_cannot_book(db, make):
    student, interviewer, badge = make.user(), make.user(Role.INTERVIEWER), make.badge()
    slot = make.slot(interviewer, NOW + timedelta(days=1))
    with pytest.raises(RuleViolation, match="Clear every required skill"):
        booking.book(db, student=student, badge_id=badge.id, slot_id=slot.id, now=NOW)


def test_booking_marks_slot_and_journey(db, setup):
    interview = _book(db, setup)
    assert interview.status == InterviewStatus.SCHEDULED
    assert interview.slot.status == SlotStatus.BOOKED
    assert interview.journey.status == S.BOOKED
    assert interview.attempt_no == 1


def test_one_active_booking_per_badge(db, make, setup):
    student, interviewer, badge, _ = setup
    _book(db, setup)
    other = make.slot(interviewer, NOW + timedelta(days=3))
    with pytest.raises(RuleViolation, match="already have an interview"):
        booking.book(db, student=student, badge_id=badge.id, slot_id=other.id, now=NOW)


def test_taken_slot_conflicts(db, make, setup):
    _, _, badge, slot = setup
    _book(db, setup)
    rival = make.user()
    make.clear_all(rival, badge)
    with pytest.raises(Conflict):
        booking.book(db, student=rival, badge_id=badge.id, slot_id=slot.id, now=NOW)


def test_slot_too_soon(db, make, setup):
    student, interviewer, badge, _ = setup
    soon = make.slot(interviewer, NOW + timedelta(minutes=20))
    with pytest.raises(RuleViolation, match="too soon"):
        booking.book(db, student=student, badge_id=badge.id, slot_id=soon.id, now=NOW)


def test_concurrent_booking_exactly_one_wins(db, make):
    interviewer, badge = make.user(Role.INTERVIEWER), make.badge()
    students = [make.user() for _ in range(5)]
    for s in students:
        make.clear_all(s, badge)
    slot = make.slot(interviewer, NOW + timedelta(days=1))
    db.commit()

    results, barrier = [], threading.Barrier(len(students))

    def attempt(student):
        session = TestSession()
        try:
            barrier.wait()
            booking.book(session, student=student, badge_id=badge.id, slot_id=slot.id, now=NOW)
            session.commit()
            results.append("ok")
        except Conflict:
            session.rollback()
            results.append("conflict")
        finally:
            session.close()

    threads = [threading.Thread(target=attempt, args=(s,)) for s in students]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert sorted(results) == ["conflict"] * 4 + ["ok"]


def test_reschedule_and_cancel_cutoff(db, make, setup):
    student, interviewer, _, _ = setup
    interview = _book(db, setup)
    new_slot = make.slot(interviewer, NOW + timedelta(days=4))
    booking.reschedule(db, student=student, interview_id=interview.id, new_slot_id=new_slot.id, now=NOW)
    assert interview.slot_id == new_slot.id
    assert interview.journey.status == S.BOOKED

    too_late = new_slot.start_at - timedelta(hours=2)
    with pytest.raises(RuleViolation, match="Changes close"):
        booking.cancel_by_student(db, student=student, interview_id=interview.id, now=too_late)

    booking.cancel_by_student(db, student=student, interview_id=interview.id, now=NOW)
    assert interview.status == InterviewStatus.CANCELLED_STUDENT
    assert new_slot.status == SlotStatus.OPEN
    assert interview.journey.status == S.ELIGIBLE


def test_reschedule_limit(db, make, setup):
    student, interviewer, _, _ = setup
    interview = _book(db, setup)
    for day in (3, 4):
        booking.reschedule(db, student=student, interview_id=interview.id, new_slot_id=make.slot(interviewer, NOW + timedelta(days=day)).id, now=NOW)
    with pytest.raises(RuleViolation, match="reschedules"):
        booking.reschedule(db, student=student, interview_id=interview.id, new_slot_id=make.slot(interviewer, NOW + timedelta(days=5)).id, now=NOW)


def test_interviewer_leave_cancels_with_priority(db, setup):
    _, interviewer, _, slot = setup
    interview = _book(db, setup)
    availability.set_slot_blocked(db, interviewer=interviewer, slot_id=slot.id, blocked=True, reason="Sick", now=NOW)
    assert interview.status == InterviewStatus.CANCELLED_INTERVIEWER
    assert slot.status == SlotStatus.BLOCKED
    assert interview.journey.status == S.ELIGIBLE
    assert interview.journey.priority_rebook is True
    assert interview.journey.attempts_used == 0


def test_pass_awards_badge_and_revocation_nullifies_it(db, make, setup):
    student, interviewer, badge, _ = setup
    interview = _book(db, setup)
    _outcome(db, interviewer, interview, OutcomeResult.PASS)
    assert interview.journey.status == S.PASSED

    staff = make.user(Role.ADMIN)
    flag = admin.raise_flag(db, reporter=staff, student_id=student.id, badge_id=badge.id, reason="Copied answers from a second screen", evidence_url=None, now=NOW)
    admin.resolve_flag(db, admin=staff, flag_id=flag.id, resolution=FlagResolution.UPHELD, now=NOW)
    held = admin.badge_holders(db)[0]
    assert held.status == StudentBadgeStatus.REVOKED
    assert interview.journey.status == S.BADGE_REVOKED

    admin.resolve_flag(db, admin=staff, flag_id=flag.id, resolution=FlagResolution.DISMISSED, now=NOW)
    assert held.status == StudentBadgeStatus.ACTIVE
    assert interview.journey.status == S.PASSED


def test_fail_uses_attempt_and_cools_down(db, make, setup):
    student, interviewer, badge, _ = setup
    interview = _book(db, setup)
    _outcome(db, interviewer, interview, OutcomeResult.FAIL)
    journey = interview.journey
    assert journey.status == S.FAILED
    assert journey.attempts_used == 1
    later_slot = make.slot(interviewer, NOW + timedelta(days=30))
    with pytest.raises(RuleViolation, match="You can book your next interview"):
        booking.book(db, student=student, badge_id=badge.id, slot_id=later_slot.id, now=NOW + timedelta(days=5))
    second = booking.book(db, student=student, badge_id=badge.id, slot_id=later_slot.id, now=NOW + timedelta(days=20))
    assert second.attempt_no == 2


def test_attempts_exhausted_is_final(db, make):
    student, interviewer, badge = make.user(), make.user(Role.INTERVIEWER), make.badge(max_attempts=1)
    make.clear_all(student, badge)
    interview = booking.book(db, student=student, badge_id=badge.id, slot_id=make.slot(interviewer, NOW + timedelta(days=1)).id, now=NOW)
    _outcome(db, interviewer, interview, OutcomeResult.FAIL)
    assert interview.journey.eligible_again_at is None
    with pytest.raises(RuleViolation, match="used all 1 attempts"):
        booking.book(db, student=student, badge_id=badge.id, slot_id=make.slot(interviewer, NOW + timedelta(days=90)).id, now=NOW + timedelta(days=60))


def test_retake_later_needs_date_and_does_not_use_attempt(db, setup):
    _, interviewer, _, _ = setup
    interview = _book(db, setup)
    with pytest.raises(RuleViolation, match="retake from"):
        _outcome(db, interviewer, interview, OutcomeResult.RETAKE_LATER)
    retake_on = (NOW + timedelta(days=7)).date()
    _outcome(db, interviewer, interview, OutcomeResult.RETAKE_LATER, retake_after=retake_on)
    assert interview.journey.status == S.RETAKE_LATER
    assert interview.journey.attempts_used == 0


def test_no_show_counts_as_attempt(db, setup):
    _, interviewer, _, _ = setup
    interview = _book(db, setup)
    interviews.mark_no_show(db, interviewer=interviewer, interview_id=interview.id, note=NO_SHOW_NOTE, now=interview.start_at + timedelta(minutes=15))
    assert interview.journey.status == S.NO_SHOW
    assert interview.journey.attempts_used == 1


def test_only_own_interviews(db, make, setup):
    interview = _book(db, setup)
    stranger = make.user(Role.INTERVIEWER)
    with pytest.raises(Exception, match="not found"):
        _outcome(db, stranger, interview, OutcomeResult.PASS)


def test_windows_generate_and_prune_slots(db, make):
    from datetime import time

    interviewer = make.user(Role.INTERVIEWER)
    window = availability.add_window(
        db, interviewer_id=interviewer.id, weekday=NOW.weekday(), specific_date=None,
        start_time=time(14), end_time=time(16), now=NOW,
    )
    slots = availability.upcoming_slots(db, interviewer.id, NOW)
    assert len(slots) == 4 * 3  # 4 half-hours on this weekday for today + 2 more weeks
    with pytest.raises(RuleViolation, match="overlaps"):
        availability.add_window(
            db, interviewer_id=interviewer.id, weekday=NOW.weekday(), specific_date=None,
            start_time=time(15), end_time=time(17), now=NOW,
        )
    availability.delete_window(db, interviewer_id=interviewer.id, window_id=window.id, now=NOW)
    assert availability.upcoming_slots(db, interviewer.id, NOW) == []


def test_team_records_skill_clear_and_corrects_it(db, make):
    from app.services import student_records

    staff, student, badge = make.user(Role.ADMIN), make.user(), make.badge(skills=2)
    get_or_create_journey(db, student.id, badge, NOW)
    skills = [bs.skill_id for bs in badge.badge_skills]
    for skill_id in skills:
        student_records.set_skill_cleared(db, admin=staff, student_id=student.id, skill_id=skill_id, cleared=True, now=NOW)
    journey = get_or_create_journey(db, student.id, badge, NOW)
    assert journey.status == S.ELIGIBLE

    student_records.set_skill_cleared(db, admin=staff, student_id=student.id, skill_id=skills[0], cleared=False, now=NOW)
    assert journey.status == S.NOT_ELIGIBLE


def test_cannot_remove_skill_behind_a_booking(db, make, setup):
    from app.services import student_records

    student, _, badge, _ = setup
    _book(db, setup)
    with pytest.raises(RuleViolation, match="Cancel the booking first"):
        student_records.set_skill_cleared(
            db, admin=make.user(Role.ADMIN), student_id=student.id,
            skill_id=badge.badge_skills[0].skill_id, cleared=False, now=NOW,
        )


def test_team_can_allow_early_rebooking(db, make, setup):
    from app.services import student_records

    _, interviewer, _, _ = setup
    interview = _book(db, setup)
    _outcome(db, interviewer, interview, OutcomeResult.FAIL)
    staff = make.user(Role.ADMIN)
    with pytest.raises(RuleViolation, match="why"):
        student_records.allow_early_rebooking(db, admin=staff, journey_id=interview.journey_id, reason="ok", now=NOW)
    journey = student_records.allow_early_rebooking(
        db, admin=staff, journey_id=interview.journey_id, reason="Power outage during the interview", now=NOW
    )
    assert journey.status == S.ELIGIBLE
    assert journey.attempts_used == 1


def test_only_qualified_interviewers_slots_are_bookable(db, make):
    student, badge, other_badge = make.user(), make.badge(), make.badge()
    make.clear_all(student, badge)
    specialist = make.user(Role.INTERVIEWER)
    from app.services import interviewers as interviewer_service

    slot = make.slot(specialist, NOW + timedelta(days=1), qualify=False)
    interviewer_service.set_badges(db, interviewer_id=specialist.id, badge_ids=[other_badge.id])
    assert booking.bookable_slots(db, badge_id=badge.id, now=NOW) == []
    assert booking.bookable_slots(db, badge_id=other_badge.id, now=NOW) == [slot]
    with pytest.raises(RuleViolation, match="doesn't take interviews for this badge"):
        booking.book(db, student=student, badge_id=badge.id, slot_id=slot.id, now=NOW)


def test_interviewer_needs_at_least_one_track(db, make):
    from app.services import interviewers as interviewer_service

    with pytest.raises(RuleViolation, match="at least one"):
        interviewer_service.set_badges(db, interviewer_id=make.user(Role.INTERVIEWER).id, badge_ids=[])


def test_team_can_nullify_badge_in_one_step(db, make, setup):
    _, interviewer, _, _ = setup
    interview = _book(db, setup)
    _outcome(db, interviewer, interview, OutcomeResult.PASS)
    held = admin.badge_holders(db)[0]
    staff = make.user(Role.ADMIN)
    flag = admin.nullify_badge(db, admin=staff, student_badge_id=held.id, reason="Answers read from a hidden screen", evidence_url=None, now=NOW)
    assert flag.resolution == FlagResolution.UPHELD
    assert held.status == StudentBadgeStatus.REVOKED
    assert interview.journey.status == S.BADGE_REVOKED
    with pytest.raises(RuleViolation, match="already been nullified"):
        admin.nullify_badge(db, admin=staff, student_badge_id=held.id, reason="Answers read from a hidden screen", evidence_url=None, now=NOW)


def test_interviewer_can_report_a_pass_for_review(db, setup):
    _, interviewer, _, _ = setup
    interview = _book(db, setup)
    _outcome(db, interviewer, interview, OutcomeResult.PASS)
    flag = admin.report_malpractice(db, interviewer=interviewer, interview_id=interview.id, reason="Someone was prompting off-camera", evidence_url=None, now=NOW)
    assert flag.resolution == FlagResolution.PENDING
    assert interview.journey.status == S.PASSED  # nothing changes until the team upholds it


def test_window_can_run_until_midnight(db, make):
    from datetime import time

    interviewer = make.user(Role.INTERVIEWER)
    availability.add_window(
        db, interviewer_id=interviewer.id, weekday=NOW.weekday(), specific_date=None,
        start_time=time(23), end_time=time(0), now=NOW,  # 11 PM – 12 AM
    )
    slots = availability.upcoming_slots(db, interviewer.id, NOW)
    assert len(slots) == 2 * 3  # 11:00 and 11:30 PM, for 3 weeks
    with pytest.raises(RuleViolation, match="overlaps"):
        availability.add_window(
            db, interviewer_id=interviewer.id, weekday=NOW.weekday(), specific_date=None,
            start_time=time(22), end_time=time(23, 30), now=NOW,
        )
    with pytest.raises(RuleViolation, match="End time must be after"):
        availability.add_window(
            db, interviewer_id=interviewer.id, weekday=(NOW.weekday() + 1) % 7, specific_date=None,
            start_time=time(23), end_time=time(22), now=NOW,
        )
