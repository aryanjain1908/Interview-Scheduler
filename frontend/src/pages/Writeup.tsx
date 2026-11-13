import clsx from "clsx";
import { ArrowLeft, Download, ExternalLink, FileText } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { Logo } from "../components/layout/AppShell";
import { buttonClasses } from "../components/ui/Button";
import { REPO_URL, GitHubIcon } from "./landing/BrandIcons";

const BASE = "/downloads/GRIT-Interviews-Writeup";

const FORMATS = [
  { ext: "pdf", label: "PDF", note: "2 pages, A4" },
  { ext: "docx", label: "Word", note: "Editable" },
  { ext: "md", label: "Markdown", note: "Plain source" },
  { ext: "txt", label: "Text", note: "No formatting" },
];

type View = "read" | "pdf";

export default function Writeup() {
  const [view, setView] = useState<View>("read");
  const [html, setHtml] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    document.title = "Write-up · GRIT Interviews";
    let cancelled = false;
    fetch("/downloads/writeup.html")
      .then((res) => (res.ok ? res.text() : Promise.reject(res.status)))
      .then((text) => !cancelled && setHtml(text))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      document.title = "GRIT Interviews";
    };
  }, []);

  return (
    <div className="min-h-screen bg-canvas text-ink-900">
      <header className="sticky top-0 z-50 border-b border-ink-200/70 bg-canvas/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1100px] items-center justify-between gap-4 px-4 sm:px-6">
          <Link to="/" aria-label="GRIT Interviews home">
            <Logo dark={false} />
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/" className={buttonClasses("ghost", "sm")}>
              <ArrowLeft className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Home</span>
            </Link>
            <a href={REPO_URL} target="_blank" rel="noreferrer" className={buttonClasses("secondary", "sm")}>
              <GitHubIcon /> <span className="hidden sm:inline">GitHub</span>
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1100px] px-4 pb-20 pt-10 sm:px-6 sm:pt-14">
        <p className="text-[14px] font-semibold text-brand-700">Assignment write-up</p>
        <h1 className="mt-2 font-head text-[34px] font-extrabold leading-tight text-ink-950 sm:text-[44px]">
          States, edge cases and data model
        </h1>
        <p className="mt-3 max-w-2xl text-[17px] leading-relaxed text-ink-600">
          The two pages that go with the app: every state of a student's interview journey, the edge cases I handled
          with my assumptions, and the database tables. Read it here or download it.
        </p>

        <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {FORMATS.map((f) => (
            <a
              key={f.ext}
              href={`${BASE}.${f.ext}`}
              download
              className="group flex items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-card ring-1 ring-ink-200/70 transition hover:ring-brand-400"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700">
                <Download className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block font-semibold text-ink-900 group-hover:text-brand-700">{f.label}</span>
                <span className="block text-[13px] leading-snug text-ink-500">
                  .{f.ext} · {f.note}
                </span>
              </span>
            </a>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-3">
          <div role="tablist" aria-label="How to view" className="inline-flex rounded-xl bg-ink-100 p-1">
            {(
              [
                ["read", "Read here"],
                ["pdf", "PDF view"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                role="tab"
                aria-selected={view === key}
                onClick={() => setView(key)}
                className={clsx(
                  "rounded-lg px-4 py-1.5 text-sm font-semibold transition",
                  view === key ? "bg-white text-ink-950 shadow-sm" : "text-ink-500 hover:text-ink-800",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <a href={`${BASE}.pdf`} target="_blank" rel="noreferrer" className={buttonClasses("secondary", "sm")}>
            <ExternalLink className="h-3.5 w-3.5" /> Open the PDF in a new tab
          </a>
        </div>

        {view === "read" ? (
          <article className="writeup-doc mt-4 rounded-2xl bg-white px-5 py-7 shadow-card ring-1 ring-ink-200/70 sm:px-10 sm:py-10">
            {html ? (
              <div dangerouslySetInnerHTML={{ __html: html }} />
            ) : failed ? (
              <p className="text-ink-600">
                The write-up couldn't be loaded here. <a href={`${BASE}.pdf`}>Open the PDF</a> instead.
              </p>
            ) : (
              <div className="space-y-3" aria-busy="true">
                {[80, 95, 60, 90, 70].map((w) => (
                  <div key={w} className="h-4 animate-pulse rounded bg-ink-100" style={{ width: `${w}%` }} />
                ))}
              </div>
            )}
          </article>
        ) : (
          <div className="mt-4 overflow-hidden rounded-2xl bg-white shadow-card ring-1 ring-ink-200/70">
            <object data={`${BASE}.pdf#view=FitH`} type="application/pdf" className="block h-[80vh] w-full">
              <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
                <FileText className="h-8 w-8 text-ink-400" />
                <p className="text-ink-600">Your browser can't show the PDF here.</p>
                <a href={`${BASE}.pdf`} className={buttonClasses("primary", "sm")}>
                  <Download className="h-3.5 w-3.5" /> Download the PDF
                </a>
              </div>
            </object>
          </div>
        )}
      </main>
    </div>
  );
}
