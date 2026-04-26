"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Mark } from "@/components/ui/logo";
import { authClient } from "@/lib/auth-client";
import { ArrowRight, Loader2, Lock, Mail, User } from "lucide-react";

type AuthMode = "sign-in" | "sign-up";

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

          <form className="mt-7 grid gap-4" onSubmit={submitEmail}>
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
