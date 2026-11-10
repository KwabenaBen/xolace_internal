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
  // An admin owns the task: the admin task reviewer (Team rules) decides. Null when unset.
  v.object({ kind: v.literal("reviewer"), name: v.union(v.string(), v.null()) })
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
    /** Who decides on `task`, for the app to name. */
    async deciderOf(task: Doc<"tasks">): Promise<Decider> {
      if (!(await ownerIsAdmin(task))) return { kind: "admins" };
      return {
        kind: "reviewer",
        name: reviewer !== null && reviewer.isActive ? reviewer.name : null,
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
