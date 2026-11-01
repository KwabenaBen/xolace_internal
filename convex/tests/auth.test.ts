import { beforeAll, describe, expect, test } from "vitest";

import { api, internal } from "../_generated/api";
import {
  createTestConvex,
  expectAppError,
  setupAuthEnv,
  signIn,
  signUp,
  type TestConvex,
} from "../test.setup";

beforeAll(setupAuthEnv);

async function seedInvites(
  t: TestConvex,
  invites: { email: string; title: string; role: "admin" | "member" }[],
  adminTaskReviewerEmail?: string
) {
  return await t.mutation(internal.seed.run, { invites, adminTaskReviewerEmail });
}

describe("invite-only sign-up", () => {
  test("an invited email can sign up and gets the invite's role and title", async () => {
    const t = createTestConvex();
    await seedInvites(t, [{ email: "coo@cadence.test", title: "COO", role: "admin" }]);

    const result = await signUp(t, { email: "coo@cadence.test", name: "Ama Mensah" });
    expect(result.tokens).toBeTruthy();

    const { users, invites, activity } = await t.run(async (ctx) => ({
      users: await ctx.db.query("users").collect(),
      invites: await ctx.db.query("invites").collect(),
      activity: await ctx.db.query("activity").collect(),
    }));
    expect(users).toHaveLength(1);
    expect(users[0]).toMatchObject({
      name: "Ama Mensah",
      email: "coo@cadence.test",
      title: "COO",
      role: "admin",
      isActive: true,
      timezone: "Africa/Accra",
    });
    expect(invites[0].usedAt).toBeTypeOf("number");
    expect(invites[0].usedBy).toBe(users[0]._id);
    expect(activity.map((a) => a.action)).toContain("user.signed_up");
  });

  test("email matching ignores case and surrounding spaces", async () => {
    const t = createTestConvex();
    await seedInvites(t, [{ email: "CTO@Cadence.test", title: "CTO", role: "member" }]);

    const result = await signUp(t, { email: "  cto@CADENCE.test " });
    expect(result.tokens).toBeTruthy();
    const user = await t.run(async (ctx) => ctx.db.query("users").first());
    expect(user?.email).toBe("cto@cadence.test");
    expect(user?.role).toBe("member");
  });

  test("a non-invited email is rejected and nothing is created", async () => {
    const t = createTestConvex();
    await seedInvites(t, [{ email: "coo@cadence.test", title: "COO", role: "admin" }]);

    await expectAppError(signUp(t, { email: "stranger@example.com" }), "NOT_INVITED");

    const { users, accounts } = await t.run(async (ctx) => ({
      users: await ctx.db.query("users").collect(),
      accounts: await ctx.db.query("authAccounts").collect(),
    }));
    expect(users).toHaveLength(0);
    expect(accounts).toHaveLength(0);
  });

  test("a used invite does not let the same email create a second account", async () => {
    const t = createTestConvex();
    await seedInvites(t, [{ email: "cmo@cadence.test", title: "CMO/CDO", role: "member" }]);
    await signUp(t, { email: "cmo@cadence.test" });

    await expect(
      signUp(t, { email: "cmo@cadence.test", password: "a-different-password" })
    ).rejects.toThrow();
    const users = await t.run(async (ctx) => ctx.db.query("users").collect());
    expect(users).toHaveLength(1);
  });

  test("sign-up requires a name and an 8+ character password", async () => {
    const t = createTestConvex();
    await seedInvites(t, [{ email: "ceo@cadence.test", title: "CEO", role: "member" }]);

    await expectAppError(signUp(t, { email: "ceo@cadence.test", name: "  " }), "INVALID_ARGUMENT");
    await expectAppError(
      signUp(t, { email: "ceo@cadence.test", password: "short" }),
      "INVALID_ARGUMENT"
    );
  });

  test("the admin task reviewer setting links to the reviewer's user when they sign up", async () => {
    const t = createTestConvex();
    await seedInvites(
      t,
      [
        { email: "coo@cadence.test", title: "COO", role: "admin" },
        { email: "ceo@cadence.test", title: "CEO", role: "member" },
      ],
      "ceo@cadence.test"
    );

    const before = await t.run(async (ctx) =>
      ctx.db
        .query("settings")
        .withIndex("by_key", (q) => q.eq("key", "adminTaskReviewer"))
        .unique()
    );
    expect(before?.value).toEqual({ email: "ceo@cadence.test" });

    await signUp(t, { email: "ceo@cadence.test" });

    const { setting, ceo } = await t.run(async (ctx) => ({
      setting: await ctx.db
        .query("settings")
        .withIndex("by_key", (q) => q.eq("key", "adminTaskReviewer"))
        .unique(),
      ceo: await ctx.db
        .query("users")
        .withIndex("email", (q) => q.eq("email", "ceo@cadence.test"))
        .unique(),
    }));
    expect(setting?.value).toEqual({ email: "ceo@cadence.test", userId: ceo?._id });
  });
});

describe("sign-in", () => {
  test("an active user can sign in", async () => {
    const t = createTestConvex();
    await seedInvites(t, [{ email: "coo@cadence.test", title: "COO", role: "admin" }]);
    await signUp(t, { email: "coo@cadence.test" });

    const result = await signIn(t, { email: "COO@cadence.test" });
    expect(result.tokens).toBeTruthy();
  });

  test("a deactivated user cannot sign in, and deactivation ends their sessions", async () => {
    const t = createTestConvex();
    await seedInvites(t, [
      { email: "coo@cadence.test", title: "COO", role: "admin" },
      { email: "cto@cadence.test", title: "CTO", role: "member" },
    ]);
    await signUp(t, { email: "coo@cadence.test" });
    await signUp(t, { email: "cto@cadence.test" });

    const { cooId, ctoId } = await t.run(async (ctx) => {
      const users = await ctx.db.query("users").collect();
      return {
        cooId: users.find((u) => u.role === "admin")!._id,
        ctoId: users.find((u) => u.role === "member")!._id,
      };
    });
    const asCoo = t.withIdentity({ subject: `${cooId}|test-session` });
    await asCoo.mutation(api.users.setActive, { userId: ctoId, isActive: false });

    const ctoSessions = await t.run(async (ctx) =>
      ctx.db
        .query("authSessions")
        .withIndex("userId", (q) => q.eq("userId", ctoId))
        .collect()
    );
    expect(ctoSessions).toHaveLength(0);

    await expectAppError(signIn(t, { email: "cto@cadence.test" }), "ACCOUNT_INACTIVE");
  });

  test("a wrong password is rejected", async () => {
    const t = createTestConvex();
    await seedInvites(t, [{ email: "coo@cadence.test", title: "COO", role: "admin" }]);
    await signUp(t, { email: "coo@cadence.test" });

    await expect(
      signIn(t, { email: "coo@cadence.test", password: "wrong-password" })
    ).rejects.toThrow();
  });
});
