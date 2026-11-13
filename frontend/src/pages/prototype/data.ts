/** Prototype data: the showcase fixtures, plus the screens the walk-through adds
 * (ready to book, open slots, the interviewer's full day). No API calls. */
import { STUDENT, showcaseData } from "../../features/showcase/fixtures";
import { addDaysToKey, istDateKey } from "../../lib/format";
import type { Dashboard, OutcomeResult, ScheduleItem, Slot } from "../../lib/types";

const MIN = 60_000;
const DAY = 86_400_000;

export type Result = Extract<OutcomeResult, "pass" | "retake_later" | "fail">;

export function prototypeData(now: number) {
  const base = showcaseData(now);
  const [fe, ...others] = base.booked.journeys;

  const eligible: Dashboard = {
    ...base.booked,
    journeys: [
      {
        ...fe!,
        journey: { ...fe!.journey, status: "eligible" },
        can_book: true,
        current_interview: null,
        current_interview_changeable: false,
      },
      ...others,
    ],
    notifications: [
      {
        id: "n-eligible",
        kind: "became_eligible",
        title: "You're eligible for the Frontend Developer interview",
        body: "You've cleared every skill for the Frontend Developer Track Badge. Book your live interview slot from your dashboard.",
        tone: "success",
        read_at: null,
        created_at: new Date(now - 3 * 60 * MIN).toISOString(),
      },
    ],
    unread_count: 1,
  };

  const after: Record<Result, Dashboard> = { pass: base.passed, retake_later: base.retake, fail: base.failed };

  /** The interviewer's day of Riya's interview, seen 20 minutes into it:
   * one interview done earlier, Riya's live one, one later that day. */
  const day = (startMs: number) => {
    const at = (offset: number) => ({
      start_at: new Date(startMs + offset).toISOString(),
      end_at: new Date(startMs + offset + 30 * MIN).toISOString(),
    });
    const live: ScheduleItem = { ...base.scheduleBefore, ...at(0) };
    const done: ScheduleItem = {
      ...base.scheduleAfter,
      ...at(-150 * MIN),
      id: "iv-done",
      student: { ...STUDENT, id: "s2", name: "Arjun Mehta" },
    };
    const later: ScheduleItem = {
      ...live,
      ...at(90 * MIN),
      id: "iv-later",
      status: "scheduled",
      student: { ...STUDENT, id: "s3", name: "Sneha Reddy" },
      staff_actions: {
        start: { allowed: false, reason: null, available_at: new Date(startMs + 80 * MIN).toISOString() },
        record: { allowed: false, reason: null, available_at: new Date(startMs + 90 * MIN).toISOString() },
        no_show: { allowed: false, reason: null, available_at: null },
        reschedule: { allowed: false, reason: null, available_at: null },
        cancel: { allowed: false, reason: null, available_at: null },
      },
    };
    const recorded = (result: Result): ScheduleItem => ({
      ...live,
      status: "completed",
      outcome: { ...after[result].journeys[0]!.last_interview!.outcome!, internal_notes: "" },
    });
    return { done, live, later, recorded, now: startMs + 20 * MIN };
  };

  return { ...base, eligible, after, day, slots: openSlots(now) };
}

/** Open slots for the next two weeks: a few a day, like a real interviewer pool. */
function openSlots(now: number): Slot[] {
  const today = istDateKey(new Date(now));
  const times = ["10:00", "11:30", "14:00", "16:30", "18:00"];
  // One interviewer, so the story stays with Priya on every screen.
  const priya = { id: "i1", name: "Priya Sharma" };
  const slots: Slot[] = [];
  for (let d = 1; d <= 14; d++) {
    const key = addDaysToKey(today, d);
    if (new Date(`${key}T00:00:00+05:30`).getUTCDay() === 6 && d % 2) continue; // a quiet Sunday
    times.forEach((t, i) => {
      if ((d + i) % 4 === 0) return; // some slots already taken
      const start = new Date(`${key}T${t}:00+05:30`).getTime();
      slots.push({
        id: `slot-${key}-${t}`,
        start_at: new Date(start).toISOString(),
        end_at: new Date(start + 30 * MIN).toISOString(),
        status: "open",
        interviewer: priya,
      } as Slot);
    });
  }
  return slots.filter((s) => Date.parse(s.start_at) > now + DAY / 48);
}
