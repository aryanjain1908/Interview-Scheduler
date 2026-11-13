from enum import Enum

from sqlalchemy import Enum as SAEnum


class Role(str, Enum):
    STUDENT = "student"
    INTERVIEWER = "interviewer"
    ADMIN = "admin"


class JourneyStatus(str, Enum):
    NOT_ELIGIBLE = "not_eligible"
    ELIGIBLE = "eligible"
    BOOKED = "booked"
    IN_PROGRESS = "in_progress"
    PASSED = "passed"
    FAILED = "failed"
    RETAKE_LATER = "retake_later"
    NO_SHOW = "no_show"
    BADGE_REVOKED = "badge_revoked"


class SlotStatus(str, Enum):
    OPEN = "open"
    BOOKED = "booked"
    BLOCKED = "blocked"


class InterviewStatus(str, Enum):
    SCHEDULED = "scheduled"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    NO_SHOW = "no_show"
    CANCELLED_STUDENT = "cancelled_student"
    CANCELLED_INTERVIEWER = "cancelled_interviewer"
    # Student was there, interviewer never joined (reported by the student).
    INTERVIEWER_ABSENT = "interviewer_absent"
    # Nobody started it by the end of the slot (e.g. both missed it) — closed automatically.
    MISSED = "missed"
    # A no-show the team reversed after review; the attempt was refunded.
    EXCUSED = "excused"


ACTIVE_INTERVIEW_STATUSES = (InterviewStatus.SCHEDULED, InterviewStatus.IN_PROGRESS)


class ChangeRequestStatus(str, Enum):
    """A student's emergency change inside the change window, waiting for the team."""

    PENDING = "pending"
    APPROVED = "approved"  # no attempt used
    REJECTED = "rejected"  # counted as an attempt


class DisputeResolution(str, Enum):
    EXCUSED = "excused"
    REJECTED = "rejected"


class OutcomeResult(str, Enum):
    PASS = "pass"
    FAIL = "fail"
    RETAKE_LATER = "retake_later"


class StudentBadgeStatus(str, Enum):
    ACTIVE = "active"
    REVOKED = "revoked"


class FlagResolution(str, Enum):
    PENDING = "pending"
    UPHELD = "upheld"
    DISMISSED = "dismissed"


def str_enum(enum_cls: type) -> SAEnum:
    """Store enum *values* as plain varchar so adding a state never needs a PG enum migration."""
    return SAEnum(
        enum_cls,
        native_enum=False,
        length=32,
        values_callable=lambda members: [m.value for m in members],
        validate_strings=True,
    )
