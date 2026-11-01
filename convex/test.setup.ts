/// <reference types="vite/client" />
/// <reference types="node" />
import { convexTest } from "convex-test";
import { ConvexError } from "convex/values";
import { exportJWK, exportPKCS8, generateKeyPair } from "jose";
import { expect } from "vitest";

import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import type { AppErrorCode, AppErrorData } from "./lib/errors";
import schema from "./schema";

// Test-only helpers. The file name has two dots, so Convex never deploys it.

export const modules = import.meta.glob("./**/*.*s");

export function createTestConvex() {
  return convexTest({ schema, modules });
}

export type TestConvex = ReturnType<typeof createTestConvex>;

/** Convex Auth needs signing keys to issue tokens; generate a throwaway pair per run. */
export async function setupAuthEnv(): Promise<void> {
  const keys = await generateKeyPair("RS256", { extractable: true });
  const privateKey = await exportPKCS8(keys.privateKey);
  const publicKey = await exportJWK(keys.publicKey);
  process.env.JWT_PRIVATE_KEY = privateKey.trimEnd().replace(/\n/g, " ");
  process.env.JWKS = JSON.stringify({ keys: [{ use: "sig", ...publicKey }] });
  process.env.CONVEX_SITE_URL = "https://cadence-test.convex.site";
  process.env.SITE_URL = "http://localhost:8081";
  process.env.AUTH_LOG_LEVEL = "ERROR";
}

export function signUp(t: TestConvex, params: { email: string; password?: string; name?: string }) {
  return t.action(api.auth.signIn, {
    provider: "password",
    params: { password: "correct-horse-battery", name: "Test User", ...params, flow: "signUp" },
  });
}

export function signIn(t: TestConvex, params: { email: string; password?: string }) {
  return t.action(api.auth.signIn, {
    provider: "password",
    params: { password: "correct-horse-battery", ...params, flow: "signIn" },
  });
}

/** Inserts a user directly (bypassing auth) and returns a client signed in as them. */
export async function insertUser(
  t: TestConvex,
  user: { email: string; role: "admin" | "member"; isActive?: boolean; title?: string }
) {
  const userId: Id<"users"> = await t.run(async (ctx) =>
    ctx.db.insert("users", {
      name: user.email.split("@")[0],
      email: user.email,
      title: user.title ?? (user.role === "admin" ? "COO" : "CTO"),
      role: user.role,
      isActive: user.isActive ?? true,
      timezone: "Africa/Accra",
    })
  );
  // Convex Auth's identity subject is "<userId>|<sessionId>".
  const asUser = t.withIdentity({ subject: `${userId}|test-session` });
  return { userId, asUser };
}

function appErrorData(error: unknown): AppErrorData | null {
  if (!(error instanceof ConvexError)) return null;
  const data: unknown = typeof error.data === "string" ? JSON.parse(error.data) : error.data;
  return data as AppErrorData;
}

/** Asserts that `promise` rejects with an app error (convex/lib/errors.ts) with this code. */
export async function expectAppError(promise: Promise<unknown>, code: AppErrorCode) {
  const error = await promise.then(
    () => null,
    (e: unknown) => e
  );
  expect(error, `expected a ${code} error`).not.toBeNull();
  expect(appErrorData(error)?.code).toBe(code);
}
