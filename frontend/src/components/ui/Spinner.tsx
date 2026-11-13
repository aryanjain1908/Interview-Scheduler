import { cn } from "../../lib/cn";
import { Loader2 } from "lucide-react";
import { ReactNode } from "react";

export const FullPageSpinner = () => (
  <div className="grid min-h-[60vh] place-items-center">
    <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
  </div>
);

export const Skeleton = ({ className }: { className?: string }) => (
  <div className={cn("animate-pulse rounded-xl bg-ink-200/60", className)} />
);

export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon: ReactNode;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-ink-100 text-ink-500">{icon}</div>
      <h3 className="mt-4 font-display text-base font-bold text-ink-900">{title}</h3>
      {children && <p className="mt-1 max-w-sm text-sm text-ink-500">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: string; onRetry?: () => void }) {
  return (
    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-800">
      {error}
      {onRetry && (
        <button onClick={onRetry} className="ml-2 font-semibold underline">
          Try again
        </button>
      )}
    </div>
  );
}
