import { cn } from "../../lib/cn";
import { ReactNode } from "react";

import { INTERVIEW_STATUS, JOURNEY_STATUS, OUTCOME, Tone, TONE_CLASSES } from "../../lib/status";
import type { InterviewStatus, JourneyStatus, OutcomeResult } from "../../lib/types";

export function Pill({ tone = "neutral", children, dot }: { tone?: Tone; children: ReactNode; dot?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset",
        TONE_CLASSES[tone],
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export const JourneyPill = ({ status }: { status: JourneyStatus }) => (
  <Pill tone={JOURNEY_STATUS[status].tone} dot>
    {JOURNEY_STATUS[status].label}
  </Pill>
);

export const InterviewPill = ({ status }: { status: InterviewStatus }) => (
  <Pill tone={INTERVIEW_STATUS[status].tone}>{INTERVIEW_STATUS[status].label}</Pill>
);

export const OutcomePill = ({ result }: { result: OutcomeResult }) => (
  <Pill tone={OUTCOME[result].tone}>{OUTCOME[result].label}</Pill>
);
