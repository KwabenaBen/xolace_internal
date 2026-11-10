import { v, type Infer } from "convex/values";

import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import schema from "../schema";
import { isAdmin } from "./auth";
import { getUserSetting } from "./settings";
import { userSummaryValidator, type UserDirectory } from "./views";

/** Who decides a task's extension requests, as the app says it. */
export const deciderValidator = v.union(
  v.object({ kind: v.literal("admins") }),
  // An admin owns the task: the admin task reviewer (Team rules) decides. When the reviewer
  // can't (none set, deactivated, or they own the task) the other admins do; `reviewer` with
  // `name` null (none / deactivated) or `isOwner` only when there's no other admin either, so
  // nobody can decide.
  v.object({
    kind: v.literal("reviewer"),
    name: v.union(v.string(), v.null()),
    isOwner: v.boolean(),
  })
);
export type Decider = Infer<typeof deciderValidator>;

/**
 * Who decides extension requests. A member's task: the admins. An admin's task: the admin task
 * reviewer from Team rules; if the reviewer can't (none set, deactivated, or it's their own task)
 * the other admins do, so there's someone whenever there's a second admin. Nobody ever decides
 * on a task they own. Loads the reviewer and the admins once, then answers per task.
 */
export async function loadDeciders(ctx: QueryCtx) {
  const reviewer = await getUserSetting(ctx, "adminTaskReviewer");
  const activeAdmins = (
    await ctx.db
      .query("users")
      .withIndex("by_isActive", (q) => q.eq("isActive", true))
      .take(500)
  ).filter(isAdmin);
  const owners = new Map<Id<"users">, Doc<"users"> | null>();

  async function ownerIsAdmin(task: Doc<"tasks">): Promise<boolean> {
    if (task.ownerId === undefined) return false;
    if (!owners.has(task.ownerId)) {
      owners.set(task.ownerId, await ctx.db.get("users", task.ownerId));
    }
    const owner = owners.get(task.ownerId);
    return owner !== null && owner !== undefined && isAdmin(owner);
  }
  /** The reviewer can decide on this (admin-owned) task. */
  function reviewerDecides(task: Doc<"tasks">): boolean {
    return reviewer !== null && reviewer.isActive && reviewer._id !== task.ownerId;
  }
  /** Another active admin than the task's owner exists. */
  function otherAdmin(task: Doc<"tasks">): boolean {
    return activeAdmins.some((a) => a._id !== task.ownerId);
  }

  return {
    /** Whether `user` may approve or decline extension requests on `task`. */
    async canDecide(user: Doc<"users">, task: Doc<"tasks">): Promise<boolean> {
      if (!user.isActive || task.ownerId === undefined || task.ownerId === user._id) return false;
      if ((await ownerIsAdmin(task)) && reviewerDecides(task)) return reviewer!._id === user._id;
      return isAdmin(user);
    },
    /** Whether anyone can decide on `task` (asking is refused when nobody could). */
    async hasDecider(task: Doc<"tasks">): Promise<boolean> {
      if (!(await ownerIsAdmin(task))) return true;
      return reviewerDecides(task) || otherAdmin(task);
    },
    /** Who decides on `task`, for the app to name. */
    async deciderOf(task: Doc<"tasks">): Promise<Decider> {
      if (!(await ownerIsAdmin(task))) return { kind: "admins" };
      if (reviewerDecides(task)) return { kind: "reviewer", name: reviewer!.name, isOwner: false };
      if (otherAdmin(task)) return { kind: "admins" };
      const active = reviewer !== null && reviewer.isActive;
      return {
        kind: "reviewer",
        name: active ? reviewer.name : null,
        isOwner: active && reviewer._id === task.ownerId,
      };
    },
  };
}

export const extensionViewValidator = schema.doc("extensionRequests").extend({
  requester: v.union(userSummaryValidator, v.null()),
  reviewer: v.union(userSummaryValidator, v.null()),
});
export type ExtensionView = Infer<typeof extensionViewValidator>;

export function toExtensionView(
  request: Doc<"extensionRequests">,
  directory: UserDirectory
): ExtensionView {
  return {
    ...request,
    requester: directory.get(request.requestedBy) ?? null,
    reviewer: request.reviewerId !== undefined ? (directory.get(request.reviewerId) ?? null) : null,
  };
}
