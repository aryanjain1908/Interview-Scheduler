/** Shapes match the real API; message copy mirrors backend/app/services/messages.py. */
import { formatDay, formatTime } from "../../lib/format";
import type {
  Badge,
  BadgeJourney,
  Dashboard,
  Interview,
  JourneyStatus,
  Notification,
  Outcome,
  ScheduleItem,
  User,
} from "../../lib/types";

const DAY = 86_400_000;

export const STUDENT: User = {
  id: "s1",
  name: "Riya Kapoor",
  email: "riya@grit.demo",
  role: "student",
  college: "NIAT Hyderabad",
};

const BADGES: Badge[] = [
  { id: "b-fe", slug: "frontend", name: "Frontend Developer", color: "indigo", description: "Build responsive, accessible interfaces with modern JavaScript and React.", max_attempts: 3, interview_minutes: 30 },
  { id: "b-be", slug: "backend", name: "Backend Developer", color: "emerald", description: "Design APIs, model data and ship secure, reliable services.", max_attempts: 3, interview_minutes: 30 },
  { id: "b-da", slug: "data-analyst", name: "Data Analyst", color: "amber", description: "Turn raw data into decisions with SQL, Python and clear visuals.", max_attempts: 3, interview_minutes: 30 },
];
const [FE, BE, DA] = BADGES as [Badge, Badge, Badge];

const SKILLS: Record<string, string[]> = {
  frontend: ["HTML & CSS", "JavaScript Essentials", "Responsive Web Design", "React Fundamentals", "Web APIs & Async JS"],
  backend: ["Python Fundamentals", "SQL & Databases", "REST API Design", "Node.js & Express", "Auth & Security"],
  "data-analyst": ["Spreadsheets", "SQL & Databases", "Python for Data", "Statistics Basics", "Data Visualization"],
};

const iso = (ms: number) => new Date(ms).toISOString();

/** Same shape as the backend's "Tue, 18 Nov at 4:30 PM IST". */
const messageDateTime = (at: string) => `${formatDay(at)} at ${formatTime(at)} IST`;
const messageDate = (at: string) => new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }).format(new Date(at));

function interviewAt(now: number, badge: Badge, startMs: number, outcome: Outcome | null = null): Interview {
  return {
    id: `iv-${badge.slug}-${outcome?.result ?? "upcoming"}`,
    slot_id: `slot-${badge.slug}`,
    status: outcome ? "completed" : "scheduled",
    attempt_no: 1,
    meeting_link: "https://meet.jit.si/grit-interview-demo",
    start_at: iso(startMs),
    end_at: iso(startMs + 30 * 60_000),
    booked_at: iso(now - 2 * DAY),
    cancel_reason: null,
    interviewer: { id: "i1", name: "Priya Sharma" },
    badge,
    outcome,
    disputed_at: null,
    dispute_reason: null,
    dispute_resolution: null,
    dispute_deadline: iso(startMs + 30 * 60_000 + 2 * DAY),
    moved_by_interviewer_at: null,
    move_reason: null,
    change_requests: [],
    student_actions: {
      report_interviewer_absent: CLOSED,
      dispute: CLOSED,
      reschedule: outcome ? CLOSED : OPEN,
      cancel: outcome ? CLOSED : OPEN,
      emergency_change: CLOSED,
    },
  };
}

const CLOSED = { allowed: false, reason: null, available_at: null };
const OPEN = { allowed: true, reason: null, available_at: null };

function journey(
  badge: Badge,
  status: JourneyStatus,
  opts: Partial<BadgeJourney> & { cleared?: number; attemptsUsed?: number; eligibleAgain?: string | null } = {},
): BadgeJourney {
  const cleared = opts.cleared ?? 5;
  const attemptsUsed = opts.attemptsUsed ?? 0;
  return {
    badge,
    skills: SKILLS[badge.slug]!.map((name, i) => ({ id: `${badge.slug}-${i}`, name, cleared: i < cleared })),
    journey: {
      id: `j-${badge.slug}`,
      status,
      attempts_used: attemptsUsed,
      attempts_left: badge.max_attempts - attemptsUsed,
      eligible_since: null,
      eligible_again_at: opts.eligibleAgain ?? null,
      priority_rebook: false,
      reschedules_used: 0,
    },
    can_book: status === "eligible",
    block_reason: null,
    reschedules_left: 2,
    current_interview: null,
    current_interview_changeable: false,
    last_interview: null,
    pending_change: null,
    earned: null,
    ...opts,
  };
}

function note(kind: string, title: string, body: string, tone: Notification["tone"], at: number, read = false): Notification {
  return { id: `${kind}-${at}`, kind, title, body, tone, read_at: read ? iso(at) : null, created_at: iso(at) };
}

const FEEDBACK = {
  pass: "Clear fundamentals and a structured approach. You explained trade-offs well — great work.",
  retake: "Strong start, but we ran out of time before the component-state section. Revise lifting state and effects, then come back — you're close.",
  fail: "You struggled with core async concepts and state management. Practise promises, closures and component state, then rebuild one small project end to end.",
};

