import clsx from "clsx";
import { useState } from "react";

import { useReducedMotion } from "./useReducedMotion";

type Key =
  | "not_eligible"
  | "eligible"
  | "booked"
  | "in_progress"
  | "passed"
  | "retake_later"
  | "failed"
  | "no_show"
  | "badge_revoked";

const W = 190;
const H = 64;
const EDGE = "#4A5285";
const LOOP = "#8A90AE";

const NODES: { key: Key; label: string; x: number; y: number; fill: string; ring: string; text: string }[] = [
  {
    key: "not_eligible",
    label: "Skills pending",
    x: 20,
    y: 200,
    fill: "#FFFFFF",
    ring: "#9A9EB8",
    text: "#1A2350",
  },
  { key: "eligible", label: "Eligible", x: 290, y: 200, fill: "#EEF0FF", ring: "#7F83F5", text: "#3730A3" },
  { key: "booked", label: "Booked", x: 560, y: 200, fill: "#E0F2FE", ring: "#38BDF8", text: "#075985" },
  {
    key: "in_progress",
    label: "Interview",
    x: 830,
    y: 200,
    fill: "#D1FAE5",
    ring: "#34D399",
    text: "#065F46",
  },
  { key: "passed", label: "Badge earned", x: 1110, y: 60, fill: "#059669", ring: "#059669", text: "#FFFFFF" },
  {
    key: "retake_later",
    label: "Retake later",
    x: 1110,
    y: 200,
    fill: "#FEF3C7",
    ring: "#F59E0B",
    text: "#92400E",
  },
  { key: "failed", label: "Not cleared", x: 1110, y: 340, fill: "#FFE4E6", ring: "#FB7185", text: "#9F1239" },
  { key: "no_show", label: "No-show", x: 560, y: 360, fill: "#FFF7ED", ring: "#FB923C", text: "#9A3412" },
  {
    key: "badge_revoked",
    label: "Badge revoked",
    x: 1400,
    y: 60,
    fill: "#F1F5F9",
    ring: "#64748B",
    text: "#334155",
  },
];

const DETAILS: Record<Key, { body: string; rules: string[] }> = {
  not_eligible: {
    body: "The student is still clearing the skills for this badge.",
    rules: ["Clears the last skill → Eligible (booking unlocks automatically)"],
  },
  eligible: {
    body: "Every skill is cleared, so the dashboard shows a Book button. The team sees them on the not-booked list.",
    rules: ["Books a slot at least 30 minutes ahead → Booked"],
  },
  booked: {
    body: "A slot is reserved. Reminders go out a day before and an hour before.",
    rules: [
      "Reschedule (twice) or cancel up to 12 hours before — no attempt used",
      "Inside 12 hours: emergency change with a reason; the team decides if it costs an attempt",
      "Interviewer cancels, never joins, or nobody starts it → back to Eligible, no attempt used",
      "Interviewer starts it (from 10 minutes before) → Interview",
      "Student doesn't join within 15 minutes → No-show",
    ],
  },
  in_progress: {
    body: "The 30-minute video interview is happening.",
    rules: [
      "The interviewer records the result, with scores and feedback → Badge earned, Retake later or Not cleared",
    ],
  },
  passed: {
    body: "The badge is live on the student's GRIT profile.",
    rules: ["Cheating found later → Badge revoked"],
  },
  retake_later: {
    body: "Not quite ready yet. This doesn't use an attempt.",
    rules: ["Can book again from the date the interviewer picked → Eligible"],
  },
  failed: {
    body: "Uses one of 3 attempts. The student gets written feedback.",
    rules: ["After 14 days, if attempts are left → Eligible", "After the 3rd attempt, final for the season"],
  },
  no_show: {
    body: "The student didn't join. It uses an attempt, but they can dispute it within 48 hours.",
    rules: ["After 3 days → Eligible", "Dispute accepted → Eligible straight away, attempt given back"],
  },
  badge_revoked: {
    body: "The badge was removed after a cheating finding. The student sees the reason.",
    rules: ["Appeal accepted → Badge earned again"],
  },
};

const n = (k: Key) => NODES.find((x) => x.key === k)!;
const cy = (k: Key) => n(k).y + H / 2;
const right = (k: Key) => `${n(k).x + W} ${cy(k)}`;
const left = (k: Key) => `${n(k).x} ${cy(k)}`;
const cx = (k: Key) => n(k).x + W / 2;

