/* eslint-disable @typescript-eslint/no-explicit-any */
//
// authAdmin — one-off mutations for recovering from BETTER_AUTH_SECRET rotation.
//
// JWKS records are encrypted with `BETTER_AUTH_SECRET`. If the secret changes
// after JWKS was generated, every decrypt throws and every social-provider
// init fails with a misleading "Provider not found" error. Wipe the JWKS
// table to force regeneration with the current secret.
//
// Run with: `npx convex run authAdmin:wipeJwks`

import { internalAction } from "./_generated/server";
import { components } from "./_generated/api";

export const wipeJwks = internalAction({
  args: {},
  handler: async (ctx) => {
    const adapter = (
      components as { betterAuth: { adapter: Record<string, unknown> } }
    ).betterAuth.adapter;
    const result = await ctx.runMutation((adapter as any).deleteMany, {
      input: { model: "jwks", where: [] },
      paginationOpts: { cursor: null, numItems: 1000 },
    });
    return { result };
  },
});

// Debug: count records in the betterAuth jwks table.
export const countJwks = internalAction({
  args: {},
  handler: async (ctx) => {
    const adapter = (
      components as { betterAuth: { adapter: Record<string, unknown> } }
    ).betterAuth.adapter;
    const result = (await ctx.runQuery((adapter as any).findMany, {
      model: "jwks",
      where: [],
      paginationOpts: { cursor: null, numItems: 100 },
    })) as { page?: unknown[] };
    return {
      count: result.page?.length ?? 0,
      ids: (result.page ?? []).map((r: any) => r._id),
      createdAts: (result.page ?? []).map((r: any) => r.createdAt),
    };
  },
});

// Try the actual createAuth function to see if it succeeds.
export const debugCreateAuth = internalAction({
  args: {},
  handler: async (_ctx) => {
    try {
      const { createAuth } = await import("./auth");
      const auth = createAuth(_ctx as any);
      const opts = (auth as any).options ?? {};
      const $context = await (auth as any).$context;
      const ctxOpts = $context?.options ?? {};
      return {
        ok: true,
        socialProviderKeys: Object.keys(opts.socialProviders ?? {}),
        hasGithub: Boolean(opts.socialProviders?.github),
        baseURL: opts.baseURL,
        trustedOrigins:
          typeof opts.trustedOrigins === "function"
            ? "[function]"
            : opts.trustedOrigins,
        resolvedTrustedOrigins: $context?.trustedOrigins ?? null,
        // After plugins resolve, the $context has the FINAL options.
        ctxSocialProviderKeys: Object.keys(ctxOpts.socialProviders ?? {}),
        ctxHasGithub: Boolean(ctxOpts.socialProviders?.github),
        accountLinking: ctxOpts.account?.accountLinking ?? opts.account?.accountLinking ?? null,
        pluginIds: ($context?.options?.plugins ?? []).map((p: any) => p?.id),
      };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : null,
      };
    }
  },
});

// Debug: returns the exact env values the auth code sees on Convex.
// Run with: `npx convex run authAdmin:debugAuthEnv`
export const debugAuthEnv = internalAction({
  args: {},
  handler: async () => {
    return {
      GITHUB_CLIENT_ID_present: Boolean(process.env.GITHUB_CLIENT_ID),
      GITHUB_CLIENT_ID_len: process.env.GITHUB_CLIENT_ID?.length ?? 0,
      GITHUB_CLIENT_SECRET_present: Boolean(process.env.GITHUB_CLIENT_SECRET),
      GITHUB_CLIENT_SECRET_len: process.env.GITHUB_CLIENT_SECRET?.length ?? 0,
      CONVEX_SITE_URL: process.env.CONVEX_SITE_URL ?? null,
      NEXT_PUBLIC_CONVEX_SITE_URL: process.env.NEXT_PUBLIC_CONVEX_SITE_URL ?? null,
      NEXT_PUBLIC_CONVEX_URL: process.env.NEXT_PUBLIC_CONVEX_URL ?? null,
      SITE_URL: process.env.SITE_URL ?? null,
      BETTER_AUTH_SECRET_present: Boolean(process.env.BETTER_AUTH_SECRET),
      BETTER_AUTH_SECRET_len: process.env.BETTER_AUTH_SECRET?.length ?? 0,
    };
  },
});
