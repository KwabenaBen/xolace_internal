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
  // An admin owns the task: the admin task reviewer (Team rules) decides. `name` is null when
  // none is set (or they're deactivated); `isOwner` when the reviewer is the task's own owner,
  // so nobody can decide.
  v.object({
    kind: v.literal("reviewer"),
    name: v.union(v.string(), v.null()),
    isOwner: v.boolean(),
  })
);
export type Decider = Infer<typeof deciderValidator>;

/**
 * Who decides extension requests: the admins, or, when an admin owns the task, the admin task
 * reviewer from Team rules, so nobody decides their own. Nobody ever decides on a task they own.
 * Loads the reviewer once, then answers per task.
 */
export async function loadDeciders(ctx: QueryCtx) {
  const reviewer = await getUserSetting(ctx, "adminTaskReviewer");
  const owners = new Map<Id<"users">, Doc<"users"> | null>();

  async function ownerIsAdmin(task: Doc<"tasks">): Promise<boolean> {
    if (task.ownerId === undefined) return false;
    if (!owners.has(task.ownerId)) {
      owners.set(task.ownerId, await ctx.db.get("users", task.ownerId));
    }
    const owner = owners.get(task.ownerId);
    return owner !== null && owner !== undefined && isAdmin(owner);
  }

  return {
    /** Whether `user` may approve or decline extension requests on `task`. */
    async canDecide(user: Doc<"users">, task: Doc<"tasks">): Promise<boolean> {
      if (!user.isActive || task.ownerId === undefined || task.ownerId === user._id) return false;
      if (await ownerIsAdmin(task)) {
        return reviewer !== null && reviewer.isActive && reviewer._id === user._id;
      }
      return isAdmin(user);
    },
    /**
     * Whether anyone can decide on `task`: always for a member's task (there's always an active
     * admin); for an admin's own task, only with an active admin task reviewer who isn't its owner.
     */
    async hasDecider(task: Doc<"tasks">): Promise<boolean> {
      if (!(await ownerIsAdmin(task))) return true;
      return reviewer !== null && reviewer.isActive && reviewer._id !== task.ownerId;
    },
    /** Who decides on `task`, for the app to name. */
    async deciderOf(task: Doc<"tasks">): Promise<Decider> {
      if (!(await ownerIsAdmin(task))) return { kind: "admins" };
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
