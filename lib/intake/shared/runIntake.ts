// runIntake — driver that turns an `IntakeAdapter` into Convex side-effects.
//
// Spec: specs/2026-04-25-recruit-merge-design.md §6.
//
// For every event the adapter yields, this driver:
//   1. Persists it onto the `intakeRuns` row (UI live-streams via useQuery).
//   2. If the event carries a `patch` or `provenance` payload, merges it into
//      the canonical `userProfiles` doc.
//
// Adapters never touch Convex directly through `db` — they call this driver
// from a Convex action (registered in `convex/intakeActions.ts`).

import { api } from "../../../convex/_generated/api";

import type { IntakeAdapter, IntakeContext, IntakeProgressEvent } from "./types";

export interface RunIntakeResult {
  runId: string;
  events: number;
}

export async function runIntake<TInput>(
  adapter: IntakeAdapter<TInput>,
  input: TInput,
  ctx: IntakeContext
): Promise<RunIntakeResult> {
  // Convex generated FunctionReference types live behind `api.*`; the typed
  // shape is `Id<"intakeRuns">` but it's just a string at runtime.
  const runId = (await ctx.ctx.runMutation(api.intakeRuns.start, {
    userId: ctx.userId,
    kind: adapter.name,
  })) as string;

  let count = 0;

  try {
    for await (const event of adapter.run(input, ctx)) {
      const stamped: IntakeProgressEvent = {
        ...event,
        at: event.at ?? ctx.now(),
      };

      // Persist a sanitized copy: drop `data` entirely (may contain
      // Browserbase live-view URLs which give full browser control, raw
      // li_at cookies, or other sensitive payloads) and `patch` (already
      // merged into userProfiles — duplicating bloats the live-event log
      // and risks leaking PII via the public events array).
      const persisted = sanitizeEventForPersist(stamped);

      await ctx.ctx.runMutation(api.intakeRuns.appendEvent, {
        runId: runId as never, // FunctionReference args are typed via api.*
        event: persisted,
      });

      const hasPatch = stamped.patch && Object.keys(stamped.patch).length > 0;
      const hasProvenance =
        stamped.provenance && Object.keys(stamped.provenance).length > 0;

      if (hasPatch || hasProvenance) {
        await ctx.ctx.runMutation(api.userProfiles.merge, {
          userId: ctx.userId,
          patch: stamped.patch ?? {},
          provenance: stamped.provenance ?? {},
          label: `${adapter.name}:${stamped.stage}`,
        });
      }

      count += 1;
    }

    await ctx.ctx.runMutation(api.intakeRuns.complete, {
      runId: runId as never,
    });
  } catch (error) {
    await ctx.ctx.runMutation(api.intakeRuns.fail, {
      runId: runId as never,
      error: stringifyError(error),
    });
    throw error;
  }

  return { runId, events: count };
}

function stringifyError(error: unknown): string {
  if (error instanceof Error) return error.message || error.name || "Error";
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

/**
 * Strip sensitive fields from an event before it lands in `intakeRuns.events`.
 *
 * The persisted events array is queryable by the owning user via
 * `intakeRuns.byUserKind` / `intakeRuns.live`, so anything we leave in there
 * becomes part of that surface. Adapters can yield rich payloads (Browserbase
 * `liveViewUrl` debugger URLs that grant browser control, raw `liAt`
 * cookies, full HTTP responses, etc.) — all of those belong in the runtime
 * stream, not the persisted log.
 *
 * Drop:
 *   - `data` — adapter-specific structured payload, may contain debugger URLs
 *     or cookies. If a future event needs to surface a small whitelisted
 *     payload to the UI (e.g. a sessionId), add it here explicitly rather
 *     than threading the entire `data` object through.
 *   - `patch` — already merged into `userProfiles`; duplicating bloats the
 *     live event log and exposes PII via the events query.
 *
 * Keep:
 *   - `stage`, `message`, `done`, `total`, `level`, `at`, `provenance` — UI
 *     metadata, no sensitive values.
 */
function sanitizeEventForPersist(
  event: IntakeProgressEvent
): IntakeProgressEvent {
  const sanitized: IntakeProgressEvent = { ...event };
  delete sanitized.data;
  delete sanitized.patch;
  return sanitized;
}
