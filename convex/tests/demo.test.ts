import { describe, expect, test } from "vitest";

import { api, internal } from "../_generated/api";
import { createTestConvex, insertUser } from "../test.setup";

describe("demo data", () => {
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
});
