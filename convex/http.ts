/* eslint-disable @typescript-eslint/no-explicit-any */
import { httpRouter, httpActionGeneric } from "convex/server";
import { authComponent, createAuth } from "./auth";

const http = httpRouter();

// Diagnostic route — confirms env vars + GitHub provider are visible to the
// HTTP handler at request time. Useful when "Provider not found" recurs.
// Hit with: curl https://<deploy>.convex.site/debug/auth
http.route({
  path: "/debug/auth",
  method: "GET",
  handler: httpActionGeneric(async (ctx) => {
    const auth = createAuth(ctx as any);
    const opts = (auth as any).options ?? {};
    const $context = await (auth as any).$context;
    const testUrl =
      "http://localhost:3000/api/auth/complete-oauth?redirect=%2Fonboarding";
    const isTrusted = $context?.isTrustedOrigin?.(testUrl, {
      allowRelativePaths: true,
    });
    return Response.json({
      env_GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID ? "set" : "MISSING",
      env_GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET ? "set" : "MISSING",
      env_CONVEX_SITE_URL: process.env.CONVEX_SITE_URL ?? "MISSING",
      env_BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET ? "set" : "MISSING",
      socialProviders: Object.keys(opts.socialProviders ?? {}),
      ctxSocialProviders: Object.keys($context?.options?.socialProviders ?? {}),
      pluginIds: ($context?.options?.plugins ?? []).map((p: any) => p?.id),
      trustedOrigins: $context?.trustedOrigins ?? null,
      optionsTrustedOrigins: opts.trustedOrigins ?? null,
      baseURL: opts.baseURL ?? null,
      isTrustedTestUrl: { url: testUrl, result: isTrusted },
    });
  }),
});

authComponent.registerRoutes(http, createAuth);

export default http;
