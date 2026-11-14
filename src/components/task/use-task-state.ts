import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";

import { api } from "@convex/_generated/api";
import type { Doc, Id } from "@convex/_generated/dataModel";
import { isOwnerWorking } from "@convex/lib/validators";
import type { TaskView } from "@convex/lib/views";

import { ruleValue } from "@/components/team-rules/rules";

import { nobodyDecides } from "./deciders";

export type TaskExtensions = FunctionReturnType<typeof api.extensions.forTask>;
export type TaskReviews = FunctionReturnType<typeof api.reviews.forTask>;

/**
 * Everything a task page loads: the task and its feature (`undefined` while loading, `null` if
 * there's no such task), its requests for more time, and the team's late window. Shared by the
 * phone's task page and the website's task panel, so they can't drift apart.
 */
export function useTaskData(taskId: string): {
  data: FunctionReturnType<typeof api.tasks.get> | undefined;
  extensions: TaskExtensions | undefined;
  /** Its peer reviews and verification (Phase 6), and what you can do with them. */
  reviews: TaskReviews | undefined;
  windowHours: number;
} {
  const data = useQuery(api.tasks.get, { taskId });
  const rules = useQuery(api.settings.list);
  const loadedId = data?.task._id;
  const extensions = useQuery(
    api.extensions.forTask,
    loadedId !== undefined ? { taskId: loadedId } : "skip"
  );
  const reviews = useQuery(
    api.reviews.forTask,
    loadedId !== undefined ? { taskId: loadedId } : "skip"
  );
  const windowValue = ruleValue(rules, "extensionLateWindowHours");
  return {
    data,
    extensions,
    reviews,
    windowHours: typeof windowValue === "number" ? windowValue : 24,
  };
}

export type TaskFacts = {
  isProposal: boolean;
  isDeclined: boolean;
  /** Not a proposal and not declined. */
  isLive: boolean;
  /** The signed-in user owns it and it's in their hands: they can post updates. */
  canUpdate: boolean;
  /** The request for more time waiting for a decision, if any. */
  pending: TaskExtensions["requests"][number] | undefined;
  /** A request may be waiting (also while loading, so no Ask button flashes in and out). */
  hasPending: boolean;
  /** Why asking for more time isn't possible (nobody could decide), or null. */
  cantAsk: string | null;
  /** Why the waiting request can only be declined now (the server refuses approving), or null. */
  approveBlock: string | null;
};

/** What the signed-in user can do with a task, from its data (the server enforces the same). */
export function taskFacts(
  task: TaskView,
  feature: Doc<"features">,
  extensions: TaskExtensions | undefined,
  userId: Id<"users">
): TaskFacts {
  const isProposal = task.status === "proposed";
  const isDeclined = task.status === "declined";
  const isLive = !isProposal && !isDeclined;
  const pending = extensions?.requests.find((r) => r.status === "pending");
  // The server only approves while the task is in its owner's hands, its feature hasn't
  // shipped, and the request came from its current owner.
  const approveBlock =
    pending === undefined
      ? null
      : pending.requestedBy !== task.ownerId
        ? "It came from the task's previous owner, so it can only be declined."
        : !isOwnerWorking(task.status)
          ? "The task is with its reviewer or verified now, so it can only be declined."
          : feature.status === "shipped"
            ? "The feature has shipped, so it can only be declined."
            : null;
  return {
    isProposal,
    isDeclined,
    isLive,
    canUpdate: isLive && task.ownerId === userId && isOwnerWorking(task.status),
    pending,
    hasPending: extensions === undefined || pending !== undefined,
    cantAsk:
      extensions !== undefined && !extensions.canRequest
        ? nobodyDecides(extensions.decider, true)
        : null,
    approveBlock,
  };
}

/**
 * The owner's next review step, if they can take it now: "peer" (ask the peer reviewer to review
 * a code task) or "submit" (submit it for verification). Null otherwise (the server checks too).
 */
export function nextReviewStep(reviews: TaskReviews | undefined): "peer" | "submit" | null {
  if (reviews === undefined) return null;
  if (reviews.canSubmit) return "submit";
  if (reviews.canAskPeerReview && reviews.needsPeerReview) return "peer";
  return null;
}
