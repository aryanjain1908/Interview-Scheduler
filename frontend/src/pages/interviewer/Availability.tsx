import clsx from "clsx";
import { CalendarPlus, Plus, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";

import {
  useAddWindow,
  useAvailability,
  useBlockDay,
  useShortNotice,
  useBlockSlot,
  useDeleteWindow,
  useSetMyBadges,
  WindowInput,
} from "../../api/interviewer";
import { Button } from "../../components/ui/Button";
import { Card, CardHeader, PageHeader } from "../../components/ui/Card";
import { Field, Input, Select, Textarea } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import { ErrorState, Skeleton } from "../../components/ui/Spinner";
import { useToast } from "../../components/ui/Toast";
import { errorMessage } from "../../lib/api";
import { formatClock, formatDay, formatTime, istDateKey, keyToDate, WEEKDAYS } from "../../lib/format";
import { BOOKING_NOTICE_MIN, SHORT_NOTICE_MIN } from "../../lib/policy";
import type { AvailabilityWindow, InterviewerSlot } from "../../lib/types";
import { TrackPicker } from "../../features/interviewer/TrackPicker";

/** An end of "00:00:00" means midnight at the end of the day. */
const HALF_HOURS = Array.from({ length: 49 }, (_, i) => {
  const minutes = i * 30; // 00:00 → 24:00
  const hms = `${String(Math.floor(minutes / 60) % 24).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}:00`;
  return { minutes, value: hms, label: minutes === 24 * 60 ? "Midnight" : formatClock(hms) };
});
const START_OPTIONS = HALF_HOURS.slice(0, -1);
const minutesOf = (hms: string) => Number(hms.slice(0, 2)) * 60 + Number(hms.slice(3, 5));

export default function InterviewerAvailability() {
  const { data, isLoading, error, refetch } = useAvailability();
  if (isLoading) return <Skeleton className="h-[520px]" />;
  if (error || !data) return <ErrorState error={errorMessage(error)} onRetry={refetch} />;

  const weekly = data.windows.filter((w) => w.weekday !== null);
  const oneOff = data.windows.filter((w) => w.specific_date !== null);
  const open = data.slots.filter((s) => s.bookable_state === "open").length;
  const booked = data.slots.filter((s) => s.status === "booked").length;

  return (
    <div>
      <PageHeader
        eyebrow="Availability"
        title="When can you interview?"
        description="Set your weekly hours once. We turn them into 30-minute slots for the next 14 days, and students book from those."
      />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <div className="space-y-6">
          <TracksCard badgeIds={data.badge_ids} />
          <Card>
            <CardHeader title="Weekly hours" subtitle="Repeats every week · times in IST" />
            <ul className="divide-y divide-ink-100 px-5 py-2">
              {WEEKDAYS.map((name, weekday) => (
                <WeekdayRow key={name} name={name} weekday={weekday} windows={weekly.filter((w) => w.weekday === weekday)} />
              ))}
            </ul>
          </Card>
          <OneOffCard windows={oneOff} />
        </div>
        <Card className="h-fit">
          <CardHeader
            title="Next 14 days"
            subtitle={`${open} open · ${booked} booked — click a slot to block or reopen it`}
            action={<Legend />}
          />
          <SlotCalendar slots={data.slots} />
        </Card>
      </div>
    </div>
  );
}

function WindowChip({ window }: { window: AvailabilityWindow }) {
  const remove = useDeleteWindow();
  const toast = useToast();
  return (
    <span className="inline-flex items-center gap-1 rounded-lg bg-brand-50 py-1 pl-2.5 pr-1 text-xs font-semibold text-brand-800 ring-1 ring-inset ring-brand-100">
      {formatClock(window.start_time)} – {formatClock(window.end_time)}
      <button
        onClick={() => remove.mutate(window.id, { onError: (e) => toast.error(errorMessage(e)) })}
        className="rounded p-0.5 text-brand-400 hover:bg-brand-100 hover:text-brand-700"
        aria-label="Remove window"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </span>
  );
}

function TimeRangeForm({ onSubmit, onCancel, loading }: { onSubmit: (s: string, e: string) => void; onCancel: () => void; loading: boolean }) {
  const [start, setStart] = useState("10:00:00");
  const [endMinutes, setEndMinutes] = useState(13 * 60);
  // Only ends after the start; if the start moves past the end, push the end along.
  const ends = HALF_HOURS.filter((o) => o.minutes > minutesOf(start));
  const end = ends.find((o) => o.minutes === endMinutes) ?? ends[0]!;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <Select aria-label="From" value={start} onChange={(e) => setStart(e.target.value)} className="h-8 w-[120px] text-xs">
        {START_OPTIONS.map((o) => (
          <option key={o.minutes} value={o.value}>{o.label}</option>
        ))}
      </Select>
      <span className="text-xs text-ink-400">to</span>
      <Select
        aria-label="To"
        value={end.minutes}
        onChange={(e) => setEndMinutes(Number(e.target.value))}
        className="h-8 w-[120px] text-xs"
      >
        {ends.map((o) => (
          <option key={o.minutes} value={o.minutes}>{o.label}</option>
        ))}
      </Select>
      <Button size="sm" loading={loading} onClick={() => onSubmit(start, end.value)}>
        Add
      </Button>
      <Button size="sm" variant="ghost" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  );
}

