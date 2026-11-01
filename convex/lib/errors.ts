import { ConvexError } from "convex/values";

export type AppErrorCode =
  | "UNAUTHENTICATED"
  | "ACCOUNT_INACTIVE"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "INVALID_ARGUMENT"
  | "NOT_INVITED"
  | "CONFLICT";

export type AppErrorData = { code: AppErrorCode; message: string };

/**
 * Every error a user might see is thrown through this, so the app can show
 * `error.data.message` (see src/lib/errors.ts). Plain `Error`s are hidden in production.
 */
export function appError(code: AppErrorCode, message: string): ConvexError<AppErrorData> {
  return new ConvexError({ code, message });
}
