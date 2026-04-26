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

export async function getToken() {
  try {
    return await getAuthServer().getToken();
  } catch {
    return null;
  }
}

interface SessionEnvelopeUser {
  id?: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

interface SessionEnvelope {
  session?: { userId?: string; id?: string } | null;
  user?: SessionEnvelopeUser | null;
}

export async function getSessionFromAuth(): Promise<SessionEnvelope | null> {
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
  return (await response.json().catch(() => null)) as SessionEnvelope | null;
}

/**
 * Resolve the current user's id from the better-auth session, or `null` if
 * no session is present. Use from Next route handlers / server components.
 */
export async function getSessionUserId(): Promise<string | null> {
  const envelope = await getSessionFromAuth();
  if (!envelope) return null;
  return (
    envelope.user?.id ??
    envelope.session?.userId ??
    envelope.session?.id ??
    null
  );
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
