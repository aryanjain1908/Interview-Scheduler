import clsx from "clsx";
import { Bell } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useInbox, useMarkInboxRead } from "../../api/notifications";
import { relativeFromNow } from "../../lib/format";

const DOT = { info: "bg-brand-500", success: "bg-emerald-500", warning: "bg-amber-500", danger: "bg-rose-500" };

export function NotificationBell({ dark = false, placement = "down" }: { dark?: boolean; placement?: "down" | "up" }) {
  const { data = [] } = useInbox();
  const markRead = useMarkInboxRead();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const unread = data.filter((n) => !n.read_at).length;

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const toggle = () => {
    setOpen((o) => !o);
    if (!open && unread) markRead.mutate();
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={toggle}
        aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}
        className={clsx(
          "relative rounded-lg p-2 transition",
          dark ? "text-ink-300 hover:bg-white/10 hover:text-white" : "text-ink-600 hover:bg-ink-100",
        )}
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute right-1 top-1 grid h-4 min-w-4 place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
            {unread}
          </span>
        )}
      </button>
      {open && (
        <div
          className={clsx(
            "absolute z-50 w-[340px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl bg-white shadow-lift ring-1 ring-ink-200",
            placement === "up" ? "bottom-full left-0 mb-2" : dark ? "left-0 top-full mt-2" : "right-0 top-full mt-2",
          )}
        >
          <p className="border-b border-ink-100 px-4 py-3 font-display text-sm font-bold text-ink-950">Notifications</p>
          {data.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-ink-500">You're all caught up.</p>
          ) : (
            <ul className="max-h-[420px] divide-y divide-ink-100 overflow-y-auto">
              {data.map((n) => (
                <li key={n.id} className="flex gap-3 px-4 py-3">
                  <span className={clsx("mt-1.5 h-2 w-2 shrink-0 rounded-full", DOT[n.tone])} />
                  <div className="min-w-0">
                    <p className="text-[13px] text-ink-800">
                      <span className="font-semibold text-ink-950">{n.title}</span> {n.body}
                    </p>
                    <p className="mt-0.5 text-[11px] text-ink-400">{relativeFromNow(n.created_at)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
