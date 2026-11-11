import { v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import { env, internalMutation, type MutationCtx } from "./_generated/server";
import { findUserByEmail, normalizeEmail } from "./lib/accounts";
import { logActivity } from "./lib/activity";
import { countActiveAdmins } from "./lib/auth";
import { DAY_MS, endOfDayGmt, toDateOnly } from "./lib/dates";
import { appError } from "./lib/errors";
import { getUserSetting } from "./lib/settings";
import {
  roleValidator,
  type FeatureStatus,
  type TaskKind,
  type TaskPriority,
  type TaskStatus,
} from "./lib/validators";

/**
 * Demo data for the dev deployment, so the Board has something to show. CLI only, never prod.
 * Every command refuses to run unless the deployment has CADENCE_DEMO=on (set it on dev only:
 * `bunx convex env set CADENCE_DEMO on`), so a slip of `--prod` does nothing.
 *   bunx convex run demo:seed     adds demo people, features ("Demo: …"), tasks and proposals
 *   bunx convex run demo:clear    removes the demo people, and the demo features with their tasks
 *   bunx convex run demo:setRole "{email:'you@example.com',role:'admin'}"
 *                                 makes a signed-up account an admin or a member, to try the app
 *                                 from either side (switch it back the same way)
 * A demo feature is one whose title starts with "Demo: " AND that a demo person created, so a
 * real feature is never removed. The activity log is never touched.
 * Demo people have emails ending in DEMO_EMAIL_DOMAIN and no login. Tasks are spread across them
 * and the existing (real) users, so real accounts see demo work in My Tasks too.
 */

const DEMO_TITLE_PREFIX = "Demo: ";
const DEMO_EMAIL_DOMAIN = "@demo.cadence.test";

const DEMO_PEOPLE = [
  { key: "kofi", name: "Kofi Mensah", title: "CTO (demo)", role: "member" },
  { key: "abena", name: "Abena Owusu", title: "CEO (demo)", role: "member" },
  { key: "yaw", name: "Yaw Boateng", title: "COO (demo)", role: "admin" },
] as const;
type PersonKey = (typeof DEMO_PEOPLE)[number]["key"] | "you";

type DemoTask = {
  title: string;
  kind: TaskKind;
  owner: PersonKey;
  reviewer?: PersonKey;
  status: TaskStatus;
  progress: number;
  /** Days from today; negative is in the past. */
  due: number;
  priority: TaskPriority;
  criteria: string[];
  description?: string;
};

type DemoFeature = {
  title: string;
  description: string;
  expectedResult: string;
  sourceNote: string;
  status: FeatureStatus;
  due: number;
  tasks: DemoTask[];
  proposals: { title: string; by: PersonKey; kind: TaskKind; declined?: string }[];
};

const DEMO_FEATURES: DemoFeature[] = [
  {
    title: "Onboarding flow",
    description: "New teammates get from invite to their first task without help.",
    expectedResult: "Every invited person signs up and sees their tasks in under five minutes.",
    sourceNote: "Weekly sync, 3 Nov",
    status: "in_progress",
    due: 12,
    tasks: [
      {
        title: "Sign-up API with invite check",
        kind: "code",
        owner: "kofi",
        reviewer: "abena",
        status: "in_peer_review",
        progress: 90,
        due: 4,
        priority: "high",
        criteria: [
          "Rejects emails without an invite",
          "Gives the user the invite's role and title",
        ],
      },
      {
        title: "Welcome screen animation",
        kind: "design",
        owner: "you",
        status: "in_progress",
        progress: 60,
        due: 2,
        priority: "medium",
        criteria: ["Dots spell the product name", "Respects Reduce Motion"],
      },
      {
        title: "Onboarding copy",
        kind: "content",
        owner: "you",
        status: "todo",
        progress: 0,
        due: 6,
        priority: "low",
        criteria: ["Fits on a small iPhone", "Reviewed by the CEO"],
      },
      {
        title: "Invite the founding team",
        kind: "operations",
        owner: "yaw",
        status: "verified",
        progress: 100,
        due: -2,
        priority: "medium",
        criteria: ["All four cofounders invited"],
      },
      {
        title: "Fix the password reset bug",
        kind: "code",
        owner: "abena",
        reviewer: "kofi",
        status: "blocked",
        progress: 30,
        due: -1,
        priority: "urgent",
        criteria: ["Reset link works once", "Old sessions are signed out"],
        description: "Blocked on the email provider account.",
      },
    ],
    proposals: [{ title: "Dark mode for the web app", by: "you", kind: "design" }],
  },
  {
    title: "Partner payments",
    description: "Customers can pay through a local bank partner.",
    expectedResult: "Two banks shortlisted and one payments API proven end to end.",
    sourceNote: "Strategy day, 28 Oct",
    status: "planned",
    due: 30,
    tasks: [
      {
        title: "Shortlist three banks",
        kind: "operations",
        owner: "yaw",
        status: "in_progress",
        progress: 40,
        due: 5,
        priority: "high",
        criteria: ["Fees compared", "Settlement times compared"],
      },
      {
        title: "Payments API spike",
        kind: "code",
        owner: "kofi",
        reviewer: "abena",
        status: "todo",
        progress: 0,
        due: 14,
        priority: "medium",
        criteria: ["One test payment goes through", "Notes on the API's limits"],
      },
      {
        title: "Pricing page design",
        kind: "design",
        owner: "you",
        status: "changes_requested",
        progress: 70,
        due: -3,
        priority: "high",
        criteria: ["Shows all three plans", "Works on web and phone"],
      },
    ],
    proposals: [
      {
        title: "Referral link in settings",
        by: "kofi",
        kind: "code",
        declined: "Out of scope for v1. Let's revisit after launch.",
      },
    ],
  },
  {
    title: "Investor update deck",
    description: "The quarterly update for our angel investors.",
    expectedResult: "Deck sent with Q3 numbers and the plan for Q4.",
    sourceNote: "Board call, 1 Nov",
    status: "internal_testing",
    due: 3,
    tasks: [
      {
        title: "Draft the narrative",
        kind: "content",
        owner: "abena",
        status: "submitted",
        progress: 100,
        due: 1,
        priority: "high",
        criteria: ["Ten slides or fewer", "Clear ask on the last slide"],
      },
      {
        title: "Charts from Q3 numbers",
        kind: "design",
        owner: "you",
        status: "verified",
        progress: 100,
        due: -1,
        priority: "medium",
        criteria: ["Revenue and burn charts", "Same style as last quarter"],
      },
    ],
    proposals: [],
  },
];

function deadlineIn(days: number, now: number): number {
  return endOfDayGmt(toDateOnly(now + days * DAY_MS)) ?? now;
}

function requireDemoDeployment(): void {
  if (env.CADENCE_DEMO !== "on") {
    throw appError(
      "FORBIDDEN",
      "Demo data is off on this deployment. On a dev deployment only: bunx convex env set CADENCE_DEMO on"
    );
  }
}

async function findDemoFeatures(ctx: MutationCtx): Promise<Doc<"features">[]> {
  const demoPeople = new Set((await findDemoUsers(ctx)).map((u) => u._id));
  const features = await ctx.db.query("features").take(500);
  return features.filter(
    (f) => f.title.startsWith(DEMO_TITLE_PREFIX) && demoPeople.has(f.createdBy)
  );
}

async function findDemoUsers(ctx: MutationCtx): Promise<Doc<"users">[]> {
  const users = await ctx.db.query("users").take(500);
  return users.filter((u) => u.email.endsWith(DEMO_EMAIL_DOMAIN));
}

export const seed = internalMutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    requireDemoDeployment();
    if ((await findDemoFeatures(ctx)).length > 0) {
      return "Demo data is already there. Run demo:clear first to reseed.";
    }
    const now = Date.now();

    // People: the demo team, plus whoever has really signed up (they get the "you" tasks).
    const people = new Map<PersonKey, Id<"users">>();
    for (const person of DEMO_PEOPLE) {
      const email = `${person.key}${DEMO_EMAIL_DOMAIN}`;
      const existing = (await findDemoUsers(ctx)).find((u) => u.email === email);
      people.set(
        person.key,
        existing?._id ??
          (await ctx.db.insert("users", {
            name: person.name,
            email,
            title: person.title,
            role: person.role,
            isActive: true,
            timezone: "Africa/Accra",
          }))
      );
    }
    const realUsers = (await ctx.db.query("users").take(500)).filter(
      (u) => u.isActive && !u.email.endsWith(DEMO_EMAIL_DOMAIN)
    );
    people.set("you", realUsers[0]?._id ?? people.get("abena")!);
    const who = (key: PersonKey) => people.get(key)!;

    let taskCount = 0;
    for (const feature of DEMO_FEATURES) {
      const featureId = await ctx.db.insert("features", {
        title: `${DEMO_TITLE_PREFIX}${feature.title}`,
        description: feature.description,
        expectedResult: feature.expectedResult,
        sourceNote: feature.sourceNote,
        deadline: deadlineIn(feature.due, now),
        status: feature.status,
        createdBy: who("yaw"),
      });

      for (const task of feature.tasks) {
        const deadline = deadlineIn(task.due, now);
        const done = task.status === "verified";
        const submitted = done || task.status === "submitted";
        await ctx.db.insert("tasks", {
          featureId,
          title: task.title,
          description: task.description ?? "",
          kind: task.kind,
          acceptanceCriteria: task.criteria,
          ownerId: who(task.owner),
          peerReviewerId: task.reviewer !== undefined ? who(task.reviewer) : undefined,
          deadline,
          originalDeadline: deadline,
          priority: task.priority,
          status: task.status,
          progress: task.progress,
          countsAsLate: false,
          submittedAt: submitted ? deadline - 2 * DAY_MS : undefined,
          verifiedAt: done ? deadline - DAY_MS : undefined,
        });
        taskCount++;
      }

      for (const proposal of feature.proposals) {
        await ctx.db.insert("tasks", {
          featureId,
          title: proposal.title,
          description: "Proposed from the demo seed.",
          kind: proposal.kind,
          acceptanceCriteria: [],
          proposedBy: who(proposal.by),
          priority: "medium",
          status: proposal.declined !== undefined ? "declined" : "proposed",
          declineReason: proposal.declined,
          progress: 0,
          countsAsLate: false,
        });
        taskCount++;
      }
    }
    return `Added ${DEMO_PEOPLE.length} demo people, ${DEMO_FEATURES.length} features and ${taskCount} tasks.`;
  },
});

