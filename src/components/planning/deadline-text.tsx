import { Typography } from "heroui-native";
import type { JSX } from "react";

import { formatDeadline } from "@convex/lib/dates";
import type { TaskStatus } from "@convex/lib/validators";

import { useNow } from "@/lib/use-now";

/**
 * "Due 30 Nov", or "Overdue · 30 Nov" in red once the deadline has passed on unverified work.
 * (Phase 3 adds a stored overdue flag for digests; the app can simply compare with now.)
 */
export function DeadlineText({
  deadline,
  status,
  prefix = "Due",
}: {
  deadline: number | undefined;
  status?: TaskStatus;
  prefix?: string;
}): JSX.Element {
  const now = useNow();
  if (deadline === undefined) {
    return (
      <Typography type="body-xs" color="muted">
        No deadline yet
      </Typography>
    );
  }
  const isOverdue =
    deadline < now && status !== "verified" && status !== "declined" && status !== "proposed";
  return (
    <Typography
      type="body-xs"
      color="muted"
      className={isOverdue ? "font-semibold text-danger" : undefined}
    >
      {isOverdue
        ? `Overdue · ${formatDeadline(deadline, now)}`
        : `${prefix} ${formatDeadline(deadline, now)}`}
    </Typography>
  );
}