const EDGES: { d: string; label?: [string, number, number] }[] = [
  { d: `M ${right("not_eligible")} L ${left("eligible")}` },
  { d: `M ${right("eligible")} L ${left("booked")}`, label: ["books", 520, 220] },
  { d: `M ${right("booked")} L ${left("in_progress")}`, label: ["starts", 790, 220] },
  { d: `M ${right("in_progress")} C 1065 ${cy("in_progress")}, 1065 ${cy("passed")}, ${left("passed")}` },
  { d: `M ${right("in_progress")} L ${left("retake_later")}` },
  { d: `M ${right("in_progress")} C 1065 ${cy("in_progress")}, 1065 ${cy("failed")}, ${left("failed")}` },
  { d: `M ${right("passed")} L ${left("badge_revoked")}`, label: ["cheating", 1350, 80] },
  {
    d: `M ${cx("booked")} ${n("booked").y + H} L ${cx("booked")} ${n("no_show").y}`,
    label: ["didn't join", 668, 320],
  },
];

const TOP_ARC = `M ${cx("booked")} ${n("booked").y} C ${cx("booked")} 120, ${cx("eligible")} 120, ${cx("eligible")} ${n("eligible").y}`;
const LANE = `M ${n("retake_later").x + W} ${cy("retake_later")} H 1335 V 480 H ${cx("eligible")} V ${n("eligible").y + H}`;
const FEEDERS = [
  `M ${cx("failed")} ${n("failed").y + H} V 480`,
  `M ${cx("no_show")} ${n("no_show").y + H} V 480`,
];

const MAIN = `M ${right("not_eligible")} L ${left("eligible")} L ${right("eligible")} L ${left("booked")} L ${right("booked")} L ${left("in_progress")} L ${right("in_progress")}`;
const ROUTES = [
  {
    id: "jr-pass",
    d: `${MAIN} C 1065 ${cy("in_progress")}, 1065 ${cy("passed")}, ${left("passed")}`,
    color: "#10B981",
    dur: 8,
  },
  { id: "jr-retake", d: `${MAIN} L ${left("retake_later")}`, color: "#F59E0B", dur: 8 },
  {
    id: "jr-fail",
    d: `${MAIN} C 1065 ${cy("in_progress")}, 1065 ${cy("failed")}, ${left("failed")}`,
    color: "#F43F5E",
    dur: 8,
  },
  {
    id: "jr-noshow",
    d: `M ${right("not_eligible")} L ${left("eligible")} L ${right("eligible")} L ${cx("booked")} ${cy("booked")} L ${cx("booked")} ${n("no_show").y}`,
    color: "#FB923C",
    dur: 6,
  },
  { id: "jr-back", d: LANE, color: "#7F83F5", dur: 7 },
];

