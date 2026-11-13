import clsx from "clsx";
import { ArrowRight, CalendarCheck2, CalendarClock, Percent, ShieldAlert, UserCheck, UserX } from "lucide-react";
import { ReactNode } from "react";
import { Link } from "react-router-dom";

import { useOverview } from "../../api/admin";
import { Card, CardHeader, PageHeader } from "../../components/ui/Card";
import { ErrorState, Skeleton } from "../../components/ui/Spinner";
import { errorMessage } from "../../lib/api";
import { JOURNEY_STATUS } from "../../lib/status";
import type { JourneyStatus } from "../../lib/types";

const FUNNEL: JourneyStatus[] = [
  "not_eligible",
  "eligible",
  "booked",
  "in_progress",
  "passed",
  "retake_later",
  "failed",
  "no_show",
  "badge_revoked",
];

const BAR: Record<string, string> = {
  neutral: "bg-ink-300",
  brand: "bg-brand-500",
  sky: "bg-sky-500",
  emerald: "bg-emerald-500",
  amber: "bg-amber-400",
  rose: "bg-rose-500",
  slate: "bg-slate-400",
};

export default function AdminOverview() {
  const { data, isLoading, error, refetch } = useOverview();
  if (isLoading) return <Skeleton className="h-[480px]" />;
  if (error || !data) return <ErrorState error={errorMessage(error)} onRetry={refetch} />;

  const utilisation = data.slots_next_7_days ? Math.round((data.slots_booked_next_7_days / data.slots_next_7_days) * 100) : 0;
  const max = Math.max(...FUNNEL.map((s) => data.by_status[s] ?? 0), 1);

  return (
    <div>
      <PageHeader
        eyebrow="Interview team"
        title="Interview pipeline"
        description="Who's ready, who's booked, and how interviews are going across every Track Badge."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <Kpi icon={<UserCheck />} label="Eligible students" value={data.eligible_total} />
        <Kpi icon={<CalendarCheck2 />} label="Booked" value={data.booked} tone="sky" />
        <Kpi
          icon={<UserX />}
          label="Not booked yet"
          value={data.not_booked}
          tone="amber"
          to="/admin/students?filter=not_booked"
        />
        <Kpi icon={<CalendarClock />} label="Interviews today" value={data.interviews_today} />
        <Kpi icon={<Percent />} label="Pass rate" value={data.pass_rate === null ? "—" : `${Math.round(data.pass_rate * 100)}%`} tone="emerald" />
        <Kpi icon={<ShieldAlert />} label="Open flags" value={data.pending_flags} tone={data.pending_flags ? "rose" : undefined} to="/admin/integrity" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card>
          <CardHeader title="Where students are" subtitle="Journeys by state, across all badges" />
          <ul className="space-y-2.5 p-5">
            {FUNNEL.map((status) => {
              const count = data.by_status[status] ?? 0;
              const meta = JOURNEY_STATUS[status];
              return (
                <li key={status} className="grid grid-cols-[130px_1fr_40px] items-center gap-3 text-sm">
                  <span className="truncate text-ink-600">{meta.label}</span>
                  <div className="h-2.5 overflow-hidden rounded-full bg-ink-100">
                    <div className={clsx("h-full rounded-full", BAR[meta.tone])} style={{ width: `${(count / max) * 100}%` }} />
                  </div>
                  <span className="text-right font-semibold tabular-nums text-ink-900">{count}</span>
                </li>
              );
            })}
          </ul>
        </Card>

        <div className="space-y-6">
          <Card className="p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-400">Slot utilisation · next 7 days</p>
            <p className="mt-2 font-display text-3xl font-extrabold text-ink-950">{utilisation}%</p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-ink-100">
              <div className="h-full rounded-full bg-brand-500" style={{ width: `${utilisation}%` }} />
            </div>
            <p className="mt-2 text-xs text-ink-500">
              {data.slots_booked_next_7_days} of {data.slots_next_7_days} available slots booked
            </p>
          </Card>
          <Link
            to="/admin/students?filter=not_booked"
            className="group flex items-center justify-between rounded-2xl bg-ink-950 p-5 text-white shadow-lift"
          >
            <div>
              <p className="text-sm font-semibold">{data.not_booked} eligible students haven't booked</p>
              <p className="mt-0.5 text-xs text-ink-400">Review the list and send a reminder</p>
            </div>
            <ArrowRight className="h-5 w-5 transition group-hover:translate-x-1" />
          </Link>
        </div>
      </div>
    </div>
  );
}

const KPI_TONES: Record<string, string> = {
  default: "bg-ink-100 text-ink-600",
  sky: "bg-sky-100 text-sky-700",
  amber: "bg-amber-100 text-amber-700",
  emerald: "bg-emerald-100 text-emerald-700",
  rose: "bg-rose-100 text-rose-700",
};

function Kpi({
  icon,
  label,
  value,
  tone = "default",
  to,
}: {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  tone?: string;
  to?: string;
}) {
  const body = (
    <Card className={clsx("h-full p-4", to && "transition hover:ring-brand-300")}>
      <div className={clsx("grid h-8 w-8 place-items-center rounded-lg [&>svg]:h-4 [&>svg]:w-4", KPI_TONES[tone])}>{icon}</div>
      <p className="mt-3 font-display text-2xl font-extrabold tabular-nums text-ink-950">{value}</p>
      <p className="text-xs font-medium text-ink-500">{label}</p>
    </Card>
  );
  return to ? <Link to={to}>{body}</Link> : body;
}
