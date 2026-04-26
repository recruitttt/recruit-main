/* eslint-disable @typescript-eslint/no-explicit-any */
//
// auth-github — server-side helper to read a user's GitHub OAuth access token
// from better-auth's `account` table.
//
// Spec: docs/superpowers/specs/2026-04-25-recruit-merge-design.md §5.
//
// Used by the GitHub intake adapter (subagent C) to obtain a token suitable
// for Octokit REST + GraphQL calls. Returns null when no linked GitHub
// account exists or when the token has not been persisted (e.g. an
// email-signup user that never connected GitHub).

import { components } from "../convex/_generated/api";
import type { ActionCtx, MutationCtx, QueryCtx } from "../convex/_generated/server";

type AnyCtx = ActionCtx | MutationCtx | QueryCtx;

export async function getGitHubAccessToken(
  ctx: AnyCtx,
  userId: string
): Promise<string | null> {
  if (!userId) return null;

  // Account rows live in the better-auth component's `account` table. Each row
  // holds (providerId, userId, accessToken, refreshToken, ...) for a single
  // OAuth provider.
  const row = (await (ctx as any).runQuery(
    components.betterAuth.adapter.findOne,
    {
      model: "account",
      where: [
        { field: "userId", operator: "eq", value: userId },
        { field: "providerId", operator: "eq", value: "github" },
      ],
    }
  )) as { accessToken?: string | null } | null;

  if (!row) return null;
  const token = row.accessToken;
  if (typeof token !== "string" || token.length === 0) return null;
  return token;
}
