import { createHmac, timingSafeEqual } from "node:crypto";

import { ConvexHttpClient } from "convex/browser";
import { cookies } from "next/headers";

import { api } from "@/convex/_generated/api";
import { encryptOAuthToken } from "@/lib/oauth-token-crypto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const STATE_COOKIE = "recruit_google_oauth_state";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const redirectBase = process.env.NEXT_PUBLIC_APP_URL ?? `${url.protocol}//${url.host}`;
  if (!code || !state) {
    return Response.redirect(`${redirectBase}/dashboard?gmail=missing_code`);
  }

  const cookieStore = await cookies();
  const nonce = cookieStore.get(STATE_COOKIE)?.value;
  cookieStore.delete(STATE_COOKIE);
  if (!nonce || !verifyState(state, nonce)) {
    return Response.redirect(`${redirectBase}/dashboard?gmail=bad_state`);
  }

  try {
    const tokens = await exchangeCode(code);
    if (!tokens.refresh_token) throw new Error("missing_refresh_token");
    const profile = await fetchUserInfo(tokens.access_token);
    await convexClient().mutation(api.followups.upsertOAuthConnection, {
      provider: "gmail",
      accountEmail: profile.email,
      scopes: String(tokens.scope ?? "").split(/\s+/).filter(Boolean),
      encryptedRefreshToken: encryptOAuthToken(tokens.refresh_token),
      status: "connected",
    });
    return Response.redirect(`${redirectBase}/dashboard?gmail=connected`);
  } catch (error) {
    const reason = encodeURIComponent(error instanceof Error ? error.message : "oauth_failed");
    return Response.redirect(`${redirectBase}/dashboard?gmail=${reason}`);
  }
}

async function exchangeCode(code: string) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: requiredEnv("GOOGLE_OAUTH_CLIENT_ID"),
      client_secret: requiredEnv("GOOGLE_OAUTH_CLIENT_SECRET"),
      redirect_uri: requiredEnv("GOOGLE_OAUTH_REDIRECT_URI"),
      code,
      grant_type: "authorization_code",
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error_description ?? json.error ?? "token_exchange_failed");
  return json as { access_token: string; refresh_token?: string; scope?: string };
}

async function fetchUserInfo(accessToken: string) {
  const res = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error_description ?? json.error ?? "userinfo_failed");
  return json as { email?: string };
}

function verifyState(state: string, nonce: string) {
  const expected = `${nonce}.${createHmac("sha256", requiredEnv("GOOGLE_OAUTH_STATE_SECRET"))
    .update(nonce)
    .digest("base64url")}`;
  const left = Buffer.from(state);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

function convexClient() {
  const url = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!url) throw new Error("missing_convex_url");
  return new ConvexHttpClient(url.replace(/\/+$/, ""));
}

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`missing_${name.toLowerCase()}`);
  return value;
}
