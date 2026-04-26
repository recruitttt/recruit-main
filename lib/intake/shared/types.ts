// IntakeAdapter contract — see specs/2026-04-25-recruit-merge-design.md §6.
//
// Every intake source (GitHub, LinkedIn, Resume, Web, Chat) implements
// `IntakeAdapter<TInput>`. The driver in `runIntake.ts` iterates the adapter,
// persists each event into the `intakeRuns` table for live UI streaming, and
// merges patches into the canonical `userProfiles` doc.

import type { FunctionReference } from "convex/server";

import type { AICredentials } from "../../intake/github/models";
import type { UserProfile } from "../../profile";

// Re-export for convenience so adapters don't need a separate import.
export type { AICredentials } from "../../intake/github/models";
export type { UserProfile } from "../../profile";

export type ProvenanceSource =
  | "chat"
  | "resume"
  | "github"
  | "linkedin"
  | "website"
  | "devpost"
  | "voice"
  | "manual";

export type IntakeAdapterName =
  | "github"
  | "linkedin"
  | "resume"
  | "web"
  | "chat"
  | "voice";

export type IntakeRunKind = IntakeAdapterName | "ai-report";

export type IntakeProgressLevel = "info" | "warn" | "error";

/**
 * Single event emitted by an adapter. When `patch` or `provenance` is set the
 * driver merges them into `userProfiles`. UI consumers render `stage`,
 * `message`, and (`done`/`total`) for progress bars.
 */
export interface IntakeProgressEvent {
  /** Pipeline stage tag (e.g. "starting", "scrape", "summarize", "complete"). */
  stage: string;
  /** Human-readable message for the UI. */
  message?: string;
  /** Progress numerator. */
  done?: number;
  /** Progress denominator. */
  total?: number;
  /** Partial profile patch — merged into `userProfiles.profile` on emit. */
  patch?: Partial<UserProfile>;
  /** Field-path → source provenance, merged into `userProfiles.provenance`. */
  provenance?: Record<string, ProvenanceSource>;
  /** Severity for UI styling and log filtering. */
  level?: IntakeProgressLevel;
  /** ISO timestamp set by the adapter (driver fills if missing). */
  at?: string;
  /** Adapter-specific structured payload (e.g. live-view URL, repo name). */
  data?: Record<string, unknown>;
}

/**
 * Minimal storage surface used by adapters that need raw blob access (e.g.
 * the resume adapter pulls the uploaded PDF from `_storage`). Convex action
 * ctx exposes this via `ctx.storage.get(id)`. The Next route shim
 * (`convexHttpClientToCtx` in `runIntakeNode.ts`) provides a stub that
 * throws if called — only adapters that actually need storage (currently
 * just the resume adapter, which runs as a Convex action) should depend on
 * it.
 */
export interface IntakeStorage {
  get(id: string): Promise<Blob | null>;
}

/**
 * Minimal Convex caller surface — the only methods adapters and the
 * `runIntake` driver actually use. A Convex `ActionCtx` satisfies this
 * structurally; so does the `convexHttpClientToCtx` shim in
 * `runIntakeNode.ts`, which lets the same adapter run from a Next.js route
 * handler (where playwright-only adapters live to keep the Convex bundler
 * away from native deps).
 */
export interface IntakeConvexCtx {
  runMutation<Reference extends FunctionReference<"mutation", "public">>(
    mutation: Reference,
    args: Reference["_args"]
  ): Promise<Reference["_returnType"]>;
  runQuery<Reference extends FunctionReference<"query", "public">>(
    query: Reference,
    args: Reference["_args"]
  ): Promise<Reference["_returnType"]>;
  storage: IntakeStorage;
}

/**
 * Context passed to every adapter. Wraps a Convex caller (either an
 * `ActionCtx` from a Convex action, or a `ConvexHttpClient` shim from a Next
 * route handler) so the adapter can call mutations/queries.
 */
export interface IntakeContext {
  userId: string;
  ctx: IntakeConvexCtx;
  credentials: AICredentials;
  /** Returns an ISO timestamp; injectable for tests. */
  now: () => string;
}

/**
 * The contract every adapter must satisfy. `name` is used for the `intakeRuns`
 * row's `kind` field; `run()` yields `IntakeProgressEvent`s as it works.
 */
export interface IntakeAdapter<TInput> {
  name: IntakeAdapterName;
  run(input: TInput, ctx: IntakeContext): AsyncIterable<IntakeProgressEvent>;
}
