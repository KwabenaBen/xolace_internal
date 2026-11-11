import { beforeAll, describe, expect, test } from "vitest";

import { api, internal } from "../_generated/api";
import { INVITE_REJECTED_MESSAGE } from "../lib/constants";
import { formatInviteCode } from "../lib/inviteCodes";
import {
  createTestConvex,
  expectAppError,
  insertUser,
  inviteCodeFor,
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

    await expectAppError(
      signUp(t, { email: "cmo@cadence.test", password: "a-different-password" }),
      "NOT_INVITED"
    );
    const users = await t.run(async (ctx) => ctx.db.query("users").collect());
    expect(users).toHaveLength(1);
  });

  test("sign-up never checks an existing account's password (no guessing, no sign-in)", async () => {
    const t = createTestConvex();
    await seedInvites(t, [{ email: "coo@cadence.test", title: "COO", role: "admin" }]);
    await signUp(t, { email: "coo@cadence.test" });
    const sessionsBefore = await t.run(async (ctx) => ctx.db.query("authSessions").collect());

    // The right password, a junk code: refused like any other sign-up, and no session.
    await expectAppError(
      signUp(t, { email: "COO@cadence.test ", inviteCode: "JUNK-CODE" }),
      "NOT_INVITED"
    );
    // A wrong one reads exactly the same, so sign-up doesn't reveal who has an account.
    const wrong = await expectAppError(
      signUp(t, { email: "coo@cadence.test", password: "guess-number-one", inviteCode: "JUNK" }),
      "NOT_INVITED"
    );
    const stranger = await expectAppError(
      signUp(t, { email: "nobody@cadence.test" }),
      "NOT_INVITED"
    );
    expect(wrong?.message).toBe(stranger?.message);
    const sessionsAfter = await t.run(async (ctx) => ctx.db.query("authSessions").collect());
    expect(sessionsAfter).toHaveLength(sessionsBefore.length);
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

describe("invite codes", () => {
  const coo = { email: "coo@cadence.test", title: "COO", role: "admin" as const };

  test("the seed gives each new invite a code and returns it", async () => {
    const t = createTestConvex();
    const result = await seedInvites(t, [coo]);
    expect(result.invitesCreated).toHaveLength(1);
    expect(result.invitesCreated[0].code).toMatch(/^[A-Z2-9]{8}$/);
    expect(await inviteCodeFor(t, coo.email)).toBe(result.invitesCreated[0].code);
  });

  test("a wrong code is refused with the same message as an email with no invite", async () => {
    const t = createTestConvex();
    await seedInvites(t, [coo]);

    const wrongCode = await expectAppError(
      signUp(t, { email: coo.email, inviteCode: "ABCD-EFGH" }),
      "NOT_INVITED"
    );
    const noInvite = await expectAppError(
      signUp(t, { email: "stranger@example.com" }),
      "NOT_INVITED"
    );
    expect(wrongCode?.message).toBe(INVITE_REJECTED_MESSAGE);
    expect(noInvite?.message).toBe(INVITE_REJECTED_MESSAGE);
    expect(await t.run(async (ctx) => ctx.db.query("users").collect())).toHaveLength(0);
  });

  test("sign-up asks for a code before anything else is checked", async () => {
    const t = createTestConvex();
    await seedInvites(t, [coo]);
    await expectAppError(signUp(t, { email: coo.email, inviteCode: "  " }), "INVALID_ARGUMENT");
  });

  test("typing is forgiving: case, spaces and the dash don't matter", async () => {
    const t = createTestConvex();
    await seedInvites(t, [coo]);
    const code = (await inviteCodeFor(t, coo.email))!;

    const typed = ` ${formatInviteCode(code).toLowerCase()} `;
    const result = await signUp(t, { email: coo.email, inviteCode: typed });
    expect(result.tokens).toBeTruthy();
  });

  test("an expired invite is refused, and the code is cleared once used", async () => {
    const t = createTestConvex();
    await seedInvites(t, [coo, { email: "cto@cadence.test", title: "CTO", role: "member" }]);
    await t.run(async (ctx) => {
      const invite = await ctx.db
        .query("invites")
        .withIndex("by_email", (q) => q.eq("email", "cto@cadence.test"))
        .unique();
      await ctx.db.patch("invites", invite!._id, { expiresAt: Date.now() - 1 });
    });

    await expectAppError(signUp(t, { email: "cto@cadence.test" }), "NOT_INVITED");
    await signUp(t, { email: coo.email });
    const used = await t.run(async (ctx) =>
      ctx.db
        .query("invites")
        .withIndex("by_email", (q) => q.eq("email", coo.email))
        .unique()
    );
    expect(used?.usedAt).toBeTypeOf("number");
    expect(used?.code).toBeUndefined();
  });

  test("an invite from before codes needs a new one from the CLI", async () => {
    const t = createTestConvex();
    await t.run(async (ctx) =>
      ctx.db.insert("invites", { email: coo.email, title: "COO", role: "admin" })
    );
    await expectAppError(signUp(t, { email: coo.email }), "NOT_INVITED");

    const issued = await t.mutation(internal.invites.newCode, { email: coo.email });
    const result = await signUp(t, { email: coo.email, inviteCode: issued.code });
    expect(result.tokens).toBeTruthy();
  });

  test("an admin can renew a code (the old one stops working); members can't", async () => {
    const t = createTestConvex();
    const admin = await insertUser(t, { email: "admin@cadence.test", role: "admin" });
    const member = await insertUser(t, { email: "member@cadence.test", role: "member" });
    await seedInvites(t, [{ email: "cto@cadence.test", title: "CTO", role: "member" }]);
    const oldCode = (await inviteCodeFor(t, "cto@cadence.test"))!;
    const invite = (await admin.asUser.query(api.invites.list, {})).find(
      (i) => i.email === "cto@cadence.test"
    )!;

    await expectAppError(
      member.asUser.mutation(api.invites.renew, { inviteId: invite._id }),
      "FORBIDDEN"
    );
    await admin.asUser.mutation(api.invites.renew, { inviteId: invite._id });
    const newCode = await inviteCodeFor(t, "cto@cadence.test");
    expect(newCode).not.toBe(oldCode);

    await expectAppError(
      signUp(t, { email: "cto@cadence.test", inviteCode: oldCode }),
      "NOT_INVITED"
    );
    expect((await signUp(t, { email: "cto@cadence.test" })).tokens).toBeTruthy();
  });

  test("a revoked invite can't be used", async () => {
    const t = createTestConvex();
    const admin = await insertUser(t, { email: "admin@cadence.test", role: "admin" });
    await seedInvites(t, [{ email: "cto@cadence.test", title: "CTO", role: "member" }]);
    const code = (await inviteCodeFor(t, "cto@cadence.test"))!;
    const invite = (await admin.asUser.query(api.invites.list, {}))[0];

    await admin.asUser.mutation(api.invites.revoke, { inviteId: invite._id });
    await expectAppError(signUp(t, { email: "cto@cadence.test", inviteCode: code }), "NOT_INVITED");
  });
});
