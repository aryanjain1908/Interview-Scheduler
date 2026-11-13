import clsx from "clsx";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

import { addDaysToKey, istDateKey, keyToDate } from "../../lib/format";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface Props {
  selected: string;
  onSelect: (key: string) => void;
  counts: Map<string, number>;
  minKey: string;
  maxKey: string;
}

export function MonthCalendar({ selected, onSelect, counts, minKey, maxKey }: Props) {
  const [month, setMonth] = useState(() => selected.slice(0, 7));
  const first = `${month}-01`;
  const firstDate = keyToDate(first);
  const leading = (firstDate.getUTCDay() + 6) % 7;
  const gridStart = addDaysToKey(first, -leading);
  const cells = Array.from({ length: 42 }, (_, i) => addDaysToKey(gridStart, i));
  const today = istDateKey(new Date());

  const shift = (delta: number) => {
    const d = keyToDate(first);
    d.setUTCMonth(d.getUTCMonth() + delta);
    setMonth(istDateKey(d).slice(0, 7));
  };
  const canPrev = month > minKey.slice(0, 7);
  const canNext = month < maxKey.slice(0, 7);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="font-display text-base font-bold text-ink-900">
          {firstDate.toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "Asia/Kolkata" })}
        </p>
        <div className="flex gap-1">
          <button onClick={() => shift(-1)} disabled={!canPrev} className="rounded-lg p-1.5 text-ink-500 hover:bg-ink-100 disabled:opacity-30" aria-label="Previous month">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button onClick={() => shift(1)} disabled={!canNext} className="rounded-lg p-1.5 text-ink-500 hover:bg-ink-100 disabled:opacity-30" aria-label="Next month">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS.map((w) => (
          <span key={w} className="pb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-400">
            {w}
          </span>
        ))}
        {cells.map((key) => {
          const inMonth = key.startsWith(month);
          const count = counts.get(key) ?? 0;
          const enabled = inMonth && count > 0 && key >= minKey && key <= maxKey;
          const isSelected = key === selected;
          return (
            <button
              key={key}
              disabled={!enabled}
              onClick={() => onSelect(key)}
              className={clsx(
                "relative flex aspect-square flex-col items-center justify-center rounded-xl text-sm font-semibold transition",
                !inMonth && "invisible",
                isSelected
                  ? "bg-brand-600 text-white shadow-md shadow-brand-600/25"
                  : enabled
                    ? "bg-brand-50/60 text-ink-900 hover:bg-brand-100"
                    : "text-ink-300",
                key === today && !isSelected && "ring-1 ring-inset ring-brand-400",
              )}
            >
              {keyToDate(key).getUTCDate()}
              {enabled && (
                <span className={clsx("text-[9px] font-medium", isSelected ? "text-brand-100" : "text-brand-600")}>
                  {count} open
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
