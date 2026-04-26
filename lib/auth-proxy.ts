import { adaptCookieForRequest, getConvexSiteUrl } from "@/lib/auth-flow";

export const AUTH_PROXY_HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "host",
  "content-length",
]);

export function buildAuthForwardHeaders(request: Request, targetHost: string) {
  const headers = new Headers();
  request.headers.forEach((value, key) => {
    if (AUTH_PROXY_HOP_BY_HOP_HEADERS.has(key.toLowerCase())) return;
    headers.set(key, value);
  });

  const url = new URL(request.url);
  headers.set("host", targetHost);
  headers.set("x-forwarded-host", url.host);
  headers.set("x-forwarded-proto", url.protocol.replace(/:$/, ""));
  headers.set("x-better-auth-forwarded-host", url.host);
  headers.set("x-better-auth-forwarded-proto", url.protocol.replace(/:$/, ""));
  headers.set("accept-encoding", "identity");
  return headers;
}

export function copyAuthResponseHeaders(
  source: Headers,
  requestProto: string
): Headers {
  const out = new Headers();
  source.forEach((value, key) => {
    if (AUTH_PROXY_HOP_BY_HOP_HEADERS.has(key.toLowerCase())) return;
    if (key.toLowerCase() === "set-cookie") return;
    out.set(key, value);
  });
  const withGetSetCookie = source as Headers & {
    getSetCookie?: () => string[];
  };
  const setCookies = withGetSetCookie.getSetCookie?.();
  const list = setCookies?.length
    ? setCookies
    : source.get("set-cookie")?.split(/,(?=\s*[^;,=\s]+=[^;,]*)/g) ?? [];
  for (const raw of list) {
    out.append("set-cookie", adaptCookieForRequest(raw.trim(), requestProto));
  }
  return out;
}

export async function responseFromAuthUpstream(
  upstream: Response,
  requestProto: string
): Promise<Response> {
  const headers = copyAuthResponseHeaders(upstream.headers, requestProto);
  const body = upstream.body ? await upstream.arrayBuffer() : null;
  return new Response(body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });
}

export function getAuthProxyTarget(request: Request) {
  const convexSiteUrl = getConvexSiteUrl();
  if (!convexSiteUrl) return null;

  const requestUrl = new URL(request.url);
  const targetHost = new URL(convexSiteUrl).host;
  return {
    requestUrl,
    targetHost,
    targetUrl: `${convexSiteUrl}${requestUrl.pathname}${requestUrl.search}`,
  };
}
