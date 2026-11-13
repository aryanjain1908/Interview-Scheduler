import clsx from "clsx";
import { Bell } from "lucide-react";

import { relativeFromNow } from "../../lib/format";
import type { Notification } from "../../lib/types";

const DOT = { info: "bg-brand-500", success: "bg-emerald-500", warning: "bg-amber-500", danger: "bg-rose-500" };

export function NotificationList({ items, now, limit = 6 }: { items: Notification[]; now: number; limit?: number }) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center px-4 py-8 text-center text-sm text-ink-500">
        <Bell className="mb-2 h-5 w-5 text-ink-300" />
        Updates about your interviews will show up here.
      </div>
    );
  }
  return (
    <ul className="divide-y divide-ink-100">
      {items.slice(0, limit).map((n) => (
        <li key={n.id} className={clsx("relative px-5 py-3.5", !n.read_at && "bg-brand-50/40")}>
          <div className="flex gap-3">
            <span className={clsx("mt-1.5 h-2 w-2 shrink-0 rounded-full", DOT[n.tone])} />
            <div className="min-w-0">
              <p className="text-sm text-ink-800">
                <span className="font-semibold text-ink-950">{n.title}</span> {n.body}
              </p>
              <p className="mt-1 text-xs text-ink-400">{relativeFromNow(n.created_at, now)}</p>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
