import clsx from "clsx";
import { AlertTriangle, ArrowLeft, CalendarCheck2, CalendarOff, CalendarX2, Moon, Sun, Sunrise, Video } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";

import { useBook, useDashboard, useEmergencyChange, useOpenSlots, useReschedule } from "../../api/student";
import { Button, LinkButton } from "../../components/ui/Button";
import { Card, PageHeader } from "../../components/ui/Card";
import { Field, Textarea } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import { EmptyState, ErrorState, Skeleton } from "../../components/ui/Spinner";
import { BOOKING_NOTICE_MIN } from "../../lib/policy";
import { useToast } from "../../components/ui/Toast";
import { BadgeMedallion } from "../../features/student/BadgeMedallion";
import { errorCode, errorMessage } from "../../lib/api";
import { MonthCalendar } from "../../components/calendar/MonthCalendar";
import { addDaysToKey, formatDateTime, formatLongDay, formatTime, istDateKey, istHour, keyToDate } from "../../lib/format";
import type { Slot } from "../../lib/types";

const PARTS = [
  { key: "morning", label: "Morning", icon: Sunrise, test: (h: number) => h < 12 },
  { key: "afternoon", label: "Afternoon", icon: Sun, test: (h: number) => h >= 12 && h < 17 },
  { key: "evening", label: "Evening", icon: Moon, test: (h: number) => h >= 17 },
];

const HORIZON_DAYS = 14;

