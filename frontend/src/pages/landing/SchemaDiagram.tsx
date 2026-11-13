import { useState } from "react";

import { useReducedMotion } from "./useReducedMotion";

type Group = "people" | "journey" | "scheduling" | "integrity";
interface Table {
  id: string;
  x: number;
  y: number;
  group: Group;
  about: string;
  fields: [string, string?][];
}

const BW = 280;
const HEAD = 38;
const ROW = 22;

const TABLES: Table[] = [
  {
    id: "users",
    x: 20,
    y: 20,
    group: "people",
    about: "Everyone who logs in: students, interviewers and the interview team.",
    fields: [
      ["id", "PK"],
      ["name"],
      ["email", "unique"],
      ["role", "student · interviewer · admin"],
      ["college"],
    ],
  },
  {
    id: "student_skill_clears",
    x: 20,
    y: 205,
    group: "people",
    about: "Which skills each student has cleared. Clearing the last one for a badge unlocks booking.",
    fields: [["student_id", "FK"], ["skill_id", "FK"], ["cleared_at"]],
  },
  {
    id: "notifications",
    x: 20,
    y: 340,
    group: "people",
    about: "The in-app inbox: confirmations, reminders, results and team alerts.",
    fields: [["user_id", "FK"], ["title · body"], ["tone"], ["read_at"]],
  },
  {
    id: "malpractice_flags",
    x: 20,
    y: 497,
    group: "integrity",
    about: "Cheating reports. Upholding one revokes the badge; dismissing it restores it.",
    fields: [
      ["student_id · badge_id", "FK"],
      ["reason · evidence"],
      ["resolution", "pending · upheld · dismissed"],
    ],
  },

  {
    id: "badges",
    x: 350,
    y: 20,
    group: "journey",
    about: "The Track Badges, such as Frontend Developer, with 3 attempts each.",
    fields: [["id", "PK"], ["slug", "unique"], ["name"], ["max_attempts", "3"]],
  },
  {
    id: "badge_skills",
    x: 350,
    y: 183,
    group: "journey",
    about: "The skills a student must clear for each badge.",
    fields: [["badge_id", "FK"], ["skill_id", "FK"], ["position"]],
  },
  {
    id: "student_badges",
    x: 350,
    y: 318,
    group: "integrity",
    about: "Badges students have earned, and any that were revoked, with the reason.",
    fields: [
      ["student_id + badge_id", "unique"],
      ["interview_id", "FK"],
      ["status", "active · revoked"],
      ["revoked_at · reason"],
    ],
  },
  {
    id: "interview_events",
    x: 350,
    y: 475,
    group: "journey",
    about: "The audit trail: every status change, who made it, when and why.",
    fields: [["journey_id", "FK"], ["from → to status"], ["actor_id", "FK"], ["reason · created_at"]],
  },

  {
    id: "interview_journeys",
    x: 680,
    y: 20,
    group: "journey",
    about:
      "The heart of the model: one per student per badge, holding the current state, attempts and wait dates.",
    fields: [
      ["id", "PK"],
      ["student_id + badge_id", "unique"],
      ["status", "the state machine"],
      ["attempts_used"],
      ["reschedules_used"],
      ["eligible_again_at"],
      ["priority_rebook"],
    ],
  },
  {
    id: "interviews",
    x: 680,
    y: 237,
    group: "scheduling",
    about: "Each booking. The database allows only one live booking per slot, and one per student per badge.",
    fields: [
      ["id", "PK"],
      ["journey_id", "FK"],
      ["slot_id", "FK"],
      ["interviewer_id", "FK"],
      ["status · attempt_no"],
      ["meeting_link"],
      ["no-show note · dispute"],
      ["moved_by_interviewer_at"],
    ],
  },
  {
    id: "interview_outcomes",
    x: 680,
    y: 497,
    group: "scheduling",
    about: "The result of an interview: pass, retake later or not cleared, with rubric scores and feedback.",
    fields: [
      ["interview_id", "PK · FK"],
      ["result", "pass · fail · retake"],
      ["scores", "3 skills, 1–5"],
      ["feedback · notes"],
      ["retake_after"],
    ],
  },

  {
    id: "availability_windows",
    x: 1010,
    y: 20,
    group: "scheduling",
    about: "Interviewers' weekly hours and one-off dates, in IST.",
    fields: [["interviewer_id", "FK"], ["weekday | date"], ["start → end", "IST"]],
  },
  {
    id: "slots",
    x: 1010,
    y: 155,
    group: "scheduling",
    about: "The 30-minute bookable times generated from availability for the next 14 days.",
    fields: [
      ["id", "PK"],
      ["interviewer_id + start_at", "unique"],
      ["status", "open · booked · blocked"],
      ["short_notice"],
    ],
  },
  {
    id: "change_requests",
    x: 1010,
    y: 335,
    group: "scheduling",
    about: "Emergency changes made inside 12 hours, waiting for the team to approve or reject.",
    fields: [
      ["interview_id · journey_id", "FK"],
      ["reason · attempt_no"],
      ["from → to time"],
      ["status", "pending · approved · rejected"],
    ],
  },
];

