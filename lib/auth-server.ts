import { convexBetterAuthNextJs } from "@convex-dev/better-auth/nextjs";
import { headers } from "next/headers";

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

async function getSessionFromAuth() {
  const convexSiteUrl = getConvexSiteUrl();
  if (!convexSiteUrl) return null;

  const incomingHeaders = await headers();
  const requestHeaders = new Headers();
  const cookie = incomingHeaders.get("cookie");
  const host = incomingHeaders.get("host");
  const proto = incomingHeaders.get("x-forwarded-proto") ?? "https";

  if (cookie) requestHeaders.set("cookie", cookie);
  if (host) {
    requestHeaders.set("x-forwarded-host", host);
    requestHeaders.set("x-better-auth-forwarded-host", host);
  }
  requestHeaders.set("x-forwarded-proto", proto);
  requestHeaders.set("x-better-auth-forwarded-proto", proto);
  requestHeaders.set("accept", "application/json");
  requestHeaders.set("accept-encoding", "identity");

  const response = await fetch(`${convexSiteUrl}/api/auth/get-session`, {
    headers: requestHeaders,
    cache: "no-store",
  });

  if (!response.ok) return null;
  return (await response.json().catch(() => null)) as { session?: unknown } | null;
}

export async function isAuthenticated() {
  const session = await getSessionFromAuth();
  return Boolean(session?.session);
}

export const handler = {
  GET(request: Request) {
    return getAuthServer().handler.GET(request);
  },
  POST(request: Request) {
    return getAuthServer().handler.POST(request);
  },
};