export default function StudentBook() {
  const { badgeId = "" } = useParams();
  const [search] = useSearchParams();
  const rescheduleId = search.get("reschedule");
  const emergencyId = search.get("emergency");
  const navigate = useNavigate();
  const toast = useToast();

  const dashboard = useDashboard();
  const slots = useOpenSlots(badgeId);
  const book = useBook();
  const reschedule = useReschedule();
  const emergency = useEmergencyChange();
  const [emergencyOpen, setEmergencyOpen] = useState<"slot" | "cancel" | null>(null);

  const item = dashboard.data?.journeys.find((j) => j.badge.id === badgeId);
  const today = istDateKey(new Date());
  const days = useMemo(() => Array.from({ length: HORIZON_DAYS }, (_, i) => addDaysToKey(today, i)), [today]);

  // One chip per start time; several interviewers at the same time collapse into one choice.
  const byDay = useMemo(() => {
    const map = new Map<string, Map<string, Slot[]>>();
    for (const slot of slots.data ?? []) {
      const day = istDateKey(slot.start_at);
      const times = map.get(day) ?? new Map<string, Slot[]>();
      times.set(slot.start_at, [...(times.get(slot.start_at) ?? []), slot]);
      map.set(day, times);
    }
    return map;
  }, [slots.data]);

  const dayCounts = useMemo(() => new Map([...byDay.entries()].map(([d, times]) => [d, times.size])), [byDay]);
  const firstDayWithSlots = days.find((d) => byDay.has(d)) ?? today;
  const [pickedDay, setPickedDay] = useState<string | null>(null);
  const day = pickedDay ?? firstDayWithSlots;
  const [selected, setSelected] = useState<Slot | null>(null);

  if (dashboard.isLoading) return <Skeleton className="h-96" />;
  if (dashboard.error) return <ErrorState error={errorMessage(dashboard.error)} />;
  if (!item) return <ErrorState error="Badge not found." />;

  const current = item.current_interview;
  const isReschedule = Boolean(rescheduleId && current?.id === rescheduleId && current.student_actions.reschedule.allowed);
  const isEmergency = Boolean(
    emergencyId && current?.id === emergencyId && current.student_actions.emergency_change.allowed,
  );
  if (!item.can_book && !isReschedule && !isEmergency) {
    const why =
      (emergencyId && current?.student_actions.emergency_change.reason) ||
      (rescheduleId && current?.student_actions.reschedule.reason) ||
      item.block_reason;
    return (
      <Card>
        <EmptyState
          icon={<CalendarOff className="h-5 w-5" />}
          title={emergencyId || rescheduleId ? "This interview can't be changed here" : "Booking isn't open for this badge"}
          action={<LinkButton to="/student" variant="secondary">Back to home</LinkButton>}
        >
          {why}
        </EmptyState>
      </Card>
    );
  }

  const times = [...(byDay.get(day)?.entries() ?? [])];
  const mutation = isReschedule ? reschedule : book;

  const submitEmergency = (reason: string, slot: Slot | null) => {
    if (!current) return;
    emergency.mutate(
      { interviewId: current.id, reason, slotId: slot?.id ?? null },
      {
        onSuccess: () => {
          toast.success(
            slot ? "Interview moved" : "Interview cancelled",
            "The GRIT team will review your reason. If it's approved, no attempt is used.",
          );
          navigate("/student");
        },
        onError: (e) => {
          toast.error("Couldn't make the change", errorMessage(e));
          if (errorCode(e) === "slot_taken") {
            setSelected(null);
            setEmergencyOpen(null);
            slots.refetch();
          }
        },
      },
    );
  };

  const confirm = () => {
    if (!selected) return;
    const onError = (e: unknown) => {
      toast.error(isReschedule ? "Couldn't reschedule" : "Couldn't book", errorMessage(e));
      if (errorCode(e) === "slot_taken") {
        setSelected(null);
        slots.refetch();
      }
    };
    const onSuccess = () => {
      toast.success(isReschedule ? "Interview rescheduled" : "You're booked!", formatDateTime(selected.start_at));
      navigate("/student");
    };
    if (isReschedule && current) {
      reschedule.mutate({ interviewId: current.id, slotId: selected.id }, { onSuccess, onError });
    } else {
      book.mutate({ badge_id: badgeId, slot_id: selected.id }, { onSuccess, onError });
    }
  };

  return (
    <div>
      <Link to="/student" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-800">
        <ArrowLeft className="h-4 w-4" /> Home
      </Link>
      <PageHeader
        eyebrow={isEmergency ? "Emergency change" : isReschedule ? "Reschedule" : "Book your interview"}
        title={
          <span className="flex items-center gap-3">
            <BadgeMedallion badge={item.badge} state="progress" size="sm" />
            {item.badge.name}
          </span>
        }
        action={
          isEmergency ? (
            <Button variant="secondary" onClick={() => setEmergencyOpen("cancel")} icon={<CalendarX2 className="h-4 w-4" />}>
              Cancel without a new time
            </Button>
          ) : undefined
        }
        description={
          isEmergency && current
            ? `Currently ${formatDateTime(current.start_at)}. Pick a new time and tell the GRIT team what happened. If they approve it, no attempt is used; if not, this change counts as one attempt.`
            : isReschedule && current
            ? current.moved_by_interviewer_at
              ? `Currently ${formatDateTime(current.start_at)}. Your interviewer moved this, so changing it is free.`
              : `Currently ${formatDateTime(current.start_at)}. Pick a new time — ${item.reschedules_left} reschedule${item.reschedules_left === 1 ? "" : "s"} left.`
            : `${item.badge.interview_minutes}-minute live interview on video. All times are in IST.`
        }
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
        <Card className="h-fit p-4 sm:p-5">
          <MonthCalendar
            selected={day}
            counts={dayCounts}
            minKey={today}
            maxKey={days[days.length - 1]!}
            onSelect={(d) => {
              setPickedDay(d);
              setSelected(null);
            }}
          />
          <p className="mt-3 text-xs text-ink-500">
            You can book up to {HORIZON_DAYS} days ahead. Slots starting in the next {BOOKING_NOTICE_MIN} minutes aren't
            shown, so your interviewer has notice. Times are in IST.
          </p>
        </Card>

        <Card className="p-4 sm:p-6">
          <h2 className="font-display text-base font-bold text-ink-900">{formatLongDay(keyToDate(day))}</h2>
          {slots.isLoading ? (
            <Skeleton className="mt-4 h-40" />
          ) : times.length === 0 ? (
            <EmptyState icon={<CalendarOff className="h-5 w-5" />} title="No open slots this day">
              {day === today
                ? `Slots need to be booked at least ${BOOKING_NOTICE_MIN} minutes ahead. Pick a highlighted date on the calendar.`
                : "Pick a highlighted date on the calendar."}
            </EmptyState>
          ) : (
            <div className="mt-4 space-y-5">
              {PARTS.map((part) => {
                const group = times.filter(([start]) => part.test(istHour(start)));
                if (!group.length) return null;
                return (
                  <div key={part.key}>
                    <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ink-400">
                      <part.icon className="h-3.5 w-3.5" /> {part.label}
                    </p>
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-5">
                      {group.map(([start, options]) => {
                        const active = selected?.start_at === start;
                        return (
                          <button
                            key={start}
                            onClick={() => setSelected(options[0]!)}
                            className={clsx(
                              "rounded-lg border px-2 py-2.5 text-sm font-semibold transition",
                              active
                                ? "border-brand-600 bg-brand-50 text-brand-800 ring-2 ring-brand-600/20"
                                : "border-ink-200 bg-white text-ink-800 hover:border-brand-400 hover:text-brand-700",
                            )}
                          >
                            {formatTime(start)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      <div
        className={clsx(
          "sticky bottom-20 z-20 mt-4 transition lg:bottom-6",
          selected ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0",
        )}
      >
        <div className="flex items-center justify-between gap-4 rounded-2xl bg-ink-950 px-5 py-3.5 text-white shadow-lift">
          <div className="min-w-0">
            <p className="text-xs text-ink-400">Selected</p>
            <p className="font-semibold leading-snug">{selected && formatDateTime(selected.start_at)}</p>
          </div>
          {isEmergency ? (
            <Button onClick={() => setEmergencyOpen("slot")} disabled={!selected} icon={<CalendarCheck2 className="h-4 w-4" />}>
              Review change
            </Button>
          ) : (
            <ConfirmButton
              selected={selected}
              loading={mutation.isPending}
              onConfirm={confirm}
              isReschedule={isReschedule}
              badgeName={item.badge.name}
            />
          )}
        </div>
      </div>
      {isEmergency && current && (
        <EmergencyModal
          open={emergencyOpen !== null}
          slot={emergencyOpen === "slot" ? selected : null}
          currentStart={current.start_at}
          badgeName={item.badge.name}
          loading={emergency.isPending}
          onClose={() => setEmergencyOpen(null)}
          onConfirm={(reason) => submitEmergency(reason, emergencyOpen === "slot" ? selected : null)}
        />
      )}
    </div>
  );
}

const MIN_REASON = 20;

function EmergencyModal({
  open,
  slot,
  currentStart,
  badgeName,
  loading,
  onClose,
  onConfirm,
}: {
  open: boolean;
  slot: Slot | null;
  currentStart: string;
  badgeName: string;
  loading: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={slot ? "Emergency reschedule" : "Emergency cancellation"}
      description={`${badgeName} interview · currently ${formatDateTime(currentStart)}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Back
          </Button>
          <Button
            variant={slot ? "primary" : "danger"}
            disabled={reason.trim().length < MIN_REASON}
            loading={loading}
            onClick={() => onConfirm(reason)}
          >
            {slot ? "Move my interview" : "Cancel my interview"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {slot ? (
          <div className="rounded-xl bg-ink-100/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-500">New time</p>
            <p className="mt-1 font-display text-lg font-bold text-ink-950">{formatDateTime(slot.start_at)}</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-ink-600">
              <Video className="h-4 w-4" /> Video call with {slot.interviewer.name}
            </p>
          </div>
        ) : (
          <p className="text-sm text-ink-600">Your slot is released now and you can book a new one whenever you're ready.</p>
        )}
        <div className="flex gap-2.5 rounded-xl bg-amber-50 px-4 py-3 text-[13px] text-amber-900 ring-1 ring-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            This is within 12 hours of your interview, so the GRIT team reviews it. <strong>Approved:</strong> no attempt
            is used. <strong>Not approved:</strong> this change counts as one of your attempts. You get one emergency
            change per attempt.
          </p>
        </div>
        <Field label="What happened?" hint={`The team decides based on this (${MIN_REASON}+ characters).`}>
          {(id) => (
            <Textarea
              id={id}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. A family member was taken to hospital this morning and I need to be with them."
            />
          )}
        </Field>
      </div>
    </Modal>
  );
}

function ConfirmButton({
  selected,
  loading,
  onConfirm,
  isReschedule,
  badgeName,
}: {
  selected: Slot | null;
  loading: boolean;
  onConfirm: () => void;
  isReschedule: boolean;
  badgeName: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)} disabled={!selected} icon={<CalendarCheck2 className="h-4 w-4" />}>
        {isReschedule ? "Review change" : "Review booking"}
      </Button>
      <Modal
        open={open && Boolean(selected)}
        onClose={() => setOpen(false)}
        title={isReschedule ? "Confirm new time" : "Confirm your interview"}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Back
            </Button>
            <Button loading={loading} onClick={onConfirm}>
              {isReschedule ? "Confirm reschedule" : "Confirm booking"}
            </Button>
          </>
        }
      >
        {selected && (
          <div className="space-y-4">
            <div className="rounded-xl bg-ink-100/60 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-ink-500">{badgeName} interview</p>
              <p className="mt-1 font-display text-lg font-bold text-ink-950">{formatDateTime(selected.start_at)}</p>
              <p className="mt-0.5 flex items-center gap-1.5 text-sm text-ink-600">
                <Video className="h-4 w-4" /> Video call with {selected.interviewer.name}
              </p>
            </div>
            <ul className="space-y-2 text-sm text-ink-600">
              <li>• The join link appears on your dashboard. Join 5 minutes early.</li>
              <li>• Reschedule or cancel up to 12 hours before — after that, changes close.</li>
              <li>• Missing the interview counts as one of your attempts.</li>
            </ul>
          </div>
        )}
      </Modal>
    </>
  );
}
