import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";

import { api } from "@convex/_generated/api";

export type CurrentUser = NonNullable<FunctionReturnType<typeof api.users.me>>;

/**
 * The signed-in user's profile. `undefined` while loading, `null` when signed out.
 * Inside the (app) group it is always loaded and active; use `useSignedInUser` there.
 */
export function useCurrentUser(): CurrentUser | null | undefined {
  return useQuery(api.users.me);
}

/** For screens inside the (app) group, whose layout only renders once the user is loaded. */
export function useSignedInUser(): CurrentUser {
  const user = useCurrentUser();
  if (!user) throw new Error("useSignedInUser must be used inside the (app) group.");
  return user;
}