export function JourneyFlow() {
  const reduced = useReducedMotion();
  const [active, setActive] = useState<Key>("booked");
  const node = n(active);
  const detail = DETAILS[active];

  return (
    <div className="overflow-hidden rounded-3xl bg-white shadow-card ring-1 ring-ink-200/70">
      <div className="overflow-x-auto px-4 pb-2 pt-6 sm:px-8">
        <svg
          viewBox="0 0 1610 520"
          className="min-w-[900px]"
          role="img"
          aria-label="Student journey flowchart"
        >
          <defs>
            <marker
              id="jf-head"
              viewBox="0 0 12 12"
              refX="10"
              refY="6"
              markerWidth="11"
              markerHeight="11"
              orient="auto-start-reverse"
              markerUnits="userSpaceOnUse"
            >
              <path d="M1 1 L11 6 L1 11 z" fill={EDGE} />
            </marker>
            <marker
              id="jf-head-loop"
              viewBox="0 0 12 12"
              refX="10"
              refY="6"
              markerWidth="11"
              markerHeight="11"
              orient="auto-start-reverse"
              markerUnits="userSpaceOnUse"
            >
              <path d="M1 1 L11 6 L1 11 z" fill={LOOP} />
            </marker>
            {ROUTES.map((r) => (
              <path key={r.id} id={r.id} d={r.d} />
            ))}
          </defs>

          <path
            d={TOP_ARC}
            fill="none"
            stroke={LOOP}
            strokeWidth={2.2}
            strokeDasharray="7 6"
            markerEnd="url(#jf-head-loop)"
            className={reduced ? "" : "jf-dash"}
          />
          <text
            x={(cx("booked") + cx("eligible")) / 2}
            y={128}
            textAnchor="middle"
            fill="#4A5285"
            className="text-[16px] font-medium"
          >
            cancelled · interviewer absent · missed
          </text>
          {FEEDERS.map((d) => (
            <path
              key={d}
              d={d}
              fill="none"
              stroke={LOOP}
              strokeWidth={2.2}
              strokeDasharray="7 6"
              className={reduced ? "" : "jf-dash"}
            />
          ))}
          <path
            d={LANE}
            fill="none"
            stroke={LOOP}
            strokeWidth={2.2}
            strokeDasharray="7 6"
            markerEnd="url(#jf-head-loop)"
            className={reduced ? "" : "jf-dash"}
          />
          <text x={860} y={508} textAnchor="middle" fill="#4A5285" className="text-[16px] font-medium">
            back to Eligible after the retake date · 14-day wait · 3-day wait
          </text>

          {EDGES.map((e) => (
            <g key={e.d}>
              <path d={e.d} fill="none" stroke={EDGE} strokeWidth={2.6} markerEnd="url(#jf-head)" />
              {e.label && (
                <text
                  x={e.label[1]}
                  y={e.label[2]}
                  textAnchor={e.label[0] === "didn't join" ? "start" : "middle"}
                  fill="#1A2350"
                  className="text-[16px] font-semibold"
                >
                  {e.label[0]}
                </text>
              )}
            </g>
          ))}

          {!reduced &&
            ROUTES.flatMap((r, ri) =>
              [0, 1, 2].map((k) => {
                const begin = `${k * (r.dur / 3) + ri * 0.7}s`;
                return (
                  <circle
                    key={`${r.id}-${k}`}
                    r={6}
                    fill={r.color}
                    stroke="#FFFFFF"
                    strokeWidth={2}
                    opacity={0}
                  >
                    <set attributeName="opacity" to="1" begin={begin} />
                    <animateMotion dur={`${r.dur}s`} begin={begin} repeatCount="indefinite">
                      <mpath href={`#${r.id}`} />
                    </animateMotion>
                  </circle>
                );
              }),
            )}

          {NODES.map((x) => {
            const on = active === x.key;
            return (
              <g
                key={x.key}
                role="button"
                tabIndex={0}
                aria-pressed={on}
                aria-label={`${x.label}: show rules`}
                onClick={() => setActive(x.key)}
                onKeyDown={(e) =>
                  (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setActive(x.key))
                }
                className="cursor-pointer outline-none [&:focus-visible>rect]:stroke-brand-600"
              >
                {on && (
                  <rect
                    x={x.x - 6}
                    y={x.y - 6}
                    width={W + 12}
                    height={H + 12}
                    rx={22}
                    fill="none"
                    stroke="#4F46E5"
                    strokeWidth={3}
                  />
                )}
                <rect
                  x={x.x}
                  y={x.y}
                  width={W}
                  height={H}
                  rx={17}
                  fill={x.fill}
                  stroke={x.ring}
                  strokeWidth={2}
                />
                <text
                  x={x.x + W / 2}
                  y={x.y + H / 2 + 6}
                  textAnchor="middle"
                  fill={x.text}
                  className="font-head text-[20px] font-bold"
                >
                  {x.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-ink-100 px-5 py-3 text-[13px] font-medium text-ink-600 sm:px-8">
        <Dot color="#10B981" label="passes" />
        <Dot color="#F59E0B" label="retake later" />
        <Dot color="#F43F5E" label="not cleared" />
        <Dot color="#FB923C" label="no-show" />
        <Dot color="#7F83F5" label="back to Eligible" />
        <span className="text-ink-400">Each dot is a student. Click any box to see its rules.</span>
      </div>

      <div className="grid grid-cols-1 gap-6 bg-ink-950 px-5 py-7 text-white sm:px-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-brand-200">Selected state</p>
          <h3 className="mt-1 font-head text-[28px] font-extrabold">{node.label}</h3>
          <p className="mt-2 text-[16px] leading-relaxed text-ink-300">{detail.body}</p>
          <div className="mt-5 flex flex-wrap gap-1.5">
            {NODES.map((x) => (
              <button
                key={x.key}
                onClick={() => setActive(x.key)}
                aria-pressed={active === x.key}
                className={clsx(
                  "rounded-full px-3 py-1 text-[13px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-300",
                  active === x.key ? "bg-white text-ink-950" : "bg-white/10 text-ink-200 hover:bg-white/20",
                )}
              >
                {x.label}
              </button>
            ))}
          </div>
        </div>
        <ul className="min-w-0 space-y-2.5 self-start">
          {detail.rules.map((r) => (
            <li
              key={r}
              className="rounded-xl bg-white/[0.06] px-4 py-3 text-[15px] leading-snug text-ink-100 ring-1 ring-white/10"
            >
              {r}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Dot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className="h-3 w-3 rounded-full ring-2 ring-white"
        style={{ background: color, boxShadow: `0 0 0 1px ${color}` }}
      />
      {label}
    </span>
  );
}
