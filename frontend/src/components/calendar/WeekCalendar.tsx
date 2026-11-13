import clsx from "clsx";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo } from "react";

import { addDaysToKey, formatTime, formatWeekRange, istDateKey, istMinutes, keyToDate } from "../../lib/format";
import type { CalendarEntry } from "../../lib/types";
import { Button } from "../ui/Button";

const HOUR_PX = 52;

/** open = students can book it; too_soon = inside the booking notice; expired = passed unbooked. */
export type BlockKind = "open" | "too_soon" | "expired" | "blocked" | "interview";

export const BLOCK_LABEL: Record<Exclude<BlockKind, "interview">, string> = {
  open: "Available",
  too_soon: "Too soon",
  expired: "Expired",
  blocked: "Blocked",
};

export interface CalendarBlock {
  key: string;
  dayKey: string;
  kind: BlockKind;
  startAt: string;
  endAt: string;
  entries: CalendarEntry[];
}

interface Props {
  weekStart: string;
  entries: CalendarEntry[];
  now: number;
  onSelect?: (block: CalendarBlock) => void;
  showInterviewer?: boolean;
  showAvailability?: boolean;
}

/** Consecutive open or blocked slots of one interviewer merge into one block so the week stays readable. */
export function WeekCalendar({ weekStart, entries, now, onSelect, showInterviewer, showAvailability = true }: Props) {
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDaysToKey(weekStart, i)), [weekStart]);
  const blocks = useMemo(() => buildBlocks(entries, showAvailability), [entries, showAvailability]);

  const [firstHour, lastHour] = useMemo(() => {
    let lo = 9;
    let hi = 20;
    for (const b of blocks) {
      lo = Math.min(lo, Math.floor(istMinutes(b.startAt) / 60));
      hi = Math.max(hi, Math.ceil((istMinutes(b.startAt) + durationMin(b)) / 60));
    }
    return [lo, Math.min(hi + 1, 24)];
  }, [blocks]);

  const todayKey = istDateKey(new Date(now));
  const nowMinutes = istMinutes(new Date(now).toISOString());
  const hours = Array.from({ length: lastHour - firstHour }, (_, i) => firstHour + i);
  const height = hours.length * HOUR_PX;

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[860px]">
        <div className="grid grid-cols-[56px_repeat(7,minmax(0,1fr))] border-b border-ink-200">
          <div />
          {days.map((d) => {
            const date = keyToDate(d);
            const isToday = d === todayKey;
            return (
              <div key={d} className="px-2 py-2.5 text-center">
                <p className={clsx("text-[11px] font-semibold uppercase tracking-wider", isToday ? "text-brand-600" : "text-ink-400")}>
                  {date.toLocaleDateString("en-IN", { weekday: "short", timeZone: "Asia/Kolkata" })}
                </p>
                <p
                  className={clsx(
                    "mx-auto mt-0.5 grid h-8 w-8 place-items-center rounded-full font-display text-base font-bold",
                    isToday ? "bg-brand-600 text-white" : "text-ink-900",
                  )}
                >
                  {date.getUTCDate()}
                </p>
              </div>
            );
          })}
        </div>

        <div className="relative grid grid-cols-[56px_repeat(7,minmax(0,1fr))]" style={{ height }}>
          <div className="relative">
            {hours.map((h, i) => (
              <span key={h} className="absolute right-2 -translate-y-1/2 text-[10px] font-medium text-ink-400" style={{ top: i * HOUR_PX }}>
                {i === 0 ? "" : `${h % 12 || 12} ${h < 12 ? "AM" : "PM"}`}
              </span>
            ))}
          </div>
          {days.map((d) => {
            const dayBlocks = layout(blocks.filter((b) => b.dayKey === d));
            return (
              <div key={d} className={clsx("relative border-l border-ink-100", d === todayKey && "bg-brand-50/30")}>
                {hours.map((h, i) => (
                  <div key={h} className="absolute inset-x-0 border-t border-ink-100" style={{ top: i * HOUR_PX }} />
                ))}
                {d === todayKey && nowMinutes >= firstHour * 60 && nowMinutes <= lastHour * 60 && (
                  <div className="pointer-events-none absolute inset-x-0 z-20 flex items-center" style={{ top: ((nowMinutes - firstHour * 60) / 60) * HOUR_PX }}>
                    <span className="-ml-1 h-2 w-2 rounded-full bg-rose-500" />
                    <span className="h-px flex-1 bg-rose-500" />
                  </div>
                )}
                {dayBlocks.map(({ block, lane, lanes }) => (
                  <BlockView
                    key={block.key}
                    block={block}
                    top={((istMinutes(block.startAt) - firstHour * 60) / 60) * HOUR_PX}
                    height={(durationMin(block) / 60) * HOUR_PX}
                    left={`${(lane / lanes) * 100}%`}
                    width={`${100 / lanes}%`}
                    showInterviewer={showInterviewer}
                    onSelect={onSelect}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function BlockView({
  block,
  top,
  height,
  left,
  width,
  showInterviewer,
  onSelect,
}: {
  block: CalendarBlock;
  top: number;
  height: number;
  left: string;
  width: string;
  showInterviewer?: boolean;
  onSelect?: (block: CalendarBlock) => void;
}) {
  const entry = block.entries[0]!;
  const interview = entry.interview;
  const compact = height < 40;
  const title =
    block.kind === "interview" ? interview!.student.name : BLOCK_LABEL[block.kind];
  const subtitle =
    block.kind === "interview"
      ? [interview!.badge.name, showInterviewer ? entry.interviewer.name : null].filter(Boolean).join(" · ")
      : showInterviewer
        ? entry.interviewer.name
        : null;

  return (
    <button
      type="button"
      onClick={() => onSelect?.(block)}
      className={clsx(
        "absolute z-10 overflow-hidden rounded-md px-1.5 text-left text-[11px] leading-tight transition hover:z-30 hover:shadow-lift",
        compact ? "py-0.5" : "py-1",
        blockClasses(block),
      )}
      style={{ top: top + 1, height: Math.max(height - 2, 18), left: `calc(${left} + 2px)`, width: `calc(${width} - 4px)` }}
      title={`${title} · ${formatTime(block.startAt)}–${formatTime(block.endAt)}${subtitle ? ` · ${subtitle}` : ""}`}
    >
      <p className="truncate font-semibold">
        {compact ? `${formatTime(block.startAt)} ${title}` : title}
      </p>
      {!compact && (
        <p className="truncate opacity-80">
          {formatTime(block.startAt)}–{formatTime(block.endAt)}
        </p>
      )}
      {!compact && subtitle && height >= 56 && <p className="truncate opacity-80">{subtitle}</p>}
    </button>
  );
}

function blockClasses(block: CalendarBlock): string {
  if (block.kind === "open") return "bg-emerald-50 text-emerald-900 ring-1 ring-inset ring-emerald-200";
  if (block.kind === "too_soon") return "bg-amber-50 text-amber-900 ring-1 ring-inset ring-dashed ring-amber-300";
  if (block.kind === "expired") return "bg-white text-ink-400 ring-1 ring-inset ring-ink-200";
  if (block.kind === "blocked") return "striped-blocked bg-ink-100 text-ink-500 ring-1 ring-inset ring-ink-200";
  const iv = block.entries[0]!.interview!;
  if (iv.status === "in_progress") return "bg-emerald-600 text-white";
  if (iv.status === "scheduled") return "bg-brand-600 text-white";
  if (iv.status === "no_show") return "bg-amber-100 text-amber-900 ring-1 ring-inset ring-amber-300";
  if (iv.status === "interviewer_absent" || iv.status === "missed" || iv.status === "excused")
    return "bg-slate-100 text-slate-500 line-through ring-1 ring-inset ring-slate-300";
  const accent = iv.result === "pass" ? "border-emerald-500" : iv.result === "fail" ? "border-rose-500" : "border-amber-500";
  return clsx("border-l-[3px] bg-white text-ink-800 ring-1 ring-inset ring-ink-200", accent);
}

const durationMin = (b: CalendarBlock) => (Date.parse(b.endAt) - Date.parse(b.startAt)) / 60_000;

function kindOf(e: CalendarEntry): BlockKind {
  const live = e.interview && !e.interview.status.startsWith("cancelled");  // absent/missed still show as held slots
  if (live) return "interview";
  if (e.status === "blocked") return "blocked";
  if (e.bookable_state === "too_soon" || e.bookable_state === "expired") return e.bookable_state;
  return "open";
}

function buildBlocks(entries: CalendarEntry[], showAvailability: boolean): CalendarBlock[] {
  const sorted = [...entries].sort(
    (a, b) => a.interviewer.id.localeCompare(b.interviewer.id) || Date.parse(a.start_at) - Date.parse(b.start_at),
  );
  const blocks: CalendarBlock[] = [];
  for (const e of sorted) {
    const kind = kindOf(e);
    if (kind !== "interview" && !showAvailability) continue;
    const dayKey = istDateKey(e.start_at);
    const prev = blocks[blocks.length - 1];
    const mergeable =
      prev &&
      kind !== "interview" &&
      prev.kind === kind &&
      prev.dayKey === dayKey &&
      prev.entries[0]!.interviewer.id === e.interviewer.id &&
      prev.endAt === e.start_at;
    if (mergeable) {
      prev.endAt = e.end_at;
      prev.entries.push(e);
    } else {
      blocks.push({ key: e.slot_id, dayKey, kind, startAt: e.start_at, endAt: e.end_at, entries: [e] });
    }
  }
  return blocks;
}

function layout(blocks: CalendarBlock[]) {
  const sorted = [...blocks].sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt));
  const placed: { block: CalendarBlock; lane: number; lanes: number }[] = [];
  let cluster: typeof placed = [];
  let laneEnds: number[] = [];
  let clusterEnd = 0;
  const flush = () => {
    const lanes = Math.max(laneEnds.length, 1);
    for (const p of cluster) p.lanes = lanes;
    placed.push(...cluster);
    cluster = [];
    laneEnds = [];
  };
  for (const block of sorted) {
    const start = Date.parse(block.startAt);
    const end = Date.parse(block.endAt);
    if (cluster.length && start >= clusterEnd) flush();
    let lane = laneEnds.findIndex((laneEnd) => laneEnd <= start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(end);
    } else {
      laneEnds[lane] = end;
    }
    clusterEnd = Math.max(cluster.length ? clusterEnd : 0, end);
    cluster.push({ block, lane, lanes: 1 });
  }
  flush();
  return placed;
}

export function WeekNav({ weekStart, onChange, todayWeek }: { weekStart: string; onChange: (key: string) => void; todayWeek: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <Button variant="secondary" size="sm" onClick={() => onChange(addDaysToKey(weekStart, -7))} aria-label="Previous week">
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <Button variant={weekStart === todayWeek ? "dark" : "secondary"} size="sm" onClick={() => onChange(todayWeek)}>
        This week
      </Button>
      <Button variant="secondary" size="sm" onClick={() => onChange(addDaysToKey(weekStart, 7))} aria-label="Next week">
        <ChevronRight className="h-4 w-4" />
      </Button>
      <span className="ml-2 font-display text-sm font-bold text-ink-900">{formatWeekRange(weekStart)}</span>
    </div>
  );
}

export function CalendarLegend() {
  const items = [
    ["bg-brand-600", "Booked"],
    ["bg-emerald-600", "Live"],
    ["bg-white ring-1 ring-ink-300 border-l-[3px] border-emerald-500", "Completed"],
    ["bg-emerald-50 ring-1 ring-emerald-200", "Available"],
    ["bg-amber-50 ring-1 ring-amber-300", "Too soon to book"],
    ["bg-white ring-1 ring-ink-200", "Expired"],
    ["striped-blocked bg-ink-100 ring-1 ring-ink-200", "Blocked"],
  ];
  return (
    <div className="flex flex-wrap items-center gap-3 text-[11px] font-medium text-ink-500">
      {items.map(([cls, label]) => (
        <span key={label} className="flex items-center gap-1.5">
          <span className={clsx("h-3 w-3 rounded-sm", cls)} />
          {label}
        </span>
      ))}
    </div>
  );
}
