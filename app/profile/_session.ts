//
// _session — server-side helper that fetches the better-auth session JSON
// and extracts a normalised `user` shape ({ id, name?, email?, image? })
// for use in the /profile server component.
//
// Lives next to page.tsx (underscore-prefixed so Next.js doesn't treat it
// as a route segment).
//

import { headers } from "next/headers";

interface SessionUser {
  id?: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

interface SessionEnvelope {
  session?: { userId?: string; id?: string } | null;
  user?: SessionUser | null;
}

function getConvexSiteUrl(): string | undefined {
  const explicit = process.env.NEXT_PUBLIC_CONVEX_SITE_URL;
  if (explicit) return explicit;
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (convexUrl?.endsWith(".convex.cloud")) {
    return convexUrl.replace(".convex.cloud", ".convex.site");
  }
  return undefined;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const convexSiteUrl = getConvexSiteUrl();
  if (!convexSiteUrl) return null;

  const incoming = await headers();
  const requestHeaders = new Headers();
  const cookie = incoming.get("cookie");
  const host = incoming.get("host");
  const proto = incoming.get("x-forwarded-proto") ?? "https";

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

  const body = (await response.json().catch(() => null)) as SessionEnvelope | null;
  if (!body) return null;

  // Prefer the user object's id; fall back to session.userId / session.id.
  const id =
    body.user?.id ??
    body.session?.userId ??
    body.session?.id ??
    undefined;
  if (!id) return null;

  return {
    id,
    name: body.user?.name ?? null,
    email: body.user?.email ?? null,
    image: body.user?.image ?? null,
  };
}
