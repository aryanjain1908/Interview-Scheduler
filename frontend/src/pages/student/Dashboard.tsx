import { useEffect } from "react";

import { useDashboard, useMarkAllRead } from "../../api/student";
import { ErrorState, Skeleton } from "../../components/ui/Spinner";
import { StudentHomeView } from "../../features/student/StudentHomeView";
import { errorMessage } from "../../lib/api";
import { useNow } from "../../lib/useNow";

export default function StudentDashboard() {
  const { data, isLoading, error, refetch } = useDashboard();
  const markRead = useMarkAllRead();
  const now = useNow();
  const unread = data?.unread_count ?? 0;

  // Leave unread highlights visible for a moment, then clear them.
  useEffect(() => {
    if (!unread) return;
    const id = window.setTimeout(() => markRead.mutate(), 4000);
    return () => window.clearTimeout(id);
  }, [unread]);

  if (isLoading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-10 w-80" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
        <Skeleton className="h-72" />
      </div>
    );
  }
  if (error || !data) return <ErrorState error={errorMessage(error)} onRetry={refetch} />;
  return <StudentHomeView data={data} now={now} />;
}
