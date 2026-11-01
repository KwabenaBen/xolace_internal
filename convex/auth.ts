import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import type { Value } from "convex/values";

import type { MutationCtx } from "./_generated/server";
import {
  assertUserCanSignIn,
  createUserFromInvite,
  isValidEmail,
  normalizeEmail,
} from "./lib/accounts";
import { MIN_PASSWORD_LENGTH } from "./lib/constants";
import { appError } from "./lib/errors";

/**
 * Email + password auth, invite-only.
 * - Sign-up: `createOrUpdateUser` only creates a user for an email with an unused invite.
 * - Sign-in: `beforeSessionCreation` rejects deactivated users.
 * Errors are ConvexErrors so the app can show their message.
 */
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      // Explicit return type: without it TypeScript widens `{ email }` to `{ email; name?: undefined }`,
      // which Convex Auth's `Record<string, Value>` profile type rejects.
      profile(params): Record<string, Value> & { email: string } {
        const email = normalizeEmail(params.email);
        if (!isValidEmail(email)) {
          throw appError("INVALID_ARGUMENT", "Enter a valid email address.");
        }
        if (params.flow === "signUp") {
          const name = typeof params.name === "string" ? params.name.trim() : "";
          if (name.length === 0) throw appError("INVALID_ARGUMENT", "Enter your name.");
          return { email, name };
        }
        return { email };
      },
      validatePasswordRequirements(password) {
        if (password.length < MIN_PASSWORD_LENGTH) {
          throw appError(
            "INVALID_ARGUMENT",
            `Use at least ${MIN_PASSWORD_LENGTH} characters for your password.`
          );
        }
      },
    }),
  ],
  callbacks: {
    // For password accounts this runs only when a new account is created (sign-up).
    async createOrUpdateUser(ctx: MutationCtx, args) {
      if (args.existingUserId !== null) return args.existingUserId;
      const email = normalizeEmail(args.profile.email);
      const name = typeof args.profile.name === "string" ? args.profile.name : "";
      if (args.type !== "credentials" || !isValidEmail(email) || name.length === 0) {
        throw appError("NOT_INVITED", "Sign-up is invite-only.");
      }
      return await createUserFromInvite(ctx, { email, name });
    },
    // Runs before every new session (sign-up and sign-in), not on token refresh.
    async beforeSessionCreation(ctx: MutationCtx, { userId }) {
      await assertUserCanSignIn(ctx, userId);
    },
  },
});
