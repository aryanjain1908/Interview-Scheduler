// Prints frontend/public/downloads/print.html to a PDF with Edge (or Chrome) and
// checks it fits the 2-page limit. Run build.py first.
import { readFileSync, unlinkSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright-core";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const dir = resolve(root, "frontend/public/downloads");
const out = resolve(dir, "GRIT-Interviews-Writeup.pdf");
const MAX_PAGES = 2;

const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL ?? "msedge" });
const page = await browser.newPage();
await page.goto(pathToFileURL(resolve(dir, "print.html")).href, { waitUntil: "networkidle" });
await page.evaluate(() => document.fonts.ready);
await page.pdf({ path: out, format: "A4", printBackground: true, preferCSSPageSize: true });
await browser.close();
unlinkSync(resolve(dir, "print.html"));

const pages = (readFileSync(out, "latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;
console.log(`Wrote ${out.replace(root, ".")} (${pages} page${pages === 1 ? "" : "s"})`);
if (pages > MAX_PAGES) {
  console.error(`Too long: the write-up must fit on ${MAX_PAGES} pages.`);
  process.exit(1);
}
