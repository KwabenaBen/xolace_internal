import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { api, internal } from "../_generated/api";
import { createTestConvex, expectAppError, insertUser } from "../test.setup";

describe("demo data", () => {
  // Demo commands only run on a deployment with CADENCE_DEMO=on (dev only).
  beforeEach(() => {
    process.env.CADENCE_DEMO = "on";
  });
  afterEach(() => {
    delete process.env.CADENCE_DEMO;
  });

  test("seed fills the board and gives real users some tasks; clear removes all of it", async () => {
    const t = createTestConvex();
    const real = await insertUser(t, { email: "real@cadence.test", role: "admin", title: "CMO" });

    await t.mutation(internal.demo.seed, {});
    // Seeding twice doesn't duplicate.
    expect(await t.mutation(internal.demo.seed, {})).toContain("already there");

    const board = await real.asUser.query(api.tasks.board, {});
    expect(board.map((g) => g.feature.title)).toEqual([
      "Demo: Investor update deck",
      "Demo: Onboarding flow",
      "Demo: Partner payments",
    ]);
    expect(board.flatMap((g) => g.tasks)).toHaveLength(10);
    const mine = await real.asUser.query(api.tasks.mine, {});
    expect(mine.owned.length).toBeGreaterThan(0);
    expect(mine.proposals).toHaveLength(1);
    // The demo people have a week of logs (and missed days); the real user has none.
    const records = await t.run(async (ctx) => ({
      logs: await ctx.db.query("dailyLogs").collect(),
      missed: await ctx.db.query("missedDays").collect(),
    }));
    expect(records.logs.length).toBeGreaterThan(0);
    expect(records.missed.length).toBeGreaterThan(0);
    expect(records.logs.some((log) => log.userId === real.userId)).toBe(false);
    // Demo data from before logs existed: seeding again adds just the logs.
    await t.run(async (ctx) => {
      for (const log of await ctx.db.query("dailyLogs").collect()) {
        await ctx.db.delete("dailyLogs", log._id);
      }
    });
    expect(await t.mutation(internal.demo.seed, {})).toContain(
      `added ${records.logs.length} daily logs`
    );

    await t.mutation(internal.demo.clear, {});
    expect(await real.asUser.query(api.tasks.board, {})).toHaveLength(0);
    const users = await t.run(async (ctx) => ctx.db.query("users").collect());
    expect(users.map((u) => u.email)).toEqual(["real@cadence.test"]);
    const left = await t.run(async (ctx) => ({
      logs: await ctx.db.query("dailyLogs").collect(),
      missed: await ctx.db.query("missedDays").collect(),
    }));
    expect(left).toEqual({ logs: [], missed: [] });
  });

  test("clear won't leave the app without a real admin, or real work pointing at nobody", async () => {
    const t = createTestConvex();
    const member = await insertUser(t, { email: "real@cadence.test", role: "member" });
    await t.mutation(internal.demo.seed, {});
    // The only admin left would be a demo person, about to be deleted.
    await expectAppError(t.mutation(internal.demo.clear, {}), "INVALID_ARGUMENT");

    const admin = await insertUser(t, { email: "coo@cadence.test", role: "admin" });
    // A real feature with a task owned by a demo person.
    const featureId = await admin.asUser.mutation(api.features.create, {
      title: "Real work",
      description: "x",
      expectedResult: "x",
      sourceNote: "",
      deadline: "2099-01-01",
    });
    const demoPerson = await t.run(async (ctx) =>
      (await ctx.db.query("users").collect()).find((u) => u.email.endsWith("@demo.cadence.test"))
    );
    await t.run(async (ctx) =>
      ctx.db.insert("tasks", {
        featureId,
        title: "Owned by a demo person",
        description: "",
        kind: "other",
        acceptanceCriteria: ["x"],
        ownerId: demoPerson!._id,
        deadline: Date.parse("2098-12-31T23:59:59.999Z"),
        priority: "low",
        status: "todo",
        progress: 0,
        countsAsLate: false,
      })
    );
    const refused = await expectAppError(t.mutation(internal.demo.clear, {}), "INVALID_ARGUMENT");
    expect(refused?.message).toContain("Owned by a demo person");
    expect(member.userId).toBeDefined();
  });

  test("every command refuses to run without CADENCE_DEMO=on (e.g. on production)", async () => {
    const t = createTestConvex();
    await insertUser(t, { email: "real@cadence.test", role: "member" });
    delete process.env.CADENCE_DEMO;
    await expectAppError(t.mutation(internal.demo.seed, {}), "FORBIDDEN");
    await expectAppError(t.mutation(internal.demo.clear, {}), "FORBIDDEN");
    await expectAppError(
      t.mutation(internal.demo.setRole, { email: "real@cadence.test", role: "admin" }),
      "FORBIDDEN"
    );
  });

  test("setRole switches an account between member and admin, and logs it", async () => {
    const t = createTestConvex();
    const me = await insertUser(t, { email: "me@cadence.test", role: "member", title: "CMO" });

    const reply = await t.mutation(internal.demo.setRole, {
      email: " Me@Cadence.test ",
      role: "admin",
    });
    expect(reply).toContain("now an admin");
    expect((await me.asUser.query(api.users.me, {}))?.role).toBe("admin");
    // As an admin they can now use admin-only functions, e.g. read the invites.
    await me.asUser.query(api.invites.list, {});

    expect(
      await t.mutation(internal.demo.setRole, { email: "me@cadence.test", role: "member" })
    ).toContain("Nobody is an active admin now.");
    expect((await me.asUser.query(api.users.me, {}))?.role).toBe("member");
    const log = await t.run(async (ctx) => ctx.db.query("activity").collect());
    expect(log.filter((e) => e.action === "user.role_changed")).toHaveLength(2);

    await expectAppError(
      t.mutation(internal.demo.setRole, { email: "nobody@cadence.test", role: "admin" }),
      "NOT_FOUND"
    );
  });

  test('clear spares a real feature named "Demo: …" and never deletes activity', async () => {
    const t = createTestConvex();
    const admin = await insertUser(t, { email: "admin@cadence.test", role: "admin" });
    await t.mutation(internal.demo.seed, {});
    const realId = await admin.asUser.mutation(api.features.create, {
      title: "Demo: the investor demo day",
      description: "A real feature that happens to start with Demo:",
      expectedResult: "Demo day done.",
      sourceNote: "",
      deadline: "2099-01-31",
    });
    const activityBefore = await t.run(async (ctx) => ctx.db.query("activity").collect());

    await t.mutation(internal.demo.clear, {});

    const left = await t.run(async (ctx) => ({
      real: await ctx.db.get("features", realId),
      activity: await ctx.db.query("activity").collect(),
    }));
    expect(left.real?.title).toBe("Demo: the investor demo day");
    expect(left.activity).toHaveLength(activityBefore.length);
  });
});
