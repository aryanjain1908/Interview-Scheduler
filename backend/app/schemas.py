import uuid
from datetime import date, datetime, time
from typing import Dict, List, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.models import (
    ChangeRequestStatus,
    DisputeResolution,
    FlagResolution,
    InterviewStatus,
    JourneyStatus,
    OutcomeResult,
    Role,
    SlotStatus,
    StudentBadgeStatus,
)


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class SignupIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    role: Role
    college: Optional[str] = Field(default=None, max_length=160)
    # Interviewers choose the Track Badges they can interview for.
    badge_ids: List[uuid.UUID] = Field(default_factory=list)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UserOut(ORM):
    id: uuid.UUID
    name: str
    email: str
    role: Role
    college: Optional[str] = None


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class Person(ORM):
    id: uuid.UUID
    name: str


class BadgeOut(ORM):
    id: uuid.UUID
    slug: str
    name: str
    description: str
    color: str
    max_attempts: int
    interview_minutes: int


class SlotOut(ORM):
    id: uuid.UUID
    start_at: datetime
    end_at: datetime
    status: SlotStatus
    interviewer: Person


class OutcomeOut(ORM):
    result: OutcomeResult
    scores: Dict[str, int]
    feedback_to_student: str
    retake_after: Optional[date]
    recorded_at: datetime


class StaffOutcomeOut(OutcomeOut):
    internal_notes: str


class ActionOut(BaseModel):
    allowed: bool
    reason: Optional[str]
    available_at: Optional[datetime]


class ChangeRequestOut(ORM):
    id: uuid.UUID
    status: ChangeRequestStatus
    reason: str
    attempt_no: int
    from_start_at: datetime
    to_start_at: Optional[datetime]
    created_at: datetime
    resolved_at: Optional[datetime]
    resolution_note: Optional[str]


class InterviewOut(ORM):
    id: uuid.UUID
    slot_id: uuid.UUID
    status: InterviewStatus
    attempt_no: int
    meeting_link: str
    start_at: datetime
    end_at: datetime
    booked_at: datetime
    cancel_reason: Optional[str]
    interviewer: Person
    badge: BadgeOut
    outcome: Optional[OutcomeOut]
    disputed_at: Optional[datetime]
    dispute_reason: Optional[str]
    dispute_resolution: Optional[DisputeResolution]
    dispute_deadline: datetime
    moved_by_interviewer_at: Optional[datetime]
    move_reason: Optional[str]
    change_requests: List[ChangeRequestOut]
    student_actions: Dict[str, ActionOut]


class StaffInterviewOut(InterviewOut):
    student: UserOut
    outcome: Optional[StaffOutcomeOut]
    no_show_note: Optional[str]
    staff_actions: Dict[str, ActionOut]


class EventOut(ORM):
    from_status: Optional[JourneyStatus]
    to_status: JourneyStatus
    reason: str
    created_at: datetime


class JourneyOut(ORM):
    id: uuid.UUID
    status: JourneyStatus
    attempts_used: int
    attempts_left: int
    eligible_since: Optional[datetime]
    eligible_again_at: Optional[datetime]
    priority_rebook: bool
    reschedules_used: int


class StudentBadgeOut(ORM):
    id: uuid.UUID
    status: StudentBadgeStatus
    awarded_at: datetime
    revoked_at: Optional[datetime]
    revoke_reason: Optional[str]
    badge: BadgeOut


class NotificationOut(ORM):
    id: uuid.UUID
    kind: str
    title: str
    body: str
    tone: str
    read_at: Optional[datetime]
    created_at: datetime


class SkillProgressOut(BaseModel):
    id: uuid.UUID
    name: str
    cleared: bool


class BadgeJourneyOut(BaseModel):
    badge: BadgeOut
    skills: List[SkillProgressOut]
    journey: JourneyOut
    can_book: bool
    block_reason: Optional[str]
    reschedules_left: int
    current_interview: Optional[InterviewOut]
    current_interview_changeable: bool
    last_interview: Optional[InterviewOut]
    # An emergency change on this badge still waiting for the team.
    pending_change: Optional[ChangeRequestOut]
    earned: Optional[StudentBadgeOut]


class DashboardOut(BaseModel):
    student: UserOut
    journeys: List[BadgeJourneyOut]
    notifications: List[NotificationOut]
    unread_count: int
    server_time: datetime


class BookIn(BaseModel):
    badge_id: uuid.UUID
    slot_id: uuid.UUID


class RescheduleIn(BaseModel):
    slot_id: uuid.UUID


class EmergencyChangeIn(BaseModel):
    reason: str = Field(max_length=500)
    # None = cancel now and book again later.
    slot_id: Optional[uuid.UUID] = None


class InterviewerRescheduleIn(BaseModel):
    slot_id: uuid.UUID
    reason: str = Field(max_length=300)
    # The slot the interviewer was looking at; refused if the booking moved meanwhile.
    from_slot_id: Optional[uuid.UUID] = None


