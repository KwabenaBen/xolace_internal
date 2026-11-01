import { describe, expect, test } from "vitest";

import { api } from "../_generated/api";
import { createTestConvex, expectAppError, insertUser } from "../test.setup";

describe("role checks run on the server", () => {
  test("members can read but every admin-only function throws FORBIDDEN", async () => {
    const t = createTestConvex();
    const { userId: adminId } = await insertUser(t, { email: "coo@cadence.test", role: "admin" });
    const { asUser: asMember } = await insertUser(t, { email: "cto@cadence.test", role: "member" });

    expect(await asMember.query(api.users.list, {})).toHaveLength(2);
    expect(await asMember.query(api.settings.list, {})).not.toHaveLength(0);

    await expectAppError(asMember.query(api.invites.list, {}), "FORBIDDEN");
    await expectAppError(
      asMember.mutation(api.invites.create, {
        email: "new@cadence.test",
        role: "member",
        title: "Designer",
      }),
      "FORBIDDEN"
    );
    await expectAppError(
      asMember.mutation(api.users.setActive, { userId: adminId, isActive: false }),
      "FORBIDDEN"
    );
    await expectAppError(
      asMember.mutation(api.users.setRole, { userId: adminId, role: "member" }),
      "FORBIDDEN"
    );
    await expectAppError(
      asMember.mutation(api.settings.set, { key: "morningDigestTime", value: "09:00" }),
      "FORBIDDEN"
    );
  });

  test("admins can use admin-only functions, and there can be more than one admin", async () => {
    const t = createTestConvex();
    const { asUser: asAdmin } = await insertUser(t, { email: "coo@cadence.test", role: "admin" });
    const { userId: memberId, asUser: asMember } = await insertUser(t, {
      email: "ceo@cadence.test",
      role: "member",
    });

    await asAdmin.mutation(api.invites.create, {
      email: "New.Person@Cadence.test ",
      role: "member",
      title: "Designer",
    });
    const invites = await asAdmin.query(api.invites.list, {});
    expect(invites[0]).toMatchObject({ email: "new.person@cadence.test", title: "Designer" });

    await asAdmin.mutation(api.users.setRole, { userId: memberId, role: "admin" });
    // The promoted user can now call admin-only functions.
    expect(await asMember.query(api.invites.list, {})).toHaveLength(1);

    await asAdmin.mutation(api.settings.set, { key: "morningDigestTime", value: "07:30" });
    const settings = await asMember.query(api.settings.list, {});
    expect(settings.find((s) => s.key === "morningDigestTime")?.value).toBe("07:30");
  });

  test("signed-out callers are rejected; users.me returns null", async () => {
    const t = createTestConvex();
    expect(await t.query(api.users.me, {})).toBeNull();
    await expectAppError(t.query(api.users.list, {}), "UNAUTHENTICATED");
    await expectAppError(t.query(api.settings.list, {}), "UNAUTHENTICATED");
  });

  test("deactivated users are rejected everywhere, and admin rights don't survive deactivation", async () => {
    const t = createTestConvex();
    await insertUser(t, { email: "coo@cadence.test", role: "admin" });
    const { asUser: asInactiveAdmin } = await insertUser(t, {
      email: "old-admin@cadence.test",
      role: "admin",
      isActive: false,
    });

    expect(await asInactiveAdmin.query(api.users.me, {})).toMatchObject({ isActive: false });
    await expectAppError(asInactiveAdmin.query(api.users.list, {}), "ACCOUNT_INACTIVE");
    await expectAppError(asInactiveAdmin.query(api.invites.list, {}), "ACCOUNT_INACTIVE");
  });
});

describe("admin safeguards", () => {
  test("the last active admin can't be deactivated or demoted", async () => {
    const t = createTestConvex();
    const { userId: adminId, asUser: asAdmin } = await insertUser(t, {
      email: "coo@cadence.test",
      role: "admin",
    });

    await expectAppError(
      asAdmin.mutation(api.users.setActive, { userId: adminId, isActive: false }),
      "INVALID_ARGUMENT"
    );
    await expectAppError(
      asAdmin.mutation(api.users.setRole, { userId: adminId, role: "member" }),
      "INVALID_ARGUMENT"
    );
  });

  test("invites can't duplicate an existing user or a pending invite", async () => {
    const t = createTestConvex();
    const { asUser: asAdmin } = await insertUser(t, { email: "coo@cadence.test", role: "admin" });

    await expectAppError(
      asAdmin.mutation(api.invites.create, {
        email: "COO@cadence.test",
        role: "member",
        title: "X",
      }),
      "CONFLICT"
    );
    await asAdmin.mutation(api.invites.create, {
      email: "cmo@cadence.test",
      role: "member",
      title: "CMO",
    });
    await expectAppError(
      asAdmin.mutation(api.invites.create, {
        email: "cmo@cadence.test",
        role: "member",
        title: "CMO",
      }),
      "CONFLICT"
    );
  });

  test("settings reject invalid values", async () => {
    const t = createTestConvex();
    const { asUser: asAdmin } = await insertUser(t, { email: "coo@cadence.test", role: "admin" });

    await expectAppError(
      asAdmin.mutation(api.settings.set, { key: "morningDigestTime", value: "8am" }),
      "INVALID_ARGUMENT"
    );
    await expectAppError(
      asAdmin.mutation(api.settings.set, { key: "extensionLateWindowHours", value: -1 }),
      "INVALID_ARGUMENT"
    );
  });
});
