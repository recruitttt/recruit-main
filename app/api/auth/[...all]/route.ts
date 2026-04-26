import {
  buildAuthForwardHeaders,
  getAuthProxyTarget,
  responseFromAuthUpstream,
} from "@/lib/auth-proxy";

// Manual proxy to Convex Better Auth — bypasses @convex-dev/better-auth
// v0.12.0's nextjs handler bug where `fetch(newRequest, { method, redirect })`
// drops the request body (Node.js undici "expected non-null body source"
// error). We read the body explicitly and forward it as a Buffer so it
// always reaches Convex intact, including failed sign-ins (which were
// silently masked by friendlyAuthFailure before).

export const dynamic = "force-dynamic";

async function proxy(request: Request) {
  const target = getAuthProxyTarget(request);
  if (!target) {
    return Response.json(
      {
        error: {
          code: "auth_unconfigured",
          message:
            "NEXT_PUBLIC_CONVEX_SITE_URL is not set — auth proxy cannot reach Convex.",
        },
      },
      { status: 503 },
    );
  }

  const hasBody =
    request.method !== "GET" &&
    request.method !== "HEAD" &&
    request.body !== null;
  const bodyBuffer = hasBody ? await request.arrayBuffer() : undefined;

  const headers = buildAuthForwardHeaders(request, target.targetHost);

  let upstream: Response;
  try {
    upstream = await fetch(target.targetUrl, {
      method: request.method,
      headers,
      body: bodyBuffer ? new Uint8Array(bodyBuffer) : undefined,
      redirect: "manual",
      cache: "no-store",
    });
  } catch (error) {
    console.error("Auth proxy fetch failed", {
      target: target.targetUrl,
      method: request.method,
      error,
    });
    return Response.json(
      {
        error: {
          code: "auth_unavailable",
          message:
            "Authentication is unavailable right now. Try again in a minute.",
        },
      },
      { status: 503 },
    );
  }

  const requestProto = target.requestUrl.protocol.replace(/:$/, "");
  return await responseFromAuthUpstream(upstream, requestProto);
}

export async function GET(request: Request) {
  return proxy(request);
}

export async function POST(request: Request) {
  return proxy(request);
}
