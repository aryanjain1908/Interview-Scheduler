import clsx from "clsx";
import { CalendarCheck2, Moon, Sun, Sunrise, Video } from "lucide-react";
import { useMemo, useState } from "react";

import { MonthCalendar } from "../../components/calendar/MonthCalendar";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { Modal } from "../../components/ui/Modal";
import { BadgeMedallion } from "../../features/student/BadgeMedallion";
import { addDaysToKey, formatDateTime, formatLongDay, formatTime, istDateKey, istHour, keyToDate } from "../../lib/format";
import type { Badge, Slot } from "../../lib/types";

const PARTS = [
  { key: "morning", label: "Morning", icon: Sunrise, test: (h: number) => h < 12 },
  { key: "afternoon", label: "Afternoon", icon: Sun, test: (h: number) => h >= 12 && h < 17 },
  { key: "evening", label: "Evening", icon: Moon, test: (h: number) => h >= 17 },
];

/** The student booking page with sample slots. Confirming moves the walk-through on. */
export function BookingScreen({
  badge,
  slots,
  now,
  onBooked,
}: {
  badge: Badge;
  slots: Slot[];
  now: number;
  onBooked: (slot: Slot) => void;
}) {
  const today = istDateKey(new Date(now));
  const byDay = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const s of slots) {
      const key = istDateKey(s.start_at);
      map.set(key, [...(map.get(key) ?? []), s]);
    }
    return map;
  }, [slots]);
  const counts = useMemo(() => new Map([...byDay].map(([k, v]) => [k, v.length])), [byDay]);
  const [day, setDay] = useState(() => [...byDay.keys()][0] ?? today);
  const [selected, setSelected] = useState<Slot | null>(null);
  const [confirming, setConfirming] = useState(false);
  const daySlots = byDay.get(day) ?? [];

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-600">Book your interview</p>
      <h2 className="mt-1 flex items-center gap-3 font-display text-2xl font-extrabold text-ink-950">
        <BadgeMedallion badge={badge} state="progress" size="sm" />
        {badge.name}
      </h2>
      <p className="mt-1 text-sm text-ink-500">{badge.interview_minutes}-minute live interview on video. All times are in IST.</p>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="h-fit p-4">
          <MonthCalendar
            selected={day}
            counts={counts}
            minKey={today}
            maxKey={addDaysToKey(today, 13)}
            onSelect={(d) => {
              setDay(d);
              setSelected(null);
            }}
          />
        </Card>
        <Card className="p-4 sm:p-5">
          <h3 className="font-display text-base font-bold text-ink-900">{formatLongDay(keyToDate(day))}</h3>
          {daySlots.length === 0 ? (
            <p className="mt-4 text-sm text-ink-500">No open slots this day. Pick a highlighted date.</p>
          ) : (
            <div className="mt-4 space-y-4">
              {PARTS.map((part) => {
                const group = daySlots.filter((s) => part.test(istHour(s.start_at)));
                if (!group.length) return null;
                return (
                  <div key={part.key}>
                    <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ink-400">
                      <part.icon className="h-3.5 w-3.5" /> {part.label}
                    </p>
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                      {group.map((s) => (
                        <button
                          key={s.id}
                          onClick={() => setSelected(s)}
                          className={clsx(
                            "rounded-lg border px-2 py-2.5 text-sm font-semibold transition",
                            selected?.id === s.id
                              ? "border-brand-600 bg-brand-50 text-brand-800 ring-2 ring-brand-600/20"
                              : "border-ink-200 bg-white text-ink-800 hover:border-brand-400 hover:text-brand-700",
                          )}
                        >
                          {formatTime(s.start_at)}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      <div
        className={clsx(
          "mt-4 flex items-center justify-between gap-4 rounded-2xl bg-ink-950 px-5 py-3.5 text-white transition",
          selected ? "opacity-100" : "pointer-events-none opacity-40",
        )}
      >
        <div className="min-w-0">
          <p className="text-xs text-ink-400">Selected</p>
          <p className="font-semibold leading-snug">{selected ? formatDateTime(selected.start_at) : "Pick a time"}</p>
          {selected && <p className="truncate text-xs text-ink-300">with {selected.interviewer.name}</p>}
        </div>
        <Button onClick={() => setConfirming(true)} disabled={!selected} icon={<CalendarCheck2 className="h-4 w-4" />}>
          Review booking
        </Button>
      </div>

      <Modal
        open={confirming && Boolean(selected)}
        onClose={() => setConfirming(false)}
        title="Confirm your interview"
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              Back
            </Button>
            <Button
              onClick={() => {
                setConfirming(false);
                if (selected) onBooked(selected);
              }}
            >
              Confirm booking
            </Button>
          </>
        }
      >
        {selected && (
          <div className="rounded-xl bg-ink-100/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-500">{badge.name} interview</p>
            <p className="mt-1 font-display text-lg font-bold text-ink-950">{formatDateTime(selected.start_at)}</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-ink-600">
              <Video className="h-4 w-4" /> Video call with {selected.interviewer.name}
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
}
