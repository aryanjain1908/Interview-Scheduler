import { ArrowDown, ArrowRight, Check, Clock, Database, MonitorSmartphone, Server } from "lucide-react";
import { ReactNode } from "react";

import { SchemaDiagram } from "./SchemaDiagram";

export function HowItsBuilt() {
  return (
    <div className="space-y-12">
      <div>
        <h3 className="font-head text-[22px] font-bold text-ink-950">Architecture</h3>
        <p className="mt-1 max-w-2xl text-[16px] text-ink-600">
          Three layers. Every rule lives in the API, so no screen can break it.
        </p>
        <div className="mt-6 flex flex-col items-stretch gap-3 lg:flex-row lg:items-stretch">
          <Layer icon={<MonitorSmartphone className="h-5 w-5" />} name="Web app" tech="React · TypeScript">
            Separate screens for students, interviewers and the interview team.
          </Layer>
          <Arrow />
          <Layer icon={<Server className="h-5 w-5" />} name="API" tech="FastAPI · Python" strong>
            Booking, timing rules, reviews and notifications. Checks every role on every request.
          </Layer>
          <Arrow />
          <Layer icon={<Database className="h-5 w-5" />} name="Database" tech="PostgreSQL">
            Locks a slot while it's being booked, so two students can never get the same one.
          </Layer>
        </div>
        <div className="mt-3 flex items-start gap-3 rounded-2xl border border-dashed border-ink-300 bg-white px-5 py-3.5">
          <Clock className="mt-0.5 h-5 w-5 shrink-0 text-ink-500" />
          <p className="text-[15px] text-ink-700">
            <strong className="text-ink-950">Background job, every minute:</strong> sends reminders 24 hours
            and 1 hour before, and closes interviews that nobody started.
          </p>
        </div>
      </div>

      <div>
        <h3 className="font-head text-[22px] font-bold text-ink-950">Data model</h3>
        <p className="mb-6 mt-1 max-w-2xl text-[16px] text-ink-600">
          Fourteen tables. Start with{" "}
          <span className="font-mono text-[15px] text-ink-900">interview_journeys</span>: one per student per
          badge, holding their current state.
        </p>
        <SchemaDiagram />
      </div>

      <ul className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {[
          ["No double bookings", "Tested with five students booking the same slot at the same moment."],
          ["Every change is logged", "Who changed what, when and why, for every journey."],
          ["170 automated tests", "Covering every rule described on this page."],
        ].map(([title, body]) => (
          <li key={title} className="flex gap-3 rounded-2xl bg-white p-5 ring-1 ring-ink-200/70">
            <Check className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" strokeWidth={2.5} />
            <div>
              <p className="font-head text-[16px] font-bold text-ink-950">{title}</p>
              <p className="mt-0.5 text-[15px] text-ink-600">{body}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Layer({
  icon,
  name,
  tech,
  strong,
  children,
}: {
  icon: ReactNode;
  name: string;
  tech: string;
  strong?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={`flex flex-1 gap-4 rounded-2xl p-5 ${strong ? "bg-ink-950 text-white" : "bg-white ring-1 ring-ink-200/70"}`}
    >
      <span
        className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${strong ? "bg-white/10 text-brand-200" : "bg-brand-50 text-brand-600"}`}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="font-head text-[18px] font-bold">{name}</p>
        <p className={`text-[13px] font-medium ${strong ? "text-ink-400" : "text-ink-500"}`}>{tech}</p>
        <p className={`mt-2 text-[15px] leading-snug ${strong ? "text-ink-200" : "text-ink-600"}`}>
          {children}
        </p>
      </div>
    </div>
  );
}

function Arrow() {
  return (
    <span className="grid shrink-0 place-items-center text-ink-600" aria-hidden>
      <ArrowRight className="hidden h-7 w-7 lg:block" strokeWidth={2.5} />
      <ArrowDown className="h-7 w-7 lg:hidden" strokeWidth={2.5} />
    </span>
  );
}
