import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import { v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import { query, type QueryCtx } from "./_generated/server";
import { isAdmin, requireUser } from "./lib/auth";
import { hidePendingEmail } from "./lib/settings";
import { activityEntityTypeValidator } from "./lib/validators";
import { loadUserDirectory, userSummaryValidator, type UserDirectory } from "./lib/views";

/**
 * Reading the activity log (every change: who, what, when, before and after). Everyone sees it,
 * as everyone sees everything, except invite entries, which only admins see (only admins see
 * invites at all). The app turns each entry into a sentence (src/components/activity/).
 */

const activityItemValidator = v.object({
  _id: v.id("activity"),
  timestamp: v.number(),
  action: v.string(),
  entityType: activityEntityTypeValidator,
  entityId: v.string(),
  before: v.optional(v.any()),
  after: v.optional(v.any()),
  /** Who did it; null for the system (e.g. the overdue job) or someone since removed. */
  actor: v.union(userSummaryValidator, v.null()),
  /** The task it's about, if any. */
  task: v.union(v.object({ _id: v.id("tasks"), title: v.string() }), v.null()),
  /** The feature it's about, if it's a feature entry. */
  feature: v.union(v.object({ _id: v.id("features"), title: v.string() }), v.null()),
  /** The person it's about, if it's a user entry (e.g. a role change). */
  person: v.union(userSummaryValidator, v.null()),
});

type Lookups = {
  directory: UserDirectory;
  tasks: Map<Id<"tasks">, Doc<"tasks"> | null>;
  features: Map<Id<"features">, Doc<"features"> | null>;
};

async function newLookups(ctx: QueryCtx): Promise<Lookups> {
  return { directory: await loadUserDirectory(ctx), tasks: new Map(), features: new Map() };
}

async function toItem(
  ctx: QueryCtx,
  entry: Doc<"activity">,
  lookups: Lookups,
  { forAdmin }: { forAdmin: boolean }
) {
  // A team rule naming someone who hasn't joined: members see it without their email.
  const hide = !forAdmin && entry.entityType === "setting";
  const taskId =
    entry.taskId ??
    (entry.entityType === "task" ? ctx.db.normalizeId("tasks", entry.entityId) : null);
  let task = null;
  if (taskId !== null) {
    if (!lookups.tasks.has(taskId)) lookups.tasks.set(taskId, await ctx.db.get("tasks", taskId));
    const doc = lookups.tasks.get(taskId);
    task = doc ? { _id: doc._id, title: doc.title } : null;
  }
  const featureId =
    entry.entityType === "feature" ? ctx.db.normalizeId("features", entry.entityId) : null;
  let feature = null;
  if (featureId !== null) {
    if (!lookups.features.has(featureId)) {
      lookups.features.set(featureId, await ctx.db.get("features", featureId));
    }
    const doc = lookups.features.get(featureId);
    feature = doc ? { _id: doc._id, title: doc.title } : null;
  }
  // The person it's about: a user entry's user, or the person a missed daily log was recorded
  // for (the entry has no actor: Cadence recorded it).
  const missedFor =
    entry.action === "dailyLog.missed" &&
    typeof entry.after === "object" &&
    entry.after !== null &&
    "userId" in entry.after &&
    typeof entry.after.userId === "string"
      ? entry.after.userId
      : null;
  const personId =
    entry.entityType === "user"
      ? ctx.db.normalizeId("users", entry.entityId)
      : missedFor !== null
        ? ctx.db.normalizeId("users", missedFor)
        : null;
  return {
    _id: entry._id,
    timestamp: entry.timestamp,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    before: hide ? hidePendingEmail(entry.before) : entry.before,
    after: hide ? hidePendingEmail(entry.after) : entry.after,
    actor: entry.actorId !== undefined ? (lookups.directory.get(entry.actorId) ?? null) : null,
    task,
    feature,
    person: personId !== null ? (lookups.directory.get(personId) ?? null) : null,
  };
}

/** The team's activity, newest first, a page at a time; optionally only what one person did. */
export const feed = query({
  args: { paginationOpts: paginationOptsValidator, actorId: v.optional(v.id("users")) },
  returns: paginationResultValidator(activityItemValidator),
  handler: async (ctx, { paginationOpts, actorId }) => {
    const user = await requireUser(ctx);
    const ordered =
      actorId !== undefined
        ? ctx.db
            .query("activity")
            .withIndex("by_actorId", (q) => q.eq("actorId", actorId))
            .order("desc")
        : ctx.db.query("activity").order("desc");
    const visible = isAdmin(user)
      ? ordered
      : ordered.filter((q) => q.neq(q.field("entityType"), "invite"));
    const result = await visible.paginate(paginationOpts);
    const lookups = await newLookups(ctx);
    const page = [];
    const forAdmin = isAdmin(user);
    for (const entry of result.page) page.push(await toItem(ctx, entry, lookups, { forAdmin }));
    return { ...result, page };
  },
});

/** One task's history (its changes, comments and extension requests), newest first. */
export const forTask = query({
  args: { taskId: v.id("tasks") },
  returns: v.array(activityItemValidator),
  handler: async (ctx, { taskId }) => {
    const user = await requireUser(ctx);
    const tagged = await ctx.db
      .query("activity")
      .withIndex("by_taskId", (q) => q.eq("taskId", taskId))
      .order("desc")
      .take(200);
    // Entries written before tasks were tagged (Phase 4) are found by the task's own id.
    const untagged = await ctx.db
      .query("activity")
      .withIndex("by_entityType_and_entityId", (q) =>
        q.eq("entityType", "task").eq("entityId", taskId)
      )
      .order("desc")
      .take(200);
    const byId = new Map<Id<"activity">, Doc<"activity">>();
    for (const entry of [...tagged, ...untagged]) byId.set(entry._id, entry);
    const entries = [...byId.values()].sort((a, b) => b.timestamp - a.timestamp).slice(0, 200);
    const lookups = await newLookups(ctx);
    const items = [];
    const forAdmin = isAdmin(user);
    for (const entry of entries) items.push(await toItem(ctx, entry, lookups, { forAdmin }));
    return items;
  },
});
