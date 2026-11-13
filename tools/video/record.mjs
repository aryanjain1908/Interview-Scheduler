// Records narrated product videos by driving the real app.
// usage: node record.mjs <overview|student|interviewer|team>
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const BASE = "http://localhost:5173";
const API = "http://localhost:8000/api";
const W = 1280;
const H = 720;
const which = process.argv[2];
const durs = JSON.parse(fs.readFileSync(path.join(DIR, "vo", "durations.json"), "utf8"));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sql = (q) =>
  execSync(`docker compose exec -T db psql -U grit -tAc "${q.replace(/"/g, '\\"')}"`, { cwd: path.join(DIR, "..", "..") }).toString().trim();

async function api(p, { token, method = "GET", body } = {}) {
  const res = await fetch(`${API}${p}`, {
    method,
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${method} ${p} → ${res.status} ${await res.text()}`);
  return res.json();
}
const tokens = {};
const token = async (email) => (tokens[email] ??= (await api("/auth/login", { method: "POST", body: { email, password: "demo1234" } })).access_token);

// A visible cursor with click ripples (headless recordings don't draw the OS cursor).
const CURSOR = `(() => {
  const make = () => {
    if (document.getElementById('__cur') || !document.documentElement) return;
    const c = document.createElement('div'); c.id = '__cur';
    c.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24"><path d="M4 2l15 9.5-6.6 1.4L9 20z" fill="#10173A" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    Object.assign(c.style, { position: 'fixed', left: '0', top: '0', zIndex: 2147483647, pointerEvents: 'none', transform: 'translate(-60px,-60px)', filter: 'drop-shadow(0 2px 3px rgba(0,0,0,.35))' });
    document.documentElement.appendChild(c);
  };
  addEventListener('mousemove', (e) => { make(); const c = document.getElementById('__cur'); if (c) c.style.transform = 'translate(' + (e.clientX - 3) + 'px,' + (e.clientY - 2) + 'px)'; }, true);
  addEventListener('mousedown', (e) => {
    const r = document.createElement('div');
    Object.assign(r.style, { position: 'fixed', left: e.clientX - 18 + 'px', top: e.clientY - 18 + 'px', width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(99,102,241,.35)', zIndex: 2147483646, pointerEvents: 'none', transition: 'transform .45s ease-out, opacity .45s ease-out' });
    document.documentElement.appendChild(r);
    requestAnimationFrame(() => { r.style.transform = 'scale(1.8)'; r.style.opacity = '0'; });
    setTimeout(() => r.remove(), 600);
  }, true);
  document.addEventListener('DOMContentLoaded', make);
})();`;

const CARD = (title, sub, kicker) => `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&family=Plus+Jakarta+Sans:wght@700;800&display=swap" rel="stylesheet">
<style>
html,body{margin:0;height:100%;background:#0A0F24;color:#fff;font-family:Inter,sans-serif;overflow:hidden}
.g1{position:absolute;left:-180px;top:-200px;width:620px;height:620px;border-radius:50%;background:rgba(79,70,229,.45);filter:blur(130px)}
.g2{position:absolute;right:-120px;bottom:-220px;width:560px;height:560px;border-radius:50%;background:rgba(14,165,233,.28);filter:blur(130px)}
.w{position:relative;height:100%;display:flex;flex-direction:column;justify-content:center;padding:0 110px;animation:in .9s ease-out both}
.logo{display:flex;align-items:center;gap:14px;margin-bottom:44px}
.k{font:700 15px Inter;letter-spacing:.22em;text-transform:uppercase;color:#A3A9FB}
h1{font:800 68px/1.04 'Plus Jakarta Sans';letter-spacing:-.02em;margin:14px 0 0;max-width:980px}
p{font:400 24px/1.45 Inter;color:#C6C9D8;margin:22px 0 0;max-width:820px}
@keyframes in{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
</style></head><body><div class="g1"></div><div class="g2"></div><div class="w">
<div class="logo"><svg viewBox="0 0 32 32" width="52" height="52"><rect width="32" height="32" rx="9" fill="#1A2350"/><path d="M21.5 11.5a7 7 0 1 0 1.2 7.5H16" fill="none" stroke="#A3A9FB" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>
<div><div style="font:800 26px 'Plus Jakarta Sans'">GRIT</div><div style="font:600 12px Inter;letter-spacing:.2em;color:#9A9EB8">INTERVIEWS</div></div></div>
<div class="k">${kicker}</div><h1>${title}</h1><p>${sub}</p></div></body></html>`;

function director(page) {
  let x = W / 2;
  let y = H / 2;
  const d = {
    async card(title, sub, kicker, ms) {
      if (!page.url().startsWith(BASE)) await page.goto(`${BASE}/login`);
      await page.evaluate((html) => {
        document.open();
        document.write(html);
        document.close();
      }, CARD(title, sub, kicker));
      await sleep(ms);
    },
    async as(email, route) {
      const t = email ? await token(email) : null;
      await page.evaluate((tk) => (tk ? localStorage.setItem("grit.token", tk) : localStorage.removeItem("grit.token")), t);
      await page.goto(`${BASE}${route}`);
      await page.waitForLoadState("networkidle").catch(() => {});
      await sleep(500);
      await page.mouse.move(x, y);
    },
    async moveTo(target, { dx = 0, dy = 0, steps } = {}) {
      let tx, ty;
      if (typeof target === "object" && "x" in target) ({ x: tx, y: ty } = target);
      else {
        await target.scrollIntoViewIfNeeded().catch(() => {});
        const b = await target.boundingBox();
        if (!b) return;
        tx = b.x + b.width / 2 + dx;
        ty = b.y + b.height / 2 + dy;
      }
      const dist = Math.hypot(tx - x, ty - y);
      const n = steps ?? Math.max(10, Math.min(34, Math.round(dist / 18)));
      // ease-in-out along the path
      for (let i = 1; i <= n; i++) {
        const p = i / n;
        const e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
        await page.mouse.move(x + (tx - x) * e, y + (ty - y) * e);
        await sleep(9);
      }
      x = tx;
      y = ty;
    },
    async click(target, opts) {
      await d.moveTo(target, opts);
      await sleep(140);
      await page.mouse.down();
      await sleep(60);
      await page.mouse.up();
      await sleep(260);
    },
    async type(target, text) {
      await d.click(target);
      await page.keyboard.type(text, { delay: 17 });
      await sleep(300);
    },
    async scrollTo(target, block = "center") {
      await target.evaluate((el, b) => el.scrollIntoView({ behavior: "smooth", block: b }), block);
      await sleep(1100);
    },
    async scrollBy(dy, ms = 1200) {
      await page.evaluate((v) => window.scrollBy({ top: v, behavior: "smooth" }), dy);
      await sleep(ms);
    },
    wait: sleep,
  };
  return d;
}

async function record(name, scenes, prep) {
  if (prep) await prep();
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  const ctx = await browser.newContext({
    viewport: { width: W, height: H },
    recordVideo: { dir: path.join(DIR, "rec"), size: { width: W, height: H } },
  });
  await ctx.addInitScript(CURSOR);
  const page = await ctx.newPage();
  const t0 = Date.now();
  page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
  const d = director(page);
  const timeline = [];
  for (const sc of scenes) {
    const start = (Date.now() - t0) / 1000;
    const lead = sc.lead ?? 0.4;
    const dur = durs[sc.id].dur;
    timeline.push({ id: sc.id, at: +(start + lead).toFixed(3), dur, text: durs[sc.id].text, file: durs[sc.id].file });
    const began = Date.now();
    let acted = 0;
    await Promise.all([sc.run(d, page).then(() => (acted = (Date.now() - began) / 1000)), sleep((lead + dur + (sc.tail ?? 0.6)) * 1000)]);
    const gap = acted - (lead + dur + (sc.tail ?? 0.6));
    console.log(`  ${sc.id} ${start.toFixed(1)}s  voice ${dur.toFixed(1)}s  actions ${acted.toFixed(1)}s${gap > 0.8 ? `  ⚠ ${gap.toFixed(1)}s of silence` : ""}`);
  }
  await sleep(400);
  const length = (Date.now() - t0) / 1000;
  const video = page.video();
  await ctx.close();
  await browser.close();
  const out = { name, length, webm: await video.path(), timeline };
  fs.writeFileSync(path.join(DIR, `${name}.timeline.json`), JSON.stringify(out, null, 1));
  console.log(`${name}: ${length.toFixed(1)}s → ${out.webm}`);
}

const firstOpenDay = (page) => page.locator("button").filter({ hasText: / open$/ });
const timeChip = (page) => page.locator("button", { hasText: /^\d{1,2}:\d{2} (AM|PM)$/ });

const VIDEOS = {
  overview: () =>
    record("overview", [
      {
        id: "o1",
        lead: 0.6,
        run: async (d, page) => {
          await d.card("From eligible to earned.", "Live Track Badge interviews for GRIT — booked, run and recorded in one place.", "GRIT Interviews", 3800);
          await d.as(null, "/");
          await d.wait(1600);
          await d.scrollTo(page.locator("#journey"), "start");
          await d.scrollBy(260, 1800);
        },
      },
      {
        id: "o2",
        run: async (d, page) => {
          await d.as("sneha@grit.demo", "/student");
          await d.moveTo(page.getByRole("link", { name: "Book a slot" }).first());
          await d.wait(700);
          await d.click(page.getByRole("link", { name: "Book a slot" }).first());
          await d.wait(900);
          await d.click(firstOpenDay(page).nth(1));
          await d.click(timeChip(page).nth(2));
        },
      },
      {
        id: "o3",
        run: async (d, page) => {
          await d.click(page.getByRole("button", { name: "Review booking" }));
          await d.wait(1200);
          await d.click(page.getByRole("button", { name: "Confirm booking" }));
          await page.getByText("You're booked!").first().waitFor();
          await d.wait(600);
          await d.moveTo(page.getByText("You're booked!").first(), { dx: 120 });
        },
      },
      {
        id: "o4",
        run: async (d, page) => {
          await d.as("priya@grit.demo", "/interviewer");
          const row = page.locator("div.rounded-2xl", { hasText: "Aisha Khan" }).last();
          await d.moveTo(row, { dx: -200 });
          await d.wait(500);
          await d.moveTo(row.getByRole("link", { name: "Join" }));
          await d.wait(400);
          await d.click(row.getByRole("button", { name: "Record outcome" }));
          await d.click(page.getByRole("button", { name: /^Pass/ }));
        },
      },
      {
        id: "o5",
        tail: 0.4,
        run: async (d, page) => {
          for (const [label, score] of [["Fundamentals", "5"], ["Problem solving", "4"], ["Communication", "5"]]) {
            const r = page.locator("div.flex.flex-col", { has: page.getByText(label, { exact: true }) }).last();
            await d.click(r.getByRole("button", { name: score, exact: true }));
          }
          await d.click(page.getByRole("button", { name: "Submit outcome" }));
          await d.wait(400);
          await d.as("aisha@grit.demo", "/student");
          await d.wait(1200);
        },
      },
      {
        id: "o6",
        run: async (d, page) => {
          await d.as("admin@grit.demo", "/admin/students");
          await d.click(page.getByRole("button", { name: /Not booked/ }));
          await d.wait(500);
          await d.click(page.getByRole("checkbox", { name: "Select all not-booked" }));
          await d.moveTo(page.getByRole("button", { name: /Send reminder/ }));
        },
      },
      {
        id: "o7",
        run: async (d, page) => {
          await d.as("admin@grit.demo", "/admin/interviews");
          await d.click(page.getByRole("button", { name: "Emergency changes" }));
          await d.wait(1200);
          await d.moveTo(page.getByRole("row", { name: /Ishita Rao/ }), { dx: 160 });
          await d.wait(900);
          await d.click(page.getByRole("button", { name: "Emergency changes" }));
          await d.click(page.getByRole("button", { name: "Disputed" }));
          await d.wait(600);
          await d.moveTo(page.getByRole("row", { name: /Farhan Ali/ }), { dx: 160 });
        },
      },
      {
        id: "o8",
        tail: 1.6,
        run: async (d) => {
          await d.card("GRIT Interviews", "From eligible, to earned.", "Try it today", 100);
        },
      },
    ]),

  student: () =>
    record("student", [
      {
        id: "s1",
        lead: 0.8,
        run: async (d, page) => {
          await d.card("For students", "Book, change, and see your result — on one card.", "GRIT Interviews · demo", 3200);
          await d.as("divya@grit.demo", "/student");
          await d.moveTo(page.getByText("You're eligible — book your interview").first());
          await d.wait(800);
          await d.moveTo(page.getByRole("link", { name: "Book a slot" }).first());
        },
      },
      {
        id: "s2",
        run: async (d, page) => {
          await d.click(page.getByRole("link", { name: "Book a slot" }).first());
          await d.wait(1200);
          await d.click(firstOpenDay(page).nth(2));
          await d.wait(700);
          await d.moveTo(page.getByText(/aren't\s+shown/), { dx: -60 });
          await d.wait(900);
          await d.click(timeChip(page).nth(3));
        },
      },
      {
        id: "s3",
        run: async (d, page) => {
          await d.click(page.getByRole("button", { name: "Review booking" }));
          await d.wait(800);
          await d.moveTo(page.getByText(/Video call with/));
          await d.wait(600);
          await d.moveTo(page.getByText(/Reschedule or cancel up to 12 hours/));
        },
      },
      {
        id: "s4",
        run: async (d, page) => {
          await d.click(page.getByRole("button", { name: "Confirm booking" }));
          await page.getByText("You're booked!").first().waitFor();
          await d.wait(1200);
          await d.moveTo(page.getByRole("link", { name: "Reschedule" }));
          await d.wait(600);
          await d.click(page.getByRole("button", { name: /Notifications/ }).first());
          await d.wait(2200);
          await page.keyboard.press("Escape");
          await d.click({ x: 900, y: 120 });
        },
      },
      {
        id: "s5",
        run: async (d, page) => {
          await d.as("ishita@grit.demo", "/student");
          await d.moveTo(page.getByText("Emergency change under review.").first());
          await d.wait(1500);
          await d.moveTo(page.getByText(/Your reason/).first(), { dx: 80 });
        },
      },
      {
        id: "s6",
        tail: 1.2,
        run: async (d, page) => {
          await d.as("vikram@grit.demo", "/student");
          await d.wait(1200);
          await d.moveTo(page.getByText("Congratulations — you passed!").first());
          await d.wait(900);
          await d.scrollBy(300, 1400);
        },
      },
    ]),

  interviewer: () =>
    record(
      "interviewer",
      [
        {
          id: "i1",
          lead: 0.8,
          run: async (d, page) => {
            await d.card("For interviewers", "Run your interview day from one screen.", "GRIT Interviews · demo", 3200);
            await d.as("priya@grit.demo", "/interviewer");
            await d.moveTo(page.locator("div.rounded-2xl", { hasText: "Meghana S" }).last(), { dx: -250 });
          },
        },
        {
          id: "i2",
          run: async (d, page) => {
            const row = page.locator("div.rounded-2xl", { hasText: "Meghana S" }).last();
            await d.moveTo(row.getByRole("button", { name: "Mark as started" }));
            await d.wait(900);
            await d.moveTo(row.getByRole("button", { name: "No-show" }));
            await d.wait(900);
            await d.moveTo(row.getByText(/You can mark a no-show from/));
          },
        },
        {
          id: "i3",
          run: async (d, page) => {
            const row = page.locator("div.rounded-2xl", { hasText: "Meghana S" }).last();
            await d.click(row.getByRole("button", { name: "Record outcome" }));
            await d.click(page.getByRole("button", { name: /^Pass/ }));
            for (const [label, score] of [["Fundamentals", "4"], ["Problem solving", "5"], ["Communication", "4"]]) {
              const r = page.locator("div.flex.flex-col", { has: page.getByText(label, { exact: true }) }).last();
              await d.click(r.getByRole("button", { name: score, exact: true }));
            }
            await d.type(page.getByLabel(/Feedback for the student/), "Strong SQL, clear thinking.");
            await d.click(page.getByRole("button", { name: "Submit outcome" }));
          },
        },
        {
          id: "i4",
          run: async (d, page) => {
            const row = page.locator("div.rounded-2xl", { hasText: "Kiran Kumar" }).last();
            await d.click(row.getByRole("button", { name: "Change" }));
            await d.wait(700);
            await d.click(page.getByRole("menuitem", { name: "Reschedule" }));
            const select = page.getByLabel("New time");
            await d.click(select);
            await page.keyboard.press("Escape");
            await select.selectOption({ index: 2 });
            await d.type(page.getByLabel("Reason"), "Campus panel that morning.");
            await d.moveTo(page.getByRole("button", { name: "Move interview" }));
            await d.wait(900);
            await page.keyboard.press("Escape");
          },
        },
        {
          id: "i5",
          tail: 1.2,
          run: async (d, page) => {
            await d.click(page.getByRole("link", { name: "Availability" }));
            await d.wait(1000);
            await d.click(page.getByRole("button", { name: "Add hours on Saturday" }));
            await page.getByLabel("From").selectOption({ label: "11:00 PM" });
            await page.getByLabel("To").selectOption({ label: "Midnight" });
            await d.moveTo(page.getByLabel("To"));
            await d.wait(1500);
            await d.moveTo(page.getByRole("heading", { name: "Next 14 days" }), { dx: 120 });
          },
        },
      ],
      async () => {
        // A live interview that hasn't been started (Meghana), and an upcoming one to reschedule (Kiran).
        sql(
          "update slots set start_at = date_trunc('minute', now()) - interval '3 minutes', end_at = date_trunc('minute', now()) + interval '27 minutes' where id = (select i.slot_id from interviews i join users u on u.id = i.student_id where u.email = 'meghana@grit.demo' and i.status = 'scheduled')",
        );
        const kiran = await token("kiran@grit.demo");
        const priya = (await api("/auth/me", { token: await token("priya@grit.demo") })).id;
        const backend = (await api("/badges")).find((b) => b.slug === "backend");
        const today = new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
        const slot = (await api(`/student/slots?badge_id=${backend.id}`, { token: kiran })).find(
          (s) => s.interviewer.id === priya && s.start_at.slice(0, 10) <= today,
        ) ?? (await api(`/student/slots?badge_id=${backend.id}`, { token: kiran })).find((s) => s.interviewer.id === priya);
        let slotId = sql(
          "select i.slot_id from interviews i join users u on u.id = i.student_id where u.email = 'kiran@grit.demo' and i.status = 'scheduled'",
        );
        if (!slotId) {
          await api("/student/interviews", { token: kiran, method: "POST", body: { badge_id: backend.id, slot_id: slot.id } });
          slotId = slot.id;
        }
        // Keep Kiran's booking on today's schedule so it shows next to Meghana's.
        sql(
          `update slots set start_at = date_trunc('hour', now()) + interval '3 hours', end_at = date_trunc('hour', now()) + interval '3 hours 30 minutes' where id = '${slotId}'`,
        );
      },
    ),

  team: () =>
    record("team", [
      {
        id: "t1",
        lead: 0.8,
        run: async (d, page) => {
          await d.card("For the interview team", "Oversight, reviews and integrity — without the spreadsheet.", "GRIT Interviews · demo", 3200);
          await d.as("admin@grit.demo", "/admin");
          await d.moveTo({ x: 520, y: 220 });
          await d.wait(900);
          await d.moveTo({ x: 900, y: 220 });
        },
      },
      {
        id: "t2",
        run: async (d, page) => {
          await d.click(page.getByRole("link", { name: "Booking status" }));
          await d.wait(900);
          await d.click(page.getByRole("button", { name: /Not booked/ }));
          await d.wait(600);
          await d.click(page.getByRole("checkbox", { name: "Select all not-booked" }));
          await d.click(page.getByRole("button", { name: /Send reminder/ }));
        },
      },
      {
        id: "t3",
        run: async (d, page) => {
          await d.click(page.getByRole("link", { name: "Interviews", exact: true }));
          await d.wait(800);
          await d.click(page.getByRole("button", { name: "Emergency changes" }));
          await d.wait(900);
          const row = page.getByRole("row", { name: /Ishita Rao/ });
          await d.moveTo(row.getByText(/father was admitted/));
          await d.wait(800);
          await d.click(row.getByRole("button", { name: "Approve" }));
          await d.wait(900);
          await d.click(page.getByRole("button", { name: "Approve — no attempt used" }));
        },
      },
      {
        id: "t4",
        run: async (d, page) => {
          await d.click(page.getByRole("button", { name: "Emergency changes" }));
          await d.click(page.getByRole("button", { name: "Disputed" }));
          await d.wait(700);
          const row = page.getByRole("row", { name: /Farhan Ali/ });
          await d.click(row.getByRole("button", { name: "Excuse no-show" }));
          await d.wait(2600);
          await page.keyboard.press("Escape");
        },
      },
      {
        id: "t5",
        tail: 1.4,
        run: async (d, page) => {
          await d.click(page.getByRole("link", { name: "Student records" }));
          await d.wait(700);
          await d.type(page.getByPlaceholder("Name, email, college"), "Vikram");
          await d.wait(900);
          await d.click(page.getByRole("button", { name: "Open record" }).first());
          await d.wait(900);
          await d.click(page.getByRole("button", { name: "Nullify badge" }).first());
          await d.type(page.getByLabel("What happened?"), "Answers read from a second screen.");
          await d.click(page.getByRole("button", { name: "Nullify badge" }).last());
          await d.wait(1200);
        },
      },
    ]),
};

await VIDEOS[which]();
