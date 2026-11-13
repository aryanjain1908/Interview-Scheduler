import clsx from "clsx";
import { Clapperboard, GraduationCap, ShieldCheck, UserCheck } from "lucide-react";
import { useState } from "react";

const VIDEOS = [
  {
    id: "overview",
    title: "GRIT Interviews in a minute",
    sub: "The whole idea, from booking to badge.",
    icon: Clapperboard,
  },
  {
    id: "student",
    title: "For students",
    sub: "Book a slot, handle an emergency, see the result.",
    icon: GraduationCap,
  },
  {
    id: "interviewer",
    title: "For interviewers",
    sub: "Run the day, record results, move an interview.",
    icon: UserCheck,
  },
  {
    id: "team",
    title: "For the interview team",
    sub: "Nudge students, review emergencies, revoke a badge.",
    icon: ShieldCheck,
  },
];

export function VideoGallery() {
  const [current, setCurrent] = useState(VIDEOS[1]!.id);
  const video = VIDEOS.find((v) => v.id === current)!;
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="overflow-hidden rounded-3xl bg-ink-950 shadow-lift">
        <video
          key={video.id}
          className="aspect-video w-full"
          src={`/videos/${video.id}.mp4`}
          poster={`/videos/${video.id}.jpg`}
          controls
          preload="metadata"
          playsInline
        >
          <track kind="captions" src={`/videos/${video.id}.vtt`} srcLang="en" label="English" />
        </video>
        <div className="px-5 py-4 text-white">
          <p className="font-display text-lg font-bold">{video.title}</p>
          <p className="mt-0.5 text-sm text-ink-400">{video.sub}</p>
        </div>
      </div>
      <ul className="space-y-2.5">
        {VIDEOS.map((v) => {
          const on = v.id === current;
          return (
            <li key={v.id}>
              <button
                onClick={() => setCurrent(v.id)}
                aria-pressed={on}
                className={clsx(
                  "flex w-full gap-3 rounded-2xl p-3 text-left ring-1 transition",
                  on
                    ? "bg-ink-950 text-white ring-ink-950"
                    : "bg-canvas text-ink-900 ring-ink-200/70 hover:ring-brand-300",
                )}
              >
                <img
                  src={`/videos/${v.id}.jpg`}
                  alt=""
                  className="aspect-video w-28 shrink-0 rounded-lg bg-ink-200 object-cover"
                  loading="lazy"
                />
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-[13px] font-bold leading-snug">
                    <v.icon
                      className={clsx("h-3.5 w-3.5 shrink-0", on ? "text-brand-300" : "text-brand-600")}
                    />
                    {v.title}
                  </span>
                  <span
                    className={clsx("mt-1 block text-xs leading-snug", on ? "text-ink-400" : "text-ink-500")}
                  >
                    {v.sub}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
