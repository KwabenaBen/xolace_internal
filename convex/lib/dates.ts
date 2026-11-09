/**
 * Deadline dates. Shared by Convex functions and the app, so keep it free of server-only imports.
 * Every date helper in the app comes from here, so the Board, the pages and the server agree.
 *
 * Deadlines are picked as calendar dates ("YYYY-MM-DD") and stored as the last millisecond of
 * that day in GMT (Ghana time; docs/REQUIREMENTS.md → "times stored in GMT"). GMT has no
 * daylight saving, so this is plain UTC arithmetic.
 */

export const DAY_MS = 24 * 60 * 60 * 1000;

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAYS_LONG = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/** "2026-11-30" → end of that day in GMT (ms), or null if it isn't a real date. */
export function endOfDayGmt(dateOnly: string): number | null {
  const match = DATE_ONLY.exec(dateOnly);
  if (match === null) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const ms = Date.UTC(year, month - 1, day, 23, 59, 59, 999);
  const check = new Date(ms);
  // Rejects dates like 2026-02-30 that Date.UTC would silently roll over.
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1) return null;
  return ms;
}

/** A timestamp → its GMT calendar date, "YYYY-MM-DD". */
export function toDateOnly(ms: number): string {
  const date = new Date(ms);
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${date.getUTCFullYear()}-${month}-${day}`;
}

/** Midnight GMT at the start of `ms`'s day. */
export function startOfDayGmt(ms: number): number {
  return Math.floor(ms / DAY_MS) * DAY_MS;
}

/** True when both times fall on the same GMT day. */
export function sameDayGmt(a: number, b: number): boolean {
  return startOfDayGmt(a) === startOfDayGmt(b);
}

/** Whole GMT calendar days from `from`'s day to `to`'s day: 0 = same day, -1 = the day before. */
export function calendarDaysBetween(from: number, to: number): number {
  return Math.round((startOfDayGmt(to) - startOfDayGmt(from)) / DAY_MS);
}

/** " 2027" when `ms` falls in a different year from `now`, else "". */
function yearSuffix(ms: number, now: number): string {
  const year = new Date(ms).getUTCFullYear();
  return year === new Date(now).getUTCFullYear() ? "" : ` ${year}`;
}

/** "30 Nov", or "30 Nov 2027" when the year differs from `now`'s. */
export function formatDeadline(ms: number, now: number = Date.now()): string {
  const date = new Date(ms);
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}${yearSuffix(ms, now)}`;
}

/** "Fri 14 Nov", or "Fri 14 Nov 2027" when the year differs from `now`'s. */
export function shortDay(ms: number, now: number): string {
  const date = new Date(ms);
  return `${WEEKDAYS[date.getUTCDay()]} ${formatDeadline(ms, now)}`;
}

/** "Friday 14 November 2026", for screen readers. */
export function longDay(ms: number): string {
  const date = new Date(ms);
  return `${WEEKDAYS_LONG[date.getUTCDay()]} ${date.getUTCDate()} ${MONTHS_LONG[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

/** A deadline relative to today, by calendar day: "today", "tomorrow", "in 3 days", "2 days late". */
export function relativeDay(deadline: number, now: number): string {
  const days = calendarDaysBetween(now, deadline);
  if (days < 0) return `${-days} ${days === -1 ? "day" : "days"} late`;
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days} days`;
}

/** Short and long month names, for labels that need them (e.g. a week's month). */
export const MONTH_NAMES = { short: MONTHS, long: MONTHS_LONG } as const;
