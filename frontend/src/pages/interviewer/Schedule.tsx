import { CalendarDays, ChevronLeft, ChevronRight, Coffee } from "lucide-react";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";

import { useMarkNoShow, useSchedule, useStartInterview } from "../../api/interviewer";
import { useAuth } from "../../auth/AuthContext";
import { Button, LinkButton } from "../../components/ui/Button";
import { Card, PageHeader } from "../../components/ui/Card";
import { Field, Input, Textarea } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import { EmptyState, ErrorState, Skeleton } from "../../components/ui/Spinner";
import { useToast } from "../../components/ui/Toast";
import { ReportMalpracticeModal } from "../../features/integrity/IntegrityModals";
import { InterviewerCancelModal, InterviewerRescheduleModal } from "../../features/interviewer/ChangeInterviewModals";
import { OutcomeModal } from "../../features/interviewer/OutcomeModal";
import { ScheduleRow } from "../../features/interviewer/ScheduleRow";
import { errorMessage } from "../../lib/api";
import { addDaysToKey, formatLongDay, istDateKey, keyToDate } from "../../lib/format";
import type { ScheduleItem } from "../../lib/types";
import { useNow } from "../../lib/useNow";

export default function InterviewerSchedule() {
  const { user } = useAuth();
  const today = istDateKey(new Date());
  const [params] = useSearchParams();
  const [day, setDay] = useState(params.get("day") ?? today);
  const [reporting, setReporting] = useState<ScheduleItem | null>(null);
  const { data, isLoading, error, refetch } = useSchedule(day);
  const start = useStartInterview();
  const noShow = useMarkNoShow();
  const toast = useToast();
  const now = useNow();
  const [recording, setRecording] = useState<ScheduleItem | null>(null);
  const [moving, setMoving] = useState<ScheduleItem | null>(null);
  const [cancelling, setCancelling] = useState<ScheduleItem | null>(null);
  const [confirmNoShow, setConfirmNoShow] = useState<ScheduleItem | null>(null);
  const [noShowNote, setNoShowNote] = useState("");
  const closeNoShow = () => {
    setConfirmNoShow(null);
    setNoShowNote("");
  };

  const items = data ?? [];
  const live = items.filter((i) => i.status !== "cancelled_interviewer");
  const done = live.filter((i) => i.status === "completed" || i.status === "no_show").length;

  return (
    <div>
      <PageHeader
        eyebrow={`Hi ${user?.name.split(" ")[0]}`}
        title={day === today ? "Today's interviews" : formatLongDay(keyToDate(day))}
        description={
          isLoading
            ? " "
            : live.length
              ? `${live.length} interview${live.length === 1 ? "" : "s"} · ${done} done · ${live.length - done} to go`
              : "No interviews booked for this day."
        }
        action={
          <div className="flex items-center gap-1.5">
            <Button variant="secondary" size="sm" onClick={() => setDay(addDaysToKey(day, -1))} aria-label="Previous day">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant={day === today ? "dark" : "secondary"} size="sm" onClick={() => setDay(today)}>
              Today
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setDay(addDaysToKey(day, 1))} aria-label="Next day">
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Input type="date" value={day} onChange={(e) => e.target.value && setDay(e.target.value)} className="h-8 w-[150px] text-[13px]" />
          </div>
        }
      />

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      ) : error ? (
        <ErrorState error={errorMessage(error)} onRetry={refetch} />
      ) : items.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Coffee className="h-5 w-5" />}
            title="A free day"
            action={
              <LinkButton to="/interviewer/availability" variant="secondary" icon={<CalendarDays className="h-4 w-4" />}>
                Manage availability
              </LinkButton>
            }
          >
            Students book from your open slots. Add more availability if you'd like more interviews.
          </EmptyState>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <ScheduleRow
              key={item.id}
              item={item}
              now={now}
              busy={start.isPending || noShow.isPending}
              onStart={() =>
                start.mutate(item.id, {
                  onSuccess: () => toast.success("Marked as started", "Record the outcome when you're done."),
                  onError: (e) => toast.error(errorMessage(e)),
                })
              }
              onNoShow={() => setConfirmNoShow(item)}
              onRecord={() => setRecording(item)}
              onReport={() => setReporting(item)}
              onReschedule={() => setMoving(item)}
              onCancel={() => setCancelling(item)}
            />
          ))}
        </div>
      )}

      <OutcomeModal item={recording} onClose={() => setRecording(null)} />
      <InterviewerRescheduleModal item={moving} onClose={() => setMoving(null)} />
      <InterviewerCancelModal item={cancelling} onClose={() => setCancelling(null)} />
      <ReportMalpracticeModal
        target={reporting ? { id: reporting.id, studentName: reporting.student.name, badgeName: reporting.badge.name } : null}
        onClose={() => setReporting(null)}
      />

      <Modal
        open={Boolean(confirmNoShow)}
        onClose={closeNoShow}
        title="Mark as no-show?"
        description={confirmNoShow ? `${confirmNoShow.student.name} · ${confirmNoShow.badge.name}` : ""}
        footer={
          <>
            <Button variant="secondary" onClick={closeNoShow}>
              Back
            </Button>
            <Button
              variant="danger"
              disabled={noShowNote.trim().length < 10}
              loading={noShow.isPending}
              onClick={() =>
                confirmNoShow &&
                noShow.mutate(
                  { id: confirmNoShow.id, note: noShowNote },
                  {
                    onSuccess: () => {
                      toast.info("Marked as no-show", "The student has been notified.");
                      closeNoShow();
                    },
                    onError: (e) => toast.error(errorMessage(e)),
                  },
                )
              }
            >
              Mark no-show
            </Button>
          </>
        }
      >
        <p className="mb-4 text-sm text-ink-600">
          This uses one of the student's attempts and they can rebook after 3 days. The student can dispute it, and the
          GRIT team will review your note, so only do this if they didn't join at all.
        </p>
        <Field label="Note for the team" hint="e.g. how long you waited and whether you tried to reach them.">
          {(id) => (
            <Textarea
              id={id}
              value={noShowNote}
              onChange={(e) => setNoShowNote(e.target.value)}
              placeholder="Waited 15 minutes in the meeting; the student never joined."
            />
          )}
        </Field>
      </Modal>
    </div>
  );
}
