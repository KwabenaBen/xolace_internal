import { v } from "convex/values";

import { mutation, query } from "./_generated/server";
import { diffFields, logActivity } from "./lib/activity";
import { requireAdmin, requireUser } from "./lib/auth";
import { toDateOnly } from "./lib/dates";
import { appError } from "./lib/errors";
import { cleanText, latestTaskDeadline, LIMITS, parseDeadline, requireFeature } from "./lib/tasks";
import {
  compareTasks,
  loadUserDirectory,
  taskViewValidator,
  toTaskView,
  userSummaryValidator,
} from "./lib/views";
import schema from "./schema";

const featureFields = {
  title: v.string(),
  description: v.string(),
  expectedResult: v.string(),
  sourceNote: v.string(), // e.g. which meeting the feature came from
  deadline: v.string(), // "YYYY-MM-DD"
};

function cleanFeatureText(args: {
  title: string;
  description: string;
  expectedResult: string;
  sourceNote: string;
}) {
  return {
    title: cleanText(args.title, "Title", { required: true, max: LIMITS.title }),
    description: cleanText(args.description, "Description", {
      required: true,
      max: LIMITS.description,
    }),
    expectedResult: cleanText(args.expectedResult, "Expected result", {
      required: true,
      max: LIMITS.expectedResult,
    }),
    sourceNote: cleanText(args.sourceNote, "Source note", {
      required: false,
      max: LIMITS.sourceNote,
    }),
  };
}

/** Every feature, soonest deadline first (for pickers and filters). */
export const list = query({
  args: {},
  returns: v.array(schema.doc("features")),
  handler: async (ctx) => {
    await requireUser(ctx);
    return await ctx.db.query("features").withIndex("by_deadline").take(500);
  },
});

/**
 * One feature with its tasks and proposals. Takes the id as a plain string because it usually
 * comes from a URL: a malformed or wrong-table id returns null instead of throwing.
 */
export const get = query({
  args: { featureId: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      feature: schema.doc("features"),
      createdBy: v.union(userSummaryValidator, v.null()),
      tasks: v.array(taskViewValidator),
      proposals: v.array(taskViewValidator),
    })
  ),
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const featureId = ctx.db.normalizeId("features", args.featureId);
    const feature = featureId === null ? null : await ctx.db.get("features", featureId);
    if (feature === null) return null;

    const directory = await loadUserDirectory(ctx);
    const all = await ctx.db
      .query("tasks")
      .withIndex("by_featureId_and_status", (q) => q.eq("featureId", feature._id))
      .take(500);
    const live = all.filter((t) => t.status !== "proposed" && t.status !== "declined");
    const proposals = all.filter((t) => t.status === "proposed");

    return {
      feature,
      createdBy: directory.get(feature.createdBy) ?? null,
      tasks: live.sort(compareTasks).map((t) => toTaskView(t, directory)),
      proposals: proposals
        .sort((a, b) => a._creationTime - b._creationTime)
        .map((t) => toTaskView(t, directory)),
    };
  },
});

/** Admin: create a feature (status "planned"). */
export const create = mutation({
  args: featureFields,
  returns: v.id("features"),
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const text = cleanFeatureText(args);
    const deadline = parseDeadline(args.deadline, Date.now());

    const featureId = await ctx.db.insert("features", {
      ...text,
      deadline,
      status: "planned",
      createdBy: admin._id,
    });
    await logActivity(ctx, {
      actorId: admin._id,
      entityType: "feature",
      entityId: featureId,
      action: "feature.created",
      after: { ...text, deadline },
    });
    return featureId;
  },
});

/** Admin: edit a feature. Its deadline can't move earlier than any of its tasks' deadlines. */
export const update = mutation({
  args: { featureId: v.id("features"), ...featureFields },
  returns: v.null(),
  handler: async (ctx, { featureId, ...args }) => {
    const admin = await requireAdmin(ctx);
    const feature = await requireFeature(ctx, featureId);
    const text = cleanFeatureText(args);

    let deadline = feature.deadline;
    if (args.deadline !== toDateOnly(feature.deadline)) {
      deadline = parseDeadline(args.deadline, Date.now());
      const latest = await latestTaskDeadline(ctx, featureId);
      if (latest !== null && deadline < latest) {
        throw appError(
          "INVALID_ARGUMENT",
          "A task in this feature is due after that date. Move the task's deadline first."
        );
      }
    }

    const changes = diffFields(feature, { ...text, deadline });
    if (changes === null) return null;
    await ctx.db.patch("features", featureId, { ...text, deadline });
    await logActivity(ctx, {
      actorId: admin._id,
      entityType: "feature",
      entityId: featureId,
      action: "feature.updated",
      ...changes,
    });
    return null;
  },
});