export const KEY_MESSAGES = (now: number) => {
  const start = iso(startTomorrow(now));
  const retakeFrom = iso(now + 8 * DAY);
  return [
    {
      when: "Right after booking",
      title: "You're booked!",
      body: `Your Frontend Developer badge interview is on ${messageDateTime(start)} with Priya Sharma. Join from your dashboard 5 minutes early. Need to change it? You can reschedule or cancel up to 12 hours before.`,
      tone: "info" as const,
    },
    {
      when: "When the interviewer records a pass",
      title: "Congratulations — you passed!",
      body: "Your Frontend Developer Track Badge is now live on your GRIT profile. Your interviewer's feedback is on your dashboard.",
      tone: "success" as const,
    },
    {
      when: "When the interviewer suggests a retake",
      title: "You're almost there.",
      body: `Your interviewer suggested a retake for the Frontend Developer badge. Review the feedback on your dashboard — you can book your next interview from ${messageDate(retakeFrom)}. This won't count against you.`,
      tone: "warning" as const,
    },
  ];
};

function startTomorrow(now: number) {
  const d = new Date(now + DAY);
  d.setUTCHours(11, 0, 0, 0); // 4:30 PM IST
  return d.getTime();
}

export function showcaseData(now: number) {
  const start = startTomorrow(now);
  const done = now - 2 * 60 * 60_000;
  const others = [journey(BE, "not_eligible", { cleared: 3 }), journey(DA, "not_eligible", { cleared: 1 })];
  const [m1, m2, m3] = KEY_MESSAGES(now);

  const base = (fe: BadgeJourney, notifications: Notification[]): Dashboard => ({
    student: STUDENT,
    journeys: [fe, ...others],
    notifications,
    unread_count: notifications.filter((n) => !n.read_at).length,
    server_time: iso(now),
  });

  const bookingNote = note("booking_confirmed", m1!.title, m1!.body, "info", now - 2 * DAY, true);

  const booked = base(
    journey(FE, "booked", {
      current_interview: interviewAt(now, FE, start),
      current_interview_changeable: true,
    }),
    [bookingNote],
  );

  const passOutcome: Outcome = {
    result: "pass",
    scores: { fundamentals: 5, problem_solving: 4, communication: 5 },
    feedback_to_student: FEEDBACK.pass,
    retake_after: null,
    recorded_at: iso(done),
  };
  const passedInterview = interviewAt(now, FE, done - 40 * 60_000, passOutcome);
  const earned = { id: "sb1", status: "active" as const, awarded_at: iso(done), revoked_at: null, revoke_reason: null, badge: FE };
  const passed = base(
    journey(FE, "passed", { last_interview: passedInterview, earned }),
    [note("passed", m2!.title, m2!.body, "success", done), bookingNote],
  );

  const retakeOutcome: Outcome = {
    result: "retake_later",
    scores: { fundamentals: 4, problem_solving: 3, communication: 3 },
    feedback_to_student: FEEDBACK.retake,
    retake_after: iso(now + 8 * DAY).slice(0, 10),
    recorded_at: iso(done),
  };
  const retake = base(
    journey(FE, "retake_later", {
      last_interview: interviewAt(now, FE, done - 40 * 60_000, retakeOutcome),
      eligibleAgain: iso(now + 8 * DAY),
    }),
    [note("retake_suggested", m3!.title, m3!.body, "warning", done), bookingNote],
  );

  const failOutcome: Outcome = {
    result: "fail",
    scores: { fundamentals: 2, problem_solving: 2, communication: 3 },
    feedback_to_student: FEEDBACK.fail,
    retake_after: null,
    recorded_at: iso(done),
  };
  const retryFrom = iso(now + 14 * DAY);
  const failed = base(
    journey(FE, "failed", {
      last_interview: interviewAt(now, FE, done - 40 * 60_000, failOutcome),
      attemptsUsed: 1,
      eligibleAgain: retryFrom,
    }),
    [
      note(
        "failed",
        "Not this time — keep going.",
        `You didn't clear the Frontend Developer badge interview. Your interviewer's feedback is on your dashboard. You can book attempt 2 of 3 from ${messageDate(retryFrom)}.`,
        "danger",
        done,
      ),
      bookingNote,
    ],
  );

  const revoked = base(
    journey(FE, "badge_revoked", {
      last_interview: passedInterview,
      earned: {
        ...earned,
        status: "revoked",
        revoked_at: iso(now),
        revoke_reason: "Proctoring review found a second person prompting answers off-camera.",
      },
    }),
    [],
  );

  const scheduleBefore: ScheduleItem = {
    ...interviewAt(now, FE, now - 5 * 60_000),
    status: "in_progress",
    student: STUDENT,
    no_show_note: null,
    staff_actions: { start: CLOSED, record: { allowed: true, reason: null, available_at: null }, no_show: CLOSED, reschedule: CLOSED, cancel: CLOSED },
    journey_attempts_used: 0,
    max_attempts: 3,
  };
  const scheduleAfter: ScheduleItem = {
    ...scheduleBefore,
    status: "completed",
    outcome: { ...passOutcome, internal_notes: "" },
  };

  return { booked, passed, retake, failed, revoked, scheduleBefore, scheduleAfter };
}