const GROUPS: Record<Group, { label: string; head: string; ring: string; text: string }> = {
  people: { label: "People", head: "#EEF0FF", ring: "#A3A9FB", text: "#3730A3" },
  journey: { label: "Journey", head: "#E0F2FE", ring: "#7DD3FC", text: "#075985" },
  scheduling: { label: "Scheduling", head: "#D1FAE5", ring: "#6EE7B7", text: "#065F46" },
  integrity: { label: "Integrity", head: "#FFE4E6", ring: "#FDA4AF", text: "#9F1239" },
};

// [from table, field row, to table]
const RELS: [string, number, string][] = [
  ["interview_journeys", 1, "users"],
  ["interview_journeys", 1, "badges"],
  ["interviews", 1, "interview_journeys"],
  ["interviews", 2, "slots"],
  ["interview_outcomes", 0, "interviews"],
  ["change_requests", 0, "interviews"],
  ["slots", 1, "availability_windows"],
  ["interview_events", 0, "interview_journeys"],
  ["student_badges", 1, "interviews"],
  ["badge_skills", 0, "badges"],
  ["student_skill_clears", 0, "users"],
  ["notifications", 0, "users"],
  ["malpractice_flags", 0, "student_badges"],
];

const t = (id: string) => TABLES.find((x) => x.id === id)!;
const height = (tb: Table) => HEAD + tb.fields.length * ROW + 12;

function link(from: Table, row: number, to: Table): string {
  const fy = from.y + HEAD + row * ROW + ROW / 2 + 4;
  const ty = to.y + HEAD / 2;
  if (to.x > from.x)
    return `M ${from.x + BW} ${fy} C ${from.x + BW + 30} ${fy}, ${to.x - 30} ${ty}, ${to.x} ${ty}`;
  if (to.x < from.x)
    return `M ${from.x} ${fy} C ${from.x - 30} ${fy}, ${to.x + BW + 30} ${ty}, ${to.x + BW} ${ty}`;
  return `M ${from.x + BW} ${fy} C ${from.x + BW + 34} ${fy}, ${to.x + BW + 34} ${ty}, ${to.x + BW} ${ty}`;
}

