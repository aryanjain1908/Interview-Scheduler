import { Navigate, Route, Routes } from "react-router-dom";

import { RequireRole } from "./auth/RequireRole";
import { AppShell } from "./components/layout/AppShell";
import AdminCalendar from "./pages/admin/Calendar";
import AdminFlags from "./pages/admin/Flags";
import AdminInterviewers from "./pages/admin/Interviewers";
import AdminInterviews from "./pages/admin/Interviews";
import AdminOverview from "./pages/admin/Overview";
import AdminRecords from "./pages/admin/Records";
import Login from "./pages/auth/Login";
import Signup from "./pages/auth/Signup";
import InterviewerAvailability from "./pages/interviewer/Availability";
import InterviewerCalendar from "./pages/interviewer/Calendar";
import InterviewerHistory from "./pages/interviewer/History";
import InterviewerSchedule from "./pages/interviewer/Schedule";
import Landing from "./pages/landing/Landing";
import Showcase from "./pages/Showcase";
import BookingStatus from "./pages/team/BookingStatus";
import StudentBadges from "./pages/student/Badges";
import StudentBook from "./pages/student/Book";
import StudentDashboard from "./pages/student/Dashboard";
import StudentInterview from "./pages/student/InterviewDetail";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/showcase" element={<Showcase />} />

      <Route element={<RequireRole role="student" />}>
        <Route element={<AppShell />}>
          <Route path="/student" element={<StudentDashboard />} />
          <Route path="/student/book/:badgeId" element={<StudentBook />} />
          <Route path="/student/interviews/:interviewId" element={<StudentInterview />} />
          <Route path="/student/badges" element={<StudentBadges />} />
        </Route>
      </Route>

      <Route element={<RequireRole role="interviewer" />}>
        <Route element={<AppShell />}>
          <Route path="/interviewer" element={<InterviewerSchedule />} />
          <Route path="/interviewer/calendar" element={<InterviewerCalendar />} />
          <Route path="/interviewer/availability" element={<InterviewerAvailability />} />
          <Route path="/interviewer/students" element={<BookingStatus />} />
          <Route path="/interviewer/history" element={<InterviewerHistory />} />
        </Route>
      </Route>

      <Route element={<RequireRole role="admin" />}>
        <Route element={<AppShell />}>
          <Route path="/admin" element={<AdminOverview />} />
          <Route path="/admin/calendar" element={<AdminCalendar />} />
          <Route path="/admin/interviewers" element={<AdminInterviewers />} />
          <Route path="/admin/students" element={<BookingStatus />} />
          <Route path="/admin/records" element={<AdminRecords />} />
          <Route path="/admin/interviews" element={<AdminInterviews />} />
          <Route path="/admin/integrity" element={<AdminFlags />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
