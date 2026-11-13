import threading
from datetime import timedelta

import pytest

from app.core.errors import RuleViolation
from app.models import (
    ChangeRequestStatus,
    InterviewStatus,
    JourneyStatus as S,
    Notification,
    Role,
    SlotStatus,
)
from app.services import availability, booking, change_requests, interviews, reminders
from app.services.eligibility import booking_block_reason
from tests.conftest import NOW, TestSession

REASON = "My grandmother was taken to hospital this morning and I need to be with her."
MOVE = "I've been called into an all-day review that I can't move."


@pytest.fixture
def world(db, make):
    student, interviewer, badge = make.user(), make.user(Role.INTERVIEWER), make.badge()
    lead = make.user(Role.ADMIN)
    make.clear_all(student, badge)
    slot = make.slot(interviewer, NOW + timedelta(days=2))
    interview = booking.book(db, student=student, badge_id=badge.id, slot_id=slot.id, now=NOW)
    return {"student": student, "interviewer": interviewer, "badge": badge, "lead": lead, "iv": interview, "make": make}


def _kinds(db, user_id):
    return [n.kind for n in db.query(Notification).filter(Notification.user_id == user_id)]


def _late(iv, hours=3):
    """A moment inside the 12h change window."""
    return iv.start_at - timedelta(hours=hours)


def _emergency(db, w, now, slot=None, reason=REASON):
    return change_requests.emergency_change(
        db, student=w["student"], interview_id=w["iv"].id, reason=reason, new_slot_id=slot.id if slot else None, now=now
    )


def test_inside_12h_normal_change_is_closed_and_points_to_emergency(db, world):
    iv = world["iv"]
    new_slot = world["make"].slot(world["interviewer"], NOW + timedelta(days=3))
    with pytest.raises(RuleViolation, match="Emergency change"):
        booking.reschedule(db, student=world["student"], interview_id=iv.id, new_slot_id=new_slot.id, now=_late(iv))
    with pytest.raises(RuleViolation, match="Emergency change"):
        booking.cancel_by_student(db, student=world["student"], interview_id=iv.id, now=_late(iv))


def test_emergency_not_offered_while_normal_change_is_open(db, world):
    with pytest.raises(RuleViolation, match="normally"):
        _emergency(db, world, NOW)


def test_emergency_needs_a_reason_and_must_be_before_the_start(db, world):
    iv = world["iv"]
    with pytest.raises(RuleViolation, match="20\\+ characters"):
        _emergency(db, world, _late(iv), reason="sick")
    with pytest.raises(RuleViolation, match="already started"):
        _emergency(db, world, iv.start_at + timedelta(minutes=1))


def test_emergency_reschedule_moves_now_and_waits_for_review(db, world):
    iv, interviewer = world["iv"], world["interviewer"]
    old_slot = iv.slot
    reminders.send_due(db, iv.start_at - timedelta(hours=20))
    new_slot = world["make"].slot(interviewer, NOW + timedelta(days=4))
    request = _emergency(db, world, _late(iv), slot=new_slot)

    assert request.status == ChangeRequestStatus.PENDING
    assert iv.slot_id == new_slot.id and iv.status == InterviewStatus.SCHEDULED
    assert old_slot.status == SlotStatus.OPEN
    assert iv.reminded_day_before_at is None
    assert iv.journey.status == S.BOOKED
    assert iv.journey.attempts_used == 0
    assert "emergency_change_interviewer" in _kinds(db, interviewer.id)
    assert "emergency_change_review" in _kinds(db, world["lead"].id)
    assert "emergency_change" in _kinds(db, world["student"].id)


def test_emergency_cancel_frees_the_student_to_book_again(db, world):
    iv = world["iv"]
    _emergency(db, world, _late(iv))
    assert iv.status == InterviewStatus.CANCELLED_STUDENT
    assert iv.journey.status == S.ELIGIBLE
    assert booking_block_reason(iv.journey, _late(iv)) is None


def test_only_one_emergency_change_per_attempt(db, world):
    iv = world["iv"]
    first = world["make"].slot(world["interviewer"], iv.start_at + timedelta(hours=1))
    _emergency(db, world, _late(iv), slot=first)
    with pytest.raises(RuleViolation, match="still being reviewed"):
        _emergency(db, world, _late(iv, hours=2))
    change_requests.approve(db, admin=world["lead"], request_id=iv.journey.change_requests[-1].id, note="", now=NOW)
    db.refresh(iv.journey)
    with pytest.raises(RuleViolation, match="already made an emergency change"):
        _emergency(db, world, _late(iv, hours=2))


