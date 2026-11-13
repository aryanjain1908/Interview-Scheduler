import { useState } from "react";

import { useBlockSlot, useInterviewerCalendar, useShortNotice } from "../../api/interviewer";
import { BlockDetails } from "../../components/calendar/BlockDetails";
import { CalendarBlock, CalendarLegend, WeekCalendar, WeekNav } from "../../components/calendar/WeekCalendar";
import { Button, LinkButton } from "../../components/ui/Button";
import { Card, PageHeader } from "../../components/ui/Card";
import { ErrorState, Skeleton } from "../../components/ui/Spinner";
import { useToast } from "../../components/ui/Toast";
import { errorMessage } from "../../lib/api";
import { SHORT_NOTICE_MIN } from "../../lib/policy";
import { istDateKey, mondayOf } from "../../lib/format";
import { useNow } from "../../lib/useNow";

export default function InterviewerCalendar() {
  const now = useNow(60_000);
  const thisWeek = mondayOf(istDateKey(new Date(now)));
  const [week, setWeek] = useState(thisWeek);
  const { data, isLoading, error, refetch } = useInterviewerCalendar(week);
  const [selected, setSelected] = useState<CalendarBlock | null>(null);
  const block = useBlockSlot();
  const shortNotice = useShortNotice();
  const toast = useToast();

  const openNow = (b: CalendarBlock) => {
    const ids = b.entries.filter((e) => Date.parse(e.start_at) - Date.now() >= SHORT_NOTICE_MIN * 60_000).map((e) => e.slot_id);
    if (!ids.length) return toast.error(`These slots start in under ${SHORT_NOTICE_MIN} minutes — too late to book.`);
    shortNotice.mutate(
      { slotIds: ids },
      {
        onSuccess: () => {
          toast.success("Open for booking", "Students can book this time at short notice.");
          setSelected(null);
          refetch();
        },
        onError: (e) => toast.error(errorMessage(e)),
      },
    );
  };

  const setBlocked = (b: CalendarBlock, blocked: boolean) => {
    const future = b.entries.filter((e) => Date.parse(e.start_at) > Date.now());
    Promise.all(future.map((e) => block.mutateAsync({ slotId: e.slot_id, blocked })))
      .then(() => {
        toast.success(blocked ? "Time blocked" : "Time reopened", `${future.length} slot${future.length === 1 ? "" : "s"} updated.`);
        setSelected(null);
        refetch();
      })
      .catch((e) => toast.error(errorMessage(e)));
  };

  return (
    <div>
      <PageHeader
        eyebrow="Calendar"
        title="Your week"
        description="Booked interviews, open availability and blocked time at a glance. Click any block for details."
        action={<LinkButton to="/interviewer/availability" variant="secondary">Edit weekly hours</LinkButton>}
      />
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-ink-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <WeekNav weekStart={week} onChange={setWeek} todayWeek={thisWeek} />
          <CalendarLegend />
        </div>
        {isLoading ? (
          <Skeleton className="m-4 h-[480px]" />
        ) : error ? (
          <div className="p-4"><ErrorState error={errorMessage(error)} onRetry={refetch} /></div>
        ) : (
          <WeekCalendar weekStart={week} entries={data ?? []} now={now} onSelect={setSelected} />
        )}
      </Card>

      <BlockDetails
        block={selected}
        onClose={() => setSelected(null)}
        scheduleLink={(day) => `/interviewer?day=${day}`}
        footer={
          selected && selected.kind !== "interview" && selected.entries.some((e) => Date.parse(e.start_at) > Date.now()) ? (
            selected.kind === "open" || selected.kind === "too_soon" ? (
              <>
                <Button variant="danger" loading={block.isPending} onClick={() => setBlocked(selected, true)}>
                  Block this time
                </Button>
                {selected.kind === "too_soon" && (
                  <Button loading={shortNotice.isPending} onClick={() => openNow(selected)}>
                    Open for booking now
                  </Button>
                )}
              </>
            ) : (
              <Button loading={block.isPending} onClick={() => setBlocked(selected, false)}>
                Reopen this time
              </Button>
            )
          ) : undefined
        }
      />
    </div>
  );
}
