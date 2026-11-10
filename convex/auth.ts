import type { ConvexCredentialsUserConfig } from "@convex-dev/auth/providers/ConvexCredentials";
import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import type { Value } from "convex/values";

import { internal } from "./_generated/api";
import type { MutationCtx } from "./_generated/server";
import {
  assertUserCanSignIn,
  createUserFromInvite,
  isValidEmail,
  normalizeEmail,
} from "./lib/accounts";
import { INVITE_REJECTED_MESSAGE, MIN_PASSWORD_LENGTH } from "./lib/constants";
import { appError } from "./lib/errors";
import { normalizeInviteCode } from "./lib/inviteCodes";

/**
 * Email + password auth, invite-only.
 * - Sign-up: `createOrUpdateUser` only creates a user for an email with an unused, unexpired
 *   invite and its one-time code (convex/lib/accounts.ts). Every refusal reads the same.
 * - Sign-up for an email that already has an account is refused before the library sees it
 *   (`refuseSignUpForExistingAccounts`): the library would otherwise check the password there,
 *   with no limit on attempts, and sign the person in on a match.
 * - Sign-in: `beforeSessionCreation` rejects deactivated users.
 * Errors are ConvexErrors so the app can show their message.
 */
const password = Password({
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
      const inviteCode = normalizeInviteCode(params.inviteCode);
      if (inviteCode.length === 0) {
        throw appError("INVALID_ARGUMENT", "Enter the invite code from your invite.");
      }
      // Checked against the invite in createOrUpdateUser; never stored on the user.
      return { email, name, inviteCode };
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
});

/**
 * Sign-up is for new accounts only. For an email that already has one, Convex Auth's Password
 * provider checks the password inside sign-up (no rate limit, unlike sign-in) and signs the
 * person in on a match, skipping the invite check. So sign-up refuses those emails first, with
 * the same message as every other refusal (it never reveals who has an account). Convex Auth
 * reads a credentials provider's `authorize` from its `options` (merged over the provider), so
 * that's where it's wrapped; checked by convex/tests/auth.test.ts on every upgrade.
 */
function refuseSignUpForExistingAccounts(provider: typeof password): typeof password {
  const options = (provider as unknown as { options: ConvexCredentialsUserConfig }).options;
  const authorize = options.authorize;
  options.authorize = async (params, ctx) => {
    if (params.flow === "signUp") {
      const email = normalizeEmail(typeof params.email === "string" ? params.email : "");
      if (await ctx.runQuery(internal.users.emailHasAccount, { email })) {
        throw appError("NOT_INVITED", INVITE_REJECTED_MESSAGE);
      }
    }
    return await authorize(params, ctx);
  };
  return provider;
}

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [refuseSignUpForExistingAccounts(password)],
  callbacks: {
    // For password accounts this runs only when a new account is created (sign-up).
    async createOrUpdateUser(ctx: MutationCtx, args) {
      if (args.existingUserId !== null) return args.existingUserId;
      const email = normalizeEmail(args.profile.email);
      const name = typeof args.profile.name === "string" ? args.profile.name : "";
      const inviteCode = typeof args.profile.inviteCode === "string" ? args.profile.inviteCode : "";
      if (args.type !== "credentials" || !isValidEmail(email) || name.length === 0) {
        throw appError("NOT_INVITED", INVITE_REJECTED_MESSAGE);
      }
      return await createUserFromInvite(ctx, { email, name, inviteCode });
    },
    // Runs before every new session (sign-up and sign-in), not on token refresh.
    async beforeSessionCreation(ctx: MutationCtx, { userId }) {
      await assertUserCanSignIn(ctx, userId);
    },
  },
});
