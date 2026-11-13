import { Flag, History } from "lucide-react";
import { useState } from "react";

import { useHistory } from "../../api/interviewer";
import { Avatar } from "../../components/ui/Avatar";
import { Button } from "../../components/ui/Button";
import { Card, PageHeader } from "../../components/ui/Card";
import { ReportMalpracticeModal } from "../../features/integrity/IntegrityModals";
import { InterviewPill, OutcomePill } from "../../components/ui/Pill";
import { EmptyState, ErrorState, Skeleton } from "../../components/ui/Spinner";
import { errorMessage } from "../../lib/api";
import { formatDateTime } from "../../lib/format";

export default function InterviewerHistory() {
  const { data, isLoading, error } = useHistory();
  const [reporting, setReporting] = useState<{ id: string; studentName: string; badgeName: string } | null>(null);
  return (
    <div>
      <PageHeader eyebrow="History" title="Past interviews" description="Everything you've completed, with the outcome you recorded." />
      {isLoading ? (
        <Skeleton className="h-80" />
      ) : error ? (
        <ErrorState error={errorMessage(error)} />
      ) : !data?.length ? (
        <Card>
          <EmptyState icon={<History className="h-5 w-5" />} title="No interviews yet">
            Completed interviews will appear here.
          </EmptyState>
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="table-base min-w-[720px]">
            <thead>
              <tr>
                <th>Student</th>
                <th>Badge</th>
                <th>When</th>
                <th>Result</th>
                <th>Scores</th>
                <th>Internal notes</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.map((i) => (
                <tr key={i.id}>
                  <td>
                    <div className="flex items-center gap-2.5">
                      <Avatar name={i.student.name} size="sm" />
                      <span className="font-semibold text-ink-900">{i.student.name}</span>
                    </div>
                  </td>
                  <td className="text-ink-600">{i.badge.name}</td>
                  <td className="whitespace-nowrap text-ink-600">{formatDateTime(i.start_at)}</td>
                  <td>{i.outcome ? <OutcomePill result={i.outcome.result} /> : <InterviewPill status={i.status} />}</td>
                  <td className="whitespace-nowrap font-mono text-xs text-ink-600">
                    {i.outcome ? Object.values(i.outcome.scores).join(" · ") : "—"}
                  </td>
                  <td className="max-w-[280px] text-xs text-ink-500" title={i.outcome?.internal_notes || undefined}>
                    <p className="line-clamp-2">{i.outcome?.internal_notes || "—"}</p>
                  </td>
                  <td className="text-right">
                    {i.outcome?.result === "pass" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={<Flag className="h-3.5 w-3.5" />}
                        onClick={() => setReporting({ id: i.id, studentName: i.student.name, badgeName: i.badge.name })}
                      >
                        Report
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      <ReportMalpracticeModal target={reporting} onClose={() => setReporting(null)} />
    </div>
  );
}
