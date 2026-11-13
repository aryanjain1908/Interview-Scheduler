import { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes, useId } from "react";

import { cn } from "../../lib/cn";

const control =
  "w-full rounded-lg border-0 bg-white px-3 text-sm text-ink-900 ring-1 ring-inset ring-ink-200 placeholder:text-ink-400 " +
  "focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:bg-ink-100 disabled:text-ink-500";

interface FieldProps {
  label?: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  children: (id: string) => ReactNode;
  className?: string;
}

export function Field({ label, hint, error, children, className }: FieldProps) {
  const id = useId();
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="mb-1.5 block text-[13px] font-semibold text-ink-800">
          {label}
        </label>
      )}
      {children(id)}
      {error ? (
        <p className="mt-1.5 text-xs font-medium text-rose-600">{error}</p>
      ) : (
        hint && <p className="mt-1.5 text-xs text-ink-500">{hint}</p>
      )}
    </div>
  );
}

export const Input = ({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) => (
  <input className={cn(control, "h-10", className)} {...rest} />
);

export const Select = ({ className, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) => (
  <select className={cn(control, "select-chevron h-10 pr-8", className)} {...rest} />
);

export const Textarea = ({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea className={cn(control, "min-h-[96px] py-2.5 leading-relaxed", className)} {...rest} />
);

interface SegmentedProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: ReactNode; count?: number }[];
}

export function Segmented<T extends string>({ value, onChange, options }: SegmentedProps<T>) {
  return (
    <div className="inline-flex rounded-xl bg-ink-100 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-semibold transition",
            value === o.value ? "bg-white text-ink-950 shadow-sm" : "text-ink-500 hover:text-ink-800",
          )}
        >
          {o.label}
          {o.count !== undefined && (
            <span
              className={cn(
                "rounded-full px-1.5 text-[11px]",
                value === o.value ? "bg-brand-50 text-brand-700" : "bg-ink-200/70 text-ink-600",
              )}
            >
              {o.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
