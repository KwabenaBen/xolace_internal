import { DAY_MS, MONTH_NAMES, startOfDayGmt } from "@convex/lib/dates";

/**
 * The countdown's and the (parked) week strip's maths. Every calendar helper (GMT days, "Fri 14
 * Nov", "in 3 days") lives in convex/lib/dates.ts, shared with the server; don't add more here.
 */

const DAY_LETTERS = "SMTWTFS"; // Sunday first, as getUTCDay counts

export type WeekDay = { start: number; letter: string; date: number };

/** The Monday-to-Sunday week (GMT) that contains `ms`. */
export function weekOf(ms: number): WeekDay[] {
  const today = startOfDayGmt(ms);
  const fromMonday = (new Date(today).getUTCDay() + 6) % 7;
  const monday = today - fromMonday * DAY_MS;
  return Array.from({ length: 7 }, (_, i) => {
    const start = monday + i * DAY_MS;
    const date = new Date(start);
    return { start, letter: DAY_LETTERS[date.getUTCDay()], date: date.getUTCDate() };
  });
}

/** "November 2026", or "Nov – Dec 2026" when the week crosses a month. */
export function weekLabel(week: WeekDay[]): string {
  const first = new Date(week[0].start);
  const last = new Date(week[week.length - 1].start);
  if (first.getUTCMonth() === last.getUTCMonth()) {
    return `${MONTH_NAMES.long[first.getUTCMonth()]} ${first.getUTCFullYear()}`;
  }
  const year = first.getUTCFullYear() === last.getUTCFullYear() ? "" : ` ${first.getUTCFullYear()}`;
  return `${MONTH_NAMES.short[first.getUTCMonth()]}${year} – ${MONTH_NAMES.short[last.getUTCMonth()]} ${last.getUTCFullYear()}`;
}

export type Countdown = {
  /** True once the deadline has passed: the clock then counts up. */
  late: boolean;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
};

/** Time left until `deadline` (or since it, once late), split into units. */
export function countdown(deadline: number, now: number): Countdown {
  const left = deadline - now;
  const total = Math.floor(Math.abs(left) / 1000);
  return {
    late: left < 0,
    days: Math.floor(total / 86_400),
    hours: Math.floor(total / 3600) % 24,
    minutes: Math.floor(total / 60) % 60,
    seconds: total % 60,
  };
}

/** "2 days 14 hours 33 minutes", for screen readers (no seconds, so it doesn't churn). */
export function spokenCountdown({ days, hours, minutes }: Countdown): string {
  const part = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"}`;
  const parts = [];
  if (days > 0) parts.push(part(days, "day"));
  if (days > 0 || hours > 0) parts.push(part(hours, "hour"));
  parts.push(part(minutes, "minute"));
  return parts.join(" ");
}
