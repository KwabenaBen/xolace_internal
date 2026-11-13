/**
 * The countdown's maths. Every calendar helper (GMT days, "Fri 14 Nov", "in 3 days") lives in
 * convex/lib/dates.ts, shared with the server; don't add more here.
 */

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
