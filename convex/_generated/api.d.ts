/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as aiReports from "../aiReports.js";
import type * as applicationActions from "../applicationActions.js";
import type * as applicationJobs from "../applicationJobs.js";
import type * as ashby from "../ashby.js";
import type * as ashbyActions from "../ashbyActions.js";
import type * as atsIngestion from "../atsIngestion.js";
import type * as auth from "../auth.js";
import type * as authAdmin from "../authAdmin.js";
import type * as dlq from "../dlq.js";
import type * as experienceSummaries from "../experienceSummaries.js";
import type * as files from "../files.js";
import type * as followups from "../followups.js";
import type * as githubSnapshots from "../githubSnapshots.js";
import type * as http from "../http.js";
import type * as intakeActions from "../intakeActions.js";
import type * as intakeRuns from "../intakeRuns.js";
import type * as linkedinCookies from "../linkedinCookies.js";
import type * as linkedinSnapshots from "../linkedinSnapshots.js";
import type * as repoSourceFiles from "../repoSourceFiles.js";
import type * as repoSummaries from "../repoSummaries.js";
import type * as sourceConnections from "../sourceConnections.js";
import type * as userProfiles from "../userProfiles.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  aiReports: typeof aiReports;
  applicationActions: typeof applicationActions;
  applicationJobs: typeof applicationJobs;
  ashby: typeof ashby;
  ashbyActions: typeof ashbyActions;
  atsIngestion: typeof atsIngestion;
  auth: typeof auth;
  authAdmin: typeof authAdmin;
  dlq: typeof dlq;
  experienceSummaries: typeof experienceSummaries;
  files: typeof files;
  followups: typeof followups;
  githubSnapshots: typeof githubSnapshots;
  http: typeof http;
  intakeActions: typeof intakeActions;
  intakeRuns: typeof intakeRuns;
  linkedinCookies: typeof linkedinCookies;
  linkedinSnapshots: typeof linkedinSnapshots;
  repoSourceFiles: typeof repoSourceFiles;
  repoSummaries: typeof repoSummaries;
  sourceConnections: typeof sourceConnections;
  userProfiles: typeof userProfiles;
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
