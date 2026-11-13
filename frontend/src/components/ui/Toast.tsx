import { cn } from "../../lib/cn";
import { CheckCircle2, Info, XCircle } from "lucide-react";
import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from "react";

type ToastTone = "success" | "error" | "info";
interface ToastItem {
  id: number;
  tone: ToastTone;
  title: string;
  body?: string;
}

type ToastFn = (title: string, body?: string) => void;
interface ToastApi {
  success: ToastFn;
  error: ToastFn;
  info: ToastFn;
}

const ToastContext = createContext<ToastApi | null>(null);
const ICONS = { success: CheckCircle2, error: XCircle, info: Info };
const COLORS = { success: "text-emerald-500", error: "text-rose-500", info: "text-brand-500" };

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const push = useCallback((tone: ToastTone, title: string, body?: string) => {
    const id = nextId++;
    setItems((list) => [...list.slice(-3), { id, tone, title, body }]);
    window.setTimeout(() => setItems((list) => list.filter((t) => t.id !== id)), 4500);
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      success: (t, b) => push("success", t, b),
      error: (t, b) => push("error", t, b),
      info: (t, b) => push("info", t, b),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6 lg:items-end lg:pr-6">
        {items.map((t) => {
          const Icon = ICONS[t.tone];
          return (
            <div
              key={t.id}
              role="status"
              className="pointer-events-auto flex w-full max-w-sm animate-fade-up gap-3 rounded-xl bg-ink-950 px-4 py-3 text-white shadow-lift"
            >
              <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", COLORS[t.tone])} />
              <div className="min-w-0">
                <p className="text-sm font-semibold">{t.title}</p>
                {t.body && <p className="mt-0.5 text-[13px] leading-snug text-ink-300">{t.body}</p>}
              </div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}
