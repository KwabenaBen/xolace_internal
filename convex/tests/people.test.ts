import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";

import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import {
  createTestConvex,
  expectAppError,
  insertUser,
  setupAuthEnv,
  signUp,
  type TestConvex,
} from "../test.setup";

/** People, invites and team rules: the Phase 3 audit's missing cases. */

beforeAll(async () => {
  await setupAuthEnv();
});

afterEach(() => {
  vi.useRealTimers();
});

async function giveSessions(t: TestConvex, userId: Id<"users">, count: number, tokens = 2) {
  await t.run(async (ctx) => {
    for (let i = 0; i < count; i++) {
      const sessionId = await ctx.db.insert("authSessions", {
        userId,
        expirationTime: Date.now() + 86_400_000,
      });
      for (let j = 0; j < tokens; j++) {
        await ctx.db.insert("authRefreshTokens", {
          sessionId,
          expirationTime: Date.now() + 86_400_000,
        });
      }
    }
  });
}

async function countSessions(t: TestConvex, userId: Id<"users">) {
  return await t.run(async (ctx) => {
    const sessions = await ctx.db
      .query("authSessions")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .collect();
    const tokens = await ctx.db.query("authRefreshTokens").collect();
    return { sessions: sessions.length, tokens: tokens.length };
  });
}

describe("deactivating someone signs them out everywhere", () => {
  test("every session and refresh token goes, however many there are", async () => {
    vi.useFakeTimers();
    const t = createTestConvex();
    const { asUser: asAdmin } = await insertUser(t, { email: "coo@cadence.test", role: "admin" });
    const { userId } = await insertUser(t, { email: "cto@cadence.test", role: "member" });
    // More than one batch of sessions, one with more than one batch of tokens.
    await giveSessions(t, userId, 60);
    await giveSessions(t, userId, 1, 250);

    await asAdmin.mutation(api.users.setActive, { userId, isActive: false });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await countSessions(t, userId)).toEqual({ sessions: 0, tokens: 0 });
  });

  test("the newest sessions end straight away; a reactivated person's new ones are kept", async () => {
    vi.useFakeTimers();
    const t = createTestConvex();
    const { asUser: asAdmin } = await insertUser(t, { email: "coo@cadence.test", role: "admin" });
    const { userId } = await insertUser(t, { email: "cto@cadence.test", role: "member" });
    await giveSessions(t, userId, 30, 1);
    const newest = await t.run(async (ctx) =>
      ctx.db.insert("authSessions", { userId, expirationTime: Date.now() + 86_400_000 })
    );

    await asAdmin.mutation(api.users.setActive, { userId, isActive: false });
    // Before any follow-up runs, the newest (in-use) session is already gone.
    expect(await t.run(async (ctx) => ctx.db.get("authSessions", newest))).toBeNull();

    await asAdmin.mutation(api.users.setActive, { userId, isActive: true });
    vi.setSystemTime(Date.now() + 60_000); // they sign in again a minute later
    await giveSessions(t, userId, 1, 1);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect((await countSessions(t, userId)).sessions).toBe(1);
  });
});

describe("people and invites", () => {
  test("nobody deactivates themselves, even with another admin; members can't manage people", async () => {
    const t = createTestConvex();
    const { userId: cooId, asUser: asCoo } = await insertUser(t, {
      email: "coo@cadence.test",
      role: "admin",
    });
    await insertUser(t, { email: "cmo@cadence.test", role: "admin" });
    const { asUser: asMember } = await insertUser(t, { email: "cto@cadence.test", role: "member" });
    await expectAppError(
      asCoo.mutation(api.users.setActive, { userId: cooId, isActive: false }),
      "INVALID_ARGUMENT"
    );

    const inviteId = await asCoo.mutation(api.invites.create, {
      email: "designer@cadence.test",
      role: "member",
      title: "Designer",
    });
    await expectAppError(asMember.mutation(api.invites.revoke, { inviteId }), "FORBIDDEN");
    await expectAppError(asMember.mutation(api.invites.renew, { inviteId }), "FORBIDDEN");
  });

  test("a used invite can't be renewed or revoked", async () => {
    const t = createTestConvex();
    const { asUser: asAdmin } = await insertUser(t, { email: "coo@cadence.test", role: "admin" });
    const inviteId = await asAdmin.mutation(api.invites.create, {
      email: "designer@cadence.test",
      role: "member",
      title: "Designer",
    });
    await signUp(t, { email: "designer@cadence.test" });
    await expectAppError(asAdmin.mutation(api.invites.renew, { inviteId }), "INVALID_ARGUMENT");
    await expectAppError(asAdmin.mutation(api.invites.revoke, { inviteId }), "INVALID_ARGUMENT");
  });

  test("invites, roles and deactivations are logged, never with the code", async () => {
    const t = createTestConvex();
    const { asUser: asAdmin } = await insertUser(t, { email: "coo@cadence.test", role: "admin" });
    const { userId } = await insertUser(t, { email: "cto@cadence.test", role: "member" });
    const inviteId = await asAdmin.mutation(api.invites.create, {
      email: "designer@cadence.test",
      role: "member",
      title: "Designer",
    });
    await asAdmin.mutation(api.invites.revoke, { inviteId });
    await asAdmin.mutation(api.users.setRole, { userId, role: "admin" });
    await asAdmin.mutation(api.users.setActive, { userId, isActive: false });

    const log = await t.run(async (ctx) => ctx.db.query("activity").collect());
    expect(log.map((e) => e.action)).toEqual([
      "invite.created",
      "invite.revoked",
      "user.role_changed",
      "user.deactivated",
    ]);
    expect(JSON.stringify(log)).not.toMatch(/"code"/);
  });
});

describe("team rules", () => {
  test("the team time zone can't be changed from the app", async () => {
    const t = createTestConvex();
    const { asUser: asAdmin } = await insertUser(t, { email: "coo@cadence.test", role: "admin" });
    await expectAppError(
      asAdmin.mutation(api.settings.set, { key: "timeZone", value: "Mars/Phobos" }),
      "INVALID_ARGUMENT"
    );
  });

  test("when someone named before they joined signs up, the link is logged", async () => {
    const t = createTestConvex();
    const { asUser: asAdmin } = await insertUser(t, { email: "coo@cadence.test", role: "admin" });
    await asAdmin.mutation(api.invites.create, {
      email: "ceo@cadence.test",
      role: "member",
      title: "CEO",
    });
    await t.run(async (ctx) =>
      ctx.db.insert("settings", {
        key: "adminTaskReviewer",
        value: { email: "ceo@cadence.test" },
        updatedAt: Date.now(),
      })
    );
    await signUp(t, { email: "ceo@cadence.test" });
    const linked = await t.run(async (ctx) =>
      ctx.db
        .query("activity")
        .withIndex("by_entityType_and_entityId", (q) =>
          q.eq("entityType", "setting").eq("entityId", "adminTaskReviewer")
        )
        .collect()
    );
    expect(linked).toHaveLength(1);
    expect(linked[0]).toMatchObject({
      action: "setting.updated",
      before: { email: "ceo@cadence.test" },
    });
    expect(linked[0].after).toHaveProperty("userId");
  });
});
