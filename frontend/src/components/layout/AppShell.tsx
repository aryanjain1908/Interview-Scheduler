import clsx from "clsx";
import {
  Award,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  History,
  House,
  LayoutDashboard,
  ListChecks,
  LogOut,
  LucideIcon,
  ShieldAlert,
  UserRound,
  Users,
} from "lucide-react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";

import { useAuth } from "../../auth/AuthContext";
import type { Role } from "../../lib/types";
import { Avatar } from "../ui/Avatar";
import { NotificationBell } from "./NotificationBell";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

const NAV: Record<Role, NavItem[]> = {
  student: [
    { to: "/student", label: "Home", icon: LayoutDashboard, end: true },
    { to: "/student/badges", label: "My badges", icon: Award },
  ],
  interviewer: [
    { to: "/interviewer", label: "Schedule", icon: CalendarClock, end: true },
    { to: "/interviewer/calendar", label: "Calendar", icon: CalendarDays },
    { to: "/interviewer/availability", label: "Availability", icon: CalendarRange },
    { to: "/interviewer/students", label: "Booking status", icon: CalendarCheck },
    { to: "/interviewer/history", label: "History", icon: History },
  ],
  admin: [
    { to: "/admin", label: "Overview", icon: LayoutDashboard, end: true },
    { to: "/admin/calendar", label: "Calendar", icon: CalendarDays },
    { to: "/admin/interviewers", label: "Interviewers", icon: UserRound },
    { to: "/admin/students", label: "Booking status", icon: CalendarCheck },
    { to: "/admin/records", label: "Student records", icon: Users },
    { to: "/admin/interviews", label: "Interviews", icon: ListChecks },
    { to: "/admin/integrity", label: "Malpractice", icon: ShieldAlert },
  ],
};

const ROLE_LABEL: Record<Role, string> = { student: "Student", interviewer: "Interviewer", admin: "Interview team" };

/** The logo as a link back to the product home page. */
export function HomeLogo({ dark = true }: { dark?: boolean }) {
  return (
    <Link
      to="/"
      aria-label="GRIT Interviews home page"
      title="Go to the home page"
      className="-m-1 rounded-lg p-1 transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
    >
      <Logo dark={dark} />
    </Link>
  );
}

export function Logo({ dark = true }: { dark?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <svg viewBox="0 0 32 32" className="h-8 w-8" aria-hidden>
        <rect width="32" height="32" rx="9" fill={dark ? "#1A2350" : "#10173A"} />
        <path
          d="M21.5 11.5a7 7 0 1 0 1.2 7.5H16"
          fill="none"
          stroke="#A3A9FB"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <div className="leading-none">
        <p className={clsx("font-display text-[17px] font-extrabold tracking-tight", dark ? "text-white" : "text-ink-950")}>
          GRIT
        </p>
        <p className={clsx("mt-0.5 text-[10px] font-semibold uppercase tracking-[0.18em]", dark ? "text-ink-400" : "text-ink-500")}>
          Interviews
        </p>
      </div>
    </div>
  );
}

export function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;
  const items = NAV[user.role];

  const signOut = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen lg:pl-64">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col bg-ink-950 px-4 py-6 lg:flex">
        <div className="flex items-center justify-between px-2">
          <HomeLogo />
          <NotificationBell dark placement="down" />
        </div>
        <nav className="mt-10 flex flex-1 flex-col gap-1 overflow-y-auto">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                clsx(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition",
                  isActive ? "bg-white/10 text-white" : "text-ink-400 hover:bg-white/5 hover:text-white",
                )
              }
            >
              <item.icon className="h-[18px] w-[18px]" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <Link
          to="/"
          className="mb-3 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-ink-400 transition hover:bg-white/5 hover:text-white"
        >
          <House className="h-[18px] w-[18px]" />
          Home page
        </Link>
        <div className="rounded-xl bg-white/5 p-3">
          <div className="flex items-center gap-3">
            <Avatar name={user.name} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">{user.name}</p>
              <p className="text-xs text-ink-400">{ROLE_LABEL[user.role]}</p>
            </div>
          </div>
          <button
            onClick={signOut}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
          >
            <LogOut className="h-4 w-4" /> Log out
          </button>
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-ink-200/70 bg-canvas/90 px-4 py-3 backdrop-blur lg:hidden">
        <HomeLogo dark={false} />
        <div className="flex items-center gap-2">
          <NotificationBell />
          <Avatar name={user.name} size="sm" />
          <button
            onClick={signOut}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-ink-700 ring-1 ring-inset ring-ink-200 hover:bg-white"
          >
            <LogOut className="h-4 w-4" /> Log out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[1200px] px-4 pb-28 pt-6 sm:px-6 lg:px-10 lg:pb-12 lg:pt-10">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 flex overflow-x-auto border-t border-ink-200 bg-white/95 backdrop-blur lg:hidden">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              clsx(
                "flex min-w-[72px] flex-1 flex-col items-center gap-1 whitespace-nowrap px-1 py-2.5 text-[11px] font-semibold",
                isActive ? "text-brand-600" : "text-ink-500",
              )
            }
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
