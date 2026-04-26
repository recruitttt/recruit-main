/* eslint-disable @typescript-eslint/no-explicit-any */
//
// sourceConnections — owner-scoped reset/disconnect helpers for intake sources.
//
// These mutations are used by the Ready Room so a user can recover from a
// skipped, stale, or wrong source without leaving the waiting flow.

import { mutationGeneric } from "convex/server";
import { v } from "convex/values";

import { components } from "./_generated/api";

const mutation = mutationGeneric;

const sourceKindValidator = v.union(
  v.literal("github"),
  v.literal("linkedin"),
  v.literal("resume"),
  v.literal("web"),
);

type SourceKind = "github" | "linkedin" | "resume" | "web";

async function requireOwner(
  ctx: { auth: { getUserIdentity: () => Promise<{ subject?: string } | null> } },
  userId: string
): Promise<void> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthenticated");
  if (identity.subject !== userId) throw new Error("Forbidden");
}

export const disconnectSource = mutation({
  args: { userId: v.string(), kind: sourceKindValidator },
  returns: v.any(),
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.userId);

    if (args.kind === "github") {
      await ctx.runMutation(components.betterAuth.adapter.deleteOne, {
        input: {
          model: "account",
          where: [
            { field: "userId", operator: "eq", value: args.userId },
            { field: "providerId", operator: "eq", value: "github" },
          ],
        },
      });
      await deleteByUser(ctx, "githubSnapshots", "by_user", args.userId);
      await deleteByUser(ctx, "repoSourceFiles", "by_user_repo", args.userId);
      await deleteByUser(ctx, "repoSummaries", "by_user_repo", args.userId);
      await deleteIntakeRuns(ctx, args.userId, ["github"]);
    } else if (args.kind === "linkedin") {
      await deleteByUser(ctx, "linkedinSnapshots", "by_user", args.userId);
      await deleteByUser(ctx, "linkedinCookies", "by_user", args.userId);
      await deleteByUser(ctx, "experienceSummaries", "by_user_exp", args.userId);
      await deleteIntakeRuns(ctx, args.userId, ["linkedin"]);
    } else if (args.kind === "resume") {
      await deleteIntakeRuns(ctx, args.userId, ["resume"]);
    } else if (args.kind === "web") {
      await deleteIntakeRuns(ctx, args.userId, ["web"]);
    }

    await clearProfileSource(ctx, args.userId, args.kind);
    return { ok: true };
  },
});

async function deleteByUser(
  ctx: any,
  table: string,
  index: string,
  userId: string,
): Promise<void> {
  const rows = await ctx.db
    .query(table)
    .withIndex(index, (q: any) => q.eq("userId", userId))
    .collect();
  for (const row of rows) await ctx.db.delete(row._id);
}

async function deleteIntakeRuns(
  ctx: any,
  userId: string,
  kinds: ReadonlyArray<string>,
): Promise<void> {
  for (const kind of kinds) {
    const rows = await ctx.db
      .query("intakeRuns")
      .withIndex("by_user_kind", (q: any) =>
        q.eq("userId", userId).eq("kind", kind)
      )
      .collect();
    for (const row of rows) await ctx.db.delete(row._id);
  }
}

async function clearProfileSource(
  ctx: any,
  userId: string,
  kind: SourceKind,
): Promise<void> {
  const existing = await ctx.db
    .query("userProfiles")
    .withIndex("by_user", (q: any) => q.eq("userId", userId))
    .unique();
  if (!existing) return;

  const now = new Date().toISOString();
  const profile =
    existing.profile && typeof existing.profile === "object"
      ? { ...existing.profile }
      : {};
  const links =
    profile.links && typeof profile.links === "object"
      ? { ...profile.links }
      : {};

  if (kind === "github") {
    delete links.github;
    delete profile.github;
  } else if (kind === "linkedin") {
    delete links.linkedin;
  } else if (kind === "resume") {
    delete profile.resume;
  } else if (kind === "web") {
    delete links.website;
    delete links.devpost;
  }

  profile.links = links;

  const provenance = stripSourceProvenance(
    {
      ...(existing.provenance ?? {}),
      ...(profile.provenance ?? {}),
    },
    kind
  );
  profile.provenance = provenance;
  profile.updatedAt = now;

  const log = Array.isArray(existing.log) ? [...existing.log] : [];
  log.push({
    at: now,
    source: "manual",
    label: `Disconnected ${kind}`,
    level: "info",
  });

  await ctx.db.patch(existing._id, {
    profile,
    provenance,
    log: log.slice(-200),
    updatedAt: now,
  });
}

function stripSourceProvenance(
  provenance: Record<string, string>,
  kind: SourceKind,
): Record<string, string> {
  const blockedValues =
    kind === "web" ? new Set(["website", "devpost"]) : new Set([kind]);
  const blockedKeyFragments =
    kind === "web"
      ? ["links.website", "links.devpost", "website", "devpost"]
      : [kind, `links.${kind}`];

  const next: Record<string, string> = {};
  for (const [key, value] of Object.entries(provenance)) {
    if (blockedValues.has(value)) continue;
    if (blockedKeyFragments.some((fragment) => key.includes(fragment))) {
      continue;
    }
    next[key] = value;
  }
  return next;
}