/**
 * demo:clear won't leave the real app broken: it refuses while no real (non-demo) admin is
 * active, or while real work or a team rule still points at a demo person. The reply says what
 * to change first.
 */
async function refuseIfStillNeeded(
  ctx: MutationCtx,
  demoFeatures: Doc<"features">[],
  demoPeople: Doc<"users">[]
): Promise<void> {
  const demoIds = new Set(demoPeople.map((p) => p._id));
  const realAdmins = (
    await ctx.db
      .query("users")
      .withIndex("by_isActive", (q) => q.eq("isActive", true))
      .take(500)
  ).filter((u) => u.role === "admin" && !demoIds.has(u._id));
  if (realAdmins.length === 0) {
    throw appError(
      "INVALID_ARGUMENT",
      "Make a real account an admin first (demo:setRole), so clearing the demo doesn't leave Cadence without one."
    );
  }
  const demoFeatureIds = new Set(demoFeatures.map((f) => f._id));
  const realWork: string[] = [];
  for (const person of demoPeople) {
    const owned = await ctx.db
      .query("tasks")
      .withIndex("by_ownerId_and_status", (q) => q.eq("ownerId", person._id))
      .take(200);
    const reviewing = await ctx.db
      .query("tasks")
      .withIndex("by_peerReviewerId_and_status", (q) => q.eq("peerReviewerId", person._id))
      .take(200);
    for (const task of [...owned, ...reviewing]) {
      if (!demoFeatureIds.has(task.featureId)) realWork.push(`"${task.title}" (${person.name})`);
    }
  }
  const reviewer = await getUserSetting(ctx, "adminTaskReviewer");
  if (reviewer !== null && demoIds.has(reviewer._id)) {
    realWork.push(`the admin task reviewer (${reviewer.name})`);
  }
  if (realWork.length > 0) {
    throw appError(
      "INVALID_ARGUMENT",
      `Demo people are still in real use; reassign these first: ${[...new Set(realWork)].join(", ")}.`
    );
  }
}

