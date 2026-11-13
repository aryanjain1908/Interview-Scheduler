import clsx from "clsx";
import { BadgeCheck } from "lucide-react";

import { Avatar } from "../../components/ui/Avatar";
import { Card } from "../../components/ui/Card";
import { JourneyPill } from "../../components/ui/Pill";
import { formatDate } from "../../lib/format";
import type { BadgeJourney, User } from "../../lib/types";
import { BadgeMedallion, medallionState } from "./BadgeMedallion";

export function ProfileView({ student, journeys }: { student: User; journeys: BadgeJourney[] }) {
  const earned = journeys.filter((j) => j.journey.status === "passed");
  return (
    <Card className="overflow-hidden">
      <div className="relative bg-ink-950 px-6 pb-14 pt-6">
        <div className="absolute inset-0 opacity-40 [background:radial-gradient(600px_200px_at_80%_0%,#4F46E5,transparent)]" />
        <p className="relative text-xs font-semibold uppercase tracking-[0.16em] text-ink-400">GRIT profile</p>
      </div>
      <div className="relative -mt-10 px-6 pb-6">
        <div>
          <div className="w-fit rounded-full bg-white p-1">
            <Avatar name={student.name} size="lg" />
          </div>
          <div className="mt-2">
            <h2 className="flex items-center gap-1.5 font-display text-xl font-extrabold text-ink-950">
              {student.name}
              {earned.length > 0 && <BadgeCheck className="h-5 w-5 text-brand-600" />}
            </h2>
            <p className="text-sm text-ink-500">{student.college ?? "NIAT"}</p>
          </div>
        </div>

        <p className="mt-6 text-xs font-semibold uppercase tracking-wider text-ink-400">
          Track badges · {earned.length} earned
        </p>
        <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {journeys.map((j) => {
            const state = medallionState(j.journey.status);
            return (
              <li
                key={j.badge.id}
                className={clsx(
                  "flex flex-col items-center rounded-xl p-4 text-center ring-1",
                  state === "earned" ? "bg-white ring-ink-200" : "bg-ink-100/40 ring-ink-200/60",
                )}
              >
                <BadgeMedallion badge={j.badge} state={state} size="lg" />
                <p
                  className={clsx(
                    "mt-3 text-sm font-bold",
                    state === "revoked" ? "text-ink-400 line-through" : "text-ink-900",
                  )}
                >
                  {j.badge.name}
                </p>
                <div className="mt-1.5">
                  {state === "earned" && j.earned ? (
                    <span className="text-xs font-medium text-emerald-700">Earned {formatDate(j.earned.awarded_at)}</span>
                  ) : (
                    <JourneyPill status={j.journey.status} />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </Card>
  );
}
