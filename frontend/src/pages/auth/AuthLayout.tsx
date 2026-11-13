import { ArrowLeft, CalendarCheck2, ClipboardCheck, ShieldCheck } from "lucide-react";
import { ReactNode } from "react";
import { Link } from "react-router-dom";

import { HomeLogo } from "../../components/layout/AppShell";

const POINTS = [
  { icon: CalendarCheck2, title: "Book in seconds", body: "Eligible students pick a live slot right from their dashboard." },
  { icon: ClipboardCheck, title: "Outcomes that land", body: "Interviewers record pass, fail or retake, and students see it right away." },
  { icon: ShieldCheck, title: "Badges you can trust", body: "Malpractice found later? The badge is nullified, with a full audit trail." },
];

export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 min-h-screen lg:grid-cols-[1fr_minmax(480px,560px)]">
      <aside className="relative hidden overflow-hidden bg-ink-950 p-12 text-white lg:flex lg:flex-col">
        <div className="absolute inset-0 opacity-50 [background:radial-gradient(700px_400px_at_0%_100%,#4338CA,transparent),radial-gradient(500px_300px_at_100%_0%,#1A2350,transparent)]" />
        <div className="relative">
          <HomeLogo />
        </div>
        <div className="relative mt-auto max-w-lg">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-300">Track Badge interviews</p>
          <h1 className="mt-3 font-display text-4xl font-extrabold leading-[1.1] tracking-tight">
            Cleared every skill? <br />
            Your interview is one click away.
          </h1>
          <ul className="mt-10 space-y-5">
            {POINTS.map((p) => (
              <li key={p.title} className="flex gap-4">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/10">
                  <p.icon className="h-5 w-5 text-brand-200" />
                </div>
                <div>
                  <p className="font-semibold">{p.title}</p>
                  <p className="text-sm text-ink-400">{p.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </aside>
      <main className="flex flex-col justify-center px-5 py-10 sm:px-12">
        <div className="mb-8 lg:hidden">
          <HomeLogo dark={false} />
        </div>
        <div className="mx-auto w-full max-w-[400px]">
          <Link
            to="/"
            className="mb-8 inline-flex items-center gap-1.5 text-sm font-medium text-ink-500 transition hover:text-ink-900"
          >
            <ArrowLeft className="h-4 w-4" /> Back to home
          </Link>
          {children}
        </div>
      </main>
    </div>
  );
}
