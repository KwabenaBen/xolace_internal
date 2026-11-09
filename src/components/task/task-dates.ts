/**
 * Calendar helpers for the task page. Deadlines are the end of a GMT day (convex/lib/dates.ts),
 * so every date here is read in UTC (= GMT, Ghana time).
 */

const DAY = 24 * 60 * 60 * 1000;
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

/** "Fri 14 Nov". */
export function shortDay(ms: number): string {
  const d = new Date(ms);
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** "Friday 14 November", for screen readers. */
export function longDay(ms: number): string {
  const d = new Date(ms);
  return `${WEEKDAYS_LONG[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS_LONG[d.getUTCMonth()]}`;
}

/** Midnight GMT at the start of `ms`'s day. */
export function startOfDayGmt(ms: number): number {
  return Math.floor(ms / DAY) * DAY;
}

/** True when both times fall on the same GMT day. */
export function sameDayGmt(a: number, b: number): boolean {
  return startOfDayGmt(a) === startOfDayGmt(b);
}

export type WeekDay = { start: number; letter: string; date: number };

/** The Monday-to-Sunday week (GMT) that contains `ms`. */
export function weekOf(ms: number): WeekDay[] {
  const today = startOfDayGmt(ms);
  const fromMonday = (new Date(today).getUTCDay() + 6) % 7;
  const monday = today - fromMonday * DAY;
  return Array.from({ length: 7 }, (_, i) => {
    const start = monday + i * DAY;
    return {
      start,
      letter: WEEKDAYS[new Date(start).getUTCDay()].slice(0, 1),
      date: new Date(start).getUTCDate(),
    };
  });
}

/** "November 2026", or "Nov – Dec 2026" when the week crosses a month. */
export function weekLabel(week: WeekDay[]): string {
  const first = new Date(week[0].start);
  const last = new Date(week[week.length - 1].start);
  if (first.getUTCMonth() === last.getUTCMonth()) {
    return `${MONTHS_LONG[first.getUTCMonth()]} ${first.getUTCFullYear()}`;
  }
  const year = first.getUTCFullYear() === last.getUTCFullYear() ? "" : ` ${first.getUTCFullYear()}`;
  return `${MONTHS[first.getUTCMonth()]}${year} – ${MONTHS[last.getUTCMonth()]} ${last.getUTCFullYear()}`;
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
