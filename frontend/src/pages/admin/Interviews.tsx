import clsx from "clsx";
import { ListChecks, MessageSquareWarning, Siren } from "lucide-react";
import { useState } from "react";

import {
  InterviewFilters,
  useAllInterviews,
  useExcuseNoShow,
  useInterviewers,
  useRejectDispute,
  useReviewChange,
} from "../../api/admin";
import { Avatar } from "../../components/ui/Avatar";
import { Button } from "../../components/ui/Button";
import { Card, PageHeader } from "../../components/ui/Card";
import { Field, Input, Select, Textarea } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import { InterviewPill, OutcomePill, Pill } from "../../components/ui/Pill";
import { EmptyState, ErrorState, Skeleton } from "../../components/ui/Spinner";
import { useToast } from "../../components/ui/Toast";
import { errorMessage } from "../../lib/api";
import { formatDateTime } from "../../lib/format";
import { INTERVIEW_STATUS } from "../../lib/status";
import type { ChangeRequest, InterviewStatus, StaffInterview } from "../../lib/types";

const EMPTY: InterviewFilters = { status: "", day: "", interviewer_id: "", disputed: false, emergency: false };

const openDispute = (i: StaffInterview) => i.status === "no_show" && Boolean(i.disputed_at) && !i.dispute_resolution;
const pendingChange = (i: StaffInterview) => i.change_requests.find((r) => r.status === "pending") ?? null;

function FilterChip({ on, onClick, icon, label }: { on: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={clsx(
        "inline-flex h-10 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-sm font-semibold ring-1 ring-inset transition",
        on ? "bg-amber-500 text-white ring-amber-500" : "bg-white text-ink-700 ring-ink-200 hover:bg-ink-100/60",
      )}
    >
      {icon} {label}
    </button>
  );
}

