import { ConvexError } from "convex/values";

import type { AppErrorData } from "@convex/lib/errors";

/**
 * A message that is safe to show the user. Convex functions throw ConvexErrors with
 * `{ code, message }` (convex/lib/errors.ts); anything else (e.g. Convex Auth's own
 * "InvalidSecret") gets the fallback so internals never leak into the UI.
 */
export function getErrorMessage(
  error: unknown,
  fallback = "Something went wrong. Try again."
): string {
  if (error instanceof ConvexError) {
    const data: unknown = error.data;
    if (typeof data === "string") return data;
    if (isAppErrorData(data)) return data.message;
  }
  return fallback;
}

function isAppErrorData(data: unknown): data is AppErrorData {
  return (
    typeof data === "object" &&
    data !== null &&
    "message" in data &&
    typeof (data as { message: unknown }).message === "string"
  );
}
