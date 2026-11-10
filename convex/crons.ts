import { cronJobs } from "convex/server";

import { internal } from "./_generated/api";

const crons = cronJobs();

// Deadlines end at midnight GMT, so the 00:05 run flags each day's; the other runs are a
// safety net (e.g. after a deploy). Cron times are UTC, which is GMT.
crons.cron("flag overdue tasks", "5 * * * *", internal.overdue.flag, {});

export default crons;
