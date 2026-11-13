import clsx from "clsx";
import { CheckCircle2, RefreshCcw, XCircle } from "lucide-react";
import { useState } from "react";

import { useRecordOutcome } from "../../api/interviewer";
import { Button } from "../../components/ui/Button";
import { Field, Input, Textarea } from "../../components/ui/Field";
import { Modal } from "../../components/ui/Modal";
import { useToast } from "../../components/ui/Toast";
import { errorMessage } from "../../lib/api";
import { addDaysToKey, formatDateTime, istDateKey } from "../../lib/format";
import { RUBRIC } from "../../lib/status";
import type { OutcomeResult, ScheduleItem } from "../../lib/types";

const RESULTS: { value: OutcomeResult; label: string; hint: string; icon: typeof CheckCircle2; tone: string }[] = [
  { value: "pass", label: "Pass", hint: "Award the badge now", icon: CheckCircle2, tone: "emerald" },
  { value: "retake_later", label: "Retake later", hint: "Close — no attempt used", icon: RefreshCcw, tone: "amber" },
  { value: "fail", label: "Fail", hint: "Uses an attempt · 14-day wait", icon: XCircle, tone: "rose" },
];

const SELECTED = {
  emerald: "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/20",
  amber: "border-amber-500 bg-amber-50 ring-2 ring-amber-500/20",
  rose: "border-rose-500 bg-rose-50 ring-2 ring-rose-500/20",
};
const ICON = { emerald: "text-emerald-600", amber: "text-amber-600", rose: "text-rose-600" };

export function OutcomeModal({ item, onClose }: { item: ScheduleItem | null; onClose: () => void }) {
  return (
    <Modal
      open={Boolean(item)}
      onClose={onClose}
      size="lg"
      title="Record outcome"
      description={item ? `${item.student.name} · ${item.badge.name} · ${formatDateTime(item.start_at)}` : undefined}
    >
      {item && <OutcomeForm key={item.id} item={item} onDone={onClose} />}
    </Modal>
  );
}

function OutcomeForm({ item, onDone }: { item: ScheduleItem; onDone: () => void }) {
  const record = useRecordOutcome();
  const toast = useToast();
  const today = istDateKey(new Date());
  const [result, setResult] = useState<OutcomeResult | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [feedback, setFeedback] = useState("");
  const [notes, setNotes] = useState("");
  const [retakeAfter, setRetakeAfter] = useState(addDaysToKey(today, 7));
  const [error, setError] = useState<string | null>(null);

  const needsFeedback = result !== null && result !== "pass";
  const ready =
    result !== null &&
    RUBRIC.every((r) => scores[r.key]) &&
    (!needsFeedback || feedback.trim().length >= 20) &&
    (result !== "retake_later" || Boolean(retakeAfter));

  const submit = () => {
    if (!result) return;
    setError(null);
    record.mutate(
      {
        id: item.id,
        body: {
          result,
          scores,
          feedback_to_student: feedback,
          internal_notes: notes,
          retake_after: result === "retake_later" ? retakeAfter : null,
        },
      },
      {
        onSuccess: () => {
          toast.success("Outcome recorded", `${item.student.name} has been notified.`);
          onDone();
        },
        onError: (e) => setError(errorMessage(e)),
      },
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="mb-2 text-[13px] font-semibold text-ink-800">Result</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {RESULTS.map((r) => (
            <button
              key={r.value}
              onClick={() => setResult(r.value)}
              className={clsx(
                "flex items-start gap-2.5 rounded-xl border p-3 text-left transition",
                result === r.value ? SELECTED[r.tone as keyof typeof SELECTED] : "border-ink-200 hover:border-ink-300",
              )}
            >
              <r.icon className={clsx("mt-0.5 h-5 w-5 shrink-0", ICON[r.tone as keyof typeof ICON])} />
              <span>
                <span className="block text-sm font-bold text-ink-900">{r.label}</span>
                <span className="block text-xs text-ink-500">{r.hint}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-[13px] font-semibold text-ink-800">Rubric</p>
        <div className="space-y-2.5">
          {RUBRIC.map((r) => (
            <div key={r.key} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-ink-900">{r.label}</p>
                <p className="text-xs text-ink-500">{r.hint}</p>
              </div>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => setScores((s) => ({ ...s, [r.key]: n }))}
                    className={clsx(
                      "h-9 w-9 rounded-lg text-sm font-semibold transition",
                      scores[r.key] === n ? "bg-ink-900 text-white" : "bg-ink-100 text-ink-600 hover:bg-ink-200",
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {result === "retake_later" && (
        <Field label="Student can retake from" hint="They'll be able to book again from this date.">
          {(id) => (
            <Input
              id={id}
              type="date"
              value={retakeAfter}
              min={addDaysToKey(today, 1)}
              max={addDaysToKey(today, 60)}
              onChange={(e) => setRetakeAfter(e.target.value)}
              className="max-w-[200px]"
            />
          )}
        </Field>
      )}

      <Field
        label={`Feedback for the student${needsFeedback ? "" : " (optional)"}`}
        hint={needsFeedback ? `Be specific and kind — this is shown on their dashboard. ${feedback.trim().length}/20 characters minimum.` : "Shown on their dashboard."}
      >
        {(id) => (
          <Textarea
            id={id}
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="What went well, and the one or two things to work on next…"
          />
        )}
      </Field>

      <Field label="Internal notes (optional)" hint="Only visible to interviewers and the GRIT team.">
        {(id) => <Textarea id={id} value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-[64px]" />}
      </Field>

      {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

      <div className="flex justify-end gap-2 border-t border-ink-100 pt-4">
        <Button variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button disabled={!ready} loading={record.isPending} onClick={submit}>
          Submit outcome
        </Button>
      </div>
    </div>
  );
}
