import { CalendarDays, Clock, UserRound } from "lucide-react";

import { useInterviewerOverview } from "../../api/admin";
import { Avatar } from "../../components/ui/Avatar";
import { LinkButton } from "../../components/ui/Button";
import { Card, PageHeader } from "../../components/ui/Card";
import { Pill } from "../../components/ui/Pill";
import { EmptyState, ErrorState, Skeleton } from "../../components/ui/Spinner";
import { errorMessage } from "../../lib/api";
import { formatClock, formatDateTime, formatDay, keyToDate, WEEKDAYS } from "../../lib/format";
import type { AvailabilityWindow } from "../../lib/types";

export default function AdminInterviewers() {
  const { data, isLoading, error, refetch } = useInterviewerOverview();

  return (
    <div>
      <PageHeader
        eyebrow="Interview team"
        title="Interviewers"
        description="Who interviews for which Track Badge, their weekly hours, and how full the next 7 days are."
        action={<LinkButton to="/admin/calendar" icon={<CalendarDays className="h-4 w-4" />}>Open calendar</LinkButton>}
      />
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      ) : error ? (
        <ErrorState error={errorMessage(error)} onRetry={refetch} />
      ) : !data?.length ? (
        <Card>
          <EmptyState icon={<UserRound className="h-5 w-5" />} title="No interviewers yet">
            Interviewers appear here once they create an account.
          </EmptyState>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {data.map((row) => {
            const capacity = row.open_next_7 + row.booked_next_7;
            const load = capacity ? Math.round((row.booked_next_7 / capacity) * 100) : 0;
            return (
              <Card key={row.interviewer.id} className="flex flex-col p-5">
                <div className="flex items-start gap-3">
                  <Avatar name={row.interviewer.name} />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-ink-950">{row.interviewer.name}</p>
                    <p className="truncate text-xs text-ink-500" title={row.interviewer.email}>{row.interviewer.email}</p>
                  </div>
                  <LinkButton
                    to={`/admin/calendar?interviewer=${row.interviewer.id}`}
                    variant="secondary"
                    size="sm"
                    icon={<CalendarDays className="h-3.5 w-3.5" />}
                  >
                    Calendar
                  </LinkButton>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {row.badges.length ? (
                    row.badges.map((b) => (
                      <Pill key={b.id} tone="brand">
                        {b.name}
                      </Pill>
                    ))
                  ) : (
                    <Pill tone="amber">No tracks selected</Pill>
                  )}
                </div>

                <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <Stat label="Open (7 days)" value={row.open_next_7} />
                  <Stat label="Booked (7 days)" value={row.booked_next_7} />
                  <Stat label="Today" value={row.interviews_today} />
                </dl>
                <div className="mt-3">
                  <div className="h-1.5 overflow-hidden rounded-full bg-ink-100">
                    <div className="h-full rounded-full bg-brand-500" style={{ width: `${load}%` }} />
                  </div>
                  <p className="mt-1 text-[11px] text-ink-500">
                    {load}% of next week's slots booked
                    {row.blocked_next_7 > 0 && ` · ${row.blocked_next_7} blocked`}
                  </p>
                </div>

                <div className="mt-4 border-t border-ink-100 pt-3">
                  <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-400">
                    <Clock className="h-3.5 w-3.5" /> Weekly hours (IST)
                  </p>
                  <WeeklyHours windows={row.windows} />
                </div>
                <p className="mt-auto pt-3 text-xs text-ink-500">
                  Next interview: {row.next_interview_at ? formatDateTime(row.next_interview_at) : "none booked"}
                </p>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-ink-100/60 px-2 py-2">
      <dd className="font-display text-lg font-extrabold tabular-nums text-ink-950">{value}</dd>
      <dt className="text-[11px] text-ink-500">{label}</dt>
    </div>
  );
}

function WeeklyHours({ windows }: { windows: AvailabilityWindow[] }) {
  if (!windows.length) return <p className="text-xs text-ink-400">No availability set.</p>;
  const range = (w: AvailabilityWindow) => `${formatClock(w.start_time)} – ${formatClock(w.end_time)}`;
  const weekly = WEEKDAYS.map((name, i) => ({ name, items: windows.filter((w) => w.weekday === i) })).filter((d) => d.items.length);
  const oneOff = windows.filter((w) => w.specific_date);
  return (
    <ul className="space-y-1 text-xs">
      {weekly.map((d) => (
        <li key={d.name} className="flex gap-3">
          <span className="w-20 shrink-0 font-medium text-ink-700">{d.name}</span>
          <span className="text-ink-600">{d.items.map(range).join(", ")}</span>
        </li>
      ))}
      {oneOff.map((w) => (
        <li key={w.id} className="flex gap-3">
          <span className="w-20 shrink-0 font-medium text-ink-700">{formatDay(keyToDate(w.specific_date!))}</span>
          <span className="text-ink-600">{range(w)}</span>
        </li>
      ))}
    </ul>
  );
}
