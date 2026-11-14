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
 * - A weekday with no log is recorded as missed once it has ended (recordMissed, run hourly by
 *   convex/crons.ts). A missed day can't be logged afterwards. Weekends are never missed, and
 *   neither is the day someone joined or any day they were deactivated for part or all of.
 * - A log can be edited at most DAILY_LOG_LIMITS.edits times (each edit is an activity entry).
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

/** Tasks already read in this request (logs often link the same tasks day after day). */
type TaskCache = Map<Id<"tasks">, Doc<"tasks"> | null>;

/** A log with its linked tasks' titles (tasks since removed are left out). */
async function toLogView(ctx: QueryCtx, log: Doc<"dailyLogs">, cache: TaskCache): Promise<LogView> {
  const tasks = [];
  for (const taskId of log.taskIds) {
    if (!cache.has(taskId)) cache.set(taskId, await ctx.db.get("tasks", taskId));
    const task = cache.get(taskId);
    if (task) tasks.push({ _id: task._id, title: task.title, status: task.status });
  }
  return { ...log, tasks };
}

/**
 * Whether someone may link this task to their log: a live task they own or peer-review (verified
 * ones included, e.g. one verified this afternoon that they worked on this morning).
 */
function canLink(task: Doc<"tasks">, userId: Id<"users">): boolean {
  return isLiveTask(task) && (task.ownerId === userId || task.peerReviewerId === userId);
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

// `first`, not `unique`: there's only ever one (saves conflict and retry), but a stray duplicate
// mustn't make every save, and the nightly job, throw.
async function findLog(ctx: QueryCtx, userId: Id<"users">, date: string) {
  return await ctx.db
    .query("dailyLogs")
    .withIndex("by_userId_and_date", (q) => q.eq("userId", userId).eq("date", date))
    .first();
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
        const allowed = task !== null && (alreadyLinked.has(taskId) || canLink(task, user._id));
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
    // Every edit is kept in the activity log, so there's a ceiling (far above what a person needs).
    const edits = existing.edits ?? 0;
    if (edits >= DAILY_LOG_LIMITS.edits) {
      throw appError(
        "INVALID_ARGUMENT",
        `Today's log has been changed ${DAILY_LOG_LIMITS.edits} times, so it can't be changed again today.`
      );
    }
    await ctx.db.patch("dailyLogs", existing._id, {
      ...fields,
      updatedAt: Date.now(),
      edits: edits + 1,
    });
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
    const cache: TaskCache = new Map();
    for (const userId of ids) {
      const user = directory.get(userId);
      if (user === undefined) continue;
      const log = logByUser.get(userId);
      people.push({
        user,
        log: log === undefined ? null : await toLogView(ctx, log, cache),
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
    const cache: TaskCache = new Map();
    for (const log of logs) views.push(await toLogView(ctx, log, cache));
    return {
      user: { _id: person._id, name: person.name, title: person.title, isActive: person.isActive },
      joined: joinedOn(person),
      logs: views,
      missed: missed.map((m) => m.date),
    };
  },
});

/**
 * The tasks to offer for today's log (`date`, the app's today): live tasks you own or peer-review
 * that are still open, or were verified that day, soonest deadline first. (`save` accepts any task
 * `canLink` allows; older verified ones just aren't offered, to keep the list short.)
 */
export const linkableTasks = query({
  args: { date: v.string() },
  returns: v.array(linkedTaskValidator),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const date = requireDate(args.date);
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
      const verifiedEarlier =
        task.status === "verified" &&
        (task.verifiedAt === undefined || toDateOnly(task.verifiedAt) !== date);
      if (canLink(task, user._id) && !verifiedEarlier) byId.set(task._id, task);
    }
    return [...byId.values()]
      .sort((a, b) => (a.deadline ?? Infinity) - (b.deadline ?? Infinity))
      .map((task) => ({ _id: task._id, title: task.title, status: task.status }));
  },
});

/** How many ended days each run of recordMissed checks (so a failed or skipped run is made up). */
export const MISSED_LOOKBACK_DAYS = 2;

/**
 * When someone was deactivated, as [from, to) spans in ms (to = Infinity while they still are),
 * from the activity log's deactivated/reactivated entries. Null for someone deactivated with no
 * such entry (they're skipped altogether).
 */
async function deactivatedSpans(
  ctx: QueryCtx,
  user: Doc<"users">
): Promise<[number, number][] | null> {
  const entries = await ctx.db
    .query("activity")
    .withIndex("by_entityType_and_entityId", (q) =>
      q.eq("entityType", "user").eq("entityId", user._id)
    )
    .take(500);
  const changes = entries
    .filter((e) => e.action === "user.deactivated" || e.action === "user.reactivated")
    .sort((a, b) => a.timestamp - b.timestamp);
  const spans: [number, number][] = [];
  let from: number | null = null;
  for (const change of changes) {
    if (change.action === "user.deactivated" && from === null) from = change.timestamp;
    if (change.action === "user.reactivated" && from !== null) {
      spans.push([from, change.timestamp]);
      from = null;
    }
  }
  if (from !== null) spans.push([from, Infinity]);
  if (!user.isActive && from === null) return null;
  return spans;
}

/** Whether any of the spans touches the GMT day `date`. */
function touchesDay(spans: [number, number][], date: string): boolean {
  const end = endOfDayGmt(date);
  if (end === null) return false;
  const start = end - DAY_MS + 1;
  return spans.some(([from, to]) => from <= end && to > start);
}

/**
 * Records each weekday among the last MISSED_LOOKBACK_DAYS ended days as missed for everyone who
 * didn't log it. Run hourly (convex/crons.ts): the run just after midnight records the day that
 * ended, and the later ones change nothing unless a run was missed; a day is never recorded twice.
 * Skipped: anyone who joined that day or later, and anyone deactivated at any point that day
 * (from the activity log, so reactivating someone later doesn't count it). Each missed day is an
 * activity entry with no actor (Cadence did it).
 */
export const recordMissed = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const today = toDateOnly(Date.now());
    const days: string[] = [];
    for (let back = 1; back <= MISSED_LOOKBACK_DAYS; back++) {
      const date = addDays(today, -back);
      if (date !== null && !isWeekendDate(date)) days.push(date);
    }
    if (days.length === 0) return 0;
    // Everyone, not just the active: a day before someone was deactivated may still count.
    const users = await ctx.db.query("users").take(500);
    let recorded = 0;
    for (const user of users) {
      const spans = await deactivatedSpans(ctx, user);
      if (spans === null) continue;
      for (const date of days) {
        if (joinedOn(user) >= date || touchesDay(spans, date)) continue;
        if ((await findLog(ctx, user._id, date)) !== null) continue;
        const already = await ctx.db
          .query("missedDays")
          .withIndex("by_userId_and_date", (q) => q.eq("userId", user._id).eq("date", date))
          .first();
        if (already !== null) continue;
        const missedId = await ctx.db.insert("missedDays", { userId: user._id, date });
        await logActivity(ctx, {
          entityType: "dailyLog",
          entityId: missedId,
          action: "dailyLog.missed",
          after: { userId: user._id, date },
        });
        recorded++;
      }
    }
    return recorded;
  },
});
