import { createHmac, randomBytes } from "node:crypto";

import { cookies } from "next/headers";

import { GMAIL_SCOPES } from "@/lib/gmail-followups";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const STATE_COOKIE = "recruit_google_oauth_state";

export async function GET() {
  const nonce = randomBytes(16).toString("base64url");
  const state = signState(nonce);
  const cookieStore = await cookies();
  cookieStore.set(STATE_COOKIE, nonce, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 10 * 60,
  });

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", requiredEnv("GOOGLE_OAUTH_CLIENT_ID"));
  url.searchParams.set("redirect_uri", requiredEnv("GOOGLE_OAUTH_REDIRECT_URI"));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("scope", [...GMAIL_SCOPES, "openid", "email"].join(" "));
  url.searchParams.set("state", state);

  return Response.redirect(url);
}

function signState(nonce: string) {
  return `${nonce}.${createHmac("sha256", requiredEnv("GOOGLE_OAUTH_STATE_SECRET"))
    .update(nonce)
    .digest("base64url")}`;
}

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`missing_${name.toLowerCase()}`);
  return value;
}
