import { Navigate, Outlet, useLocation } from "react-router-dom";

import { FullPageSpinner } from "../components/ui/Spinner";
import type { Role } from "../lib/types";
import { HOME_FOR_ROLE, useAuth } from "./AuthContext";

export function RequireRole({ role }: { role: Role }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <FullPageSpinner />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (user.role !== role) return <Navigate to={HOME_FOR_ROLE[user.role]} replace />;
  return <Outlet />;
}
