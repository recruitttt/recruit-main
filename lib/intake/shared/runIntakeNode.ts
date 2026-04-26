// runIntakeNode — variant of `runIntake.ts` that drives an `IntakeAdapter`
// from a Next.js Node route handler instead of a Convex action.
//
// Why this exists: adapters that need native deps (e.g. the LinkedIn adapter
// pulls `playwright-core` via Browserbase) cannot live in Convex actions —
// the Convex Node bundler crashes when analyzing playwright. We move those
// adapters out to Next API routes, but the same adapter contract still needs
// access to Convex mutations/queries so it can persist snapshots, cookies,
// and per-experience summaries.
//
// `convexHttpClientToCtx()` adapts a `ConvexHttpClient` (from `convex/browser`,
// the only Convex client that runs in a Next route) to the structural
// `IntakeConvexCtx` interface — which is what `runIntake` and every adapter
// already call. No adapter changes required.

import type { ConvexHttpClient } from "convex/browser";
import type { FunctionReference } from "convex/server";

import { runIntake, type RunIntakeResult } from "./runIntake";
import type {
  AICredentials,
  IntakeAdapter,
  IntakeContext,
  IntakeConvexCtx,
} from "./types";

/**
 * Minimal shape of the public `ConvexHttpClient` API used by the shim.
 * Declared explicitly (instead of relying on `ConvexHttpClient` itself) so
 * tests can pass a stub without depending on the Convex client class.
 */
export interface ConvexHttpClientLike {
  mutation<Reference extends FunctionReference<"mutation", "public">>(
    mutation: Reference,
    args: Reference["_args"]
  ): Promise<Reference["_returnType"]>;
  query<Reference extends FunctionReference<"query", "public">>(
    query: Reference,
    args: Reference["_args"]
  ): Promise<Reference["_returnType"]>;
}

/**
 * Adapt a `ConvexHttpClient` to the `IntakeConvexCtx` shape (`runMutation` /
 * `runQuery` / `storage`) that adapters and the `runIntake` driver expect.
 *
 * Convex actions expose `runMutation(ref, args)` directly; the HTTP client
 * exposes `mutation(ref, args)` / `query(ref, args)`. This shim is just a
 * rename so the same adapter code works in either environment.
 *
 * Storage is unsupported from a route handler (`_storage` access is only
 * available inside Convex actions). We provide a stub that throws so a
 * misrouted adapter fails loudly rather than silently corrupting data.
 */
export function convexHttpClientToCtx(
  client: ConvexHttpClientLike
): IntakeConvexCtx {
  return {
    runMutation: (mutation, args) => client.mutation(mutation, args),
    runQuery: (query, args) => client.query(query, args),
    storage: {
      get: () =>
        Promise.reject(
          new Error(
            "Convex `_storage` access is unavailable from a Next route handler. " +
              "Adapters that need storage must run as Convex actions."
          )
        ),
    },
  };
}

export interface RunIntakeNodeInput<TInput> {
  adapter: IntakeAdapter<TInput>;
  input: TInput;
  userId: string;
  client: ConvexHttpClient | ConvexHttpClientLike;
  credentials: AICredentials;
  /** Returns an ISO timestamp; defaults to `new Date().toISOString()`. */
  now?: () => string;
}

/**
 * Drive an adapter from a Next route handler.
 *
 * Usage:
 *   const client = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
 *   await runIntakeNode({
 *     adapter: linkedinAdapter,
 *     input: { profileUrl },
 *     userId,
 *     client,
 *     credentials: { source: "anthropic", apiKey: process.env.ANTHROPIC_API_KEY! },
 *   });
 */
export async function runIntakeNode<TInput>({
  adapter,
  input,
  userId,
  client,
  credentials,
  now,
}: RunIntakeNodeInput<TInput>): Promise<RunIntakeResult> {
  const intakeCtx: IntakeContext = {
    userId,
    ctx: convexHttpClientToCtx(client),
    credentials,
    now: now ?? (() => new Date().toISOString()),
  };
  return await runIntake(adapter, input, intakeCtx);
}
