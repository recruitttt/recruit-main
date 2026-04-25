import { createClient, type GenericCtx } from "@convex-dev/better-auth";
import { convex } from "@convex-dev/better-auth/plugins";
import { betterAuth } from "better-auth/minimal";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import authConfig from "./auth.config";

export const authComponent = createClient<DataModel>(
  (components as { betterAuth: Parameters<typeof createClient<DataModel>>[0] })
    .betterAuth
);

export const createAuth = (ctx: GenericCtx<DataModel>) => {
  const siteUrl =
    process.env.SITE_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "http://localhost:3020";

  return betterAuth({
    baseURL: siteUrl,
    secret:
      process.env.BETTER_AUTH_SECRET ??
      "recruit-local-development-secret-at-least-32-characters",
    database: authComponent.adapter(ctx),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
    },
    socialProviders: {},
    plugins: [convex({ authConfig })],
  });
};

export const { getAuthUser } = authComponent.clientApi();
