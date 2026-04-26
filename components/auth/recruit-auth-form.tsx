"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Mark } from "@/components/ui/logo";
import {
  authErrorMessage,
  authNewUserRedirectPath,
  authSuccessRedirectPath,
  buildOAuthCompletionURL,
} from "@/lib/auth-flow";
import { authClient } from "@/lib/auth-client";
import { ArrowRight, Loader2, Lock, Mail, User } from "lucide-react";

// Inline GitHub octocat mark (lucide-react v1.9 has no Github icon).
function GithubGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.11.79-.25.79-.56 0-.28-.01-1.02-.02-2-3.2.7-3.88-1.54-3.88-1.54-.52-1.34-1.28-1.69-1.28-1.69-1.05-.72.08-.71.08-.71 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.71 1.26 3.37.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.27-5.24-5.65 0-1.25.45-2.27 1.18-3.07-.12-.29-.51-1.46.11-3.04 0 0 .96-.31 3.16 1.17a10.97 10.97 0 0 1 5.75 0c2.2-1.48 3.16-1.17 3.16-1.17.62 1.58.23 2.75.11 3.04.74.8 1.18 1.82 1.18 3.07 0 4.39-2.7 5.36-5.27 5.64.41.36.78 1.06.78 2.14 0 1.55-.01 2.79-.01 3.17 0 .31.21.68.8.56C20.21 21.39 23.5 17.07 23.5 12 23.5 5.65 18.35.5 12 .5z" />
    </svg>
  );
}

type AuthMode = "sign-in" | "sign-up";

// OAuth flow surfaces failures by redirecting back to /sign-in?error=<code>.
// Map those server-side codes to user-facing messages so a silent OAuth
// failure doesn't get mistaken for an email/password problem.
const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  oauth_missing_token:
    "GitHub sign-in didn't return a session token. Try again.",
  oauth_auth_unconfigured:
    "GitHub sign-in is not configured for this environment. Contact support.",
  oauth_session_exchange_failed:
    "GitHub sign-in finished but we couldn't validate the session. Try again — if this keeps happening, sign in with email instead.",
  oauth_state_mismatch:
    "GitHub sign-in security check failed (the OAuth state didn't match). Try again from the sign-in page.",
  state_mismatch:
    "GitHub sign-in expired or was opened from an old tab. Start again from this page.",
  please_restart_the_process:
    "GitHub sign-in expired. Start again from this page.",
  oauth_restart_required:
    "GitHub sign-in was interrupted or expired. Start again from this page.",
  oauth_provider_not_found:
    "GitHub provider isn't enabled on the server. Contact support.",
};

