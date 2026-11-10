import type { FunctionReturnType } from "convex/server";

import type { api } from "@convex/_generated/api";
import type { SettingKey, SettingValue } from "@convex/lib/validators";

export type TeamRule = FunctionReturnType<typeof api.settings.list>[number];
export type Person = FunctionReturnType<typeof api.users.list>[number];

/** The two team times, each set with a time wheel (Team rules, and their rows on Settings). */
export type TimeKey = "morningDigestTime" | "dailyLogReminderTime";

/** What each team time is for, shown on Team rules and in its sheet. */
export const TIME_RULES: Record<TimeKey, { title: string; note: string }> = {
  morningDigestTime: {
    title: "Morning digest",
    note: "One push a day: tasks due soon, overdue ones and reviews waiting. Pushes start in a later update.",
  },
  dailyLogReminderTime: {
    title: "Daily log reminder",
    note: "Weekdays, for anyone whose log isn't in yet. Reminders start in a later update.",
  },
};

/** The late-extension window's choices, in hours. */
export const LATE_WINDOW_HOURS = [6, 12, 24, 48, 72] as const;

const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** "08:00" → "8:00 AM"; anything that isn't a time → "Not set". */
export function clock(value: unknown): string {
  const match = typeof value === "string" ? TIME.exec(value) : null;
  if (match === null) return "Not set";
  const h = Number(match[1]);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${match[2]} ${h < 12 ? "AM" : "PM"}`;
}

/**
 * "08:00" ↔ a Date at that time today, in the phone's own zone: what the time wheel shows and
 * returns. Only the hours and minutes matter, so the phone's zone never shifts the team's time.
 */
export function timeToDate(value: string): Date {
  const match = TIME.exec(value);
  const date = new Date();
  date.setHours(match === null ? 8 : Number(match[1]), match === null ? 0 : Number(match[2]), 0, 0);
  return date;
}
export function dateToTime(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

/** "Africa/Accra · GMT" (the team's zone; GMT is named for the one Cadence counts dates in). */
export function zoneLabel(value: SettingValue | undefined): string {
  const zone = typeof value === "string" && value !== "" ? value : "Africa/Accra";
  return `${zone.replace(/_/g, " ")}${zone === "Africa/Accra" ? " · GMT" : ""}`;
}

/** "1 hour", "24 hours". */
export function hoursLabel(hours: number): string {
  return `${hours} ${hours === 1 ? "hour" : "hours"}`;
}

/** A rule's current value (undefined while the rules load). */
export function ruleValue(
  rules: readonly TeamRule[] | undefined,
  key: SettingKey
): SettingValue | undefined {
  return rules?.find((rule) => rule.key === key)?.value;
}

/** A team time's current "HH:mm" (the default when it's somehow not a time). */
export function timeValue(rules: readonly TeamRule[] | undefined, key: TimeKey): string {
  const value = ruleValue(rules, key);
  return typeof value === "string" && TIME.test(value)
    ? value
    : key === "morningDigestTime"
      ? "08:00"
      : "20:00";
}

/**
 * Who verifies admins' tasks: nobody yet, someone on the team (who may since have been
 * deactivated), or an invited email that hasn't signed up (the seed can name one ahead).
 */
export type Reviewer =
  { kind: "none" } | { kind: "person"; person: Person } | { kind: "invited"; email: string };

export function reviewerOf(value: SettingValue | undefined, people: readonly Person[]): Reviewer {
  if (typeof value !== "object" || value === null) return { kind: "none" };
  const person =
    value.userId !== undefined
      ? people.find((p) => p._id === value.userId)
      : people.find((p) => p.email === value.email);
  return person !== undefined
    ? { kind: "person", person }
    : { kind: "invited", email: value.email };
}

/** Their first name, for buttons and short lines. */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}
