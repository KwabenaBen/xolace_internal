import { v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import { env, internalMutation, type MutationCtx } from "./_generated/server";
import { findUserByEmail, normalizeEmail } from "./lib/accounts";
import { logActivity } from "./lib/activity";
import { countActiveAdmins } from "./lib/auth";
import { DAY_MS, endOfDayGmt, isWeekendDate, toDateOnly } from "./lib/dates";
import { appError } from "./lib/errors";
import { rollUpFeature } from "./lib/reviews";
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
 *   bunx convex run demo:seed     adds demo people, features ("Demo: …"), tasks with the reviews
 *                                 their statuses imply, proposals and the demo people's daily
 *                                 logs for the past week
 *   bunx convex run demo:clear    removes the demo people (with their logs and missed days), and
 *                                 the demo features with their tasks (and the tasks' reviews)
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

/** What the demo people's weekday logs say (cycled through). */
const DEMO_LOGS: { done: string; next?: string; blockers?: string }[] = [
  {
    done: "Finished the sign-up screen's error states and wired them to the API.",
    next: "Hook up the invite check, then hand it over for review.",
  },
  {
    done: "Went through review comments and fixed the two edge cases they found.",
    next: "Write the tests for the expired-code path.",
    blockers: "Waiting on the bank's sandbox keys.",
  },
  {
    done: "Drafted the copy for the welcome screens and shared it for feedback.",
    next: "Turn the feedback into a second draft.",
  },
  {
    done: "Paired on the payments flow; mapped out what the partner needs from us.",
    blockers: "Need a decision on which bank goes first.",
  },
];

const DEMO_WEEKEND_LINE = "Read through the partner's API docs.";

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
    status: "in_progress",
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
    status: "in_progress",
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
    const existing = await findDemoFeatures(ctx);
    if (existing.length > 0) {
      const added = await topUpDemoLogs(ctx, Date.now());
      const reviews = await topUpDemoReviews(ctx, existing, Date.now());
      const extras = [
        added > 0 ? `added ${added} daily logs for the demo people` : null,
        reviews > 0 ? `added ${reviews} reviews behind the demo tasks` : null,
      ].filter((part) => part !== null);
      return `Demo data is already there (run demo:clear first to reseed)${
        extras.length > 0 ? `; ${extras.join("; ")}` : ""
      }.`;
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
    const verifierFor = demoVerifiers(who("yaw"));

    let taskCount = 0;
    // Each demo person's open tasks, for their demo logs to link.
    const openTasks = new Map<PersonKey, Id<"tasks">[]>();
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
        const taskId = await ctx.db.insert("tasks", {
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
        if (task.owner !== "you" && !done) {
          openTasks.set(task.owner, [...(openTasks.get(task.owner) ?? []), taskId]);
        }
        const inserted = await ctx.db.get("tasks", taskId);
        if (inserted !== null) await seedDemoReviews(ctx, inserted, verifierFor, now);
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

    const logCount = await seedDemoLogs(ctx, who, openTasks, now);
    return `Added ${DEMO_PEOPLE.length} demo people, ${DEMO_FEATURES.length} features, ${taskCount} tasks and ${logCount} daily logs.`;
  },
});

/**
 * Daily logs for the demo people over the past week (not today, so their "today" is still open),
 * with a missed weekday each and one weekend line. Days that already have a log or a missed day
 * are left alone, so it can run again (e.g. on demo data seeded before logs existed). Real
 * people's logs are theirs: never seeded.
 */
async function seedDemoLogs(
  ctx: MutationCtx,
  who: (key: (typeof DEMO_PEOPLE)[number]["key"]) => Id<"users">,
  openTasks: Map<PersonKey, Id<"tasks">[]>,
  now: number
): Promise<number> {
  let logCount = 0;
  for (const [index, person] of DEMO_PEOPLE.entries()) {
    const userId = who(person.key);
    for (let daysAgo = 1; daysAgo <= 7; daysAgo++) {
      const date = toDateOnly(now - daysAgo * DAY_MS);
      const logged = await ctx.db
        .query("dailyLogs")
        .withIndex("by_userId_and_date", (q) => q.eq("userId", userId).eq("date", date))
        .first();
      const missed = await ctx.db
        .query("missedDays")
        .withIndex("by_userId_and_date", (q) => q.eq("userId", userId).eq("date", date))
        .first();
      if (logged !== null || missed !== null) continue;
      if (isWeekendDate(date)) {
        if (person.key === "kofi" && daysAgo <= 2) {
          await ctx.db.insert("dailyLogs", {
            userId,
            date,
            isWeekend: true,
            done: DEMO_WEEKEND_LINE,
            taskIds: [],
          });
          logCount++;
        }
        continue;
      }
      if ((index + daysAgo) % 5 === 0) {
        await ctx.db.insert("missedDays", { userId, date });
        continue;
      }
      const entry = DEMO_LOGS[(index + daysAgo) % DEMO_LOGS.length];
      await ctx.db.insert("dailyLogs", {
        userId,
        date,
        isWeekend: false,
        done: entry.done,
        next: entry.next,
        blockers: entry.blockers,
        taskIds: (openTasks.get(person.key) ?? []).slice(0, 1 + (daysAgo % 2)),
      });
      logCount++;
    }
  }
  return logCount;
}

/**
 * On demo data that's already there: the demo people's open tasks (for their logs to link), and
 * their logs for the past week where missing.
 */
async function topUpDemoLogs(ctx: MutationCtx, now: number): Promise<number> {
  const demoUsers = await findDemoUsers(ctx);
  const ids = new Map<PersonKey, Id<"users">>();
  const openTasks = new Map<PersonKey, Id<"tasks">[]>();
  for (const person of DEMO_PEOPLE) {
    const user = demoUsers.find((u) => u.email === `${person.key}${DEMO_EMAIL_DOMAIN}`);
    if (user === undefined) return 0;
    ids.set(person.key, user._id);
    const owned = await ctx.db
      .query("tasks")
      .withIndex("by_ownerId_and_status", (q) => q.eq("ownerId", user._id))
      .take(100);
    openTasks.set(
      person.key,
      owned
        .filter((t) => !["proposed", "declined", "verified"].includes(t.status))
        .map((t) => t._id)
    );
  }
  return await seedDemoLogs(ctx, (key) => ids.get(key)!, openTasks, now);
}

/**
 * Who decided a demo task's verification: Yaw (the demo admin). His own tasks name nobody (nobody
 * verifies their own work, and demo data never puts a decision on a real person).
 */
function demoVerifiers(yaw: Id<"users">): (ownerId: Id<"users">) => Id<"users"> | undefined {
  return (ownerId) => (ownerId === yaw ? undefined : yaw);
}

/**
 * The reviews a demo task's status implies, so its review card has something to show and act
 * on: a waiting peer review or verification, the verifier's reason behind changes requested,
 * the approvals behind a verified task. A task that already has any is left alone, so a top-up
 * never doubles them. Returns how many rows it added.
 */
async function seedDemoReviews(
  ctx: MutationCtx,
  task: Doc<"tasks">,
  verifierFor: (ownerId: Id<"users">) => Id<"users"> | undefined,
  now: number
): Promise<number> {
  const ownerId = task.ownerId;
  if (ownerId === undefined) return 0;
  const already = await ctx.db
    .query("verifications")
    .withIndex("by_taskId", (q) => q.eq("taskId", task._id))
    .first();
  if (already !== null) return 0;
  const proofUrl = "https://example.com/demo-proof";
  const allMet = task.acceptanceCriteria.map(() => true);
  const verifier = verifierFor(ownerId);
  let added = 0;
  // A code task's verification comes after its peer reviewer's approval.
  const peerApproved = async (decidedAt: number) => {
    if (task.kind !== "code" || task.peerReviewerId === undefined) return;
    await ctx.db.insert("verifications", {
      taskId: task._id,
      stage: "peer_review",
      submittedBy: ownerId,
      note: "Ready for a look.",
      proofUrl,
      decision: "approved",
      reviewerId: task.peerReviewerId,
      decidedAt,
    });
    added++;
  };
  switch (task.status) {
    case "in_peer_review":
      await ctx.db.insert("verifications", {
        taskId: task._id,
        stage: "peer_review",
        submittedBy: ownerId,
        note: "Ready for a look: the main path and its tests are in.",
        proofUrl,
      });
      added++;
      break;
    case "submitted":
      await peerApproved(now - 2 * DAY_MS);
      await ctx.db.insert("verifications", {
        taskId: task._id,
        stage: "verification",
        submittedBy: ownerId,
        note: "Done: every criterion is in, ready to check.",
        proofUrl,
      });
      added++;
      break;
    case "changes_requested":
      await peerApproved(now - 3 * DAY_MS);
      await ctx.db.insert("verifications", {
        taskId: task._id,
        stage: "verification",
        submittedBy: ownerId,
        note: "Done, I think: have a look.",
        proofUrl,
        decision: "changes_requested",
        reviewerId: verifier,
        reason: "Nearly there: the last criterion isn't met yet.",
        criteriaMet: allMet.map((_, index) => index < allMet.length - 1),
        criteria: task.acceptanceCriteria,
        decidedAt: now - DAY_MS,
      });
      added++;
      break;
    case "verified":
      await peerApproved((task.verifiedAt ?? now) - DAY_MS);
      await ctx.db.insert("verifications", {
        taskId: task._id,
        stage: "verification",
        submittedBy: ownerId,
        note: "Done: every criterion is in.",
        proofUrl,
        decision: "approved",
        reviewerId: verifier,
        criteriaMet: allMet,
        criteria: task.acceptanceCriteria,
        decidedAt: task.verifiedAt ?? now,
      });
      added++;
      break;
    default:
      break;
  }
  return added;
}

/**
 * On demo data seeded before reviews existed: the reviews behind each demo task's status, and
 * each demo feature's stage brought in line with its tasks (rollUpFeature).
 */
async function topUpDemoReviews(
  ctx: MutationCtx,
  features: Doc<"features">[],
  now: number
): Promise<number> {
  const yaw = (await findDemoUsers(ctx)).find((u) => u.email === `yaw${DEMO_EMAIL_DOMAIN}`);
  if (yaw === undefined) return 0;
  const verifierFor = demoVerifiers(yaw._id);
  let added = 0;
  for (const feature of features) {
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_featureId_and_status", (q) => q.eq("featureId", feature._id))
      .take(500);
    for (const task of tasks) added += await seedDemoReviews(ctx, task, verifierFor, now);
    await rollUpFeature(ctx, feature._id);
  }
  return added;
}

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

  // A real person's daily log that links a demo task would quietly lose the link (logs are part
  // of the record), so clearing waits until nobody's log points at one.
  const demoTaskIds = new Set<Id<"tasks">>();
  for (const feature of demoFeatures) {
    const tasks = await ctx.db
      .query("tasks")
      .withIndex("by_featureId_and_status", (q) => q.eq("featureId", feature._id))
      .take(500);
    for (const task of tasks) demoTaskIds.add(task._id);
  }
  const realPeople = (await ctx.db.query("users").take(500)).filter((u) => !demoIds.has(u._id));
  const linking: string[] = [];
  for (const person of realPeople) {
    const logs = await ctx.db
      .query("dailyLogs")
      .withIndex("by_userId_and_date", (q) => q.eq("userId", person._id))
      .take(1000);
    if (logs.some((log) => log.taskIds.some((id) => demoTaskIds.has(id)))) {
      linking.push(person.name);
    }
  }
  if (linking.length > 0) {
    throw appError(
      "INVALID_ARGUMENT",
      `Real daily logs link demo tasks (${linking.join(", ")}); clearing would change them, so the demo data stays.`
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
        const reviews = await ctx.db
          .query("verifications")
          .withIndex("by_taskId", (q) => q.eq("taskId", task._id))
          .take(500);
        for (const review of reviews) await ctx.db.delete("verifications", review._id);
        await ctx.db.delete("tasks", task._id);
      }
      await ctx.db.delete("features", feature._id);
    }
    const users = people;
    for (const user of users) {
      // Their daily logs and missed days go with them (demo records only).
      const logs = await ctx.db
        .query("dailyLogs")
        .withIndex("by_userId_and_date", (q) => q.eq("userId", user._id))
        .take(1000);
      for (const log of logs) await ctx.db.delete("dailyLogs", log._id);
      const missed = await ctx.db
        .query("missedDays")
        .withIndex("by_userId_and_date", (q) => q.eq("userId", user._id))
        .take(1000);
      for (const day of missed) await ctx.db.delete("missedDays", day._id);
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
