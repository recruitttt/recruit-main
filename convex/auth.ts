/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex, crossDomain } from "@convex-dev/better-auth/plugins";
import { betterAuth } from "better-auth/minimal";
import { anyApi, queryGeneric } from "convex/server";
import { v } from "convex/values";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import authConfig from "./auth.config";

const query = queryGeneric;

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

function stripTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function splitCsv(value: string | undefined) {
  return (
    value
      ?.split(",")
      .map((item) => item.trim())
      .filter(Boolean) ?? []
  );
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

function hostPatternFromOriginPattern(value: string) {
  try {
    return new URL(value).host;
  } catch {
    return value
      .replace(/^https?:\/\//, "")
      .replace(/\/.*$/, "")
      .trim();
  }
}

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function buildTrustedOrigins(defaultAppOrigin: string) {
  return unique([
    defaultAppOrigin,
    "http://localhost:3000",
    "http://localhost:3020",
    ...splitCsv(process.env.ADDITIONAL_TRUSTED_ORIGINS),
  ]);
}

function buildAllowedHosts(defaultAppOrigin: string) {
  return unique([
    "localhost:*",
    "127.0.0.1:*",
    ...buildTrustedOrigins(defaultAppOrigin).map(hostPatternFromOriginPattern),
    ...splitCsv(process.env.AUTH_ALLOWED_HOSTS),
  ]);
}

async function requireOwner(
  ctx: { auth: { getUserIdentity: () => Promise<{ subject?: string } | null> } },
  userId: string
) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthenticated");
  if (identity.subject !== userId) throw new Error("Forbidden");
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
    const account = (await ctx.runQuery(components.betterAuth.adapter.findOne, {
      model: "account",
      where: [
        { field: "userId", operator: "eq", value: args.userId },
        { field: "providerId", operator: "eq", value: "github" },
      ],
    })) as { accountId?: string | null; accessToken?: string | null } | null;

    return {
      github: {
        linked: Boolean(account),
        hasAccessToken:
          typeof account?.accessToken === "string" &&
          account.accessToken.length > 0,
        ...(typeof account?.accountId === "string"
          ? { accountId: account.accountId }
          : {}),
      },
    };
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

  const trustedOrigins = buildTrustedOrigins(defaultAppOrigin);
  const allowedHosts = buildAllowedHosts(defaultAppOrigin);

  return betterAuth({
    baseURL: {
      allowedHosts,
      fallback: defaultAppOrigin,
    },
    trustedOrigins,
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
              const githubAccount = await ctx.runQuery(
                components.betterAuth.adapter.findOne,
                {
                  model: "account",
                  where: [
                    { field: "userId", operator: "eq", value: userId },
                    { field: "providerId", operator: "eq", value: "github" },
                  ],
                }
              );
              if (!githubAccount) return;

              // De-dupe: only skip when a prior github intake run exists AND
              // it did not fail. A failed run should be retryable on next
              // sign-in, so we let the scheduler fire again in that case.
              const existingRun = (await ctx.runQuery(
                anyApi.intakeRuns.latestForUserKindInternal,
                { userId, kind: "github" }
              )) as { status?: string } | null;
              if (existingRun && existingRun.status !== "failed") return;

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
