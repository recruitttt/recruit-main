/* eslint-disable @typescript-eslint/no-explicit-any */
//
// linkedinCookies — persisted LinkedIn auth cookies for re-runs.
//
// Security model (spec §4):
//   - The `li_at` cookie is encrypted at rest with AES-256-GCM. The key comes
//     from `process.env.COOKIE_ENCRYPTION_KEY` (32-byte hex; generate with
//     `openssl rand -hex 32`).
//   - The public `byUser` query NEVER returns `liAt` to clients — only
//     metadata (`hasCookie`, `capturedAt`, `expiresAt`) for UI badges.
//   - Server-side callers (the LinkedIn adapter, running from the Vercel
//     route with the user's auth token forwarded) read the decrypted cookie
//     via `getDecryptedLiAt`. That query is identity-checked so only the
//     authenticated owner can decrypt their own cookie.
//   - `internalGetDecryptedLiAt` is the same logic without an identity check,
//     for callers running inside Convex actions where identity may not
//     propagate (server-controlled by definition).
//   - Every mutation (`save`, `clear`) requires identity ownership.

import {
  internalQueryGeneric,
  mutationGeneric,
  queryGeneric,
} from "convex/server";
import { v } from "convex/values";

import { decrypt, encrypt, looksEncrypted } from "../lib/server/encrypt";

const query = queryGeneric;
const mutation = mutationGeneric;
const internalQuery = internalQueryGeneric;

async function requireOwner(
  ctx: { auth: { getUserIdentity: () => Promise<{ subject?: string } | null> } },
  userId: string
): Promise<void> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthenticated");
  if (identity.subject !== userId) throw new Error("Forbidden");
}

// Shared LinkedIn login credentials sourced from `process.env.LINKEDIN_EMAIL`
// and `process.env.LINKEDIN_PASSWORD` on the Convex deployment. Returned only
// to authenticated callers — the LinkedIn intake route falls back to this
// when the Next.js process doesn't have its own LINKEDIN_EMAIL/PASSWORD set
// (e.g. fresh localhost devs who haven't populated `.env.local` yet).
//
// Security note: any authenticated user can read these. We accept that
// because the same shared account is intentionally usable by every
// developer running the app — that's the whole point of moving them off
// each developer's `.env.local`. If the trust boundary ever needs to be
// tightened, gate this on a server-side flag or specific user IDs.
export const getSharedLoginCredentials = query({
  args: {},
  returns: v.union(
    v.object({
      email: v.string(),
      password: v.string(),
    }),
    v.null(),
  ),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const email = (process.env.LINKEDIN_EMAIL ?? "").trim();
    const password = (process.env.LINKEDIN_PASSWORD ?? "").trim();
    if (!email || !password) return null;
    return { email, password };
  },
});

// Public metadata only. The plaintext cookie is never returned to clients.
export const byUser = query({
  args: { userId: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.userId);
    const row = await ctx.db
      .query("linkedinCookies")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();
    if (!row) return null;
    return {
      _id: row._id,
      _creationTime: row._creationTime,
      userId: row.userId,
      capturedAt: row.capturedAt,
      expiresAt: row.expiresAt,
      hasCookie: typeof row.liAt === "string" && row.liAt.length > 0,
    };
  },
});

// Server-side decrypted read — returns the plaintext `liAt` cookie for the
// authenticated owner. Identity is required (better-auth's Convex integration
// sets `subject` to userId), so a client cannot read another user's cookie.
//
// Used by the LinkedIn intake adapter, which runs from a Next API route via
// `ConvexHttpClient.setAuth(token)`. We deliberately keep this as a public
// query (not `internalQuery`) because external Convex clients cannot call
// `internal.*` functions; the identity check below provides the same
// access-control guarantee.
//
// An additional `internalQuery` alias (`internalGetDecryptedLiAt`) is exported
// below for callers running inside Convex actions where identity may not
// propagate — those callers are server-controlled by definition.
export const getDecryptedLiAt = query({
  args: { userId: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.userId);
    return await readDecryptedLiAt(ctx, args.userId);
  },
});

export const internalGetDecryptedLiAt = internalQuery({
  args: { userId: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    return await readDecryptedLiAt(ctx, args.userId);
  },
});

async function readDecryptedLiAt(
  ctx: { db: { query: (table: string) => any } },
  userId: string
): Promise<{
  liAt: string | null;
  jsessionId: string | null;
  capturedAt: string;
  expiresAt: string | null;
} | null> {
  const row = await ctx.db
    .query("linkedinCookies")
    .withIndex("by_user", (q: { eq: (k: string, v: string) => unknown }) =>
      q.eq("userId", userId)
    )
    .unique();
  if (!row) return null;
  const stored = typeof row.liAt === "string" ? row.liAt : "";
  let liAt: string | null = null;
  if (stored) {
    try {
      liAt = looksEncrypted(stored) ? await decrypt(stored) : stored;
    } catch {
      // Treat undecryptable rows as if no cookie were saved — the adapter
      // will fall back to a fresh login flow.
      liAt = null;
    }
  }
  return {
    liAt,
    jsessionId: row.jsessionId ?? null,
    capturedAt: row.capturedAt,
    expiresAt: row.expiresAt ?? null,
  };
}

export const save = mutation({
  args: {
    userId: v.string(),
    liAt: v.string(),
    jsessionId: v.optional(v.string()),
    expiresAt: v.optional(v.string()),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.userId);
    const now = new Date().toISOString();
    // Encrypt before write; tolerate already-encrypted values for callers that
    // pre-encrypt (currently none, but keeps the contract idempotent).
    const liAtSealed = looksEncrypted(args.liAt)
      ? args.liAt
      : await encrypt(args.liAt);
    const existing = await ctx.db
      .query("linkedinCookies")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();

    const payload = {
      userId: args.userId,
      liAt: liAtSealed,
      jsessionId: args.jsessionId,
      capturedAt: now,
      expiresAt: args.expiresAt,
    };

    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return existing._id;
    }
    return await ctx.db.insert("linkedinCookies", payload);
  },
});

export const clear = mutation({
  args: { userId: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.userId);
    const existing = await ctx.db
      .query("linkedinCookies")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();
    if (existing) await ctx.db.delete(existing._id);
    return null;
  },
});
