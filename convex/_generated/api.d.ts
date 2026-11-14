/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as activity from "../activity.js";
import type * as auth from "../auth.js";
import type * as comments from "../comments.js";
import type * as crons from "../crons.js";
import type * as dailyLogs from "../dailyLogs.js";
import type * as demo from "../demo.js";
import type * as extensions from "../extensions.js";
import type * as features from "../features.js";
import type * as http from "../http.js";
import type * as invites from "../invites.js";
import type * as lib_accounts from "../lib/accounts.js";
import type * as lib_activity from "../lib/activity.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_constants from "../lib/constants.js";
import type * as lib_dates from "../lib/dates.js";
import type * as lib_errors from "../lib/errors.js";
import type * as lib_extensions from "../lib/extensions.js";
import type * as lib_inviteCodes from "../lib/inviteCodes.js";
import type * as lib_lateRule from "../lib/lateRule.js";
import type * as lib_reviews from "../lib/reviews.js";
import type * as lib_settings from "../lib/settings.js";
import type * as lib_tasks from "../lib/tasks.js";
import type * as lib_validators from "../lib/validators.js";
import type * as lib_views from "../lib/views.js";
import type * as overdue from "../overdue.js";
import type * as reviews from "../reviews.js";
import type * as seed from "../seed.js";
import type * as settings from "../settings.js";
import type * as tasks from "../tasks.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  activity: typeof activity;
  auth: typeof auth;
  comments: typeof comments;
  crons: typeof crons;
  dailyLogs: typeof dailyLogs;
  demo: typeof demo;
  extensions: typeof extensions;
  features: typeof features;
  http: typeof http;
  invites: typeof invites;
  "lib/accounts": typeof lib_accounts;
  "lib/activity": typeof lib_activity;
  "lib/auth": typeof lib_auth;
  "lib/constants": typeof lib_constants;
  "lib/dates": typeof lib_dates;
  "lib/errors": typeof lib_errors;
  "lib/extensions": typeof lib_extensions;
  "lib/inviteCodes": typeof lib_inviteCodes;
  "lib/lateRule": typeof lib_lateRule;
  "lib/reviews": typeof lib_reviews;
  "lib/settings": typeof lib_settings;
  "lib/tasks": typeof lib_tasks;
  "lib/validators": typeof lib_validators;
  "lib/views": typeof lib_views;
  overdue: typeof overdue;
  reviews: typeof reviews;
  seed: typeof seed;
  settings: typeof settings;
  tasks: typeof tasks;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
