import { useDashboard } from "../../api/student";
import { PageHeader } from "../../components/ui/Card";
import { ErrorState, Skeleton } from "../../components/ui/Spinner";
import { ProfileView } from "../../features/student/ProfileView";
import { errorMessage } from "../../lib/api";

export default function StudentBadges() {
  const { data, isLoading, error } = useDashboard();
  if (isLoading) return <Skeleton className="h-96" />;
  if (error || !data) return <ErrorState error={errorMessage(error)} />;
  return (
    <div>
      <PageHeader
        eyebrow="My badges"
        title="Your GRIT profile"
        description="This is what recruiters and peers see. Badges appear here the moment you pass an interview."
      />
      <ProfileView student={data.student} journeys={data.journeys} />
    </div>
  );
}