function useAddWindowWithToast(onDone: () => void) {
  const add = useAddWindow();
  const toast = useToast();
  const submit = (input: WindowInput) =>
    add.mutate(input, {
      onSuccess: () => {
        toast.success("Availability added", "New slots are open for booking.");
        onDone();
      },
      onError: (e) => toast.error("Couldn't add hours", errorMessage(e)),
    });
  return { submit, loading: add.isPending };
}

function WeekdayRow({ name, weekday, windows }: { name: string; weekday: number; windows: AvailabilityWindow[] }) {
  const [adding, setAdding] = useState(false);
  const { submit, loading } = useAddWindowWithToast(() => setAdding(false));
  return (
    <li className="py-3">
      <div className="flex items-start gap-3">
        <p className={clsx("w-24 pt-1 text-sm font-semibold", windows.length ? "text-ink-900" : "text-ink-400")}>{name}</p>
        <div className="flex flex-1 flex-wrap items-center gap-1.5">
          {windows.length === 0 && !adding && <span className="pt-1 text-xs text-ink-400">Unavailable</span>}
          {windows.map((w) => (
            <WindowChip key={w.id} window={w} />
          ))}
          {!adding && (
            <button
              onClick={() => setAdding(true)}
              className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
              aria-label={`Add hours on ${name}`}
            >
              <Plus className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      {adding && (
        <div className="pl-[108px]">
          <TimeRangeForm
            loading={loading}
            onCancel={() => setAdding(false)}
            onSubmit={(start_time, end_time) => submit({ weekday, specific_date: null, start_time, end_time })}
          />
        </div>
      )}
    </li>
  );
}

function OneOffCard({ windows }: { windows: AvailabilityWindow[] }) {
  const today = istDateKey(new Date());
  const [date, setDate] = useState(today);
  const [adding, setAdding] = useState(false);
  const { submit, loading } = useAddWindowWithToast(() => setAdding(false));
  return (
    <Card>
      <CardHeader
        title="Extra dates"
        subtitle="One-off availability outside your weekly hours"
        action={
          !adding && (
            <Button size="sm" variant="secondary" icon={<CalendarPlus className="h-3.5 w-3.5" />} onClick={() => setAdding(true)}>
              Add date
            </Button>
          )
        }
      />
      <div className="space-y-2 px-5 pb-5 pt-3">
        {windows.length === 0 && !adding && <p className="text-xs text-ink-400">No extra dates.</p>}
        {windows.map((w) => (
          <div key={w.id} className="flex items-center gap-3">
            <span className="w-28 text-sm font-semibold text-ink-800">{formatDay(keyToDate(w.specific_date!))}</span>
            <WindowChip window={w} />
          </div>
        ))}
        {adding && (
          <div className="rounded-xl bg-ink-100/50 p-3">
            <Field label="Date">
              {(id) => <Input id={id} type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} className="h-8 max-w-[180px] text-xs" />}
            </Field>
            <TimeRangeForm
              loading={loading}
              onCancel={() => setAdding(false)}
              onSubmit={(start_time, end_time) => submit({ weekday: null, specific_date: date, start_time, end_time })}
            />
          </div>
        )}
      </div>
    </Card>
  );
}

function Legend() {
  return (
    <div className="hidden flex-wrap items-center justify-end gap-x-3 gap-y-1 text-[11px] font-medium text-ink-500 sm:flex">
      <span className="flex items-center gap-1 whitespace-nowrap"><span className="h-2.5 w-2.5 rounded-sm bg-white ring-1 ring-ink-300" /> Open</span>
      <span className="flex items-center gap-1 whitespace-nowrap"><span className="h-2.5 w-2.5 rounded-sm bg-amber-50 ring-1 ring-amber-300" /> Too soon to book</span>
      <span className="flex items-center gap-1 whitespace-nowrap"><span className="h-2.5 w-2.5 rounded-sm bg-brand-600" /> Booked</span>
      <span className="flex items-center gap-1"><span className="striped-blocked h-2.5 w-2.5 rounded-sm bg-ink-100 ring-1 ring-ink-200" /> Blocked</span>
    </div>
  );
}

function SlotCalendar({ slots }: { slots: InterviewerSlot[] }) {
  const block = useBlockSlot();
  const blockDay = useBlockDay();
  const toast = useToast();
  const [cancelling, setCancelling] = useState<InterviewerSlot | null>(null);
  const [soonSlot, setSoonSlot] = useState<InterviewerSlot | null>(null);
  const shortNotice = useShortNotice();
  // Cancelling a booked interview always needs a reason the student and team will see.
  const [cancelReason, setCancelReason] = useState("");
  const [offReason, setOffReason] = useState("");
  const closeCancel = () => {
    setCancelling(null);
    setCancelReason("");
  };
  const closeDayOff = () => {
    setDayOff(null);
    setOffReason("");
  };
  const [dayOff, setDayOff] = useState<string | null>(null);

  const days = useMemo(() => {
    const map = new Map<string, InterviewerSlot[]>();
    for (const s of slots) {
      const key = istDateKey(s.start_at);
      map.set(key, [...(map.get(key) ?? []), s]);
    }
    return [...map.entries()];
  }, [slots]);

  const toggle = (slot: InterviewerSlot, reason = "") =>
    block.mutate(
      { slotId: slot.id, blocked: slot.status !== "blocked", reason },
      { onError: (e) => toast.error(errorMessage(e)) },
    );

  if (days.length === 0) {
    return <p className="px-5 pb-6 pt-4 text-sm text-ink-500">Add weekly hours to start generating slots.</p>;
  }

  const dayOffBooked = dayOff ? (days.find(([k]) => k === dayOff)?.[1] ?? []).filter((s) => s.status === "booked").length : 0;

  return (
    <div className="max-h-[720px] space-y-4 overflow-y-auto px-5 pb-5 pt-4">
      {days.map(([key, daySlots]) => (
        <div key={key}>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-ink-900">{formatDay(keyToDate(key))}</p>
            {daySlots.some((s) => s.status !== "blocked") && (
              <button onClick={() => setDayOff(key)} className="text-xs font-semibold text-ink-400 hover:text-rose-600">
                Take day off
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {daySlots.map((s) => (
              <button
                key={s.id}
                disabled={block.isPending}
                onClick={() => (s.status === "booked" ? setCancelling(s) : s.bookable_state === "too_soon" ? setSoonSlot(s) : toggle(s))}
                title={
                  s.status === "booked"
                    ? `${s.student_name} · ${s.badge_name}`
                    : s.status === "blocked"
                      ? "Blocked — click to reopen"
                      : s.bookable_state === "too_soon"
                        ? `Too soon to book — click to open it at short notice or block it`
                        : "Open — click to block"
                }
                className={clsx(
                  "rounded-md px-2 py-1 text-[11px] font-semibold transition",
                  s.bookable_state === "open" && "bg-white text-ink-700 ring-1 ring-inset ring-ink-200 hover:ring-rose-300",
                  s.bookable_state === "too_soon" && "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200",
                  s.status === "booked" && "bg-brand-600 text-white hover:bg-brand-700",
                  s.status === "blocked" && "striped-blocked bg-ink-100 text-ink-400 line-through ring-1 ring-inset ring-ink-200",
                )}
              >
                {formatTime(s.start_at)}
                {s.status === "booked" && <span className="ml-1 font-medium opacity-80">· {s.student_name?.split(" ")[0]}</span>}
              </button>
            ))}
          </div>
        </div>
      ))}

      <Modal
        open={Boolean(cancelling)}
        onClose={closeCancel}
        title="Cancel a booked interview?"
        description={cancelling ? `${cancelling.student_name} · ${cancelling.badge_name} · ${formatTime(cancelling.start_at)}` : ""}
        footer={
          <>
            <Button variant="secondary" onClick={closeCancel}>Keep it</Button>
            <Button
              variant="danger"
              icon={<Trash2 className="h-4 w-4" />}
              loading={block.isPending}
              disabled={cancelReason.trim().length < 10}
              onClick={() => {
                if (cancelling) toggle(cancelling, cancelReason.trim());
                closeCancel();
              }}
            >
              Block & cancel
            </Button>
          </>
        }
      >
        <p className="mb-4 text-sm text-ink-600">
          The student will be told right away, won't lose an attempt, and will be flagged for priority rebooking. The
          GRIT team is notified too. If you can do another time, reschedule it from your Schedule instead.
        </p>
        <Field label="Reason" hint="The student and the GRIT team see this (10+ characters).">
          {(id) => <Textarea id={id} value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />}
        </Field>
      </Modal>

      <Modal
        open={Boolean(soonSlot)}
        onClose={() => setSoonSlot(null)}
        title="Open this slot at short notice?"
        description={soonSlot ? `${formatDay(soonSlot.start_at)} · ${formatTime(soonSlot.start_at)} IST` : ""}
        footer={
          <>
            <Button
              variant="danger"
              loading={block.isPending}
              onClick={() => {
                if (soonSlot) toggle(soonSlot);
                setSoonSlot(null);
              }}
            >
              Block it
            </Button>
            <Button
              loading={shortNotice.isPending}
              onClick={() =>
                soonSlot &&
                shortNotice.mutate(
                  { slotIds: [soonSlot.id] },
                  {
                    onSuccess: () => {
                      toast.success("Open for booking", "Students can book this time at short notice.");
                      setSoonSlot(null);
                    },
                    onError: (e) => toast.error(errorMessage(e)),
                  },
                )
              }
            >
              Open for booking now
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-600">
          Students normally need {BOOKING_NOTICE_MIN} minutes' notice, so this slot is hidden from them. If you're free,
          open it and students can book it up to {SHORT_NOTICE_MIN} minutes before it starts.
        </p>
      </Modal>

      <Modal
        open={Boolean(dayOff)}
        onClose={closeDayOff}
        title="Take the day off?"
        description={dayOff ? formatDay(keyToDate(dayOff)) : ""}
        footer={
          <>
            <Button variant="secondary" onClick={closeDayOff}>Back</Button>
            <Button
              variant="danger"
              loading={blockDay.isPending}
              disabled={dayOffBooked > 0 && offReason.trim().length < 10}
              onClick={() =>
                dayOff &&
                blockDay.mutate(
                  { day: dayOff, reason: offReason.trim() || "Interviewer on leave" },
                  {
                    onSuccess: () => {
                      toast.success("Day blocked");
                      closeDayOff();
                    },
                    onError: (e) => toast.error(errorMessage(e)),
                  },
                )
              }
            >
              Block whole day
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-600">
          All open slots that day will be blocked.
          {dayOffBooked > 0 && (
            <strong className="text-rose-700"> {dayOffBooked} booked interview{dayOffBooked === 1 ? "" : "s"} will be cancelled</strong>
          )}
          {dayOffBooked > 0 && " and those students prioritised for rebooking."}
        </p>
        {dayOffBooked > 0 && (
          <Field label="Reason" hint="Sent to those students and the GRIT team (10+ characters)." className="mt-4">
            {(id) => <Textarea id={id} value={offReason} onChange={(e) => setOffReason(e.target.value)} />}
          </Field>
        )}
      </Modal>
    </div>
  );
}

function TracksCard({ badgeIds }: { badgeIds: string[] }) {
  const save = useSetMyBadges();
  const toast = useToast();
  return (
    <Card>
      <CardHeader title="Tracks you interview for" subtitle="Students only see your slots for these badges" />
      <div className="p-5 pt-4">
        <TrackPicker
          value={badgeIds}
          disabled={save.isPending}
          onChange={(ids) =>
            save.mutate(ids, {
              onSuccess: () => toast.success("Tracks updated"),
              onError: (e) => toast.error(errorMessage(e)),
            })
          }
        />
      </div>
    </Card>
  );
}