export default function AdminInterviews() {
  const [filters, setFilters] = useState<InterviewFilters>(EMPTY);
  const { data, isLoading, error } = useAllInterviews(filters);
  const interviewers = useInterviewers();
  const set = (patch: Partial<InterviewFilters>) => setFilters((f) => ({ ...f, ...patch }));
  const [excusing, setExcusing] = useState<StaffInterview | null>(null);
  const [rejecting, setRejecting] = useState<StaffInterview | null>(null);
  const [reviewing, setReviewing] = useState<{ interview: StaffInterview; decision: "approve" | "reject" } | null>(null);

  return (
    <div>
      <PageHeader eyebrow="Interview team" title="All interviews" description="Every booking across interviewers, newest first." />
      <div className="mb-4 flex flex-wrap gap-2">
        <FilterChip
          on={filters.disputed}
          onClick={() => set({ disputed: !filters.disputed })}
          icon={<MessageSquareWarning className="h-4 w-4" />}
          label="Disputed"
        />
        <FilterChip
          on={filters.emergency}
          onClick={() => set({ emergency: !filters.emergency })}
          icon={<Siren className="h-4 w-4" />}
          label="Emergency changes"
        />
        <Select value={filters.status} onChange={(e) => set({ status: e.target.value as InterviewStatus | "" })} className="w-52">
          <option value="">Any status</option>
          {Object.entries(INTERVIEW_STATUS).map(([value, meta]) => (
            <option key={value} value={value}>
              {meta.label}
            </option>
          ))}
        </Select>
        <Select value={filters.interviewer_id} onChange={(e) => set({ interviewer_id: e.target.value })} className="w-48">
          <option value="">Any interviewer</option>
          {interviewers.data?.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
        <Input type="date" value={filters.day} onChange={(e) => set({ day: e.target.value })} className="w-44" />
        {(filters.status || filters.day || filters.interviewer_id || filters.disputed || filters.emergency) && (
          <Button variant="ghost" onClick={() => setFilters(EMPTY)}>
            Clear
          </Button>
        )}
      </div>

      {isLoading ? (
        <Skeleton className="h-80" />
      ) : error ? (
        <ErrorState error={errorMessage(error)} />
      ) : !data?.length ? (
        <Card>
          <EmptyState
            icon={<ListChecks className="h-5 w-5" />}
            title={filters.disputed ? "No disputes waiting" : filters.emergency ? "No emergency changes waiting" : "No interviews match"}
          />
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="table-base min-w-[760px]">
            <thead>
              <tr>
                <th>When</th>
                <th>Student</th>
                <th>Badge</th>
                <th>Interviewer</th>
                <th>Attempt</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.map((i) => (
                <tr key={i.id}>
                  <td className="whitespace-nowrap font-medium text-ink-900">{formatDateTime(i.start_at)}</td>
                  <td>
                    <div className="flex items-center gap-2.5">
                      <Avatar name={i.student.name} size="sm" />
                      <span className="font-semibold text-ink-900">{i.student.name}</span>
                    </div>
                  </td>
                  <td className="text-ink-600">{i.badge.name}</td>
                  <td className="text-ink-600">{i.interviewer.name}</td>
                  <td className="tabular-nums text-ink-600">#{i.attempt_no}</td>
                  <td>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {i.outcome ? <OutcomePill result={i.outcome.result} /> : <InterviewPill status={i.status} />}
                      {openDispute(i) && <Pill tone="amber">Disputed</Pill>}
                      {pendingChange(i) && <Pill tone="amber">Emergency change</Pill>}
                    </div>
                    <InterviewNotes interview={i} />
                  </td>
                  <td className="text-right">
                    {pendingChange(i) && (
                      <div className="flex justify-end gap-1.5">
                        <Button size="sm" variant="ghost" onClick={() => setReviewing({ interview: i, decision: "reject" })}>
                          Reject
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => setReviewing({ interview: i, decision: "approve" })}>
                          Approve
                        </Button>
                      </div>
                    )}
                    {i.status === "no_show" && (
                      <div className="flex justify-end gap-1.5">
                        {openDispute(i) && (
                          <Button size="sm" variant="ghost" onClick={() => setRejecting(i)}>
                            Reject
                          </Button>
                        )}
                        <Button size="sm" variant="secondary" onClick={() => setExcusing(i)}>
                          Excuse no-show
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      <ExcuseNoShowModal interview={excusing} onClose={() => setExcusing(null)} />
      <RejectDisputeModal interview={rejecting} onClose={() => setRejecting(null)} />
      <ReviewChangeModal review={reviewing} onClose={() => setReviewing(null)} />
    </div>
  );
}

function InterviewNotes({ interview: i }: { interview: StaffInterview }) {
  const lines: [string, string][] = [];
  if (i.no_show_note) lines.push(["Interviewer", i.no_show_note]);
  if (i.dispute_reason) lines.push(["Student", i.dispute_reason]);
  if (i.cancel_reason) lines.push(["", i.cancel_reason]);
  const change = i.change_requests[i.change_requests.length - 1];
  if (change) {
    lines.push(["Emergency change", `${changeSummary(change)} \u2014 \u201c${change.reason}\u201d`]);
    if (change.status !== "pending")
      lines.push([change.status === "approved" ? "Approved" : "Rejected", change.resolution_note ?? ""]);
  }
  if (!lines.length) return null;
  return (
    <div className="mt-1 max-w-[320px] space-y-0.5">
      {lines.map(([who, text]) => (
        <p key={who + text} className="text-[11px] text-ink-500">
          {who && <span className="font-semibold text-ink-700">{who}: </span>}
          {text}
        </p>
      ))}
    </div>
  );
}

function changeSummary(c: ChangeRequest): string {
  return c.to_start_at
    ? `moved from ${formatDateTime(c.from_start_at)} to ${formatDateTime(c.to_start_at)}`
    : `cancelled ${formatDateTime(c.from_start_at)}`;
}

function ReasonModal({
  interview,
  onClose,
  title,
  hint,
  confirmLabel,
  danger,
  pending,
  onConfirm,
  notes,
  minLength = 10,
  label = "Reason",
}: {
  interview: StaffInterview | null;
  onClose: () => void;
  title: string;
  hint: string;
  confirmLabel: string;
  danger?: boolean;
  pending: boolean;
  onConfirm: (reason: string, done: () => void) => void;
  notes?: [string, string][];
  minLength?: number;
  label?: string;
}) {
  const [reason, setReason] = useState("");
  const close = () => {
    setReason("");
    onClose();
  };
  return (
    <Modal
      open={Boolean(interview)}
      onClose={close}
      title={title}
      description={interview ? `${interview.student.name} · ${interview.badge.name} · ${formatDateTime(interview.start_at)}` : ""}
      footer={
        <>
          <Button variant="secondary" onClick={close}>
            Cancel
          </Button>
          <Button
            variant={danger ? "danger" : "primary"}
            disabled={reason.trim().length < minLength}
            loading={pending}
            onClick={() => onConfirm(reason, close)}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {(() => {
        const shown =
          notes ??
          (interview
            ? ([
                ["Interviewer", interview.no_show_note],
                ["Student", interview.dispute_reason],
              ].filter(([, t]) => t) as [string, string][])
            : []);
        return shown.length ? (
          <div className="mb-4 space-y-2 rounded-xl bg-ink-100/60 p-3 text-[13px] text-ink-700">
            {shown.map(([who, text]) => (
              <p key={who}>
                <span className="font-semibold text-ink-900">{who}:</span> {text}
              </p>
            ))}
          </div>
        ) : null;
      })()}
      <Field label={label} hint={hint}>
        {(id) => <Textarea id={id} value={reason} onChange={(e) => setReason(e.target.value)} />}
      </Field>
    </Modal>
  );
}

function ExcuseNoShowModal({ interview, onClose }: { interview: StaffInterview | null; onClose: () => void }) {
  const excuse = useExcuseNoShow();
  const toast = useToast();
  return (
    <ReasonModal
      interview={interview}
      onClose={onClose}
      title="Excuse this no-show?"
      hint="e.g. the student was in the room but the interviewer marked them absent, or the link was broken. Saved to the audit trail."
      confirmLabel="Excuse and refund attempt"
      pending={excuse.isPending}
      onConfirm={(reason, done) =>
        interview &&
        excuse.mutate(
          { id: interview.id, reason },
          {
            onSuccess: () => {
              toast.success("No-show excused", "The attempt was refunded and the student can rebook.");
              done();
            },
            onError: (e) => toast.error(errorMessage(e)),
          },
        )
      }
    />
  );
}

function RejectDisputeModal({ interview, onClose }: { interview: StaffInterview | null; onClose: () => void }) {
  const reject = useRejectDispute();
  const toast = useToast();
  return (
    <ReasonModal
      interview={interview}
      onClose={onClose}
      title="Reject this dispute?"
      hint="The student sees this reason. The no-show stands and still counts as an attempt."
      confirmLabel="Reject dispute"
      danger
      pending={reject.isPending}
      onConfirm={(reason, done) =>
        interview &&
        reject.mutate(
          { id: interview.id, reason },
          {
            onSuccess: () => {
              toast.info("Dispute rejected", "The student has been told why.");
              done();
            },
            onError: (e) => toast.error(errorMessage(e)),
          },
        )
      }
    />
  );
}

function ReviewChangeModal({
  review,
  onClose,
}: {
  review: { interview: StaffInterview; decision: "approve" | "reject" } | null;
  onClose: () => void;
}) {
  const mutation = useReviewChange();
  const toast = useToast();
  const change = review ? pendingChange(review.interview) : null;
  const approve = review?.decision === "approve";
  return (
    <ReasonModal
      interview={review?.interview ?? null}
      onClose={onClose}
      title={approve ? "Approve this emergency change?" : "Reject this emergency change?"}
      hint={
        approve
          ? "Optional. No attempt is used and the student is told it was approved."
          : "The student sees this. The late change counts as one of their attempts."
      }
      label={approve ? "Note (optional)" : "Reason"}
      minLength={approve ? 0 : 10}
      confirmLabel={approve ? "Approve — no attempt used" : "Reject — count an attempt"}
      danger={!approve}
      pending={mutation.isPending}
      notes={change ? [["Student", change.reason], ["Change", changeSummary(change)]] : []}
      onConfirm={(reason, done) =>
        change &&
        review &&
        mutation.mutate(
          { id: change.id, decision: review.decision, reason },
          {
            onSuccess: () => {
              toast.success(approve ? "Change approved" : "Change rejected", "The student has been told.");
              done();
            },
            onError: (e) => toast.error(errorMessage(e)),
          },
        )
      }
    />
  );
}