class InterviewerCancelIn(BaseModel):
    reason: str = Field(max_length=300)
    from_slot_id: Optional[uuid.UUID] = None


class NoteIn(BaseModel):
    reason: str = Field(default="", max_length=300)


class InterviewDetailOut(BaseModel):
    interview: InterviewOut
    changeable: bool
    events: List[EventOut]


class WindowIn(BaseModel):
    weekday: Optional[int] = Field(default=None, ge=0, le=6)
    specific_date: Optional[date] = None
    start_time: time
    end_time: time


class WindowOut(ORM):
    id: uuid.UUID
    weekday: Optional[int]
    specific_date: Optional[date]
    start_time: time
    end_time: time


class InterviewerSlotOut(BaseModel):
    id: uuid.UUID
    start_at: datetime
    end_at: datetime
    status: SlotStatus
    # open | too_soon | expired | booked | blocked — what a student would see.
    bookable_state: str
    student_name: Optional[str]
    badge_name: Optional[str]


class AvailabilityOut(BaseModel):
    min_booking_lead_minutes: int
    windows: List[WindowOut]
    slots: List[InterviewerSlotOut]
    badge_ids: List[uuid.UUID]


class BadgesIn(BaseModel):
    badge_ids: List[uuid.UUID]


class ReportIn(BaseModel):
    reason: str = Field(max_length=2000)
    evidence_url: Optional[str] = Field(default=None, max_length=500)


class CalendarInterviewOut(BaseModel):
    id: uuid.UUID
    status: InterviewStatus
    attempt_no: int
    meeting_link: str
    student: Person
    badge: BadgeOut
    result: Optional[OutcomeResult]


class CalendarEntryOut(BaseModel):
    slot_id: uuid.UUID
    start_at: datetime
    end_at: datetime
    status: SlotStatus
    bookable_state: str
    interviewer: Person
    interview: Optional[CalendarInterviewOut]


class InterviewerOverviewOut(BaseModel):
    interviewer: UserOut
    badges: List[BadgeOut]
    windows: List[WindowOut]
    open_next_7: int
    booked_next_7: int
    blocked_next_7: int
    interviews_today: int
    next_interview_at: Optional[datetime]


class ShortNoticeIn(BaseModel):
    slot_ids: List[uuid.UUID] = Field(min_length=1, max_length=50)
    allowed: bool = True


class BlockSlotIn(BaseModel):
    blocked: bool
    reason: str = ""


class BlockDayIn(BaseModel):
    day: date
    reason: str = Field(default="On leave", max_length=200)


class OutcomeIn(BaseModel):
    result: OutcomeResult
    scores: Dict[str, int]
    feedback_to_student: str = Field(default="", max_length=2000)
    internal_notes: str = Field(default="", max_length=2000)
    retake_after: Optional[date] = None


class ScheduleItemOut(StaffInterviewOut):
    journey_attempts_used: int
    max_attempts: int


class OverviewOut(BaseModel):
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


class EligibleRowOut(BaseModel):
    journey_id: uuid.UUID
    student: UserOut
    badge: BadgeOut
    status: JourneyStatus
    eligible_since: Optional[datetime]
    attempt_no: int
    priority_rebook: bool
    last_nudged_at: Optional[datetime]
    next_interview_at: Optional[datetime]
    interviewer_name: Optional[str]


class NudgeIn(BaseModel):
    journey_ids: List[uuid.UUID] = Field(min_length=1)


class CountOut(BaseModel):
    count: int


class FlagIn(BaseModel):
    student_id: uuid.UUID
    badge_id: uuid.UUID
    reason: str = Field(max_length=2000)
    evidence_url: Optional[str] = Field(default=None, max_length=500)


class FlagResolveIn(BaseModel):
    resolution: FlagResolution


class FlagOut(ORM):
    id: uuid.UUID
    student: UserOut
    badge: BadgeOut
    reason: str
    evidence_url: Optional[str]
    resolution: FlagResolution
    created_at: datetime
    resolved_at: Optional[datetime]
    flagger: Person


class StudentJourneySummary(BaseModel):
    journey_id: uuid.UUID
    badge: BadgeOut
    status: JourneyStatus


class StudentRowOut(BaseModel):
    student: UserOut
    journeys: List[StudentJourneySummary]


class StudentPageOut(BaseModel):
    items: List[StudentRowOut]
    total: int


class StudentRecordOut(BaseModel):
    student: UserOut
    journeys: List[BadgeJourneyOut]


class SkillClearIn(BaseModel):
    skill_id: uuid.UUID
    cleared: bool


class ReasonIn(BaseModel):
    reason: str = Field(max_length=300)


class NoShowIn(BaseModel):
    note: str = Field(max_length=300)


class DisputeIn(BaseModel):
    reason: str = Field(max_length=500)


class BadgeHolderOut(ORM):
    id: uuid.UUID
    student: UserOut
    badge: BadgeOut
    status: StudentBadgeStatus
    awarded_at: datetime
    revoked_at: Optional[datetime]
