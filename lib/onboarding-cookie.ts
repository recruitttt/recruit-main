// Onboarding gate cookie — set when the user finishes onboarding so the
// (app) layout knows to let them through to /dashboard. Browser-scoped so
// the shared demo user re-runs onboarding per browser unless that browser
// already finished it.
//
// Server reads via cookies().get(ONBOARDING_COOKIE_NAME) in the (app) layout.
// Client writes via setOnboardingCookie() at the end of /onboarding.

export const ONBOARDING_COOKIE_NAME = "recruit_onboarded";
export const ONBOARDING_COOKIE_VALUE = "1";

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export function setOnboardingCookie(): void {
  if (typeof document === "undefined") return;
  const secure =
    typeof window !== "undefined" && window.location.protocol === "https:"
      ? "; Secure"
      : "";
  document.cookie = `${ONBOARDING_COOKIE_NAME}=${ONBOARDING_COOKIE_VALUE}; Path=/; Max-Age=${ONE_YEAR_SECONDS}; SameSite=Lax${secure}`;
}

export function clearOnboardingCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${ONBOARDING_COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`;
}

export function readOnboardingCookieClient(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie
    .split(";")
    .map((c) => c.trim())
    .some((c) => c === `${ONBOARDING_COOKIE_NAME}=${ONBOARDING_COOKIE_VALUE}`);
}