def test_approved_emergency_uses_no_attempt(db, world):
    iv = world["iv"]
    request = _emergency(db, world, _late(iv))
    change_requests.approve(db, admin=world["lead"], request_id=request.id, note="Hospital letter seen", now=NOW)
    assert request.status == ChangeRequestStatus.APPROVED
    assert iv.journey.attempts_used == 0
    assert "emergency_approved" in _kinds(db, world["student"].id)
    with pytest.raises(RuleViolation, match="already been reviewed"):
        change_requests.reject(db, admin=world["lead"], request_id=request.id, note="Changed my mind here", now=NOW)


def test_rejected_emergency_counts_an_attempt(db, world):
    iv = world["iv"]
    new_slot = world["make"].slot(world["interviewer"], NOW + timedelta(days=4))
    request = _emergency(db, world, _late(iv), slot=new_slot)
    with pytest.raises(RuleViolation, match="10\\+ characters"):
        change_requests.reject(db, admin=world["lead"], request_id=request.id, note="no", now=NOW)
    change_requests.reject(db, admin=world["lead"], request_id=request.id, note="No evidence was provided.", now=NOW)
    assert iv.journey.attempts_used == 1
    assert iv.attempt_no == 2  # the moved booking is now their second attempt
    assert iv.status == InterviewStatus.SCHEDULED
    assert "emergency_rejected" in _kinds(db, world["student"].id)


def test_rejection_on_the_final_attempt_cancels_the_booking(db, world):
    iv = world["iv"]
    iv.journey.attempts_used = 2
    iv.attempt_no = 3
    new_slot = world["make"].slot(world["interviewer"], NOW + timedelta(days=4))
    request = _emergency(db, world, _late(iv), slot=new_slot)
    change_requests.reject(db, admin=world["lead"], request_id=request.id, note="No evidence was provided.", now=NOW)
    assert iv.journey.attempts_left == 0
    assert iv.status == InterviewStatus.CANCELLED_STUDENT
    assert new_slot.status == SlotStatus.OPEN
    assert iv.journey.status == S.ELIGIBLE
    assert "used all 3 attempts" in booking_block_reason(iv.journey, NOW)


def test_used_up_reschedules_open_the_emergency_route(db, world):
    iv, make = world["iv"], world["make"]
    for days in (3, 4):
        booking.reschedule(db, student=world["student"], interview_id=iv.id, new_slot_id=make.slot(world["interviewer"], NOW + timedelta(days=days)).id, now=NOW)
    with pytest.raises(RuleViolation, match="used all 2 reschedules"):
        booking.reschedule(db, student=world["student"], interview_id=iv.id, new_slot_id=make.slot(world["interviewer"], NOW + timedelta(days=5)).id, now=NOW)
    _emergency(db, world, NOW, slot=make.slot(world["interviewer"], NOW + timedelta(days=6)))
    assert iv.journey.reschedules_used == 2


def test_interviewer_moves_to_own_slot_with_a_reason(db, world):
    iv, interviewer, make = world["iv"], world["interviewer"], world["make"]
    old_slot = iv.slot
    other = make.user(Role.INTERVIEWER)
    with pytest.raises(RuleViolation, match="own open slots"):
        interviews.reschedule(db, interviewer=interviewer, interview_id=iv.id, new_slot_id=make.slot(other, NOW + timedelta(days=3)).id, reason=MOVE, now=NOW)
    new_slot = make.slot(interviewer, NOW + timedelta(days=3))
    with pytest.raises(RuleViolation, match="reason"):
        interviews.reschedule(db, interviewer=interviewer, interview_id=iv.id, new_slot_id=new_slot.id, reason="busy", now=NOW)
    interviews.reschedule(db, interviewer=interviewer, interview_id=iv.id, new_slot_id=new_slot.id, reason=MOVE, now=NOW)

    assert iv.slot_id == new_slot.id
    assert old_slot.status == SlotStatus.BLOCKED
    assert iv.moved_by_interviewer_at == NOW and iv.move_reason == MOVE
    assert iv.journey.reschedules_used == 0
    assert "interviewer_rescheduled" in _kinds(db, world["student"].id)
    assert "interviewer_rescheduled_staff" in _kinds(db, world["lead"].id)


