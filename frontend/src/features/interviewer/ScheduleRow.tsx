import clsx from "clsx";
import { CalendarClock, CalendarX2, ClipboardCheck, Clock, Flag, Play, UserX, Video } from "lucide-react";

import { Avatar } from "../../components/ui/Avatar";
import { Button } from "../../components/ui/Button";
import { Menu, MenuItem } from "../../components/ui/Menu";
import { InterviewPill, OutcomePill, Pill } from "../../components/ui/Pill";
import { actionState } from "../../lib/actions";
import { formatTime } from "../../lib/format";
import { CLOSED_WITHOUT_INTERVIEW } from "../../lib/status";
import type { ScheduleItem } from "../../lib/types";

interface Props {
  item: ScheduleItem;
  now: number;
  onStart?: () => void;
  onNoShow?: () => void;
  onRecord?: () => void;
  onReport?: () => void;
  onReschedule?: () => void;
  onCancel?: () => void;
  busy?: boolean;
}

export function ScheduleRow({ item, now, onStart, onNoShow, onRecord, onReport, onReschedule, onCancel, busy }: Props) {
  const start = Date.parse(item.start_at);
  const isNow = now >= start - 10 * 60_000 && now < Date.parse(item.end_at);
  const open = item.status === "scheduled" || item.status === "in_progress";
  const cancelled = CLOSED_WITHOUT_INTERVIEW.has(item.status);

  const startAction = actionState(item.staff_actions.start, now);
  const noShowAction = actionState(item.staff_actions.no_show, now);
  const recordAction = actionState(item.staff_actions.record, now);
  // From 10 min before the start, show not-yet-open actions greyed out with when they open;
  // before that, an upcoming interview only offers Join and Change.
  const soon = now >= start - 10 * 60_000;
  const showStart = item.status === "scheduled" && startAction.enabled;
  const showNoShow = item.status === "scheduled" && (noShowAction.enabled || (noShowAction.upcoming && soon));
  const showRecord = recordAction.enabled || (recordAction.upcoming && soon);
  const hint = soon ? [noShowAction, recordAction].find((a) => a.upcoming)?.hint : null;
  const changes: MenuItem[] = [
    ...(onReschedule && item.staff_actions.reschedule.allowed
      ? [{ label: "Reschedule", icon: <CalendarClock className="h-4 w-4" />, onSelect: onReschedule }]
      : []),
    ...(onCancel && item.staff_actions.cancel.allowed
      ? [{ label: "Cancel interview", icon: <CalendarX2 className="h-4 w-4" />, onSelect: onCancel, danger: true }]
      : []),
  ];

  return (
    <div
      className={clsx(
        "flex flex-col gap-4 rounded-2xl bg-white p-4 ring-1 transition sm:flex-row sm:flex-wrap sm:items-center sm:p-5",
        item.status === "in_progress" || (isNow && open) ? "ring-2 ring-emerald-400" : "ring-ink-200/70",
        cancelled && "opacity-60",
      )}
    >
      <div className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1 sm:w-24 sm:flex-col sm:flex-nowrap sm:items-start sm:gap-0">
        <p className="whitespace-nowrap font-display text-lg font-extrabold text-ink-950">{formatTime(item.start_at)}</p>
        <p className="whitespace-nowrap text-xs text-ink-400">
          <span className="sm:hidden">to </span>
          {formatTime(item.end_at)}
        </p>
        {isNow && open && <Pill tone="emerald" dot>Now</Pill>}
      </div>

      <div className="flex min-w-0 flex-1 items-center gap-3 sm:min-w-[14rem]">
        <Avatar name={item.student.name} />
        <div className="min-w-0">
          <p className="truncate font-semibold text-ink-950">{item.student.name}</p>
          <p className="text-xs text-ink-500">
            {item.badge.name} · Attempt {item.attempt_no} of {item.max_attempts}
            {item.student.college && <> · {item.student.college}</>}
          </p>
          {item.moved_by_interviewer_at && open && (
            <p className="mt-1 text-xs text-ink-500">
              You moved this{item.move_reason ? <> · “{item.move_reason}”</> : null}
            </p>
          )}
          {item.status === "no_show" && item.disputed_at && !item.dispute_resolution && (
            <p className="mt-1 text-xs font-medium text-amber-700">The student disputed this no-show. The team is reviewing it.</p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1.5 sm:ml-auto sm:items-end">
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {item.outcome ? <OutcomePill result={item.outcome.result} /> : <InterviewPill status={item.status} />}
          {item.outcome?.result === "pass" && onReport && (
            <Button size="sm" variant="ghost" onClick={onReport} icon={<Flag className="h-3.5 w-3.5" />}>
              Report
            </Button>
          )}
          {open && (
            <>
              <a
                href={item.meeting_link}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[13px] font-semibold text-ink-700 ring-1 ring-inset ring-ink-200 hover:bg-ink-100/60"
              >
                <Video className="h-3.5 w-3.5" /> Join
              </a>
              {showStart && onStart && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={onStart}
                  disabled={busy || !startAction.enabled}
                  title={startAction.hint ?? "Tells the student the interview is under way. Recording an outcome does this too."}
                  icon={<Play className="h-3.5 w-3.5" />}
                >
                  Mark as started
                </Button>
              )}
              {showNoShow && onNoShow && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={onNoShow}
                  disabled={busy || !noShowAction.enabled}
                  title={noShowAction.hint ?? "The student didn't join"}
                  icon={<UserX className="h-3.5 w-3.5" />}
                >
                  No-show
                </Button>
              )}
              {showRecord && onRecord && (
                <Button
                  size="sm"
                  onClick={onRecord}
                  disabled={busy || !recordAction.enabled}
                  title={recordAction.hint ?? undefined}
                  icon={<ClipboardCheck className="h-3.5 w-3.5" />}
                >
                  Record outcome
                </Button>
              )}
              <Menu label="Change" items={changes} disabled={busy} />
            </>
          )}
        </div>
        {open && hint && (
          <p className="flex items-center gap-1 text-[11px] text-ink-500">
            <Clock className="h-3 w-3" /> {hint}
          </p>
        )}
      </div>
    </div>
  );
}
