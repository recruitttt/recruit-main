/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex, crossDomain } from "@convex-dev/better-auth/plugins";
import { betterAuth } from "better-auth/minimal";
import { anyApi, mutationGeneric, queryGeneric } from "convex/server";
import { v } from "convex/values";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import authConfig from "./auth.config";
import {
  buildAllowedHosts,
  buildTrustedOrigins,
  stripTrailingSlash,
} from "../lib/auth-origin";

const query = queryGeneric;
const mutation = mutationGeneric;

type GithubAccountRow = {
  accountId?: string | null;
  accessToken?: string | null;
};

export const authComponent = createClient<DataModel>(
  (components as { betterAuth: Parameters<typeof createClient<DataModel>>[0] })
    .betterAuth
);

function isActionCtx(
  ctx: GenericCtx<DataModel>
): ctx is GenericCtx<DataModel> & {
  scheduler: { runAfter: (...args: any[]) => Promise<unknown> };
  runQuery: (...args: any[]) => Promise<any>;
} {
  return "scheduler" in ctx && "runQuery" in ctx;
}

function getConvexSiteUrl() {
  const explicit = process.env.CONVEX_SITE_URL ?? process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
  if (explicit) return stripTrailingSlash(explicit);

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (convexUrl?.endsWith(".convex.cloud")) {
    return convexUrl.replace(".convex.cloud", ".convex.site");
  }

  return undefined;
}

function getDefaultAppOrigin() {
  return stripTrailingSlash(
    process.env.SITE_URL ??
      process.env.NEXT_PUBLIC_SITE_URL ??
      "http://localhost:3000"
  );
}

async function requireOwner(
  ctx: { auth: { getUserIdentity: () => Promise<{ subject?: string } | null> } },
  userId: string
) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthenticated");
  if (identity.subject !== userId) throw new Error("Forbidden");
}

async function findGithubAccounts(
  ctx: { runQuery: (...args: any[]) => Promise<any> },
  userId: string
): Promise<GithubAccountRow[]> {
  // findMany takes args FLAT (no `input` envelope). Mutations (create, update*,
  // delete*) wrap their payload in `input`; queries do not. Wrapping findMany
  // in `input` made the args validator reject the call, so the React
  // `useQuery(api.auth.connectedAccounts, ...)` returned undefined and the UI
  // showed GitHub as "not linked" even after linkSocial wrote the row.
  const result = (await ctx.runQuery(
    (components.betterAuth.adapter as any).findMany,
    {
      model: "account",
      where: [
        { field: "userId", operator: "eq", value: userId },
        { field: "providerId", operator: "eq", value: "github" },
      ],
      paginationOpts: { cursor: null, numItems: 50 },
    }
  )) as { page?: GithubAccountRow[] } | null;

  return result?.page ?? [];
}

function hasUsableAccessToken(account: GithubAccountRow | null | undefined) {
  return (
    typeof account?.accessToken === "string" &&
    account.accessToken.length > 0
  );
}

export const connectedAccounts = query({
  args: { userId: v.string() },
  returns: v.object({
    github: v.object({
      linked: v.boolean(),
      hasAccessToken: v.boolean(),
      accountId: v.optional(v.string()),
    }),
  }),
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.userId);
    const accounts = await findGithubAccounts(ctx, args.userId);
    const account =
      accounts.find((candidate) => hasUsableAccessToken(candidate)) ??
      accounts[0] ??
      null;

    return {
      github: {
        linked: Boolean(accounts.length),
        hasAccessToken: accounts.some((candidate) =>
          hasUsableAccessToken(candidate)
        ),
        ...(typeof account?.accountId === "string"
          ? { accountId: account.accountId }
          : {}),
      },
    };
  },
});

export const disconnectGithub = mutation({
  args: { userId: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    await requireOwner(ctx, args.userId);
    return await ctx.runMutation(
      (components.betterAuth.adapter as any).deleteMany,
      {
        input: {
          model: "account",
          where: [
            { field: "userId", operator: "eq", value: args.userId },
            { field: "providerId", operator: "eq", value: "github" },
          ],
        },
        paginationOpts: { cursor: null, numItems: 1000 },
      }
    );
  },
});

