import clsx from "clsx";
import { CheckCircle2, RefreshCcw, Sparkles, XCircle } from "lucide-react";
import { useState } from "react";

import { Button } from "../../components/ui/Button";
import { Field, Textarea } from "../../components/ui/Field";
import { RUBRIC } from "../../lib/status";
import type { Result } from "./data";

/** Same form and rules as the interviewer's real outcome form; submitting only moves the walk-through on. */
const RESULTS: { value: Result; label: string; hint: string; icon: typeof CheckCircle2; tone: "emerald" | "amber" | "rose" }[] = [
  { value: "pass", label: "Pass", hint: "Award the badge now", icon: CheckCircle2, tone: "emerald" },
  { value: "retake_later", label: "Retake later", hint: "Close, no attempt used", icon: RefreshCcw, tone: "amber" },
  { value: "fail", label: "Fail", hint: "Uses an attempt · 14-day wait", icon: XCircle, tone: "rose" },
];

const SELECTED = {
  emerald: "border-emerald-500 bg-emerald-50 ring-2 ring-emerald-500/20",
  amber: "border-amber-500 bg-amber-50 ring-2 ring-amber-500/20",
  rose: "border-rose-500 bg-rose-50 ring-2 ring-rose-500/20",
};
const ICON = { emerald: "text-emerald-600", amber: "text-amber-600", rose: "text-rose-600" };

const SAMPLE: Record<Result, { scores: Record<string, number>; feedback: string }> = {
  pass: {
    scores: { fundamentals: 5, problem_solving: 4, communication: 5 },
    feedback: "Clear fundamentals and a structured approach. You explained trade-offs well.",
  },
  retake_later: {
    scores: { fundamentals: 4, problem_solving: 3, communication: 3 },
    feedback: "Good start, but we ran out of time before component state. Revise lifting state and effects, then come back.",
  },
  fail: {
    scores: { fundamentals: 2, problem_solving: 2, communication: 3 },
    feedback: "You struggled with async code and component state. Practise promises and closures, then rebuild one small project.",
  },
};

export function OutcomeForm({ onSubmit, onCancel }: { onSubmit: (result: Result) => void; onCancel: () => void }) {
  const [result, setResult] = useState<Result | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [feedback, setFeedback] = useState("");

  const needsFeedback = result !== null && result !== "pass";
  const ready = result !== null && RUBRIC.every((r) => scores[r.key]) && (!needsFeedback || feedback.trim().length >= 20);

  const fillSample = () => {
    const pick = result ?? "pass";
    setResult(pick);
    setScores(SAMPLE[pick].scores);
    setFeedback(SAMPLE[pick].feedback);
  };

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[13px] font-semibold text-ink-800">Result</p>
          <button
            onClick={fillSample}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-50"
          >
            <Sparkles className="h-3.5 w-3.5" /> Fill sample answers
          </button>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {RESULTS.map((r) => (
            <button
              key={r.value}
              onClick={() => setResult(r.value)}
              className={clsx(
                "flex items-start gap-2.5 rounded-xl border p-3 text-left transition",
                result === r.value ? SELECTED[r.tone] : "border-ink-200 bg-white hover:border-ink-300",
              )}
            >
              <r.icon className={clsx("mt-0.5 h-5 w-5 shrink-0", ICON[r.tone])} />
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

      <Field
        label={`Feedback for the student${needsFeedback ? "" : " (optional)"}`}
        hint={
          needsFeedback
            ? `Shown on their dashboard. ${feedback.trim().length}/20 characters minimum.`
            : "Shown on their dashboard."
        }
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

      <div className="flex justify-end gap-2 border-t border-ink-100 pt-4">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button disabled={!ready} onClick={() => result && onSubmit(result)}>
          Submit outcome
        </Button>
      </div>
    </div>
  );
}
