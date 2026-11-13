import { useState } from "react";
import { useSearchParams } from "react-router-dom";

import { useAdminCalendar, useInterviewers } from "../../api/admin";
import { BlockDetails } from "../../components/calendar/BlockDetails";
import { CalendarBlock, CalendarLegend, WeekCalendar, WeekNav } from "../../components/calendar/WeekCalendar";
import { Card, PageHeader } from "../../components/ui/Card";
import { Select } from "../../components/ui/Field";
import { ErrorState, Skeleton } from "../../components/ui/Spinner";
import { errorMessage } from "../../lib/api";
import { istDateKey, mondayOf } from "../../lib/format";
import { useNow } from "../../lib/useNow";

export default function AdminCalendar() {
  const now = useNow(60_000);
  const thisWeek = mondayOf(istDateKey(new Date(now)));
  const [week, setWeek] = useState(thisWeek);
  const [params, setParams] = useSearchParams();
  const interviewerId = params.get("interviewer") ?? "";
  // With every interviewer on screen, open hours crowd out the interviews; default them off.
  const [availabilityPref, setShowAvailability] = useState<boolean | null>(null);
  const showAvailability = availabilityPref ?? Boolean(interviewerId);
  const interviewers = useInterviewers();
  const { data, isLoading, error, refetch } = useAdminCalendar(week, interviewerId);
  const [selected, setSelected] = useState<CalendarBlock | null>(null);

  return (
    <div>
      <PageHeader
        eyebrow="Interview team"
        title="Interview calendar"
        description="Every interviewer's interviews and availability for the week. Filter to one interviewer to see their exact hours."
        action={
          <Select
            value={interviewerId}
            onChange={(e) => setParams(e.target.value ? { interviewer: e.target.value } : {})}
            className="w-52"
          >
            <option value="">All interviewers</option>
            {interviewers.data?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        }
      />
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-ink-100 p-4 lg:flex-row lg:items-center lg:justify-between">
          <WeekNav weekStart={week} onChange={setWeek} todayWeek={thisWeek} />
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-[13px] font-medium text-ink-700">
              <input
                type="checkbox"
                checked={showAvailability}
                onChange={(e) => setShowAvailability(e.target.checked)}
                className="h-4 w-4 rounded border-ink-300 accent-brand-600"
              />
              Show availability
            </label>
            <CalendarLegend />
          </div>
        </div>
        {isLoading ? (
          <Skeleton className="m-4 h-[480px]" />
        ) : error ? (
          <div className="p-4"><ErrorState error={errorMessage(error)} onRetry={refetch} /></div>
        ) : (
          <WeekCalendar
            weekStart={week}
            entries={data ?? []}
            now={now}
            onSelect={setSelected}
            showInterviewer={!interviewerId}
            showAvailability={showAvailability}
          />
        )}
      </Card>
      <BlockDetails block={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
