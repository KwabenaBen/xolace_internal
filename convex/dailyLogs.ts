import { v, type Infer } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import { internalMutation, mutation, query, type QueryCtx } from "./_generated/server";
import { diffFields, logActivity } from "./lib/activity";
import { requireUser } from "./lib/auth";
import { DAILY_LOG_LIMITS } from "./lib/constants";
import { addDays, DAY_MS, endOfDayGmt, isWeekendDate, toDateOnly } from "./lib/dates";
import { appError } from "./lib/errors";
import { cleanText, isLiveTask } from "./lib/tasks";
import { taskStatusValidator } from "./lib/validators";
import { loadUserDirectory, userSummaryValidator } from "./lib/views";
import schema from "./schema";

/**
 * Daily logs (Phase 5). Everyone writes one short log each weekday (what I did, what's next,
 * blockers, the tasks it was about) and may write one line at the weekend. Everyone sees every
 * log. The rules:
 * - A log is for today (GMT) only, and only your own. It can be edited until the day ends, then
 *   it's locked. Nothing is ever deleted.
 * - A weekday with no log is recorded as missed just after it ends (recordMissed, run by
 *   convex/crons.ts). A missed day can't be logged afterwards. Weekends are never missed, and
 *   neither is the day someone joined or a day they were deactivated.
 */

/** How many days `range` returns at most (a page of someone's history). */
export const MAX_RANGE_DAYS = 62;

const linkedTaskValidator = v.object({
  _id: v.id("tasks"),
  title: v.string(),
  status: taskStatusValidator,
});

const logViewValidator = schema.doc("dailyLogs").extend({ tasks: v.array(linkedTaskValidator) });
export type LogView = Infer<typeof logViewValidator>;

/** A log with its linked tasks' titles (tasks since removed are left out). */
async function toLogView(ctx: QueryCtx, log: Doc<"dailyLogs">): Promise<LogView> {
  const tasks = [];
  for (const taskId of log.taskIds) {
    const task = await ctx.db.get("tasks", taskId);
    if (task !== null) tasks.push({ _id: task._id, title: task.title, status: task.status });
  }
  return { ...log, tasks };
}

/** "2026-11-12" or a refusal: the date must be a real calendar date. */
function requireDate(date: string): string {
  if (endOfDayGmt(date) === null) throw appError("INVALID_ARGUMENT", "That isn't a date.");
  return date;
}

/** The day someone joined Cadence (GMT): their first day, which never counts as missed. */
function joinedOn(user: Doc<"users">): string {
  return toDateOnly(user._creationTime);
}

async function findLog(ctx: QueryCtx, userId: Id<"users">, date: string) {
  return await ctx.db
    .query("dailyLogs")
    .withIndex("by_userId_and_date", (q) => q.eq("userId", userId).eq("date", date))
    .unique();
}

/** Trims a weekend line to one line: newlines become spaces. */
function oneLine(text: string): string {
  return text.replace(/\s*\n\s*/g, " ");
}

/**
 * Writes or edits your log for today. `date` is the day the app shows (GMT); if that day has
 * ended (the app was left open past midnight), the log is locked and the save is refused rather
 * than landing on the wrong day. Saving it unchanged writes and records nothing.
 */