export const createAuth = (ctx: GenericCtx<DataModel>) => {
  // baseURL is resolved from the incoming app host (via the Next.js proxy's
  // forwarded headers), so cookies are issued for localhost locally and the
  // deployed app in production. GitHub itself uses a fixed Convex callback URL
  // via the provider-level `redirectURI` below, which avoids separate OAuth app
  // settings for local/testing app hosts.
  const defaultAppOrigin = getDefaultAppOrigin();
  const convexSiteUrl = getConvexSiteUrl();

  const githubClientId = process.env.GITHUB_CLIENT_ID;
  const githubClientSecret = process.env.GITHUB_CLIENT_SECRET;
  const githubConfigured = Boolean(
    githubClientId && githubClientSecret && convexSiteUrl
  );

  // Build social providers in a shape Better Auth recognizes. Using
  // `Record<string, unknown>` previously prevented the GitHub provider from
  // registering because Better Auth iterates `Object.keys(options.socialProviders)`
  // and requires concrete provider config objects (not unknown).
  const socialProviders: NonNullable<
    Parameters<typeof betterAuth>[0]["socialProviders"]
  > = {};
  if (githubConfigured) {
    socialProviders.github = {
      clientId: githubClientId!,
      clientSecret: githubClientSecret!,
      // Spec §5: read:user covers profile, user:email exposes verified emails,
      // read:org enables org membership lookups for the GitHub intake adapter.
      scope: ["read:user", "user:email", "read:org"],
      redirectURI: `${convexSiteUrl}/api/auth/callback/github`,
      mapProfileToUser: (profile: {
        name?: string | null;
        email?: string | null;
        avatar_url?: string | null;
      }) => ({
        name: profile.name ?? undefined,
        email: profile.email ?? undefined,
        image: profile.avatar_url ?? undefined,
      }),
    };
  }

  const allowedHosts = buildAllowedHosts(defaultAppOrigin);

  return betterAuth({
    baseURL: {
      allowedHosts,
      fallback: defaultAppOrigin,
    },
    trustedOrigins: (request) => buildTrustedOrigins(defaultAppOrigin, request),
    advanced: {
      trustedProxyHeaders: true,
    },
    onAPIError: {
      errorURL: `${defaultAppOrigin}/sign-in`,
    },
    secret:
      process.env.BETTER_AUTH_SECRET ??
      "recruit-local-development-secret-at-least-32-characters",
    database: authComponent.adapter(ctx),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    // Persistent sessions: 30-day expiry, refreshed daily on active use.
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
    },
    socialProviders,
    account: {
      // Allow GitHub OAuth to auto-link with an existing email-only user. Trusting
      // the github provider lets verified GitHub emails attach to an existing
      // account without an explicit linkSocial() call.
      accountLinking: {
        enabled: true,
        // Explicit "Connect GitHub" runs from an authenticated Recruit
        // session, including the shared demo user whose email will never match
        // a real GitHub account. Treat that click as consent to attach the
        // GitHub OAuth account to the current user.
        allowDifferentEmails: true,
        trustedProviders: ["github"],
      },
    },
    // Auto-trigger background GitHub intake on first sign-in (spec §5).
    //
    // We hook session.create.after because it fires on every successful sign-in
    // (email or social) AND has the userId. Inside the hook we:
    //   1. Look for any existing GitHub account row for the user.
    //   2. Look for an existing intakeRuns row of kind="github".
    //   3. If GitHub is linked AND no prior intake run exists, schedule one.
    //
    // The auth ctx captured in the closure is the Convex http action ctx, so
    // it exposes `runQuery` + `scheduler.runAfter`. Email-only users skip step
    // 3 because they have no GitHub account row.
    databaseHooks: {
      session: {
        create: {
          after: async (session) => {
            try {
              if (!isActionCtx(ctx)) return;
              const userId = session.userId;
              if (typeof userId !== "string" || !userId) return;

              // Check whether the user has a linked GitHub account (i.e. a
              // GitHub access token exists in better-auth's account table).
              const githubAccounts = await findGithubAccounts(ctx, userId);
              if (
                !githubAccounts.some((account) =>
                  hasUsableAccessToken(account)
                )
              ) {
                return;
              }

              // De-dupe: running/queued imports stay untouched. Completed
              // rows only count when a GitHub snapshot exists; earlier broken
              // flows could create a terminal run without importing the
              // account, and those must be retried on the next GitHub sign-in.
              const existingRun = (await ctx.runQuery(
                anyApi.intakeRuns.latestForUserKindInternal,
                { userId, kind: "github" }
              )) as { status?: string } | null;
              if (
                existingRun?.status === "queued" ||
                existingRun?.status === "running"
              ) {
                return;
              }
              if (existingRun && existingRun.status !== "failed") {
                const snapshot = await ctx.runQuery(
                  anyApi.githubSnapshots.latestForUserInternal,
                  { userId }
                );
                if (snapshot) return;
              }

              // TODO Phase 4 wire-up — `runGithubIntake` is created by
              // subagent C. Reference via anyApi so we don't depend on the
              // generated api.d.ts (avoids a chicken-and-egg typecheck).
              await ctx.scheduler.runAfter(
                0,
                anyApi.intakeActions.runGithubIntake,
                { userId }
              );
            } catch (error) {
              // Never let the intake hook break the sign-in flow.
              console.error("[auth] github intake auto-trigger failed", error);
            }
          },
        },
      },
    },
    plugins: [crossDomain({ siteUrl: defaultAppOrigin }), convex({ authConfig })],
  });
};

export const { getAuthUser } = authComponent.clientApi();
