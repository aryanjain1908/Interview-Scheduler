// Mirrors backend/app/schemas.py

export type Role = "student" | "interviewer" | "admin";

export type JourneyStatus =
  | "not_eligible"
  | "eligible"
  | "booked"
  | "in_progress"
  | "passed"
  | "failed"
  | "retake_later"
  | "no_show"
  | "badge_revoked";

export type InterviewStatus =
  | "scheduled"
  | "in_progress"
  | "completed"
  | "no_show"
  | "cancelled_student"
  | "cancelled_interviewer"
  | "interviewer_absent"
  | "missed"
  | "excused";

export type SlotStatus = "open" | "booked" | "blocked";
export type BookableState = "open" | "too_soon" | "expired" | "booked" | "blocked";
export type OutcomeResult = "pass" | "fail" | "retake_later";
export type FlagResolution = "pending" | "upheld" | "dismissed";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  college: string | null;
}

export interface Person {
  id: string;
  name: string;
}

export interface Badge {
  id: string;
  slug: string;
  name: string;
  description: string;
  color: string;
  max_attempts: number;
  interview_minutes: number;
}

export interface Outcome {
  result: OutcomeResult;
  scores: Record<string, number>;
  feedback_to_student: string;
  retake_after: string | null;
  recorded_at: string;
  internal_notes?: string;
}

export interface Action {
  allowed: boolean;
  reason: string | null;
  available_at: string | null;
}

export type DisputeResolution = "excused" | "rejected";

/** A student's late (inside 12h) change, reviewed by the team. */
export interface ChangeRequest {
  id: string;
  status: "pending" | "approved" | "rejected";
  reason: string;
  attempt_no: number;
  from_start_at: string;
  to_start_at: string | null;
  created_at: string;
  resolved_at: string | null;
  resolution_note: string | null;
}

export interface Interview {
  id: string;
  slot_id: string;
  status: InterviewStatus;
  attempt_no: number;
  meeting_link: string;
  start_at: string;
  end_at: string;
  booked_at: string;
  cancel_reason: string | null;
  interviewer: Person;
  badge: Badge;
  outcome: Outcome | null;
  disputed_at: string | null;
  dispute_reason: string | null;
  dispute_resolution: DisputeResolution | null;
  dispute_deadline: string;
  moved_by_interviewer_at: string | null;
  move_reason: string | null;
  change_requests: ChangeRequest[];
  student_actions: {
    report_interviewer_absent: Action;
    dispute: Action;
    reschedule: Action;
    cancel: Action;
    emergency_change: Action;
  };
}

export interface StaffInterview extends Interview {
  student: User;
  no_show_note: string | null;
  staff_actions: { start: Action; record: Action; no_show: Action; reschedule: Action; cancel: Action };
}

export interface ScheduleItem extends StaffInterview {
  journey_attempts_used: number;
  max_attempts: number;
}

export interface Journey {
  id: string;
  status: JourneyStatus;
  attempts_used: number;
  attempts_left: number;
  eligible_since: string | null;
  eligible_again_at: string | null;
  priority_rebook: boolean;
  reschedules_used: number;
}

export interface EarnedBadge {
  id: string;
  status: "active" | "revoked";
  awarded_at: string;
  revoked_at: string | null;
  revoke_reason: string | null;
  badge: Badge;
}

export interface SkillProgress {
  id: string;
  name: string;
  cleared: boolean;
}

export interface BadgeJourney {
  badge: Badge;
  skills: SkillProgress[];
  journey: Journey;
  can_book: boolean;
  block_reason: string | null;
  reschedules_left: number;
  current_interview: Interview | null;
  current_interview_changeable: boolean;
  last_interview: Interview | null;
  pending_change: ChangeRequest | null;
  earned: EarnedBadge | null;
}

export interface Notification {
  id: string;
  kind: string;
  title: string;
  body: string;
  tone: "info" | "success" | "warning" | "danger";
  read_at: string | null;
  created_at: string;
}

export interface Dashboard {
  student: User;
  journeys: BadgeJourney[];
  notifications: Notification[];
  unread_count: number;
  server_time: string;
}

export interface Slot {
  id: string;
  start_at: string;
  end_at: string;
  status: SlotStatus;
  interviewer: Person;
}

export interface JourneyEvent {
  from_status: JourneyStatus | null;
  to_status: JourneyStatus;
  reason: string;
  created_at: string;
}

export interface InterviewDetail {
  interview: Interview;
  changeable: boolean;
  events: JourneyEvent[];
}

export interface AvailabilityWindow {
  id: string;
  weekday: number | null;
  specific_date: string | null;
  start_time: string;
  end_time: string;
}

export interface InterviewerSlot {
  id: string;
  start_at: string;
  end_at: string;
  status: SlotStatus;
  bookable_state: BookableState;
  student_name: string | null;
  badge_name: string | null;
}

export interface Availability {
  min_booking_lead_minutes: number;
  windows: AvailabilityWindow[];
  slots: InterviewerSlot[];
  badge_ids: string[];
}

export interface Overview {
  by_status: Record<JourneyStatus, number>;
  eligible_total: number;
  booked: number;
  not_booked: number;
  interviews_today: number;
  completed: number;
  pass_rate: number | null;
  slots_next_7_days: number;
  slots_booked_next_7_days: number;
  pending_flags: number;
}

export interface EligibleRow {
  journey_id: string;
  student: User;
  badge: Badge;
  status: JourneyStatus;
  eligible_since: string | null;
  attempt_no: number;
  priority_rebook: boolean;
  last_nudged_at: string | null;
  next_interview_at: string | null;
  interviewer_name: string | null;
}

export interface Flag {
  id: string;
  student: User;
  badge: Badge;
  reason: string;
  evidence_url: string | null;
  resolution: FlagResolution;
  created_at: string;
  resolved_at: string | null;
  flagger: Person;
}

export interface BadgeHolder {
  id: string;
  student: User;
  badge: Badge;
  status: "active" | "revoked";
  awarded_at: string;
  revoked_at: string | null;
}

export interface StudentRow {
  student: User;
  journeys: { journey_id: string; badge: Badge; status: JourneyStatus }[];
}

export interface StudentPage {
  items: StudentRow[];
  total: number;
}

export interface StudentRecord {
  student: User;
  journeys: BadgeJourney[];
}

export interface CalendarEntry {
  slot_id: string;
  start_at: string;
  end_at: string;
  status: SlotStatus;
  bookable_state: BookableState;
  interviewer: Person;
  interview: {
    id: string;
    status: InterviewStatus;
    attempt_no: number;
    meeting_link: string;
    student: Person;
    badge: Badge;
    result: OutcomeResult | null;
  } | null;
}

export interface InterviewerOverview {
  interviewer: User;
  badges: Badge[];
  windows: AvailabilityWindow[];
  open_next_7: number;
  booked_next_7: number;
  blocked_next_7: number;
  interviews_today: number;
  next_interview_at: string | null;
}