export const save = mutation({
  args: {
    date: v.string(),
    done: v.string(),
    next: v.optional(v.string()),
    blockers: v.optional(v.string()),
    taskIds: v.optional(v.array(v.id("tasks"))),
  },
  returns: v.id("dailyLogs"),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const date = requireDate(args.date);
    const today = toDateOnly(Date.now());
    if (date < today) {
      throw appError("INVALID_ARGUMENT", "That day has ended, so its log is locked.");
    }
    if (date > today) throw appError("INVALID_ARGUMENT", "You can only log today.");

    const existing = await findLog(ctx, user._id, date);
    const isWeekend = isWeekendDate(date);
    let fields: Pick<Doc<"dailyLogs">, "isWeekend" | "done" | "next" | "blockers" | "taskIds">;
    if (isWeekend) {
      const extras =
        (args.next ?? "").trim() !== "" ||
        (args.blockers ?? "").trim() !== "" ||
        (args.taskIds ?? []).length > 0;
      if (extras) throw appError("INVALID_ARGUMENT", "A weekend log is a single line.");
      const line = oneLine(
        cleanText(args.done, "Your line", { required: true, max: DAILY_LOG_LIMITS.weekendLine })
      );
      fields = { isWeekend, done: line, next: undefined, blockers: undefined, taskIds: [] };
    } else {
      const done = cleanText(args.done, "What you did", {
        required: true,
        max: DAILY_LOG_LIMITS.done,
      });
      const next = cleanText(args.next ?? "", "What's next", {
        required: false,
        max: DAILY_LOG_LIMITS.next,
      });
      const blockers = cleanText(args.blockers ?? "", "Blockers", {
        required: false,
        max: DAILY_LOG_LIMITS.blockers,
      });
      const taskIds = [...new Set(args.taskIds ?? [])];
      if (taskIds.length > DAILY_LOG_LIMITS.taskIds) {
        throw appError(
          "INVALID_ARGUMENT",
          `Link at most ${DAILY_LOG_LIMITS.taskIds} tasks to one log.`
        );
      }
      // A task this log already links stays linkable (e.g. it was reassigned during the day).
      const alreadyLinked = new Set(existing?.taskIds ?? []);
      for (const taskId of taskIds) {
        const task = await ctx.db.get("tasks", taskId);
        const allowed =
          task !== null &&
          (alreadyLinked.has(taskId) ||
            (isLiveTask(task) && (task.ownerId === user._id || task.peerReviewerId === user._id)));
        if (!allowed) {
          throw appError("INVALID_ARGUMENT", "You can only link tasks you own or review.");
        }
      }
      fields = {
        isWeekend,
        done,
        next: next === "" ? undefined : next,
        blockers: blockers === "" ? undefined : blockers,
        taskIds,
      };
    }

    if (existing === null) {
      const logId = await ctx.db.insert("dailyLogs", { userId: user._id, date, ...fields });
      await logActivity(ctx, {
        actorId: user._id,
        entityType: "dailyLog",
        entityId: logId,
        action: "dailyLog.written",
        after: { date, isWeekend },
      });
      return logId;
    }
    const changes = diffFields(existing, fields);
    if (changes === null) return existing._id;
    await ctx.db.patch("dailyLogs", existing._id, { ...fields, updatedAt: Date.now() });
    await logActivity(ctx, {
      actorId: user._id,
      entityType: "dailyLog",
      entityId: existing._id,
      action: "dailyLog.edited",
      before: changes.before,
      after: { date, ...changes.after },
    });
    return existing._id;
  },
});

const dayPersonValidator = v.object({
  user: userSummaryValidator,
  log: v.union(logViewValidator, v.null()),
  /** True once the day has ended without a log (recorded by recordMissed). */
  missed: v.boolean(),
});

/**
 * One day across the team: everyone who was on Cadence that day (active people who had joined
 * by then, plus anyone who logged), each with their log, or whether the day was missed. `date`
 * comes from the app (queries don't read the clock), so "today" is the app's today.
 */
export const day = query({
  args: { date: v.string() },
  returns: v.object({
    date: v.string(),
    isWeekend: v.boolean(),
    people: v.array(dayPersonValidator),
  }),
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const date = requireDate(args.date);
    const logs = await ctx.db
      .query("dailyLogs")
      .withIndex("by_date", (q) => q.eq("date", date))
      .take(500);
    const missed = await ctx.db
      .query("missedDays")
      .withIndex("by_date", (q) => q.eq("date", date))
      .take(500);
    const active = await ctx.db
      .query("users")
      .withIndex("by_isActive", (q) => q.eq("isActive", true))
      .take(500);
    const directory = await loadUserDirectory(ctx);
    const logByUser = new Map(logs.map((log) => [log.userId, log]));
    const missedUsers = new Set(missed.map((m) => m.userId));
    const ids = new Set<Id<"users">>([
      ...active.filter((u) => joinedOn(u) <= date).map((u) => u._id),
      ...logByUser.keys(),
      ...missedUsers,
    ]);
    const people = [];
    for (const userId of ids) {
      const user = directory.get(userId);
      if (user === undefined) continue;
      const log = logByUser.get(userId);
      people.push({
        user,
        log: log === undefined ? null : await toLogView(ctx, log),
        missed: missedUsers.has(userId),
      });
    }
    people.sort((a, b) => a.user.name.localeCompare(b.user.name));
    return { date, isWeekend: isWeekendDate(date), people };
  },
});

