import { cronJobs } from "convex/server";

import { internal } from "./_generated/api";

const crons = cronJobs();

// Deadlines end at midnight GMT, so the 00:05 run flags each day's; the other runs are a
// safety net (e.g. after a deploy). Cron times are UTC, which is GMT.
crons.cron("flag overdue tasks", "5 * * * *", internal.overdue.flag, {});

// A weekday ends at midnight GMT; the 00:10 run records it as missed for everyone who didn't log
// it, and the hourly runs after it catch up if a run was missed (never recording a day twice;
// days someone was deactivated are judged from the activity log, not the clock).
crons.cron("record missed daily logs", "10 * * * *", internal.dailyLogs.recordMissed, {});

export default crons;
