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
    const real = await insertUser(t, { email: "real@cadence.test", role: "member", title: "CMO" });

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

    await t.mutation(internal.demo.clear, {});
    expect(await real.asUser.query(api.tasks.board, {})).toHaveLength(0);
    const users = await t.run(async (ctx) => ctx.db.query("users").collect());
    expect(users.map((u) => u.email)).toEqual(["real@cadence.test"]);
  });

  test("both commands refuse to run without CADENCE_DEMO=on (e.g. on production)", async () => {
    const t = createTestConvex();
    delete process.env.CADENCE_DEMO;
    await expectAppError(t.mutation(internal.demo.seed, {}), "FORBIDDEN");
    await expectAppError(t.mutation(internal.demo.clear, {}), "FORBIDDEN");
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