/**
 * One person's logs and missed weekdays between two dates (inclusive, at most MAX_RANGE_DAYS),
 * newest first: their history a page at a time, and the week strip. The id comes from a route,
 * so a bad one returns null.
 */
export const range = query({
  args: { userId: v.string(), from: v.string(), to: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      user: userSummaryValidator,
      /** The day they joined: history starts there, and it never counts as missed. */
      joined: v.string(),
      logs: v.array(logViewValidator),
      missed: v.array(v.string()),
    })
  ),
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const from = requireDate(args.from);
    const to = requireDate(args.to);
    if (from > to) throw appError("INVALID_ARGUMENT", "The range starts after it ends.");
    const longest = addDays(from, MAX_RANGE_DAYS - 1);
    if (longest !== null && to > longest) {
      throw appError("INVALID_ARGUMENT", `Ask for at most ${MAX_RANGE_DAYS} days at a time.`);
    }
    const userId = ctx.db.normalizeId("users", args.userId);
    if (userId === null) return null;
    const person = await ctx.db.get("users", userId);
    if (person === null) return null;
    const logs = await ctx.db
      .query("dailyLogs")
      .withIndex("by_userId_and_date", (q) =>
        q.eq("userId", userId).gte("date", from).lte("date", to)
      )
      .order("desc")
      .take(MAX_RANGE_DAYS);
    const missed = await ctx.db
      .query("missedDays")
      .withIndex("by_userId_and_date", (q) =>
        q.eq("userId", userId).gte("date", from).lte("date", to)
      )
      .order("desc")
      .take(MAX_RANGE_DAYS);
    const views = [];
    for (const log of logs) views.push(await toLogView(ctx, log));
    return {
      user: { _id: person._id, name: person.name, title: person.title, isActive: person.isActive },
      joined: joinedOn(person),
      logs: views,
      missed: missed.map((m) => m.date),
    };
  },
});

/**
 * The tasks you can link to today's log: live tasks you own or peer-review that aren't verified
 * yet (a log already linking a verified task keeps it), soonest deadline first.
 */
export const linkableTasks = query({
  args: {},
  returns: v.array(linkedTaskValidator),
  handler: async (ctx) => {
    const user = await requireUser(ctx);
    const owned = await ctx.db
      .query("tasks")
      .withIndex("by_ownerId_and_status", (q) => q.eq("ownerId", user._id))
      .take(500);
    const reviewing = await ctx.db
      .query("tasks")
      .withIndex("by_peerReviewerId_and_status", (q) => q.eq("peerReviewerId", user._id))
      .take(500);
    const byId = new Map<Id<"tasks">, Doc<"tasks">>();
    for (const task of [...owned, ...reviewing]) {
      if (isLiveTask(task) && task.status !== "verified") byId.set(task._id, task);
    }
    return [...byId.values()]
      .sort((a, b) => (a.deadline ?? Infinity) - (b.deadline ?? Infinity))
      .map((task) => ({ _id: task._id, title: task.title, status: task.status }));
  },
});

/**
 * Records yesterday as missed for everyone active who didn't log it, if it was a weekday. Run
 * once a day just after midnight GMT (convex/crons.ts); running it again records nothing new.
 * Someone deactivated at that moment is skipped (their day isn't counted), and so is anyone who
 * joined that day or later. Each missed day is an activity entry with no actor (Cadence did it).
 */
export const recordMissed = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const yesterday = toDateOnly(Date.now() - DAY_MS);
    if (isWeekendDate(yesterday)) return 0;
    const active = await ctx.db
      .query("users")
      .withIndex("by_isActive", (q) => q.eq("isActive", true))
      .take(500);
    let recorded = 0;
    for (const user of active) {
      if (joinedOn(user) >= yesterday) continue;
      if ((await findLog(ctx, user._id, yesterday)) !== null) continue;
      const already = await ctx.db
        .query("missedDays")
        .withIndex("by_userId_and_date", (q) => q.eq("userId", user._id).eq("date", yesterday))
        .first();
      if (already !== null) continue;
      const missedId = await ctx.db.insert("missedDays", { userId: user._id, date: yesterday });
      await logActivity(ctx, {
        entityType: "dailyLog",
        entityId: missedId,
        action: "dailyLog.missed",
        after: { userId: user._id, date: yesterday },
      });
      recorded++;
    }
    return recorded;
  },
});
