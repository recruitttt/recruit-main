import {
  adaptCookieForRequest,
  getConvexSiteUrl,
  getSetCookieHeaders,
  safeRedirectPath,
} from "@/lib/auth-flow";

function redirectResponse(location: string, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("location", location);
  return new Response(null, {
    ...init,
    status: init?.status ?? 302,
    headers,
  });
}

function authErrorRedirect(code: string) {
  return redirectResponse(`/sign-in?error=${encodeURIComponent(code)}`);
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const token = requestUrl.searchParams.get("ott");
  const redirectTo = safeRedirectPath(
    requestUrl.searchParams.get("redirect"),
    "/onboarding"
  );

  if (!token) return authErrorRedirect("oauth_missing_token");

  const convexSiteUrl = getConvexSiteUrl();
  if (!convexSiteUrl) return authErrorRedirect("oauth_auth_unconfigured");

  const proto = requestUrl.protocol.replace(/:$/, "") || "https";
  const verifyResponse = await fetch(
    `${convexSiteUrl}/api/auth/cross-domain/one-time-token/verify`,
    {
      method: "POST",
      headers: {
        accept: "application/json",
        "accept-encoding": "identity",
        "content-type": "application/json",
        "x-forwarded-host": requestUrl.host,
        "x-forwarded-proto": proto,
        "x-better-auth-forwarded-host": requestUrl.host,
        "x-better-auth-forwarded-proto": proto,
      },
      body: JSON.stringify({ token }),
      cache: "no-store",
      redirect: "manual",
    }
  );

  if (!verifyResponse.ok) {
    return authErrorRedirect("oauth_session_exchange_failed");
  }

  const headers = new Headers();
  for (const cookie of getSetCookieHeaders(verifyResponse.headers)) {
    headers.append("set-cookie", adaptCookieForRequest(cookie, proto));
  }

  return redirectResponse(redirectTo, { headers });
}
