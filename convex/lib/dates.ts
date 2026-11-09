/**
 * Deadline dates. Shared by Convex functions and the app, so keep it free of server-only imports.
 *
 * Deadlines are picked as calendar dates ("YYYY-MM-DD") and stored as the last millisecond of
 * that day in GMT (Ghana time; docs/REQUIREMENTS.md → "times stored in GMT"). GMT has no
 * daylight saving, so this is plain UTC arithmetic.
 */

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

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

/** "30 Nov", or "30 Nov 2027" when the year differs from `now`'s. */
export function formatDeadline(ms: number, now: number = Date.now()): string {
  const date = new Date(ms);
  const label = `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
  return date.getUTCFullYear() === new Date(now).getUTCFullYear()
    ? label
    : `${label} ${date.getUTCFullYear()}`;
}
