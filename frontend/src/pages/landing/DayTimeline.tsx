const MARKS = [
  { at: -30, label: "Booking closes", body: "No new bookings this close to the start" },
  { at: -10, label: "Interviewer can start", body: "The Join link is live for both sides" },
  { at: 0, label: "Interview starts", body: "The result can now be recorded" },
  { at: 15, label: "No-show allowed", body: "Only after waiting 15 minutes" },
  { at: 30, label: "Slot ends", body: "30-minute interview" },
  { at: 45, label: "Marked missed", body: "If nobody started it. No attempt is used." },
];

const MIN = -30;
const MAX = 45;
const pos = (m: number) => ((m - MIN) / (MAX - MIN)) * 100;
const stamp = (m: number) => (m === 0 ? "Start" : `${m > 0 ? "+" : "−"}${Math.abs(m)} min`);

export function DayTimeline() {
  return (
    <div className="rounded-3xl bg-white p-5 shadow-card ring-1 ring-ink-200/70 sm:p-8">
      {/* the scale, from tablet width up; phones read the list below */}
      <div className="relative mx-6 mb-8 mt-1 hidden h-12 sm:block">
        <div className="absolute inset-x-0 top-[22px] h-1.5 rounded-full bg-ink-100" />
        <div
          className="absolute top-[22px] h-1.5 rounded-full bg-emerald-400"
          style={{ left: `${pos(0)}%`, width: `${pos(30) - pos(0)}%` }}
        />
        {MARKS.map((m) => (
          <div
            key={m.at}
            className="absolute top-0 -translate-x-1/2 text-center"
            style={{ left: `${pos(m.at)}%` }}
          >
            <span
              className={`mx-auto mt-4 block h-4 w-4 rounded-full ring-4 ring-white ${m.at === 0 ? "bg-emerald-500" : "bg-ink-700"}`}
            />
            <span className="mt-1.5 block whitespace-nowrap text-[13px] font-semibold tabular-nums text-ink-700">
              {stamp(m.at)}
            </span>
          </div>
        ))}
      </div>
      <ol className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-3 lg:grid-cols-6">
        {MARKS.map((m) => (
          <li key={m.at} className="min-w-0">
            <p className="text-[13px] font-semibold tabular-nums text-brand-700 sm:hidden">{stamp(m.at)}</p>
            <p className="font-head text-[16px] font-bold text-ink-950">{m.label}</p>
            <p className="mt-1 text-[14px] leading-snug text-ink-600">{m.body}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
