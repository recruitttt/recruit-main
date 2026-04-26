export type AuthMode = "sign-in" | "sign-up";

const DEFAULT_REDIRECT = "/dashboard";
const DEFAULT_ONBOARDING_REDIRECT = "/onboarding?step=2";
const DEFAULT_OAUTH_REDIRECT = DEFAULT_ONBOARDING_REDIRECT;

function errorMessage(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;

  if ("message" in error && typeof error.message === "string") {
    return error.message;
  }

  if (
    "error" in error &&
    error.error &&
    typeof error.error === "object" &&
    "message" in error.error &&
    typeof error.error.message === "string"
  ) {
    return error.error.message;
  }

  return null;
}

function errorCode(error: unknown): string | null {
  if (!error || typeof error !== "object") return null;

  if ("code" in error && typeof error.code === "string") {
    return error.code;
  }

  if (
    "error" in error &&
    error.error &&
    typeof error.error === "object" &&
    "code" in error.error &&
    typeof error.error.code === "string"
  ) {
    return error.error.code;
  }

  return null;
}

export function authErrorMessage(mode: AuthMode, error: unknown) {
  const fallback =
    mode === "sign-in"
      ? "Unable to sign in. Check your email and password, then try again."
      : "Unable to create the account. Check the details and try again.";

  const message = errorMessage(error);
  const code = errorCode(error);

  // Specific error codes from Better Auth — surface real, helpful messages.
  if (code === "PROVIDER_NOT_FOUND") {
    return "GitHub sign-in is misconfigured on the server (provider not registered). Try email sign-in or contact support.";
  }
  if (code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL" || /USER_ALREADY_EXISTS/i.test(code ?? "")) {
    return "An account already exists for that email. Sign in instead.";
  }
  if (code === "PASSWORD_TOO_SHORT") {
    return "Password too short — use at least 8 characters.";
  }
  if (code === "INVALID_EMAIL_OR_PASSWORD") {
    return "No account matched that email and password. Create an account first or try again.";
  }
  if (code === "EMAIL_NOT_VERIFIED") {
    return "Verify your email address before signing in.";
  }

  if (!message) return fallback;
  if (/fetch failed|network|failed to fetch/i.test(message)) {
    return "Auth service is unavailable right now. Try again in a minute.";
  }
  // Surface message-level patterns ONLY for actual credential errors —
  // never for provider/state errors that contain "found" or "user".
  if (/invalid email or password|invalid credentials|wrong password|incorrect password/i.test(message)) {
    return mode === "sign-in"
      ? "No account matched that email and password. Create an account first or try again."
      : "Unable to create the account with those details. Try a different email or password.";
  }

  return message;
}

export function safeRedirectPath(
  raw: string | null | undefined,
  fallback = DEFAULT_REDIRECT
) {
  if (!raw) return fallback;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.startsWith("/\\")) {
    return fallback;
  }

  try {
    const parsed = new URL(raw, "https://recruit.local");
    if (parsed.origin !== "https://recruit.local") return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

export function buildOAuthCompletionURL(origin: string, redirectPath: string) {
  const url = new URL("/api/auth/complete-oauth", origin);
  url.searchParams.set(
    "redirect",
    safeRedirectPath(redirectPath, DEFAULT_OAUTH_REDIRECT)
  );
  return url.toString();
}

export function authSuccessRedirectPath(
  mode: AuthMode,
  raw: string | null | undefined
) {
  return safeRedirectPath(
    raw,
    mode === "sign-up" ? DEFAULT_ONBOARDING_REDIRECT : DEFAULT_REDIRECT
  );
}

export function authNewUserRedirectPath(
  mode: AuthMode,
  raw: string | null | undefined
) {
  return safeRedirectPath(
    raw,
    mode === "sign-in" ? DEFAULT_ONBOARDING_REDIRECT : DEFAULT_ONBOARDING_REDIRECT
  );
}

export function getConvexSiteUrl(
  env: Pick<NodeJS.ProcessEnv, string> = process.env
) {
  const explicit = env.NEXT_PUBLIC_CONVEX_SITE_URL ?? env.CONVEX_SITE_URL;
  if (explicit) return explicit.replace(/\/+$/, "");

  const convexUrl = env.NEXT_PUBLIC_CONVEX_URL;
  if (convexUrl?.endsWith(".convex.cloud")) {
    return convexUrl.replace(".convex.cloud", ".convex.site");
  }

  return null;
}

export function getSetCookieHeaders(headers: Headers): string[] {
  const withGetSetCookie = headers as Headers & {
    getSetCookie?: () => string[];
  };
  const setCookies = withGetSetCookie.getSetCookie?.();
  if (setCookies?.length) return setCookies;

  const combined = headers.get("set-cookie");
  if (!combined) return [];
  return combined.split(/,(?=\s*[^;,=\s]+=[^;,]*)/g).map((value) => value.trim());
}

/**
 * Bidirectional cookie matching: Convex Better Auth STORES cookies with the
 * `__Secure-` prefix and reads them back under the SAME name on subsequent
 * requests. Stripping the prefix on the way out would break the cookie name
 * round-trip. Modern browsers (Chrome, Firefox, Safari) accept `__Secure-`
 * cookies on `http://localhost` via the loopback exception, so we leave the
 * cookie unchanged in both directions.
 */
export function adaptCookieForRequest(cookie: string, _requestProto: string): string {
  return cookie;
}
