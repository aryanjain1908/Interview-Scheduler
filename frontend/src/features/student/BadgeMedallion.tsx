import clsx from "clsx";
import { BarChart3, Code2, Lock, Server, ShieldOff } from "lucide-react";
import { useId } from "react";

import { accentFor } from "../../lib/status";
import type { Badge } from "../../lib/types";

export type MedallionState = "earned" | "locked" | "revoked" | "progress";

const ICONS: Record<string, typeof Code2> = { frontend: Code2, backend: Server, "data-analyst": BarChart3 };

const SIZES = { sm: "h-12 w-12", md: "h-16 w-16", lg: "h-24 w-24", xl: "h-32 w-32" };
const ICON_SIZES = { sm: "h-5 w-5", md: "h-6 w-6", lg: "h-9 w-9", xl: "h-12 w-12" };

export function BadgeMedallion({
  badge,
  state,
  size = "md",
}: {
  badge: Pick<Badge, "slug" | "color" | "name">;
  state: MedallionState;
  size?: keyof typeof SIZES;
}) {
  const gradientId = useId();
  const accent = accentFor(badge.color);
  const Icon = ICONS[badge.slug] ?? Code2;
  const vivid = state === "earned";
  const muted = state === "revoked" || state === "locked";

  return (
    <div className={clsx("relative shrink-0", SIZES[size])} title={badge.name}>
      <svg viewBox="0 0 100 100" className={clsx("h-full w-full", vivid && "drop-shadow-[0_8px_16px_rgba(16,23,58,0.25)]")}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={muted ? "#C6C9D8" : accent.from} />
            <stop offset="100%" stopColor={muted ? "#9A9EB8" : accent.to} />
          </linearGradient>
        </defs>
        <polygon
          points="50,3 92,27 92,73 50,97 8,73 8,27"
          fill={state === "progress" ? "#fff" : `url(#${gradientId})`}
          stroke={state === "progress" ? accent.ring : "rgba(255,255,255,0.5)"}
          strokeWidth={state === "progress" ? 4 : 2}
          strokeDasharray={state === "progress" ? "6 5" : undefined}
        />
        {vivid && <polygon points="50,12 84,31 84,69 50,88 16,69 16,31" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" />}
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        {state === "locked" ? (
          <Lock className={clsx(ICON_SIZES[size], "text-white")} />
        ) : state === "revoked" ? (
          <ShieldOff className={clsx(ICON_SIZES[size], "text-white")} />
        ) : (
          <Icon className={clsx(ICON_SIZES[size], state === "progress" ? accent.text : "text-white")} strokeWidth={2.2} />
        )}
      </div>
    </div>
  );
}

export function medallionState(status: string): MedallionState {
  if (status === "passed") return "earned";
  if (status === "badge_revoked") return "revoked";
  if (status === "not_eligible") return "locked";
  return "progress";
}
