import type { InterviewStatus, JourneyStatus, OutcomeResult } from "./types";

export type Tone = "neutral" | "brand" | "sky" | "emerald" | "amber" | "rose" | "slate";

interface StatusMeta {
  label: string;
  tone: Tone;
}

export const JOURNEY_STATUS: Record<JourneyStatus, StatusMeta> = {
  not_eligible: { label: "Skills pending", tone: "neutral" },
  eligible: { label: "Ready to book", tone: "brand" },
  booked: { label: "Booked", tone: "sky" },
  in_progress: { label: "Live now", tone: "emerald" },
  passed: { label: "Badge earned", tone: "emerald" },
  failed: { label: "Not cleared", tone: "rose" },
  retake_later: { label: "Retake suggested", tone: "amber" },
  no_show: { label: "No-show", tone: "amber" },
  badge_revoked: { label: "Badge revoked", tone: "slate" },
};

export const INTERVIEW_STATUS: Record<InterviewStatus, StatusMeta> = {
  scheduled: { label: "Scheduled", tone: "sky" },
  in_progress: { label: "In progress", tone: "emerald" },
  completed: { label: "Completed", tone: "neutral" },
  no_show: { label: "No-show", tone: "amber" },
  cancelled_student: { label: "Cancelled by student", tone: "slate" },
  cancelled_interviewer: { label: "Cancelled by interviewer", tone: "slate" },
  interviewer_absent: { label: "Interviewer didn't join", tone: "rose" },
  missed: { label: "Missed", tone: "slate" },
  excused: { label: "No-show excused", tone: "slate" },
};

export const CLOSED_WITHOUT_INTERVIEW = new Set(["cancelled_student", "cancelled_interviewer", "interviewer_absent", "missed", "excused"]);

export const OUTCOME: Record<OutcomeResult, StatusMeta> = {
  pass: { label: "Pass", tone: "emerald" },
  fail: { label: "Fail", tone: "rose" },
  retake_later: { label: "Retake later", tone: "amber" },
};

export const TONE_CLASSES: Record<Tone, string> = {
  neutral: "bg-ink-100 text-ink-700 ring-ink-200",
  brand: "bg-brand-50 text-brand-700 ring-brand-200",
  sky: "bg-sky-50 text-sky-700 ring-sky-200",
  emerald: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  rose: "bg-rose-50 text-rose-700 ring-rose-200",
  slate: "bg-slate-100 text-slate-600 ring-slate-300",
};

export const RUBRIC: { key: string; label: string; hint: string }[] = [
  { key: "fundamentals", label: "Fundamentals", hint: "Core concepts of the track" },
  { key: "problem_solving", label: "Problem solving", hint: "Approach, debugging, trade-offs" },
  { key: "communication", label: "Communication", hint: "Explains thinking clearly" },
];

export const BADGE_ACCENT: Record<string, { from: string; to: string; ring: string; text: string }> = {
  indigo: { from: "#6366F1", to: "#4338CA", ring: "#C5CAFE", text: "text-brand-700" },
  emerald: { from: "#10B981", to: "#047857", ring: "#A7F3D0", text: "text-emerald-700" },
  amber: { from: "#F59E0B", to: "#B45309", ring: "#FDE68A", text: "text-amber-700" },
};

export const accentFor = (color: string) => BADGE_ACCENT[color] ?? BADGE_ACCENT.indigo!;