export const clear = internalMutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    requireDemoDeployment();
    const features = await findDemoFeatures(ctx);
    const people = await findDemoUsers(ctx);
    await refuseIfStillNeeded(ctx, features, people);
    for (const feature of features) {
      const tasks = await ctx.db
        .query("tasks")
        .withIndex("by_featureId_and_status", (q) => q.eq("featureId", feature._id))
        .take(500);
      for (const task of tasks) {
        // What hangs off a demo task goes with it (the activity log stays, as always).
        const comments = await ctx.db
          .query("comments")
          .withIndex("by_taskId", (q) => q.eq("taskId", task._id))
          .take(500);
        for (const comment of comments) await ctx.db.delete("comments", comment._id);
        const requests = await ctx.db
          .query("extensionRequests")
          .withIndex("by_taskId_and_status", (q) => q.eq("taskId", task._id))
          .take(500);
        for (const request of requests) await ctx.db.delete("extensionRequests", request._id);
        await ctx.db.delete("tasks", task._id);
      }
      await ctx.db.delete("features", feature._id);
    }
    const users = people;
    for (const user of users) {
      await ctx.db.delete("users", user._id);
    }
    // The activity log is the audit trail: it is never deleted, demo entries included.
    return `Removed ${features.length} demo features (with their tasks) and ${users.length} demo people.`;
  },
});

/**
 * Dev only: make an account an admin or a member, to see the app from either side. Unlike the
 * app's own setRole it needs no admin to run it (there may be none yet on dev), and it may leave
 * no active admin, which the reply says. Recorded in the activity log like any role change.
 */
export const setRole = internalMutation({
  args: { email: v.string(), role: roleValidator },
  returns: v.string(),
  handler: async (ctx, args) => {
    requireDemoDeployment();
    const user = await findUserByEmail(ctx, normalizeEmail(args.email));
    if (user === null) throw appError("NOT_FOUND", `No account for ${args.email}.`);
    if (user.role !== args.role) {
      await ctx.db.patch("users", user._id, { role: args.role });
      await logActivity(ctx, {
        entityType: "user",
        entityId: user._id,
        action: "user.role_changed",
        before: { role: user.role },
        after: { role: args.role, source: "demo:setRole" },
      });
    }
    const admins = await countActiveAdmins(ctx);
    return `${user.name} is now ${args.role === "admin" ? "an admin" : "a member"}.${
      admins === 0 ? " Nobody is an active admin now." : ` Active admins: ${admins}.`
    }`;
  },
});
