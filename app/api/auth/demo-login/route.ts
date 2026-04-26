import { adaptCookieForRequest, getSetCookieHeaders } from "@/lib/auth-flow";

// Demo bypass — signs in (or creates and signs in) a single shared demo user
// so reviewers can land in `/onboarding` without OAuth or remembering a
// password. Disabled by setting `NEXT_PUBLIC_DEMO_BYPASS_ENABLED=false`
// (the env is also read on the server via `DEMO_BYPASS_ENABLED`).
//
// The demo account is intentionally a real Better Auth user so all server
// invariants (auth hooks, session cookies, `requireOwner` checks) hold —
// it's just one users everyone shares.

export const dynamic = "force-dynamic";

const DEMO_EMAIL = "demo@recruit.local";
const DEMO_PASSWORD = "DemoUserLocalDevSecure-1234!";
const DEMO_NAME = "Demo User";

function isEnabled(): boolean {
  const flag =
    process.env.DEMO_BYPASS_ENABLED ??
    process.env.NEXT_PUBLIC_DEMO_BYPASS_ENABLED ??
    "true";
  return flag.toLowerCase() !== "false";
}

async function callAuth(
  origin: string,
  path: string,
  body: Record<string, unknown>,
): Promise<Response> {
  return fetch(`${origin}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: origin,
      Accept: "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
}

export async function POST(request: Request) {
  if (!isEnabled()) {
    return Response.json(
      { ok: false, message: "Demo sign-in is disabled in this environment." },
      { status: 403 },
    );
  }

  const url = new URL(request.url);
  const origin = `${url.protocol}//${url.host}`;
  const proto = url.protocol.replace(/:$/, "");

  // Try sign-in first — the demo user usually already exists.
  let signIn = await callAuth(origin, "/api/auth/sign-in/email", {
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
  });

  // If sign-in failed because the user doesn't exist, create them and retry.
  if (!signIn.ok) {
    const signUp = await callAuth(origin, "/api/auth/sign-up/email", {
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      name: DEMO_NAME,
    });
    // 422 = duplicate (race condition between two demo logins); ignore.
    if (!signUp.ok && signUp.status !== 422) {
      const text = await signUp.text().catch(() => "");
      return Response.json(
        {
          ok: false,
          message: `Demo signup failed (${signUp.status}). ${text}`,
        },
        { status: 500 },
      );
    }
    signIn = await callAuth(origin, "/api/auth/sign-in/email", {
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
    });
  }

  if (!signIn.ok) {
    const text = await signIn.text().catch(() => "");
    return Response.json(
      { ok: false, message: `Demo sign-in failed (${signIn.status}). ${text}` },
      { status: 500 },
    );
  }

  // Forward Set-Cookie headers so the browser stores the session.
  const headers = new Headers({ "Content-Type": "application/json" });
  for (const cookie of getSetCookieHeaders(signIn.headers)) {
    headers.append("set-cookie", adaptCookieForRequest(cookie, proto));
  }

  return new Response(
    JSON.stringify({ ok: true, redirect: "/onboarding" }),
    { status: 200, headers },
  );
}
