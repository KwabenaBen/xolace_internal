import { describe, expect, test } from "vitest";

import { api } from "../_generated/api";
import { createTestConvex, expectAppError, insertUser, type TestConvex } from "../test.setup";

async function settingLog(t: TestConvex, key: string) {
  return await t.run(async (ctx) =>
    ctx.db
      .query("activity")
      .withIndex("by_entityType_and_entityId", (q) =>
        q.eq("entityType", "setting").eq("entityId", key)
      )
      .take(20)
  );
}

describe("team rules (settings)", () => {
  test("saving the value that's already there writes and logs nothing", async () => {
    const t = createTestConvex();
    const { asUser: asAdmin } = await insertUser(t, { email: "coo@cadence.test", role: "admin" });

    await asAdmin.mutation(api.settings.set, { key: "morningDigestTime", value: "07:30" });
    await asAdmin.mutation(api.settings.set, { key: "morningDigestTime", value: "07:30" });
    expect(await settingLog(t, "morningDigestTime")).toHaveLength(1);

    await asAdmin.mutation(api.settings.set, { key: "morningDigestTime", value: "08:15" });
    const log = await settingLog(t, "morningDigestTime");
    expect(log).toHaveLength(2);
    expect(log[1]).toMatchObject({ before: "07:30", after: "08:15" });
  });

  test("the admin task reviewer is an active person, stored with their email", async () => {
    const t = createTestConvex();
    const { asUser: asAdmin } = await insertUser(t, { email: "coo@cadence.test", role: "admin" });
    const { userId: ceoId } = await insertUser(t, { email: "ceo@cadence.test", role: "member" });
    const { userId: goneId } = await insertUser(t, {
      email: "gone@cadence.test",
      role: "member",
      isActive: false,
    });

    await asAdmin.mutation(api.settings.set, {
      key: "adminTaskReviewer",
      value: { email: "anything@cadence.test", userId: ceoId },
    });
    const rules = await asAdmin.query(api.settings.list, {});
    expect(rules.find((r) => r.key === "adminTaskReviewer")?.value).toEqual({
      email: "ceo@cadence.test",
      userId: ceoId,
    });

    // The same person again is no change.
    await asAdmin.mutation(api.settings.set, {
      key: "adminTaskReviewer",
      value: { email: "ceo@cadence.test", userId: ceoId },
    });
    expect(await settingLog(t, "adminTaskReviewer")).toHaveLength(1);

    await expectAppError(
      asAdmin.mutation(api.settings.set, {
        key: "adminTaskReviewer",
        value: { email: "gone@cadence.test", userId: goneId },
      }),
      "INVALID_ARGUMENT"
    );
    await expectAppError(
      asAdmin.mutation(api.settings.set, {
        key: "adminTaskReviewer",
        value: { email: "ceo@cadence.test" },
      }),
      "INVALID_ARGUMENT"
    );
  });
});
