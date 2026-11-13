import clsx from "clsx";
import { Check } from "lucide-react";

import { useBadges } from "../../api/team";
import { BadgeMedallion } from "../student/BadgeMedallion";

export function TrackPicker({ value, onChange, disabled }: { value: string[]; onChange: (ids: string[]) => void; disabled?: boolean }) {
  const { data: badges, isLoading } = useBadges();
  if (isLoading) return <div className="h-16 animate-pulse rounded-xl bg-ink-100" />;

  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);

  return (
    <div className="grid grid-cols-3 gap-2">
      {badges?.map((b) => {
        const on = value.includes(b.id);
        return (
          <button
            type="button"
            key={b.id}
            disabled={disabled}
            onClick={() => toggle(b.id)}
            aria-pressed={on}
            className={clsx(
              "relative flex flex-col items-center gap-2 rounded-xl border px-2 py-3 text-center transition disabled:opacity-60",
              on ? "border-brand-600 bg-brand-50 ring-2 ring-brand-600/15" : "border-ink-200 bg-white hover:border-ink-300",
            )}
          >
            <BadgeMedallion badge={b} state={on ? "earned" : "locked"} size="sm" />
            <span className="text-[12px] font-semibold leading-tight text-ink-900">{b.name}</span>
            {on && (
              <span className="absolute right-2 top-2 grid h-4 w-4 place-items-center rounded-full bg-brand-600 text-white">
                <Check className="h-3 w-3" />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
