import { convexBetterAuthNextJs } from "@convex-dev/better-auth/nextjs";

type AuthServer = ReturnType<typeof convexBetterAuthNextJs>;

let authServer: AuthServer | null = null;

function getConvexSiteUrl() {
  const explicit = process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
  if (explicit) return explicit;

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (convexUrl?.endsWith(".convex.cloud")) {
    return convexUrl.replace(".convex.cloud", ".convex.site");
  }

  return undefined;
}

function getAuthServer() {
  if (authServer) return authServer;

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  const convexSiteUrl = getConvexSiteUrl();

  if (!convexUrl || !convexSiteUrl) {
    throw new Error("Convex auth requires NEXT_PUBLIC_CONVEX_URL and NEXT_PUBLIC_CONVEX_SITE_URL.");
  }

  authServer = convexBetterAuthNextJs({
    convexUrl,
    convexSiteUrl,
  });

  return authServer;
}

export function getToken() {
  return getAuthServer().getToken();
}

export function isAuthenticated() {
  return getAuthServer().isAuthenticated();
}

export const handler = {
  GET(request: Request) {
    return getAuthServer().handler.GET(request);
  },
  POST(request: Request) {
    return getAuthServer().handler.POST(request);
  },
};
