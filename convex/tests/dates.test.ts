import { describe, expect, test } from "vitest";

import {
  addDays,
  calendarDaysBetween,
  endOfDayGmt,
  formatDeadline,
  isWeekendDate,
  relativeDay,
  shortDay,
} from "../lib/dates";

describe("daily-log days", () => {
  test("weekends are Saturday and Sunday in GMT", () => {
    expect(isWeekendDate("2026-11-13")).toBe(false); // Friday
    expect(isWeekendDate("2026-11-14")).toBe(true);
    expect(isWeekendDate("2026-11-15")).toBe(true);
    expect(isWeekendDate("2026-11-16")).toBe(false); // Monday
    expect(isWeekendDate("2026-02-30")).toBe(false); // not a date
  });

  test("days move across months and years", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2027-01-01", -1)).toBe("2026-12-31");
    expect(addDays("2026-11-16", -7)).toBe("2026-11-09");
    expect(addDays("nope", 1)).toBeNull();
  });
});

// 9 Nov 2026, 10:00 GMT.
const now = Date.UTC(2026, 10, 9, 10, 0);
const due = (date: string) => endOfDayGmt(date)!;

describe("deadline dates (GMT calendar days)", () => {
  test("relativeDay counts calendar days, not 24-hour blocks", () => {
    expect(relativeDay(due("2026-11-09"), now)).toBe("today");
    expect(relativeDay(due("2026-11-10"), now)).toBe("tomorrow");
    expect(relativeDay(due("2026-11-12"), now)).toBe("in 3 days");
    expect(relativeDay(due("2026-11-08"), now)).toBe("1 day late");
    expect(relativeDay(due("2026-11-06"), now)).toBe("3 days late");
  });

  test("late in the evening still counts today as today", () => {
    const evening = Date.UTC(2026, 10, 9, 23, 30);
    expect(relativeDay(due("2026-11-09"), evening)).toBe("today");
    expect(relativeDay(due("2026-11-10"), evening)).toBe("tomorrow");
    expect(calendarDaysBetween(evening, due("2026-11-12"))).toBe(3);
  });

  test("dates show the year only when it isn't this year", () => {
    expect(formatDeadline(due("2026-11-14"), now)).toBe("14 Nov");
    expect(formatDeadline(due("2027-01-05"), now)).toBe("5 Jan 2027");
    expect(shortDay(due("2026-11-13"), now)).toBe("Fri 13 Nov");
    expect(shortDay(due("2027-01-05"), now)).toBe("Tue 5 Jan 2027");
  });
});
