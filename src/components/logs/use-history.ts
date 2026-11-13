import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";

import { api } from "@convex/_generated/api";
import { addDays } from "@convex/lib/dates";

import type { LogView } from "./log-days";

/**
 * One person's history (their page, phone and website): their logs and missed weekdays in windows
 * of four weeks, newest first, with older windows added as asked ("Show earlier").
 */

export const WINDOW_DAYS = 28;

export type PersonRange = NonNullable<FunctionReturnType<typeof api.dailyLogs.range>>;

/** A day in someone's history: their log, or a weekday they missed. */
export type HistoryEntry = { date: string; log: LogView | null; missed: boolean };

/** The `index`-th window back from today (0 = the four weeks ending today). */
export function historyWindow(today: string, index: number): { from: string; to: string } {
  const to = addDays(today, -index * WINDOW_DAYS) ?? today;
  return { from: addDays(to, -(WINDOW_DAYS - 1)) ?? to, to };
}

/** A window's logs and missed days as one list, newest first. */
export function entriesOf(range: PersonRange): HistoryEntry[] {
  const entries: HistoryEntry[] = [
    ...range.logs.map((log) => ({ date: log.date, log, missed: false })),
    ...range.missed.map((date) => ({ date, log: null, missed: true })),
  ];
  return entries.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

/** One window of someone's history (undefined while loading, null for an unknown person). */
export function useHistoryWindow(
  userId: string,
  today: string,
  index: number
): PersonRange | null | undefined {
  return useQuery(api.dailyLogs.range, { userId, ...historyWindow(today, index) });
}

/** "12 logs and 1 missed weekday in the last 4 weeks" (or "No logs yet in the last 4 weeks"). */
export function summaryLine(range: PersonRange): string {
  const logs = range.logs.length;
  const missed = range.missed.length;
  const parts = [];
  if (logs > 0) parts.push(`${logs} ${logs === 1 ? "log" : "logs"}`);
  if (missed > 0) parts.push(`${missed} missed ${missed === 1 ? "weekday" : "weekdays"}`);
  return parts.length === 0
    ? "No logs yet in the last 4 weeks"
    : `${parts.join(" and ")} in the last 4 weeks`;
}
