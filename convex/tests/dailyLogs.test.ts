import { afterEach, describe, expect, test, vi } from "vitest";

import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { DAILY_LOG_LIMITS } from "../lib/constants";
import { toDateOnly } from "../lib/dates";
import { createTestConvex, expectAppError, insertUser, type TestConvex } from "../test.setup";

// Thursday 12 Nov 2026 is a weekday; Saturday 14 and Sunday 15 are the weekend.
const THU = "2026-11-12";
const FRI = "2026-11-13";
const SAT = "2026-11-14";
const MON = "2026-11-16";
const DAY = 24 * 60 * 60 * 1000;

afterEach(() => {
  vi.useRealTimers();
});

/** Only the clock is faked, so convex-test's own timers keep working. */
function setClock(iso: string) {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(iso));
}

/** The team joins on 1 Nov; the clock then moves to Thursday 12 Nov, mid-morning. */
async function setup() {
  setClock("2026-11-01T09:00:00Z");
  const t = createTestConvex();
  const coo = await insertUser(t, { email: "coo@cadence.test", role: "admin", title: "COO" });
  const ceo = await insertUser(t, { email: "ceo@cadence.test", role: "member", title: "CEO" });
  const cto = await insertUser(t, { email: "cto@cadence.test", role: "member", title: "CTO" });
  const featureId = await coo.asUser.mutation(api.features.create, {
    title: "Onboarding flow",
    description: "New users can sign up and finish setup.",
    expectedResult: "Most invited users finish onboarding.",
    sourceNote: "",
    deadline: toDateOnly(Date.now() + 40 * DAY),
  });
  setClock(`${THU}T10:00:00Z`);
  return { t, coo, ceo, cto, featureId };
}

async function createTask(
  asAdmin: ReturnType<TestConvex["withIdentity"]>,
  featureId: Id<"features">,
  ownerId: Id<"users">,
  peerReviewerId?: Id<"users">
) {
  return await asAdmin.mutation(api.tasks.create, {
    featureId,
    title: peerReviewerId === undefined ? "Write the welcome copy" : "Build the sign-up API",
    description: "",
    kind: peerReviewerId === undefined ? "content" : "code",
    acceptanceCriteria: ["It's done"],
    ownerId,
    peerReviewerId,
    deadline: toDateOnly(Date.now() + 10 * DAY),
    priority: "medium",
  });
}

async function logsOf(t: TestConvex, userId: Id<"users">) {
  return await t.run(async (ctx) =>
    ctx.db
      .query("dailyLogs")
      .withIndex("by_userId_and_date", (q) => q.eq("userId", userId))
      .collect()
  );
}

async function activityActions(t: TestConvex) {
  return await t.run(async (ctx) =>
    (await ctx.db.query("activity").collect()).map((a) => a.action)
  );
}