def test_student_can_change_freely_after_an_interviewer_move(db, world):
    iv, interviewer, make = world["iv"], world["interviewer"], world["make"]
    soon = make.slot(interviewer, NOW + timedelta(hours=5))  # inside the 12h window
    interviews.reschedule(db, interviewer=interviewer, interview_id=iv.id, new_slot_id=soon.id, reason=MOVE, now=NOW)
    later = make.slot(interviewer, NOW + timedelta(days=3))
    booking.reschedule(db, student=world["student"], interview_id=iv.id, new_slot_id=later.id, now=NOW + timedelta(hours=1))
    assert iv.slot_id == later.id
    assert iv.journey.reschedules_used == 0  # didn't use one of theirs
    assert iv.moved_by_interviewer_at is None  # back to the normal rules


def test_interviewer_cannot_move_a_started_interview(db, world):
    iv, interviewer = world["iv"], world["interviewer"]
    new_slot = world["make"].slot(interviewer, NOW + timedelta(days=3))
    with pytest.raises(RuleViolation, match="already started"):
        interviews.reschedule(db, interviewer=interviewer, interview_id=iv.id, new_slot_id=new_slot.id, reason=MOVE, now=iv.start_at)


def test_interviewer_cancel_needs_reason_and_notifies_student_and_team(db, world):
    iv, interviewer = world["iv"], world["interviewer"]
    with pytest.raises(RuleViolation, match="reason"):
        interviews.cancel(db, interviewer=interviewer, interview_id=iv.id, reason="no", now=NOW)
    interviews.cancel(db, interviewer=interviewer, interview_id=iv.id, reason=MOVE, now=NOW)
    assert iv.status == InterviewStatus.CANCELLED_INTERVIEWER
    assert iv.journey.status == S.ELIGIBLE and iv.journey.priority_rebook
    assert iv.journey.attempts_used == 0
    assert "cancelled_by_interviewer" in _kinds(db, world["student"].id)
    assert "interviewer_cancelled_staff" in _kinds(db, world["lead"].id)
    body = db.query(Notification).filter_by(user_id=world["student"].id, kind="cancelled_by_interviewer").one().body
    assert MOVE.rstrip(".") in body


def test_interviewer_cannot_cancel_once_started(db, world):
    iv, interviewer = world["iv"], world["interviewer"]
    interviews.start(db, interviewer=interviewer, interview_id=iv.id, now=iv.start_at)
    with pytest.raises(RuleViolation, match="hasn't started"):
        interviews.cancel(db, interviewer=interviewer, interview_id=iv.id, reason=MOVE, now=iv.start_at)


def test_blocking_a_slot_never_cancels_a_started_interview(db, world):
    iv, interviewer = world["iv"], world["interviewer"]
    interviews.start(db, interviewer=interviewer, interview_id=iv.id, now=iv.start_at - timedelta(minutes=5))
    with pytest.raises(RuleViolation, match="already started"):
        availability.set_slot_blocked(
            db, interviewer=interviewer, slot_id=iv.slot_id, blocked=True, reason="Off", now=iv.start_at - timedelta(minutes=5)
        )
    assert iv.status == InterviewStatus.IN_PROGRESS


def test_interviewer_cancel_and_student_emergency_race_one_wins(db, world):
    iv, interviewer, student = world["iv"], world["interviewer"], world["student"]
    new_slot = world["make"].slot(interviewer, NOW + timedelta(days=4))
    shown_slot = iv.slot_id  # what the interviewer was looking at
    db.commit()
    when = _late(iv)
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
        except Exception as exc:  # surface anything unexpected in the assertion
            session.rollback()
            results.append(repr(exc))
        finally:
            session.close()

    cancel = lambda s: interviews.cancel(  # noqa: E731
        s, interviewer=s.merge(interviewer), interview_id=iv.id, reason=MOVE, now=when, from_slot_id=shown_slot
    )
    emergency = lambda s: change_requests.emergency_change(  # noqa: E731
        s, student=s.merge(student), interview_id=iv.id, reason=REASON, new_slot_id=new_slot.id, now=when
    )
    threads = [threading.Thread(target=run, args=(a,)) for a in (cancel, emergency)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert sorted(results) == ["ok", "refused"]


def test_blocking_the_old_slot_after_a_student_moved_leaves_the_new_booking(db, world):
    """The interviewer blocks a slot just as the student moves away from it."""
    iv, interviewer = world["iv"], world["interviewer"]
    old_slot = iv.slot
    new_slot = world["make"].slot(interviewer, NOW + timedelta(days=4))
    booking.reschedule(db, student=world["student"], interview_id=iv.id, new_slot_id=new_slot.id, now=NOW)
    cancelled = booking.cancel_by_interviewer(db, interview=iv, actor_id=interviewer.id, reason=MOVE, now=NOW, slot_id=old_slot.id)
    assert cancelled is False
    assert iv.status == InterviewStatus.SCHEDULED and iv.slot_id == new_slot.id