export function RecruitAuthForm({ mode }: { mode: AuthMode }) {
  const searchParams = useSearchParams();
  const oauthErrorCode = searchParams.get("error");
  const oauthError = useMemo(() => {
    if (!oauthErrorCode) return null;
    return (
      OAUTH_ERROR_MESSAGES[oauthErrorCode] ??
      `Sign-in failed (${oauthErrorCode}). Try again.`
    );
  }, [oauthErrorCode]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [clearedOAuthErrorCode, setClearedOAuthErrorCode] = useState<string | null>(
    null
  );
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const callbackURL = useMemo(() => {
    const redirect = searchParams.get("redirect_url") ?? searchParams.get("redirectTo");
    return authSuccessRedirectPath(mode, redirect);
  }, [mode, searchParams]);
  const newUserCallbackURL = useMemo(() => {
    const redirect = searchParams.get("redirect_url") ?? searchParams.get("redirectTo");
    return authNewUserRedirectPath(mode, redirect);
  }, [mode, searchParams]);

  const displayedError =
    error ?? (oauthErrorCode !== clearedOAuthErrorCode ? oauthError : null);

  function clearErrorsForNewAttempt() {
    setError(null);
    if (oauthErrorCode) setClearedOAuthErrorCode(oauthErrorCode);
  }

  const isSignUp = mode === "sign-up";
  const title = isSignUp ? "Create your Recruit account" : "Sign in to Recruit";
  const subtitle = isSignUp
    ? "Start your application command center."
    : "Welcome back to your application command center.";
  const alternateHref = isSignUp ? "/sign-in" : "/sign-up";
  const alternateText = isSignUp ? "Already have an account?" : "New to Recruit?";
  const alternateAction = isSignUp ? "Sign in" : "Create account";

  async function submitEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    clearErrorsForNewAttempt();
    setPendingAction("email");

    try {
      const result = isSignUp
        ? await authClient.signUp.email({
            email,
            password,
            name: name || email.split("@")[0] || "Recruit user",
            callbackURL,
          })
        : await authClient.signIn.email({
            email,
            password,
            callbackURL,
          });

      if (result.error) {
        setError(authErrorMessage(mode, result.error));
        return;
      }

      window.location.assign(callbackURL);
    } catch (error) {
      setError(authErrorMessage(mode, error));
    } finally {
      setPendingAction(null);
    }
  }

  // GitHub returns to Convex first, then /api/auth/complete-oauth exchanges the
  // one-time token and lands the user in onboarding with same-origin cookies.
  async function continueWithGitHub() {
    clearErrorsForNewAttempt();
    setPendingAction("github");

    try {
      const result = await authClient.signIn.social({
        provider: "github",
        callbackURL: buildOAuthCompletionURL(window.location.origin, callbackURL),
        newUserCallbackURL: buildOAuthCompletionURL(
          window.location.origin,
          newUserCallbackURL
        ),
        errorCallbackURL: new URL(
          "/sign-in?error=oauth_restart_required",
          window.location.origin
        ).toString(),
      });

      if (result.error) {
        setError(authErrorMessage(mode, result.error));
        setPendingAction(null);
      }
      // Successful social sign-in returns a redirect URL — the better-auth
      // client follows it automatically, so we leave `pendingAction` set so
      // the spinner stays visible during the navigation.
    } catch (error) {
      setError(authErrorMessage(mode, error));
      setPendingAction(null);
    }
  }

  // Demo bypass — signs in (or signs up + signs in) a fixed local-dev user
  // so reviewers/screenshot makers can land in `/onboarding` without an OAuth
  // round-trip or remembering a password. Disabled on origins flagged as
  // production by NEXT_PUBLIC_DEMO_BYPASS_ENABLED=false.
  async function continueAsDemo() {
    clearErrorsForNewAttempt();
    setPendingAction("demo");

    try {
      const response = await fetch("/api/auth/demo-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const body = (await response.json().catch(() => null)) as
        | { ok: true; redirect: string }
        | { ok: false; message?: string }
        | null;

      if (!response.ok || !body?.ok) {
        setError(
          body && !body.ok && body.message
            ? body.message
            : "Demo sign-in failed. Try again.",
        );
        setPendingAction(null);
        return;
      }
      window.location.assign(body.redirect ?? "/onboarding");
    } catch (error) {
      setError(authErrorMessage(mode, error));
      setPendingAction(null);
    }
  }

  return (
    <main className="relative flex min-h-[100dvh] w-full items-center justify-center overflow-hidden bg-[#CDD5DF] px-4 py-10 text-[#101827]">
      <div className="mx-auto flex w-full max-w-[460px] flex-col items-center gap-5">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-full border border-white/60 bg-white/40 px-3 py-2 text-sky-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.75),0_14px_40px_rgba(15,23,42,0.08)] backdrop-blur-2xl"
          aria-label="Recruit home"
        >
          <Mark size="sm" className="text-sky-600" />
          <span className="font-serif text-[19px] leading-none">recruit</span>
        </Link>

        <section className="w-full rounded-[28px] border border-white/55 bg-white/42 p-6 shadow-[0_24px_70px_rgba(15,23,42,0.13),inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-2xl sm:p-8">
          <div className="text-center">
            <h1 className="font-serif text-[30px] font-normal leading-none text-[#101827]">
              {title}
            </h1>
            <p className="mt-3 text-sm leading-6 text-[#465568]">{subtitle}</p>
          </div>

          <button
            type="button"
            onClick={continueWithGitHub}
            disabled={pendingAction !== null}
            className="mt-7 flex h-11 w-full items-center justify-center gap-2 rounded-full border border-white/70 bg-[#101827] px-4 text-[13px] font-semibold text-white shadow-[0_14px_32px_rgba(15,23,42,0.18)] transition hover:bg-[#1C2637] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pendingAction === "github" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <GithubGlyph className="h-4 w-4" />
                Continue with GitHub
              </>
            )}
          </button>

          <div className="my-5 flex items-center gap-3 text-[11px] uppercase tracking-wider text-[#6B7A90]">
            <span className="h-px flex-1 bg-white/55" />
            or use email
            <span className="h-px flex-1 bg-white/55" />
          </div>

          <form className="grid gap-4" onSubmit={submitEmail}>
            {isSignUp && (
              <label className="grid gap-2">
                <span className="font-mono text-[11px] font-semibold uppercase text-[#465568]">Name</span>
                <span className="flex h-11 items-center gap-2 rounded-full border border-white/70 bg-white/54 px-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] focus-within:border-sky-300 focus-within:ring-2 focus-within:ring-sky-400/20">
                  <User className="h-4 w-4 text-[#6B7A90]" />
                  <input value={name} onChange={(event) => setName(event.target.value)} className="h-full flex-1 bg-transparent text-sm text-[#101827] outline-none placeholder:text-[#6B7A90]" placeholder="Your name" autoComplete="name" />
                </span>
              </label>
            )}

            <label className="grid gap-2">
              <span className="font-mono text-[11px] font-semibold uppercase text-[#465568]">Email address</span>
              <span className="flex h-11 items-center gap-2 rounded-full border border-white/70 bg-white/54 px-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] focus-within:border-sky-300 focus-within:ring-2 focus-within:ring-sky-400/20">
                <Mail className="h-4 w-4 text-[#6B7A90]" />
                <input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="h-full flex-1 bg-transparent text-sm text-[#101827] outline-none placeholder:text-[#6B7A90]" placeholder="you@example.com" autoComplete="email" />
              </span>
            </label>

            <label className="grid gap-2">
              <span className="font-mono text-[11px] font-semibold uppercase text-[#465568]">Password</span>
              <span className="flex h-11 items-center gap-2 rounded-full border border-white/70 bg-white/54 px-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] focus-within:border-sky-300 focus-within:ring-2 focus-within:ring-sky-400/20">
                <Lock className="h-4 w-4 text-[#6B7A90]" />
                <input type="password" required minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} className="h-full flex-1 bg-transparent text-sm text-[#101827] outline-none placeholder:text-[#6B7A90]" placeholder="At least 8 characters" autoComplete={isSignUp ? "new-password" : "current-password"} />
              </span>
            </label>

            {displayedError && (
              <p className="rounded-2xl border border-red-300/50 bg-red-50/70 px-3 py-2 text-sm text-red-700">
                {displayedError}
              </p>
            )}

            <button
              type="submit"
              className="mt-1 flex h-11 items-center justify-center gap-2 rounded-full bg-[#101827] px-4 text-[13px] font-semibold text-white shadow-[0_14px_32px_rgba(15,23,42,0.18)] transition hover:bg-[#1C2637] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={pendingAction !== null}
            >
              {pendingAction === "email" ? <Loader2 className="h-4 w-4 animate-spin" /> : <>{isSignUp ? "Create account" : "Continue"}<ArrowRight className="h-4 w-4" /></>}
            </button>
          </form>

          <div className="mt-7 text-center text-sm text-[#465568]">
            {alternateText}{" "}
            <Link href={alternateHref} className="font-semibold text-sky-700 hover:text-sky-800">
              {alternateAction}
            </Link>
          </div>

          <button
            type="button"
            onClick={continueAsDemo}
            disabled={pendingAction !== null}
            className="mt-4 flex h-9 w-full items-center justify-center gap-1.5 rounded-full border border-dashed border-[#6B7A90]/50 bg-transparent px-3 text-[12px] font-medium text-[#465568] transition hover:border-sky-400 hover:bg-white/40 hover:text-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pendingAction === "demo" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              "Continue as demo user — skip auth"
            )}
          </button>
        </section>
      </div>
    </main>
  );
}
