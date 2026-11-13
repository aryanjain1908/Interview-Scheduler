import { ArrowRight, Check, FileText, PlayCircle, X } from "lucide-react";
import { ReactNode } from "react";
import { Link } from "react-router-dom";

import { HOME_FOR_ROLE, useAuth } from "../../auth/AuthContext";
import { Logo } from "../../components/layout/AppShell";
import { buttonClasses } from "../../components/ui/Button";
import { AUTHOR_URL, GitHubIcon, LinkedInIcon, REPO_URL } from "./BrandIcons";
import { DayTimeline } from "./DayTimeline";
import { HowItsBuilt } from "./HowItsBuilt";
import { JourneyFlow } from "./JourneyFlow";
import { VideoGallery } from "./VideoGallery";

// Body text is 17px so it reads on a projector.

const NAV = [
  ["How it works", "#how"],
  ["Journey", "#journey"],
  ["Edge cases", "#plans-change"],
  ["How it's built", "#built"],
  ["Demo videos", "#videos"],
];

export default function Landing() {
  const { user } = useAuth();
  const appLink = user ? HOME_FOR_ROLE[user.role] : "/login";

  return (
    <div className="min-h-screen bg-canvas text-ink-900 [&_h1]:text-balance [&_h2]:text-balance">
      <header className="sticky top-0 z-50 border-b border-ink-200/70 bg-canvas/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1360px] items-center justify-between gap-4 px-4 sm:px-6">
          <Link to="/" aria-label="GRIT Interviews home">
            <Logo dark={false} />
          </Link>
          <nav className="hidden items-center gap-1 lg:flex">
            {NAV.map(([label, href]) => (
              <a
                key={href}
                href={href}
                className="rounded-lg px-3 py-2 text-[15px] font-medium text-ink-600 transition hover:bg-ink-100 hover:text-ink-950"
              >
                {label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/writeup" className={buttonClasses("secondary", "sm")} aria-label="Read the write-up">
              <FileText className="h-4 w-4" /> <span className="hidden sm:inline">Write-up</span>
            </Link>
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
              className={buttonClasses("secondary", "sm")}
              aria-label="View the source code on GitHub"
            >
              <GitHubIcon /> <span className="hidden sm:inline">GitHub</span>
            </a>
            <Link to={appLink} className={buttonClasses("dark", "sm")}>
              {user ? "Open the app" : "Log in"} <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </header>

      <section className="overflow-hidden">
        <div className="mx-auto grid max-w-[1360px] grid-cols-1 items-center gap-12 px-4 pb-20 pt-14 sm:px-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:pt-20">
          <div>
            <p className="text-[14px] font-semibold text-brand-700">
              For NIAT students earning GRIT Track Badges
            </p>
            <h1 className="mt-4 font-head text-[42px] font-extrabold leading-[1.08] text-ink-950 sm:text-[56px]">
              Badge interviews, from booking to result.
            </h1>
            <p className="mt-5 max-w-[34rem] text-[19px] leading-relaxed text-ink-600">
              Students book their interview when they're ready. Interviewers record the result. The GRIT team
              sees everyone's progress, in one place.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to={appLink} className={buttonClasses("primary", "lg")}>
                {user ? "Open the app" : "Try the live demo"} <ArrowRight className="h-4 w-4" />
              </Link>
              <a href="#videos" className={buttonClasses("secondary", "lg")}>
                <PlayCircle className="h-4 w-4" /> Watch the 1-minute tour
              </a>
            </div>
            <p className="mt-8 text-[14px] text-ink-500">
              React · FastAPI · PostgreSQL · 175 automated tests
            </p>
          </div>

          <div className="relative min-w-0">
            <div className="overflow-hidden rounded-2xl bg-ink-950 shadow-lift ring-1 ring-ink-900/10">
              <div className="flex items-center gap-1.5 bg-ink-900 px-4 py-2.5">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                <span className="ml-3 text-[12px] font-medium text-ink-400">
                  GRIT Interviews · 1-minute tour, with sound
                </span>
              </div>
              <video
                className="aspect-video w-full max-w-full bg-ink-950"
                src="/videos/overview.mp4"
                poster="/videos/overview.jpg"
                controls
                preload="metadata"
                playsInline
              >
                <track kind="captions" src="/videos/overview.vtt" srcLang="en" label="English" />
              </video>
            </div>
          </div>
        </div>
      </section>

      <Section
        id="why"
        tone="white"
        kicker="Why it's needed"
        title="From chats and spreadsheets to one shared system."
      >
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <Compare
            label="Today"
            tone="bad"
            items={[
              "Students ask on WhatsApp when they can book",
              "Interviewers track slots in their own calendars",
              "Results sit in spreadsheets",
              "Nobody knows who's ready but hasn't booked",
            ]}
          />
          <Compare
            label="With GRIT Interviews"
            tone="good"
            items={[
              "Booking opens the moment the last skill is cleared",
              "Interviewers set their available hours once a week",
              "Results and feedback appear on the student's dashboard",
              "The team sees who hasn't booked and reminds them",
            ]}
          />
        </div>
      </Section>

      <Section id="how" kicker="How it works" title="Four steps from cleared skills to an earned badge.">
        <ol className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(([title, body], i) => (
            <li key={title} className="rounded-3xl bg-white p-6 shadow-card ring-1 ring-ink-200/70">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-ink-950 font-head text-[16px] font-bold text-white">
                {i + 1}
              </span>
              <p className="mt-5 font-head text-[19px] font-bold text-ink-950">{title}</p>
              <p className="mt-1.5 text-[15.5px] leading-relaxed text-ink-600">{body}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section
        id="roles"
        tone="white"
        kicker="Who uses it"
        title="One product, a clear screen for each role."
      >
        <div className="space-y-16">
          <Feature
            role="Students"
            title="Know where you stand, always."
            points={[
              "Book a 30-minute slot in a few taps",
              "Reschedule, cancel, or report an emergency",
              "See your scores and feedback when it's done",
            ]}
            img="/shots/student-passed.png"
            alt="A student's card after passing, with rubric scores and the interviewer's feedback"
            narrow
          />
          <Feature
            role="Interviewers"
            title="Run the whole day from one schedule."
            points={[
              "Set weekly hours, days off and short-notice slots",
              "Buttons unlock only when it's time",
              "Record pass, retake later or not cleared, with feedback",
            ]}
            img="/shots/interviewer-schedule.png"
            alt="An interviewer's schedule with a live interview ready for its result"
            flip
          />
          <Feature
            role="Interview team"
            title="See who's stuck, and act on it."
            points={[
              "Filter eligible students who haven't booked",
              "Send reminders in one click",
              "Review emergencies and disputes, revoke badges",
            ]}
            img="/shots/team-status.png"
            alt="The team's booking status list, showing students who haven't booked yet"
          />
        </div>
      </Section>

      <Section
        id="journey"
        kicker="The interview journey"
        title="Every student follows one clear path."
        description="This is the state machine behind the product. Forward steps run left to right; dashed lines lead back to Eligible. Each moving dot is a student. Click any box to see its rules."
      >
        <JourneyFlow />
      </Section>

      <Section
        id="day"
        tone="white"
        kicker="Interview day"
        title="Actions unlock on a fixed timeline."
        description="So an interviewer can't mark a student absent before the interview has even started."
      >
        <DayTimeline />
      </Section>

      <Section
        id="plans-change"
        kicker="Edge cases"
        title="When plans change, the rules are already decided."
      >
        <div className="grid grid-cols-1 gap-x-10 gap-y-7 md:grid-cols-2">
          {FAQ.map(([q, a]) => (
            <div key={q} className="border-l-2 border-brand-300 pl-5">
              <p className="font-head text-[18px] font-bold text-ink-950">{q}</p>
              <p className="mt-1.5 text-[16px] leading-relaxed text-ink-600">{a}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section id="built" tone="white" kicker="How it's built" title="Simple to use. Hard to break.">
        <HowItsBuilt />
      </Section>

      <Section
        id="messages"
        kicker="What students read"
        title="The three messages that matter most."
        description="Word for word, as they appear in the app."
      >
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {MESSAGES.map((m) => (
            <div
              key={m.title}
              className="flex flex-col rounded-3xl bg-white p-6 shadow-card ring-1 ring-ink-200/70"
            >
              <span className={`w-fit rounded-full px-2.5 py-1 text-[12px] font-semibold ${m.chip}`}>
                {m.when}
              </span>
              <p className="mt-4 font-head text-[20px] font-bold text-ink-950">{m.title}</p>
              <p className="mt-2 text-[15.5px] leading-relaxed text-ink-700">{m.body}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section
        id="videos"
        tone="white"
        kicker="Demo videos"
        title="Watch it working, recorded in the real app."
      >
        <VideoGallery />
      </Section>

      <section id="try" className="bg-ink-950 py-20 text-white">
        <div className="mx-auto grid max-w-[1360px] grid-cols-1 items-center gap-10 px-4 sm:px-6 lg:grid-cols-2">
          <div>
            <h2 className="font-head text-[34px] font-extrabold leading-tight sm:text-[40px]">
              Try it yourself.
            </h2>
            <p className="mt-3 max-w-md text-[17px] leading-relaxed text-ink-300">
              Log in with any account below. Every one uses the password{" "}
              <code className="rounded bg-white/10 px-1.5 py-0.5 text-white">demo1234</code>.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link to={appLink} className={buttonClasses("primary", "lg")}>
                {user ? "Open the app" : "Log in"} <ArrowRight className="h-4 w-4" />
              </Link>
              <Link to="/writeup" className={buttonClasses("secondary", "lg")}>
                <FileText className="h-4 w-4" /> Read the write-up
              </Link>
              <Link to="/showcase" className={buttonClasses("secondary", "lg")}>
                See before and after screens
              </Link>
              <a
                href={REPO_URL}
                target="_blank"
                rel="noreferrer"
                className={buttonClasses("dark", "lg") + " ring-1 ring-white/20"}
              >
                <GitHubIcon /> View the code
              </a>
            </div>
          </div>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {ACCOUNTS.map(([email, what]) => (
              <li key={email} className="rounded-xl bg-white/5 px-4 py-3 ring-1 ring-white/10">
                <p className="font-mono text-[14px] text-white">{email}</p>
                <p className="mt-0.5 text-[13px] text-ink-400">{what}</p>
              </li>
            ))}
          </ul>
        </div>
        <div className="mx-auto mt-16 flex max-w-[1360px] flex-col items-center justify-between gap-4 border-t border-white/10 px-4 pt-8 text-[14px] text-ink-400 sm:flex-row sm:px-6">
          <p>
            Designed and built by{" "}
            <a
              href={AUTHOR_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 font-semibold text-white underline-offset-4 hover:underline"
            >
              <LinkedInIcon className="h-4 w-4 text-[#0A66C2]" /> Aryan Jain
            </a>
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            <Link to="/writeup" className="inline-flex items-center gap-1.5 hover:text-white">
              <FileText className="h-4 w-4" /> Write-up (PDF, Word)
            </Link>
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 hover:text-white"
            >
              <GitHubIcon /> Source on GitHub
            </a>
            <span className="text-ink-600">NIAT AI Product Engineer assignment</span>
          </div>
        </div>
      </section>
    </div>
  );
}

function Section({
  id,
  kicker,
  title,
  description,
  tone = "canvas",
  children,
}: {
  id: string;
  kicker: string;
  title: string;
  description?: string;
  tone?: "canvas" | "white";
  children: ReactNode;
}) {
  return (
    <section id={id} className={`scroll-mt-16 py-20 sm:py-24 ${tone === "white" ? "bg-white" : "bg-canvas"}`}>
      <div className="mx-auto max-w-[1360px] px-4 sm:px-6">
        <p className="text-[14px] font-semibold text-brand-700">{kicker}</p>
        <h2 className="mt-2 max-w-4xl font-head text-[30px] font-extrabold leading-[1.15] text-ink-950 sm:text-[40px]">
          {title}
        </h2>
        {description && (
          <p className="mt-3 max-w-2xl text-[17px] leading-relaxed text-ink-600">{description}</p>
        )}
        <div className="mt-10">{children}</div>
      </div>
    </section>
  );
}

function Compare({ label, tone, items }: { label: string; tone: "bad" | "good"; items: string[] }) {
  const good = tone === "good";
  return (
    <div className={`rounded-3xl p-7 ${good ? "bg-ink-950 text-white" : "bg-canvas ring-1 ring-ink-200/70"}`}>
      <p className={`font-head text-[18px] font-bold ${good ? "text-white" : "text-ink-950"}`}>{label}</p>
      <ul className="mt-5 space-y-3.5">
        {items.map((t) => (
          <li key={t} className="flex gap-3 text-[16px] leading-snug">
            {good ? (
              <Check className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" strokeWidth={2.5} />
            ) : (
              <X className="mt-0.5 h-5 w-5 shrink-0 text-rose-500" strokeWidth={2.5} />
            )}
            <span className={good ? "text-ink-100" : "text-ink-700"}>{t}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Feature({
  role,
  title,
  points,
  img,
  alt,
  flip,
  narrow,
}: {
  role: string;
  title: string;
  points: string[];
  img: string;
  alt: string;
  flip?: boolean;
  narrow?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-2 lg:gap-14">
      <div className={flip ? "lg:order-2" : ""}>
        <p className="text-[14px] font-semibold uppercase tracking-[0.12em] text-ink-500">{role}</p>
        <h3 className="mt-2 font-head text-[26px] font-bold leading-tight text-ink-950 sm:text-[30px]">
          {title}
        </h3>
        <ul className="mt-5 space-y-3">
          {points.map((p) => (
            <li key={p} className="flex gap-3 text-[17px] text-ink-700">
              <Check className="mt-1 h-5 w-5 shrink-0 text-emerald-600" strokeWidth={2.5} />
              {p}
            </li>
          ))}
        </ul>
      </div>
      <div className={`rounded-3xl bg-canvas p-4 ring-1 ring-ink-200/70 sm:p-6 ${flip ? "lg:order-1" : ""}`}>
        <img
          src={img}
          alt={alt}
          loading="lazy"
          className={`mx-auto w-full rounded-2xl shadow-card ring-1 ring-ink-200 ${narrow ? "max-w-[380px]" : ""}`}
        />
      </div>
    </div>
  );
}

const STEPS: [string, string][] = [
  ["Clear your skills", "Booking unlocks automatically when the last skill for a badge is cleared."],
  ["Book a slot", "Pick a day and time. Reminders arrive a day before and an hour before."],
  [
    "Take the interview",
    "A 30-minute video call, scored on fundamentals, problem solving and communication.",
  ],
  [
    "Get your result",
    "Pass, retake later or not cleared, with written feedback. A pass adds the badge to your profile.",
  ],
];

const FAQ: [string, string][] = [
  ["Two students pick the same slot?", "Only one gets it. The other is asked to choose another time."],
  [
    "A student has a last-minute emergency?",
    "They move or cancel and give a reason. The team decides whether it costs an attempt.",
  ],
  [
    "The interviewer can't make it?",
    "They reschedule or cancel with a reason. The student keeps their attempt and is booked first.",
  ],
  [
    "Someone doesn't show up?",
    "A no-show can be marked only after 15 minutes. If nobody starts the interview, it closes without using an attempt.",
  ],
  [
    "A student was marked absent unfairly?",
    "They can dispute it within 48 hours. The team sees both sides before deciding.",
  ],
  ["Cheating is found after a pass?", "The team revokes the badge in one step. The student sees the reason."],
];

const MESSAGES = [
  {
    when: "After booking",
    chip: "bg-sky-50 text-sky-800",
    title: "You're booked!",
    body: "Your Frontend Developer badge interview is on Tue, 18 Nov at 4:30 PM IST with Priya Sharma. Join from your dashboard 5 minutes early. Need to change it? You can reschedule or cancel up to 12 hours before.",
  },
  {
    when: "On a pass",
    chip: "bg-emerald-50 text-emerald-800",
    title: "Congratulations — you passed!",
    body: "Your Frontend Developer Track Badge is now live on your GRIT profile. Your interviewer's feedback is on your dashboard.",
  },
  {
    when: "On a retake",
    chip: "bg-amber-50 text-amber-800",
    title: "You're almost there.",
    body: "Your interviewer suggested a retake for the Frontend Developer badge. Review the feedback on your dashboard — you can book your next interview from 2 Dec. This won't count against you.",
  },
];

const ACCOUNTS = [
  ["sneha@grit.demo", "Student, ready to book"],
  ["ishita@grit.demo", "Student with an emergency change"],
  ["priya@grit.demo", "Interviewer with interviews today"],
  ["admin@grit.demo", "Interview team"],
];