export function SchemaDiagram() {
  const reduced = useReducedMotion();
  const [hover, setHover] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string>("interview_journeys");
  const focus = hover ?? pinned;
  const linked = (id: string) =>
    focus === id || RELS.some(([a, , b]) => (a === focus && b === id) || (b === focus && a === id));
  const sel = t(focus);

  return (
    <div className="overflow-hidden rounded-3xl bg-white shadow-card ring-1 ring-ink-200/70">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-ink-100 px-5 py-4 sm:px-8">
        <div className="min-w-0 max-w-3xl">
          <p className="font-mono text-[15px] font-bold" style={{ color: GROUPS[sel.group].text }}>
            {sel.id}
          </p>
          <p className="mt-0.5 text-[15px] leading-snug text-ink-700">{sel.about}</p>
        </div>
        <div className="flex flex-wrap gap-3 text-[13px] font-medium text-ink-600">
          {(Object.keys(GROUPS) as Group[]).map((g) => (
            <span key={g} className="flex items-center gap-1.5">
              <span
                className="h-3 w-3 rounded"
                style={{ background: GROUPS[g].head, boxShadow: `inset 0 0 0 1.5px ${GROUPS[g].ring}` }}
              />
              {GROUPS[g].label}
            </span>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto px-4 py-5 sm:px-8">
        <svg viewBox="0 0 1310 670" className="min-w-[900px]" role="img" aria-label="Database schema">
          <defs>
            {RELS.map(([a, r, b], i) => (
              <path key={i} id={`sd-rel-${i}`} d={link(t(a), r, t(b))} />
            ))}
          </defs>
          {RELS.map(([a, r, b], i) => {
            const on = focus === a || focus === b;
            return (
              <g key={i} opacity={on ? 1 : 0.35}>
                <path
                  d={link(t(a), r, t(b))}
                  fill="none"
                  stroke={on ? "#4F46E5" : "#8A90AE"}
                  strokeWidth={on ? 2.6 : 1.8}
                />
                <circle
                  cx={Number(link(t(a), r, t(b)).split(" ")[1])}
                  cy={Number(link(t(a), r, t(b)).split(" ")[2])}
                  r={3.5}
                  fill={on ? "#4F46E5" : "#8A90AE"}
                />
                {on && !reduced && (
                  <circle r={4.5} fill="#4F46E5">
                    <animateMotion
                      dur="2.4s"
                      repeatCount="indefinite"
                      keyPoints="1;0"
                      keyTimes="0;1"
                      calcMode="linear"
                    >
                      <mpath href={`#sd-rel-${i}`} />
                    </animateMotion>
                  </circle>
                )}
              </g>
            );
          })}

          {TABLES.map((tb) => {
            const g = GROUPS[tb.group];
            const isFocus = focus === tb.id;
            return (
              <g
                key={tb.id}
                role="button"
                tabIndex={0}
                aria-label={`${tb.id}: ${tb.about}`}
                opacity={linked(tb.id) ? 1 : 0.62}
                onMouseEnter={() => setHover(tb.id)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(tb.id)}
                onBlur={() => setHover(null)}
                onClick={() => setPinned(tb.id)}
                className="cursor-pointer outline-none transition-opacity"
              >
                <rect
                  x={tb.x}
                  y={tb.y}
                  width={BW}
                  height={height(tb)}
                  rx={14}
                  fill="#FFFFFF"
                  stroke={isFocus ? "#4F46E5" : g.ring}
                  strokeWidth={isFocus ? 3 : 1.6}
                />
                <path
                  d={`M ${tb.x} ${tb.y + 14} a 14 14 0 0 1 14 -14 h ${BW - 28} a 14 14 0 0 1 14 14 v ${HEAD - 14} h ${-BW} z`}
                  fill={g.head}
                />
                <text x={tb.x + 16} y={tb.y + 25} fill={g.text} className="font-mono text-[14.5px] font-bold">
                  {tb.id}
                </text>
                {tb.fields.map(([name, note], i) => (
                  <g key={name} transform={`translate(${tb.x + 16} ${tb.y + HEAD + i * ROW + 17})`}>
                    <text fill="#10173A" className="font-mono text-[13px]">
                      {name}
                    </text>
                    {note && (
                      <text
                        x={BW - 32}
                        textAnchor="end"
                        fill={/PK|unique/.test(note) ? "#4F46E5" : "#6B7194"}
                        className="text-[12px] font-semibold"
                      >
                        {note}
                      </text>
                    )}
                  </g>
                ))}
              </g>
            );
          })}
        </svg>
      </div>
      <p className="border-t border-ink-100 px-5 py-3 text-[13px] text-ink-500 sm:px-8">
        Hover a table to trace its links · click to keep it selected · PK = primary key, FK = link to another
        table
      </p>
    </div>
  );
}