describe("writing a log", () => {
  test("a weekday log is saved for today, once, and recorded", async () => {
    const { t, cto } = await setup();
    const logId = await cto.asUser.mutation(api.dailyLogs.save, {
      date: THU,
      done: "  Built the invite check.  ",
      next: "Tests for expired codes",
      blockers: "   ",
    });
    const [log] = await logsOf(t, cto.userId);
    expect(log._id).toBe(logId);
    expect(log).toMatchObject({ date: THU, isWeekend: false, done: "Built the invite check." });
    expect(log.next).toBe("Tests for expired codes");
    expect(log.blockers).toBeUndefined();
    expect(await activityActions(t)).toContain("dailyLog.written");
  });

  test("it can be edited until the day ends; an unchanged save records nothing", async () => {
    const { t, cto } = await setup();
    await cto.asUser.mutation(api.dailyLogs.save, { date: THU, done: "First draft." });
    const before = (await activityActions(t)).length;

    await cto.asUser.mutation(api.dailyLogs.save, { date: THU, done: "First draft." });
    expect((await activityActions(t)).length).toBe(before);

    setClock(`${THU}T23:30:00Z`);
    await cto.asUser.mutation(api.dailyLogs.save, {
      date: THU,
      done: "First draft, then a second.",
      blockers: "Waiting on design",
    });
    const logs = await logsOf(t, cto.userId);
    expect(logs).toHaveLength(1);
    expect(logs[0].done).toBe("First draft, then a second.");
    expect(logs[0].updatedAt).toBeDefined();
    const edit = await t.run(async (ctx) =>
      (await ctx.db.query("activity").collect()).find((a) => a.action === "dailyLog.edited")
    );
    expect(edit?.before).toEqual({ done: "First draft." });
    expect(edit?.after).toEqual({
      date: THU,
      done: "First draft, then a second.",
      blockers: "Waiting on design",
    });
  });

  test("once the day has ended the log is locked, and a future day can't be logged", async () => {
    const { cto } = await setup();
    await cto.asUser.mutation(api.dailyLogs.save, { date: THU, done: "Thursday's work." });
    setClock(`${FRI}T00:00:01Z`);
    await expectAppError(
      cto.asUser.mutation(api.dailyLogs.save, { date: THU, done: "Edited too late." }),
      "INVALID_ARGUMENT"
    );
    await expectAppError(
      cto.asUser.mutation(api.dailyLogs.save, { date: SAT, done: "Tomorrow's." }),
      "INVALID_ARGUMENT"
    );
    await expectAppError(
      cto.asUser.mutation(api.dailyLogs.save, { date: "2026-02-30", done: "Not a day." }),
      "INVALID_ARGUMENT"
    );
  });

  test("what you did is required and every part has a length limit", async () => {
    const { cto } = await setup();
    await expectAppError(
      cto.asUser.mutation(api.dailyLogs.save, { date: THU, done: "   " }),
      "INVALID_ARGUMENT"
    );
    await expectAppError(
      cto.asUser.mutation(api.dailyLogs.save, {
        date: THU,
        done: "x".repeat(DAILY_LOG_LIMITS.done + 1),
      }),
      "INVALID_ARGUMENT"
    );
    await expectAppError(
      cto.asUser.mutation(api.dailyLogs.save, {
        date: THU,
        done: "Fine.",
        blockers: "x".repeat(DAILY_LOG_LIMITS.blockers + 1),
      }),
      "INVALID_ARGUMENT"
    );
  });

  test("a weekend log is one line with no tasks", async () => {
    const { t, cto, coo, featureId } = await setup();
    const taskId = await createTask(coo.asUser, featureId, cto.userId);
    setClock(`${SAT}T15:00:00Z`);
    await expectAppError(
      cto.asUser.mutation(api.dailyLogs.save, { date: SAT, done: "Read docs.", next: "More" }),
      "INVALID_ARGUMENT"
    );
    await expectAppError(
      cto.asUser.mutation(api.dailyLogs.save, { date: SAT, done: "Read docs.", taskIds: [taskId] }),
      "INVALID_ARGUMENT"
    );
    await cto.asUser.mutation(api.dailyLogs.save, { date: SAT, done: "Read the\n  API docs." });
    const [log] = await logsOf(t, cto.userId);
    expect(log).toMatchObject({ isWeekend: true, done: "Read the API docs.", taskIds: [] });
  });

  test("only tasks you own or peer-review can be linked, each once", async () => {
    const { t, coo, ceo, cto, featureId } = await setup();
    const own = await createTask(coo.asUser, featureId, cto.userId);
    const reviewing = await createTask(coo.asUser, featureId, ceo.userId, cto.userId);
    const someoneElses = await createTask(coo.asUser, featureId, ceo.userId);
    const proposal = await cto.asUser.mutation(api.tasks.propose, {
      featureId,
      title: "An idea",
      description: "Maybe later.",
      kind: "other",
      acceptanceCriteria: [],
      priority: "low",
    });

    await expectAppError(
      cto.asUser.mutation(api.dailyLogs.save, {
        date: THU,
        done: "Work.",
        taskIds: [someoneElses],
      }),
      "INVALID_ARGUMENT"
    );
    await expectAppError(
      cto.asUser.mutation(api.dailyLogs.save, { date: THU, done: "Work.", taskIds: [proposal] }),
      "INVALID_ARGUMENT"
    );
    await cto.asUser.mutation(api.dailyLogs.save, {
      date: THU,
      done: "Work.",
      taskIds: [own, reviewing, own],
    });
    const [log] = await logsOf(t, cto.userId);
    expect(log.taskIds).toEqual([own, reviewing]);

    const linkable = await cto.asUser.query(api.dailyLogs.linkableTasks, {});
    expect(linkable.map((task) => task._id).sort()).toEqual([own, reviewing].sort());
  });

  test("signed-out and deactivated people can't write a log", async () => {
    const { t } = await setup();
    await expectAppError(
      t.mutation(api.dailyLogs.save, { date: THU, done: "Hi" }),
      "UNAUTHENTICATED"
    );
    const gone = await insertUser(t, {
      email: "gone@cadence.test",
      role: "member",
      isActive: false,
    });
    await expectAppError(
      gone.asUser.mutation(api.dailyLogs.save, { date: THU, done: "Hi" }),
      "ACCOUNT_INACTIVE"
    );
  });
});

