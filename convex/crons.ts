import { cronJobs } from "convex/server";

import { internal } from "./_generated/api";

const crons = cronJobs();

// Deadlines end at midnight GMT, so the 00:05 run flags each day's; the other runs are a
// safety net (e.g. after a deploy). Cron times are UTC, which is GMT.
crons.cron("flag overdue tasks", "5 * * * *", internal.overdue.flag, {});

// A weekday ends at midnight GMT; at 00:10 the day before is recorded as missed for everyone who
// didn't log it. Once a day on purpose: a later run could count a day someone was deactivated
// for, if they'd been reactivated in between.
crons.cron("record missed daily logs", "10 0 * * *", internal.dailyLogs.recordMissed, {});

export default crons;
