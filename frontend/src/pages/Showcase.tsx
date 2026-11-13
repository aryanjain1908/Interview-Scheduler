import clsx from "clsx";
import { ArrowDown, ArrowLeft, ArrowRight } from "lucide-react";
import { ReactNode, useMemo } from "react";
import { Link } from "react-router-dom";

import { HOME_FOR_ROLE, useAuth } from "../auth/AuthContext";
import { Logo } from "../components/layout/AppShell";
import { ScheduleRow } from "../features/interviewer/ScheduleRow";
import { KEY_MESSAGES, showcaseData } from "../features/showcase/fixtures";
import { ProfileView } from "../features/student/ProfileView";
import { StudentHomeView } from "../features/student/StudentHomeView";
import type { Dashboard, Notification } from "../lib/types";

const TONE_DOT = { info: "bg-brand-500", success: "bg-emerald-500", warning: "bg-amber-500", danger: "bg-rose-500" };

export default function Showcase() {
  const { user } = useAuth();
  const now = useMemo(() => Date.now(), []);
  const data = useMemo(() => showcaseData(now), [now]);
  const messages = useMemo(() => KEY_MESSAGES(now), [now]);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-ink-200/70 bg-canvas/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between px-4 py-3 sm:px-6">
          <Logo dark={false} />
          <Link
            to={user ? HOME_FOR_ROLE[user.role] : "/login"}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-600 hover:text-ink-900"
          >
            <ArrowLeft className="h-4 w-4" /> {user ? "Back to app" : "Log in"}
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-[1280px] space-y-16 px-4 py-10 sm:px-6">
        <section>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-600">Before / after</p>
          <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight text-ink-950 sm:text-4xl">
            What an interview result changes
          </h1>
          <p className="mt-2 max-w-2xl text-ink-500">
            The same components students and interviewers use, shown for one student, Riya, before and after her
            interview result.
          </p>
        </section>

        <section>
          <SectionTitle n={1} title="The three messages that matter" sub="Exact copy, as it appears in the student's inbox and on their home screen." />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {messages.map((m) => (
              <div key={m.title} className="rounded-2xl bg-white p-5 shadow-card ring-1 ring-ink-200/70">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">{m.when}</p>
                <div className="mt-3 flex gap-3">
                  <span className={clsx("mt-1.5 h-2 w-2 shrink-0 rounded-full", TONE_DOT[m.tone])} />
                  <p className="text-sm leading-relaxed text-ink-800">
                    <span className="font-semibold text-ink-950">{m.title}</span> {m.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <Comparison
          n={2}
          title="Student home: booked → passed"
          sub="The countdown card becomes a celebration with the badge, scores and feedback. The badge count ticks up."
          before={<HomePanel data={data.booked} now={now} />}
          after={<HomePanel data={data.passed} now={now} />}
        />

        <Comparison
          n={3}
          title="Student home: booked → retake later"
          sub="A clear date and specific feedback, framed as 'almost there'. No attempt is used."
          before={<HomePanel data={data.booked} now={now} />}
          after={<HomePanel data={data.retake} now={now} />}
        />

        <Comparison
          n={4}
          title="Student home: booked → not cleared"
          sub="Honest result, feedback to act on, attempts left and when they can book again."
          before={<HomePanel data={data.booked} now={now} />}
          after={<HomePanel data={data.failed} now={now} />}
        />

        <section>
          <SectionTitle
            n={5}
            title="GRIT profile: before → passed → revoked"
            sub="What others see. A pass puts the badge on the profile. If malpractice is upheld later, it's nullified."
          />
          <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-3">
            <Frame label="Before result">
              <ProfileView student={data.booked.student} journeys={data.booked.journeys} />
            </Frame>
            <Frame label="After pass" tone="after">
              <ProfileView student={data.passed.student} journeys={data.passed.journeys} />
            </Frame>
            <Frame label="After malpractice upheld" tone="revoked">
              <ProfileView student={data.revoked.student} journeys={data.revoked.journeys} />
            </Frame>
          </div>
        </section>

        <Comparison
          n={6}
          title="Interviewer's day: live → outcome recorded"
          sub="One click opens the outcome form. Once submitted, the row locks to the result and the student is notified."
          before={<ScheduleRow item={data.scheduleBefore} now={now} onStart={noop} onNoShow={noop} onRecord={noop} />}
          after={<ScheduleRow item={data.scheduleAfter} now={now} />}
        />
      </main>
    </div>
  );
}

const noop = () => undefined;

function SectionTitle({ n, title, sub }: { n: number; title: string; sub: string }) {
  return (
    <div className="mb-5 flex gap-3">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ink-950 text-xs font-bold text-white">{n}</span>
      <div>
        <h2 className="font-display text-xl font-bold text-ink-950">{title}</h2>
        <p className="mt-0.5 text-sm text-ink-500">{sub}</p>
      </div>
    </div>
  );
}

function Comparison({ n, title, sub, before, after }: { n: number; title: string; sub: string; before: ReactNode; after: ReactNode }) {
  return (
    <section>
      <SectionTitle n={n} title={title} sub={sub} />
      <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
        <Frame label="Before">{before}</Frame>
        <div className="grid place-items-center self-center text-ink-300">
          <ArrowRight className="hidden h-6 w-6 xl:block" />
          <ArrowDown className="h-6 w-6 xl:hidden" />
        </div>
        <Frame label="After" tone="after">{after}</Frame>
      </div>
    </section>
  );
}

function Frame({ label, tone = "before", children }: { label: string; tone?: "before" | "after" | "revoked"; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p
        className={clsx(
          "mb-2 inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider",
          tone === "before" && "bg-ink-200 text-ink-600",
          tone === "after" && "bg-emerald-100 text-emerald-800",
          tone === "revoked" && "bg-slate-200 text-slate-700",
        )}
      >
        {label}
      </p>
      {/* Inert: same components as the app, no side effects. */}
      <div className="pointer-events-none select-none rounded-3xl bg-canvas p-3 ring-1 ring-ink-200 sm:p-5" aria-hidden>
        {children}
      </div>
    </div>
  );
}

function HomePanel({ data, now }: { data: Dashboard; now: number }) {
  const latest: Notification | undefined = data.notifications[0];
  return (
    <div className="space-y-4">
      <StudentHomeView data={data} now={now} interactive={false} compact />
      {latest && (
        <div className="rounded-xl bg-white p-4 ring-1 ring-ink-200/70">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">Newest message in inbox</p>
          <p className="mt-1.5 text-sm text-ink-800">
            <span className="font-semibold text-ink-950">{latest.title}</span> {latest.body}
          </p>
        </div>
      )}
    </div>
  );
}
