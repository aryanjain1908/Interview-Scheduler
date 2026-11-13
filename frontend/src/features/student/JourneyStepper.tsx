import clsx from "clsx";
import { Check } from "lucide-react";

import type { JourneyStatus } from "../../lib/types";

const STEPS = ["Skills", "Eligible", "Booked", "Interview", "Result"];

const PROGRESS: Record<JourneyStatus, { index: number; tone: "brand" | "emerald" | "amber" | "rose" | "slate" }> = {
  not_eligible: { index: 0, tone: "brand" },
  eligible: { index: 1, tone: "brand" },
  booked: { index: 2, tone: "brand" },
  in_progress: { index: 3, tone: "emerald" },
  passed: { index: 4, tone: "emerald" },
  failed: { index: 4, tone: "rose" },
  retake_later: { index: 4, tone: "amber" },
  no_show: { index: 3, tone: "amber" },
  badge_revoked: { index: 4, tone: "slate" },
};

const TONE_BG = {
  brand: "bg-brand-600",
  emerald: "bg-emerald-500",
  amber: "bg-amber-500",
  rose: "bg-rose-500",
  slate: "bg-slate-400",
};

export function JourneyStepper({ status }: { status: JourneyStatus }) {
  const { index, tone } = PROGRESS[status];
  return (
    <ol className="flex items-center gap-1.5" aria-label="Interview progress">
      {STEPS.map((label, i) => {
        const done = i < index || (i === index && i === STEPS.length - 1);
        const current = i === index;
        return (
          <li key={label} className="flex flex-1 flex-col gap-1.5">
            <div
              className={clsx(
                "h-1.5 rounded-full",
                done || current ? TONE_BG[i === index ? tone : "brand"] : "bg-ink-200",
                current && !done && "opacity-60",
              )}
            />
            <span
              className={clsx(
                "flex items-center gap-1 text-[11px] font-semibold",
                current ? "text-ink-900" : done ? "text-ink-600" : "text-ink-400",
              )}
            >
              {done && i < index && <Check className="h-3 w-3" />}
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
