import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";

import { api } from "@convex/_generated/api";
import {
  addDays,
  endOfDayGmt,
  isWeekendDate,
  longDay,
  MONTH_NAMES,
  shortDay,
  toDateOnly,
} from "@convex/lib/dates";

import { useNow } from "@/lib/use-now";

/**
 * What the Logs screens (phone and website) share: today's date, the week's dates, and how each
 * day reads for one person (logged, missed, still open, ...). Every calendar helper itself lives in
 * convex/lib/dates.ts, shared with the server.
 */

export type TeamDay = FunctionReturnType<typeof api.dailyLogs.day>;
export type DayPerson = TeamDay["people"][number];
/** One log as the app receives it: the log, with its linked tasks' titles. */
export type LogView = NonNullable<DayPerson["log"]>;

/** Today's GMT date ("2026-11-12"), and the clock it came from (re-renders each minute). */
export function useToday(): { now: number; today: string } {
  const now = useNow();
  return { now, today: toDateOnly(now) };
}

/** The Monday-to-Sunday week (GMT dates) that holds `date`. */
export function weekDates(date: string): string[] {
  const end = endOfDayGmt(date);
  const fromMonday = end === null ? 0 : (new Date(end).getUTCDay() + 6) % 7;
  const monday = addDays(date, -fromMonday) ?? date;
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i) ?? monday);
}

/** The team's log for each day of the week holding `today` (undefined while loading). */
export function useTeamWeek(today: string): (TeamDay | undefined)[] {
  const week = weekDates(today);
  // Seven queries, always the same seven hooks (one per weekday), shared with anything else
  // asking for the same day.
  return [
    useQuery(api.dailyLogs.day, { date: week[0] }),
    useQuery(api.dailyLogs.day, { date: week[1] }),
    useQuery(api.dailyLogs.day, { date: week[2] }),
    useQuery(api.dailyLogs.day, { date: week[3] }),
    useQuery(api.dailyLogs.day, { date: week[4] }),
    useQuery(api.dailyLogs.day, { date: week[5] }),
    useQuery(api.dailyLogs.day, { date: week[6] }),
  ];
}

/**
 * How one person's day reads:
 * - "logged": they wrote a log (or a weekend line);
 * - "missed": a weekday that ended without one (recorded by the server just after midnight);
 * - "open": today, not written yet;
 * - "future": a day still to come;
 * - "off": nothing to show (a weekend without a line, or a day before the record).
 */
export type DayMark = "logged" | "missed" | "open" | "future" | "off";

export function markFor(
  date: string,
  today: string,
  entry: { log: LogView | null; missed: boolean } | undefined
): DayMark {
  if (entry?.log) return "logged";
  if (entry?.missed === true) return "missed";
  if (date > today) return "future";
  if (date === today) return isWeekendDate(date) ? "off" : "open";
  return "off";
}

/** Words for a mark, for labels and screen readers. */
export const MARK_WORDS: Record<DayMark, string> = {
  logged: "Logged",
  missed: "Missed",
  open: "Not yet",
  future: "Still to come",
  off: "No log",
};

/** "Today", "Yesterday", else "Wed 11 Nov" (with the year when it differs). */
export function dayName(date: string, today: string, now: number): string {
  if (date === today) return "Today";
  if (date === addDays(today, -1)) return "Yesterday";
  const end = endOfDayGmt(date);
  return end === null ? date : shortDay(end, now);
}

/** Always the date itself, "Wed 11 Nov" (for sentences like "joined Cadence on …"). */
export function plainDay(date: string, now: number): string {
  const end = endOfDayGmt(date);
  return end === null ? date : shortDay(end, now);
}

/** "Wednesday 11 November 2026", for screen readers. */
export function spokenDay(date: string): string {
  const end = endOfDayGmt(date);
  return end === null ? date : longDay(end);
}

/** A date's day of the month and its weekday letter ("12", "T"), for the week's pills. */
export function dayParts(date: string): { day: number; letter: string; short: string } {
  const end = endOfDayGmt(date) ?? 0;
  const d = new Date(end);
  return {
    day: d.getUTCDate(),
    letter: "SMTWTFS"[d.getUTCDay()],
    short: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getUTCDay()],
  };
}

/** "9 – 15 November" for a week (or "30 Nov – 6 Dec" across months). */
export function weekRange(week: string[]): string {
  const first = new Date(endOfDayGmt(week[0]) ?? 0);
  const last = new Date(endOfDayGmt(week[week.length - 1]) ?? 0);
  if (first.getUTCMonth() === last.getUTCMonth()) {
    return `${first.getUTCDate()} – ${last.getUTCDate()} ${MONTH_NAMES.long[last.getUTCMonth()]}`;
  }
  return `${first.getUTCDate()} ${MONTH_NAMES.short[first.getUTCMonth()]} – ${last.getUTCDate()} ${MONTH_NAMES.short[last.getUTCMonth()]}`;
}

/** The first line of a log, cut to `max` characters, for rows and previews. */
export function excerpt(text: string, max = 140): string {
  const line = text.split("\n")[0].trim();
  return line.length > max ? `${line.slice(0, max - 1).trimEnd()}…` : line;
}
