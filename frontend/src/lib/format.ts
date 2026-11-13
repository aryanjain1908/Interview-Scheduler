// All times are shown in IST, whatever the viewer's device timezone.
const TZ = "Asia/Kolkata";

const fmt = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-IN", { timeZone: TZ, ...options });

const timeFmt = fmt({ hour: "numeric", minute: "2-digit", hour12: true });
const dayFmt = fmt({ weekday: "short", day: "numeric", month: "short" });
const longDayFmt = fmt({ weekday: "long", day: "numeric", month: "long" });
const dateFmt = fmt({ day: "numeric", month: "short", year: "numeric" });
const shortDateFmt = fmt({ day: "numeric", month: "short" });
const keyFmt = fmt({ year: "numeric", month: "2-digit", day: "2-digit" });
const hourFmt = fmt({ hour: "numeric", hour12: false });

export const formatTime = (iso: string) => timeFmt.format(new Date(iso)).toUpperCase();
export const formatDay = (iso: string | Date) => dayFmt.format(new Date(iso));
export const formatLongDay = (iso: string | Date) => longDayFmt.format(new Date(iso));
export const formatDate = (iso: string | Date) => dateFmt.format(new Date(iso));
/** "20 Nov" — matches the backend message copy. */
export const formatShortDate = (iso: string | Date) => shortDateFmt.format(new Date(iso));
export const formatDateTime = (iso: string) => `${formatDay(iso)}, ${formatTime(iso)} IST`;

export function istDateKey(value: string | Date): string {
  const parts = keyFmt.formatToParts(new Date(value));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export const istHour = (iso: string) => Number(hourFmt.format(new Date(iso))) % 24;

/** A YYYY-MM-DD key as a Date anchored at IST noon, safe for display formatting. */
export const keyToDate = (key: string) => new Date(`${key}T12:00:00+05:30`);

export function addDaysToKey(key: string, days: number): string {
  const d = keyToDate(key);
  d.setUTCDate(d.getUTCDate() + days);
  return istDateKey(d);
}

export function relativeFromNow(iso: string, now = Date.now()): string {
  const diff = new Date(iso).getTime() - now;
  const abs = Math.abs(diff);
  if (abs < 60_000) return "just now";
  const minutes = Math.round(abs / 60_000);
  const hours = Math.round(abs / 3_600_000);
  const days = Math.round(abs / 86_400_000);
  const text = minutes < 60 ? `${minutes} min` : hours < 36 ? `${hours} hr` : `${days} days`;
  return diff >= 0 ? `in ${text}` : `${text} ago`;
}

export function daysSince(iso: string | null, now = Date.now()): number | null {
  if (!iso) return null;
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 86_400_000));
}

export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function formatClock(hms: string): string {
  const [h, m] = hms.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");

const minuteFmt = fmt({ hour: "numeric", minute: "numeric", hour12: false });

export function istMinutes(iso: string): number {
  const parts = minuteFmt.formatToParts(new Date(iso));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return (get("hour") % 24) * 60 + get("minute");
}

export function mondayOf(key: string): string {
  const weekday = keyToDate(key).getUTCDay();
  return addDaysToKey(key, -((weekday + 6) % 7));
}

export function formatWeekRange(mondayKey: string): string {
  const start = keyToDate(mondayKey);
  const end = keyToDate(addDaysToKey(mondayKey, 6));
  const sameMonth = start.getUTCMonth() === end.getUTCMonth();
  const left = sameMonth ? String(start.getUTCDate()) : shortDateFmt.format(start);
  return `${left} – ${dateFmt.format(end)}`;
}
