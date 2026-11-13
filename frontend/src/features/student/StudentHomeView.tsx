import { Award, CalendarClock, Inbox } from "lucide-react";
import { ReactNode } from "react";

import { Card, CardHeader } from "../../components/ui/Card";
import { formatDateTime } from "../../lib/format";
import type { BadgeJourney, Dashboard, JourneyStatus } from "../../lib/types";
import { InterviewStatusCard } from "./InterviewStatusCard";
import { NotificationList } from "./NotificationList";

const RANK: Record<JourneyStatus, number> = {
  in_progress: 0,
  booked: 1,
  eligible: 2,
  retake_later: 3,
  failed: 4,
  no_show: 4,
  passed: 5,
  badge_revoked: 6,
  not_eligible: 7,
};

const WEEK = 7 * 86_400_000;

/** Fresh results float to the top so a student sees them first. */
function rank(item: BadgeJourney, now: number): number {
  const recordedAt = item.last_interview?.outcome?.recorded_at;
  const freshResult =
    recordedAt && now - Date.parse(recordedAt) < WEEK && ["passed", "failed", "retake_later"].includes(item.journey.status);
  return freshResult ? -1 : RANK[item.journey.status];
}

interface Props {
  data: Dashboard;
  now: number;
  interactive?: boolean;
  compact?: boolean;
}

export function StudentHomeView({ data, now, interactive = true, compact = false }: Props) {
  const journeys = [...data.journeys].sort((a, b) => rank(a, now) - rank(b, now));
  const earned = data.journeys.filter((j) => j.journey.status === "passed").length;
  const next = data.journeys
    .map((j) => j.current_interview)
    .filter((i): i is NonNullable<typeof i> => Boolean(i))
    .sort((a, b) => Date.parse(a.start_at) - Date.parse(b.start_at))[0];
  const firstName = data.student.name.split(" ")[0];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-600">GRIT · Track badges</p>
        <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight text-ink-950 sm:text-[28px]">
          Hi {firstName}, here's where you stand
        </h1>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat icon={<Award className="h-4 w-4" />} label="Badges earned" value={`${earned} of ${data.journeys.length}`} />
        <Stat
          icon={<CalendarClock className="h-4 w-4" />}
          label="Next interview"
          value={next ? formatDateTime(next.start_at) : "Nothing booked"}
        />
        <Stat icon={<Inbox className="h-4 w-4" />} label="Unread updates" value={String(data.unread_count)} />
      </div>

      <div className={compact ? "space-y-5" : "grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]"}>
        <div className="space-y-5">
          {(compact ? journeys.slice(0, 1) : journeys).map((item) => (
            <InterviewStatusCard key={item.badge.id} item={item} now={now} interactive={interactive} />
          ))}
        </div>
        {!compact && (
          <Card className="h-fit overflow-hidden lg:sticky lg:top-6">
            <CardHeader title="Updates" subtitle="Messages about your interviews" className="pb-3" />
            <NotificationList items={data.notifications} now={now} />
          </Card>
        )}
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 ring-1 ring-ink-200/70">
      <div className="grid h-8 w-8 place-items-center rounded-lg bg-ink-100 text-ink-600">{icon}</div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">{label}</p>
        <p className="text-sm font-semibold leading-snug text-ink-900">{value}</p>
      </div>
    </div>
  );
}
