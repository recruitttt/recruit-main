"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { GithubIcon } from "@/components/ui/brand-icons";
import { Mark } from "@/components/ui/logo";
import { authClient } from "@/lib/auth-client";
import { ArrowRight, Loader2, Lock, Mail, User } from "lucide-react";

type AuthMode = "sign-in" | "sign-up";
type SocialProvider = "google" | "github";

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.24 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A10.99 10.99 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.12-1.43.34-2.1V7.06H2.18A10.99 10.99 0 0 0 1 12c0 1.77.42 3.45 1.18 4.94l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A10.99 10.99 0 0 0 2.18 7.06L5.84 9.9C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  );
}

export function RecruitAuthForm({ mode }: { mode: AuthMode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  const callbackURL = useMemo(() => {
    const redirect = searchParams.get("redirect_url") ?? searchParams.get("redirectTo");
    return redirect && redirect.startsWith("/") ? redirect : "/dashboard";
  }, [searchParams]);

  const isSignUp = mode === "sign-up";
  const title = isSignUp ? "Create your Recruit account" : "Sign in to Recruit";
  const subtitle = isSignUp
    ? "Start your application command center."
    : "Welcome back to your application command center.";
  const alternateHref = isSignUp ? "/sign-in" : "/sign-up";
  const alternateText = isSignUp ? "Already have an account?" : "New to Recruit?";
  const alternateAction = isSignUp ? "Sign in" : "Create account";
  const googleEnabled = process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "1";
  const githubEnabled = process.env.NEXT_PUBLIC_GITHUB_AUTH_ENABLED === "1";
  const socialAuthEnabled = googleEnabled || githubEnabled;

  async function submitEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPendingAction("email");

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

    setPendingAction(null);
    if (result.error) {
      setError(result.error.message ?? "Authentication failed.");
      return;
    }

    router.push(callbackURL);
    router.refresh();
  }

  async function submitSocial(provider: SocialProvider) {
    setError(null);
    setPendingAction(provider);
    const result = await authClient.signIn.social({
      provider,
      callbackURL,
    });

    if (result.error) {
      setPendingAction(null);
      setError(result.error.message ?? `Unable to continue with ${provider}.`);
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

          {socialAuthEnabled && (
            <>
              <div className="mt-7 grid gap-3">
                {googleEnabled && (
                  <button
                    type="button"
                    className="flex h-11 items-center justify-center gap-2 rounded-full border border-white/70 bg-white/54 px-4 text-[13px] font-semibold text-[#101827] shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_10px_24px_rgba(15,23,42,0.045)] transition hover:bg-white/68 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={pendingAction !== null}
                    onClick={() => void submitSocial("google")}
                  >
                    {pendingAction === "google" ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleIcon className="h-4 w-4" />}
                    Continue with Google
                  </button>
                )}
                {githubEnabled && (
                  <button
                    type="button"
                    className="flex h-11 items-center justify-center gap-2 rounded-full border border-white/70 bg-white/54 px-4 text-[13px] font-semibold text-[#101827] shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_10px_24px_rgba(15,23,42,0.045)] transition hover:bg-white/68 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={pendingAction !== null}
                    onClick={() => void submitSocial("github")}
                  >
                    {pendingAction === "github" ? <Loader2 className="h-4 w-4 animate-spin" /> : <GithubIcon className="h-4 w-4" />}
                    Continue with GitHub
                  </button>
                )}
              </div>

              <div className="my-7 flex items-center gap-4">
                <div className="h-px flex-1 bg-white/55" />
                <span className="font-mono text-[11px] font-semibold uppercase text-[#6B7A90]">or</span>
                <div className="h-px flex-1 bg-white/55" />
              </div>
            </>
          )}

          <form className={socialAuthEnabled ? "grid gap-4" : "mt-7 grid gap-4"} onSubmit={submitEmail}>
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

            {error && (
              <p className="rounded-2xl border border-red-300/50 bg-red-50/70 px-3 py-2 text-sm text-red-700">
                {error}
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
        </section>
      </div>
    </main>
  );
}
