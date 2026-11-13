import { CalendarPlus } from "lucide-react";
import { useMemo, useState } from "react";

import { useAvailability, useInterviewerCancel, useInterviewerReschedule } from "../../api/interviewer";
import { Button, LinkButton } from "../../components/ui/Button";
import { Field, Select, Textarea } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import { useToast } from "../../components/ui/Toast";
import { errorCode, errorMessage } from "../../lib/api";
import { formatDateTime, formatDay, formatTime, istDateKey } from "../../lib/format";
import type { ScheduleItem } from "../../lib/types";

const MIN_REASON = 10;

function useReason() {
  const [reason, setReason] = useState("");
  return { reason, setReason, valid: reason.trim().length >= MIN_REASON, reset: () => setReason("") };
}

function ReasonField({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <Field label="Reason" hint={`The student and the GRIT team see this (${MIN_REASON}+ characters).`}>
      {(id) => <Textarea id={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />}
    </Field>
  );
}

export function InterviewerRescheduleModal({ item, onClose }: { item: ScheduleItem | null; onClose: () => void }) {
  const availability = useAvailability();
  const reschedule = useInterviewerReschedule();
  const toast = useToast();
  const { reason, setReason, valid, reset } = useReason();
  const [slotId, setSlotId] = useState("");

  // Only slots a student could book right now (open and with enough notice).
  const days = useMemo(() => {
    const groups = new Map<string, { id: string; start_at: string }[]>();
    for (const s of availability.data?.slots ?? []) {
      if (s.bookable_state !== "open") continue;
      const key = istDateKey(s.start_at);
      groups.set(key, [...(groups.get(key) ?? []), s]);
    }
    return [...groups.values()];
  }, [availability.data]);

  const close = () => {
    reset();
    setSlotId("");
    onClose();
  };

  return (
    <Modal
      open={Boolean(item)}
      onClose={close}
      title="Reschedule this interview"
      description={item ? `${item.student.name} · ${item.badge.name} · ${formatDateTime(item.start_at)}` : ""}
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Back
          </Button>
          <Button
            disabled={!valid || !slotId}
            loading={reschedule.isPending}
            onClick={() =>
              item &&
              reschedule.mutate(
                { id: item.id, slotId, fromSlotId: item.slot_id, reason },
                {
                  onSuccess: () => {
                    toast.success("Interview moved", "The student and the GRIT team have been told why.");
                    close();
                  },
                  onError: (e) => {
                    toast.error("Couldn't reschedule", errorMessage(e));
                    if (errorCode(e) === "slot_taken") {
                      setSlotId("");
                      availability.refetch();
                    }
                  },
                },
              )
            }
          >
            Move interview
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {availability.isLoading ? (
          <p className="text-sm text-ink-500">Loading your open slots…</p>
        ) : days.length === 0 ? (
          <div className="rounded-xl bg-ink-100/60 p-4 text-sm text-ink-600">
            <p>You have no open slots to move this to. Add availability first, or cancel the interview instead.</p>
            <LinkButton to="/interviewer/availability" size="sm" variant="secondary" className="mt-3" icon={<CalendarPlus className="h-4 w-4" />}>
              Add availability
            </LinkButton>
          </div>
        ) : (
          <Field label="New time" hint="One of your open slots. Students need at least 30 minutes' notice.">
            {(id) => (
              <Select id={id} value={slotId} onChange={(e) => setSlotId(e.target.value)}>
                <option value="">Pick a time</option>
                {days.map((slots) => (
                  <optgroup key={slots[0]!.start_at} label={formatDay(slots[0]!.start_at)}>
                    {slots.map((s) => (
                      <option key={s.id} value={s.id}>
                        {formatDay(s.start_at)} · {formatTime(s.start_at)} IST
                      </option>
                    ))}
                  </optgroup>
                ))}
              </Select>
            )}
          </Field>
        )}
        <ReasonField value={reason} onChange={setReason} placeholder="e.g. I've been pulled into an all-day review I can't move." />
        <p className="text-xs text-ink-500">
          Your current time will be blocked. The student can change or cancel the new time for free if it doesn't suit
          them.
        </p>
      </div>
    </Modal>
  );
}

export function InterviewerCancelModal({ item, onClose }: { item: ScheduleItem | null; onClose: () => void }) {
  const cancel = useInterviewerCancel();
  const toast = useToast();
  const { reason, setReason, valid, reset } = useReason();
  const close = () => {
    reset();
    onClose();
  };
  return (
    <Modal
      open={Boolean(item)}
      onClose={close}
      title="Cancel this interview?"
      description={item ? `${item.student.name} · ${item.badge.name} · ${formatDateTime(item.start_at)}` : ""}
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Keep it
          </Button>
          <Button
            variant="danger"
            disabled={!valid}
            loading={cancel.isPending}
            onClick={() =>
              item &&
              cancel.mutate(
                { id: item.id, fromSlotId: item.slot_id, reason },
                {
                  onSuccess: () => {
                    toast.info("Interview cancelled", "The student and the GRIT team have been told why.");
                    close();
                  },
                  onError: (e) => toast.error("Couldn't cancel", errorMessage(e)),
                },
              )
            }
          >
            Cancel interview
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-ink-600">
          The student keeps their attempt and moves to the front of the queue to rebook. The slot is blocked on your
          calendar. If you can do another time, use Reschedule instead.
        </p>
        <ReasonField value={reason} onChange={setReason} placeholder="e.g. I'm unwell and can't take interviews today." />
      </div>
    </Modal>
  );
}
