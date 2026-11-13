import { ArrowLeft, Video } from "lucide-react";
import { Link, useParams } from "react-router-dom";

import { useInterviewDetail } from "../../api/student";
import { Card, CardHeader, PageHeader } from "../../components/ui/Card";
import { InterviewPill, JourneyPill, OutcomePill } from "../../components/ui/Pill";
import { ErrorState, Skeleton } from "../../components/ui/Spinner";
import { FeedbackQuote, ScoreBars } from "../../features/student/OutcomeSummary";
import { errorMessage } from "../../lib/api";
import { formatDateTime } from "../../lib/format";

export default function StudentInterviewDetail() {
  const { interviewId = "" } = useParams();
  const { data, isLoading, error } = useInterviewDetail(interviewId);

  if (isLoading) return <Skeleton className="h-96" />;
  if (error || !data) return <ErrorState error={errorMessage(error)} />;
  const { interview, events } = data;

  return (
    <div>
      <Link to="/student" className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 hover:text-ink-800">
        <ArrowLeft className="h-4 w-4" /> Home
      </Link>
      <PageHeader
        eyebrow={`${interview.badge.name} · Attempt ${interview.attempt_no}`}
        title={formatDateTime(interview.start_at)}
        description={`With ${interview.interviewer.name}`}
        action={<InterviewPill status={interview.status} />}
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Card className="p-5">
          {interview.outcome ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-ink-700">Result</span>
                <OutcomePill result={interview.outcome.result} />
              </div>
              <ScoreBars scores={interview.outcome.scores} />
              <FeedbackQuote outcome={interview.outcome} interviewer={interview.interviewer.name} />
            </div>
          ) : (
            <div className="space-y-3 text-sm text-ink-600">
              <p>Your interview link:</p>
              <a
                href={interview.meeting_link}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-lg bg-ink-900 px-4 py-2.5 font-semibold text-white hover:bg-ink-800"
              >
                <Video className="h-4 w-4" /> Open meeting room
              </a>
              <p className="text-xs text-ink-500">Keep your camera on and have your code editor ready to share.</p>
            </div>
          )}
        </Card>
        <Card>
          <CardHeader title="Timeline" subtitle="Every change to this badge's interview" />
          <ol className="relative mx-5 my-4 border-l border-ink-200">
            {events.map((e, i) => (
              <li key={i} className="mb-4 ml-4 last:mb-1">
                <span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-brand-500" />
                <div className="flex flex-wrap items-center gap-2">
                  <JourneyPill status={e.to_status} />
                  <span className="text-xs text-ink-400">{formatDateTime(e.created_at)}</span>
                </div>
                {e.reason && <p className="mt-1 text-[13px] text-ink-600">{e.reason}</p>}
              </li>
            ))}
          </ol>
        </Card>
      </div>
    </div>
  );
}