describe("reading logs", () => {
  test("a day shows everyone who was on Cadence, with their log or a missed day", async () => {
    const { t, coo, ceo, cto } = await setup();
    await cto.asUser.mutation(api.dailyLogs.save, { date: THU, done: "Shipped the API." });
    const newcomer = await insertUser(t, { email: "new@cadence.test", role: "member" });

    const thursday = await coo.asUser.query(api.dailyLogs.day, { date: THU });
    expect(thursday.isWeekend).toBe(false);
    const byName = new Map(thursday.people.map((p) => [p.user._id, p]));
    expect(byName.get(cto.userId)?.log?.done).toBe("Shipped the API.");
    expect(byName.get(ceo.userId)?.log).toBeNull();
    expect(byName.get(ceo.userId)?.missed).toBe(false);
    // Joined today: listed today (they can log), not on earlier days.
    expect(byName.has(newcomer.userId)).toBe(true);
    const before = await coo.asUser.query(api.dailyLogs.day, { date: "2026-11-11" });
    expect(before.people.map((p) => p.user._id)).not.toContain(newcomer.userId);

    // After midnight Thursday is recorded as missed for those who didn't log.
    setClock(`${FRI}T00:10:00Z`);
    await t.mutation(internal.dailyLogs.recordMissed, {});
    const after = await coo.asUser.query(api.dailyLogs.day, { date: THU });
    expect(after.people.find((p) => p.user._id === ceo.userId)?.missed).toBe(true);
    expect(after.people.find((p) => p.user._id === cto.userId)?.missed).toBe(false);
  });

  test("a person's range has their logs and missed days, newest first", async () => {
    const { t, coo, cto } = await setup();
    setClock(`${FRI}T00:10:00Z`);
    await t.mutation(internal.dailyLogs.recordMissed, {}); // Thursday missed
    setClock(`${FRI}T12:00:00Z`);
    await cto.asUser.mutation(api.dailyLogs.save, { date: FRI, done: "Friday's work." });

    const range = await coo.asUser.query(api.dailyLogs.range, {
      userId: cto.userId,
      from: "2026-11-09",
      to: "2026-11-15",
    });
    expect(range?.joined).toBe("2026-11-01");
    expect(range?.logs.map((l) => l.date)).toEqual([FRI]);
    expect(range?.missed).toEqual([THU]);

    expect(
      await coo.asUser.query(api.dailyLogs.range, { userId: "nope", from: THU, to: FRI })
    ).toBeNull();
    await expectAppError(
      coo.asUser.query(api.dailyLogs.range, { userId: cto.userId, from: FRI, to: THU }),
      "INVALID_ARGUMENT"
    );
    await expectAppError(
      coo.asUser.query(api.dailyLogs.range, {
        userId: cto.userId,
        from: "2026-08-01",
        to: "2026-11-15",
      }),
      "INVALID_ARGUMENT"
    );
  });
});

describe("missed weekdays", () => {
  test("recorded once for active people who didn't log, never at the weekend", async () => {
    const { t, coo, ceo, cto } = await setup();
    await cto.asUser.mutation(api.dailyLogs.save, { date: THU, done: "Logged." });
    const gone = await insertUser(t, { email: "gone@cadence.test", role: "member" });
    await t.run(async (ctx) => ctx.db.patch("users", gone.userId, { isActive: false }));
    const joinedToday = await insertUser(t, { email: "new@cadence.test", role: "member" });

    setClock(`${FRI}T00:10:00Z`);
    expect(await t.mutation(internal.dailyLogs.recordMissed, {})).toBe(2); // the COO and CEO
    expect(await t.mutation(internal.dailyLogs.recordMissed, {})).toBe(0); // already recorded
    const missed = await t.run(async (ctx) => ctx.db.query("missedDays").collect());
    expect(missed.map((m) => m.userId).sort()).toEqual([coo.userId, ceo.userId].sort());
    expect(missed.every((m) => m.date === THU)).toBe(true);
    // Their first day never counts, and nor does a deactivated person's.
    expect(missed.some((m) => m.userId === joinedToday.userId)).toBe(false);
    expect(missed.some((m) => m.userId === gone.userId)).toBe(false);

    // The entry names who it's about, though Cadence recorded it.
    const feed = await ceo.asUser.query(api.activity.feed, {
      paginationOpts: { numItems: 20, cursor: null },
    });
    const entry = feed.page.find(
      (a) => a.action === "dailyLog.missed" && a.person?._id === ceo.userId
    );
    expect(entry?.actor).toBeNull();

    // A missed day can't be logged afterwards.
    setClock(`${FRI}T08:00:00Z`);
    await expectAppError(
      ceo.asUser.mutation(api.dailyLogs.save, { date: THU, done: "Late." }),
      "INVALID_ARGUMENT"
    );

    // Saturday and Sunday are never missed: Monday's and Sunday's runs record nothing.
    // Friday ended, a weekday: nobody logged it, including the one who joined on Thursday.
    setClock(`${SAT}T00:10:00Z`);
    expect(await t.mutation(internal.dailyLogs.recordMissed, {})).toBe(4);
    setClock("2026-11-15T00:10:00Z"); // Saturday ended
    expect(await t.mutation(internal.dailyLogs.recordMissed, {})).toBe(0);
    setClock(`${MON}T00:10:00Z`); // Sunday ended
    expect(await t.mutation(internal.dailyLogs.recordMissed, {})).toBe(0);
  });
});
