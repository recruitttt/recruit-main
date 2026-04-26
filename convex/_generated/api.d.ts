/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as applicationActions from "../applicationActions.js";
import type * as applicationJobs from "../applicationJobs.js";
import type * as ashby from "../ashby.js";
import type * as ashbyActions from "../ashbyActions.js";
import type * as atsIngestion from "../atsIngestion.js";
import type * as auth from "../auth.js";
import type * as dlq from "../dlq.js";
import type * as followups from "../followups.js";
import type * as http from "../http.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  applicationActions: typeof applicationActions;
  applicationJobs: typeof applicationJobs;
  ashby: typeof ashby;
  ashbyActions: typeof ashbyActions;
  atsIngestion: typeof atsIngestion;
  auth: typeof auth;
  dlq: typeof dlq;
  followups: typeof followups;
  http: typeof http;
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

export declare const components: {
  betterAuth: import("@convex-dev/better-auth/_generated/component.js").ComponentApi<"betterAuth">;
};
