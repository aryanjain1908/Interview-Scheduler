import { MessageSquareQuote } from "lucide-react";

import { RUBRIC } from "../../lib/status";
import type { Outcome } from "../../lib/types";

export function ScoreBars({ scores }: { scores: Record<string, number> }) {
  return (
    <dl className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-x-4 gap-y-2.5">
      {RUBRIC.map(({ key, label }) => {
        const value = scores[key] ?? 0;
        return (
          <div key={key}>
            <dt className="flex items-baseline justify-between gap-2 text-xs font-medium text-ink-600">
              {label}
              <span className="whitespace-nowrap font-semibold tabular-nums text-ink-900">{value}/5</span>
            </dt>
            <dd className="mt-1 flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <span key={n} className={`h-1.5 flex-1 rounded-full ${n <= value ? "bg-ink-800" : "bg-ink-200"}`} />
              ))}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

export function FeedbackQuote({ outcome, interviewer }: { outcome: Outcome; interviewer: string }) {
  if (!outcome.feedback_to_student) return null;
  return (
    <figure className="rounded-xl bg-white/70 p-4 ring-1 ring-ink-200/70">
      <MessageSquareQuote className="h-4 w-4 text-ink-400" />
      <blockquote className="mt-2 text-sm leading-relaxed text-ink-800">{outcome.feedback_to_student}</blockquote>
      <figcaption className="mt-2 text-xs font-medium text-ink-500">— {interviewer}, your interviewer</figcaption>
    </figure>
  );
}
