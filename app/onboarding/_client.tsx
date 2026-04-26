"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAction, useConvexAuth, useMutation, useQuery } from "convex/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { X } from "lucide-react";

import { Wordmark } from "@/components/ui/logo";
import {
  ActionButton,
  GlassCard,
  cx,
  mistClasses,
} from "@/components/design-system";
import { AgentCharacter } from "@/components/onboarding/characters";
import { TypingIndicator, UserMessage } from "@/components/onboarding/chat";
import { ScoutMessage } from "@/components/onboarding/scout-message";
import { ProgressBar } from "@/components/onboarding/progress-bar";
import { IntakeSummary } from "@/components/onboarding/intake-summary";
import { ProfileCard } from "@/components/onboarding/profile-card";
import { TestimonialBadge } from "@/components/onboarding/testimonial-card";
import { SoundToggle } from "@/components/onboarding/sound-toggle";
import { ActivationOrbit } from "@/components/onboarding/activation-orbit";
import { SquadWelcome } from "@/components/onboarding/squad-welcome";
import { TrustRow } from "@/components/onboarding/trust-row";
import { ScoutDock } from "@/components/scout/scout-dock";
import { AccountStepCard } from "@/app/onboarding/steps/account-step";
import { ResumeStepCard } from "@/app/onboarding/steps/resume-step";
import { ConnectStepCard } from "@/app/onboarding/steps/connect-step";
import { PrefsStepCard } from "@/app/onboarding/steps/prefs-step";
import { ActivateStepCard } from "@/app/onboarding/steps/activate-step";

import { authClient } from "@/lib/auth-client";
import {
  buildOAuthCompletionURL,
  buildOAuthLinkCallbackURL,
} from "@/lib/auth-flow";
import { setOnboardingCookie } from "@/lib/onboarding-cookie";
import {
  isGithubConnected,
  isLinkedinProfileUrl,
  normalizeLinkedinProfileUrl,
  shouldAutoStartGithubIntake,
} from "@/lib/intake/shared/source-state";
import {
  startLinkedinIntake,
  streamResumeIntake,
} from "@/lib/intake/shared/client-stream";
import { trimLinks } from "@/lib/intake/shared/url-utils";
import { playActivate, playReceive, playSend } from "@/lib/sounds";
import { speak } from "@/lib/speech";
import { logProfileEvent, mergeProfile } from "@/lib/profile";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

import {
  EMPTY,
  STEP_INDEX,
  STEP_ORDER,
  STEP_PROMPTS,
  STORAGE,
  resolveStartingStep,
  type ChatEntry,
  type Data,
  type DataUpdate,
  type Step,
} from "@/app/onboarding/_data";

export function OnboardingClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roleParam = searchParams.get("role");
  const stepParam = searchParams.get("step");
  const session = authClient.useSession();
  const userId = session.data?.user?.id ?? null;
  const sessionEmail = session.data?.user?.email ?? "";
  const convexAuth = useConvexAuth();
  const canReadConvex = Boolean(userId && convexAuth.isAuthenticated);
  const reduceMotion = useReducedMotion();

  const initialStep = useMemo(
    () => resolveStartingStep(stepParam),
    [stepParam],
  );

  const [data, setData] = useState<Data>(EMPTY);
  const [step, setStep] = useState<Step>(initialStep);
  const [messages, setMessages] = useState<ChatEntry[]>([
    { id: `a-${initialStep}`, kind: "agent", text: STEP_PROMPTS[initialStep] },
  ]);
  const [parsingResume, setParsingResume] = useState(false);
  const [resumeError, setResumeError] = useState<string | null>(null);
  const [typing, setTyping] = useState(false);
  const [activating, setActivating] = useState(false);
  // Squad-welcome splash. Defaults to hidden on the server so SSR matches the
  // common case (returning users); we flip it on after mount if the flag is
  // unset AND the user is landing on step 1 unauthenticated.
  const [showSplash, setShowSplash] = useState(false);
  const [splashHydrated, setSplashHydrated] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<{ step: Step; data: Data; messages: ChatEntry[] }[]>(
    [],
  );
  const githubAutoStartRef = useRef<string | null>(null);
  const lastSpokenRef = useRef<string | null>(null);

  // Speak each new agent message via ElevenLabs TTS. Tracks the last-spoken
  // id so re-renders don't replay, and so back-stepping (which trims older
  // agent entries) doesn't cause the prior message to speak again.
  useEffect(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.kind !== "agent") continue;
      if (lastSpokenRef.current === m.id) return;
      lastSpokenRef.current = m.id;
      void speak(m.text);
      return;
    }
  }, [messages]);

  const stepIndex = STEP_INDEX[step];
  const totalSteps = STEP_ORDER.length;

  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const markOnboardingComplete = useMutation(
    api.userProfiles.markOnboardingComplete,
  );
  const runGithubIntake = useAction(api.intakeActions.runGithubIntake);
  const runWebIntake = useAction(api.intakeActions.runWebIntake);

  const githubRun = useQuery(
    api.intakeRuns.byUserKind,
    canReadConvex ? { userId, kind: "github" } : "skip",
  );
  const accountConnections = useQuery(
    api.auth.connectedAccounts,
    canReadConvex ? { userId } : "skip",
  );
  const linkedinRun = useQuery(
    api.intakeRuns.byUserKind,
    canReadConvex ? { userId, kind: "linkedin" } : "skip",
  );
  const resumeRun = useQuery(
    api.intakeRuns.byUserKind,
    canReadConvex ? { userId, kind: "resume" } : "skip",
  );
  const webRun = useQuery(
    api.intakeRuns.byUserKind,
    canReadConvex ? { userId, kind: "web" } : "skip",
  );
  const githubConnected = isGithubConnected(accountConnections);

  // ---------------------------------------------------------------------------
  // Effects
  // ---------------------------------------------------------------------------

  useEffect(() => {
    router.prefetch("/ready");
  }, [router]);

  // Decide whether to show the squad-welcome splash. Skipped if: the user
  // has seen it before (flag), is already deep-linking to a later step, or
  // is already authenticated (returning visitor). The flag is read from
  // localStorage so we wait until after mount to flip it on (SSR cannot read).
  useEffect(() => {
    let dismissed = true;
    if (!stepParam && !session.data?.user) {
      try {
        dismissed =
          localStorage.getItem("recruit:onboarding:intro-dismissed") === "1";
      } catch {
        dismissed = true;
      }
    }
    /* eslint-disable react-hooks/set-state-in-effect --
       localStorage is browser-only; splash visibility must be hydrated
       post-mount and there is no external system to subscribe to. */
    setShowSplash(!dismissed);
    setSplashHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [session.data?.user, stepParam]);

  const dismissSplash = useCallback(() => {
    try {
      localStorage.setItem("recruit:onboarding:intro-dismissed", "1");
    } catch {}
    setShowSplash(false);
  }, []);

  useEffect(() => {
    let next = EMPTY;
    try {
      const raw = localStorage.getItem(STORAGE);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Data>;
        next = {
          ...EMPTY,
          ...parsed,
          links: { ...EMPTY.links, ...(parsed.links ?? {}) },
          prefs: { ...EMPTY.prefs, ...(parsed.prefs ?? {}) },
        };
      }
    } catch {}
    const id = window.setTimeout(() => setData(next), 0);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    const email = sessionEmail.trim();
    if (!email) return;
    const id = window.setTimeout(() => {
      setData((current) =>
        current.email.trim() ? current : { ...current, email },
      );
    }, 0);
    return () => window.clearTimeout(id);
  }, [sessionEmail]);

  useEffect(() => {
    if (!roleParam) return;
    const id = window.setTimeout(() => {
      setData((current) => {
        if (current.prefs.roles.includes(roleParam)) return current;
        return {
          ...current,
          prefs: {
            ...current.prefs,
            roles: [roleParam, ...current.prefs.roles],
          },
        };
      });
    }, 0);
    return () => window.clearTimeout(id);
  }, [roleParam]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE, JSON.stringify(data));
      if (data.email || data.resumeFilename || data.prefs.roles.length > 0) {
        logProfileEvent("chat", "Persisted onboarding state", "info", {
          hasEmail: Boolean(data.email),
          resumeFilename: data.resumeFilename || undefined,
          roles: data.prefs.roles,
        });
      }
    } catch {}
  }, [data]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, typing, step]);

  useEffect(() => {
    if (!userId || !canReadConvex) return;
    if (
      !shouldAutoStartGithubIntake({ connected: githubConnected, run: githubRun })
    ) {
      return;
    }
    const key = `${userId}:github`;
    if (githubAutoStartRef.current === key) return;
    githubAutoStartRef.current = key;
    void runGithubIntake({ userId }).catch((err) => {
      githubAutoStartRef.current = null;
      logProfileEvent("github", "GitHub intake failed to start", "error", {
        message: err instanceof Error ? err.message : String(err),
      });
    });
  }, [canReadConvex, githubConnected, githubRun, runGithubIntake, userId]);

  // ---------------------------------------------------------------------------
  // Derived state + mutators
  // ---------------------------------------------------------------------------

  const selectedRoles = useMemo(() => {
    if (!roleParam || data.prefs.roles.includes(roleParam))
      return data.prefs.roles;
    return [roleParam, ...data.prefs.roles];
  }, [data.prefs.roles, roleParam]);

  const linkCount = Object.values(data.links).filter((v) => v.trim()).length;
  const accountEmail = data.email || sessionEmail;

  const completeCount = [
    Boolean(accountEmail || session.data?.user),
    Boolean(data.resumeFilename),
    linkCount > 0 || githubConnected,
    selectedRoles.length > 0,
    Boolean(data.prefs.location || data.prefs.workAuth),
  ].filter(Boolean).length;

  const updateData = useCallback((updates: DataUpdate) => {
    setData((current) => ({
      ...current,
      ...updates,
      links: { ...current.links, ...(updates.links ?? {}) },
      prefs: { ...current.prefs, ...(updates.prefs ?? {}) },
    }));
  }, []);

  const toggleRole = (role: string) => {
    updateData({
      prefs: {
        ...data.prefs,
        roles: selectedRoles.includes(role)
          ? selectedRoles.filter((r) => r !== role)
          : [...selectedRoles, role],
      },
    });
  };

  const advance = (userText: string, nextStep: Step) => {
    historyRef.current = [
      ...historyRef.current,
      { step, data, messages },
    ];
    setMessages((current) => [
      ...current,
      { id: `u-${current.length}-${step}`, kind: "user", text: userText },
    ]);
    playSend();
    setTyping(true);
    window.setTimeout(() => {
      setTyping(false);
      setStep(nextStep);
      setMessages((current) => [
        ...current,
        {
          id: `a-${current.length}-${nextStep}`,
          kind: "agent",
          text: STEP_PROMPTS[nextStep],
        },
      ]);
      playReceive();
    }, 360);
  };

  const handleBack = () => {
    if (typing || activating) return;
    const last = historyRef.current[historyRef.current.length - 1];
    if (last) {
      historyRef.current = historyRef.current.slice(0, -1);
      setStep(last.step);
      setData(last.data);
      setMessages(last.messages);
      return;
    }
    if (stepIndex <= 0) return;
    const prev = STEP_ORDER[stepIndex - 1];
    setStep(prev);
    setMessages((current) => {
      const trimmed = [...current];
      while (trimmed.length > 0 && trimmed[trimmed.length - 1].kind !== "agent") {
        trimmed.pop();
      }
      if (trimmed.length > 0 && trimmed[trimmed.length - 1].kind === "agent") {
        trimmed.pop();
      }
      return trimmed.length > 0
        ? trimmed
        : [{ id: `a-${prev}`, kind: "agent", text: STEP_PROMPTS[prev] }];
    });
  };

  // ---------------------------------------------------------------------------
  // Step handlers
  // ---------------------------------------------------------------------------

  const handleGithubSignIn = useCallback(async () => {
    try {
      await authClient.signIn.social({
        provider: "github",
        callbackURL: buildOAuthCompletionURL(
          window.location.origin,
          "/onboarding?step=2",
        ),
        errorCallbackURL: new URL(
          "/sign-in?error=oauth_restart_required",
          window.location.origin,
        ).toString(),
      });
    } catch (error) {
      logProfileEvent("github", "GitHub OAuth failed to start", "error", {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }, []);

  const handleEmailContinue = () => {
    router.push("/sign-up?redirect_url=/onboarding?step=2");
  };

  const handleResumeFile = async (file: File | null) => {
    if (!file) return;
    if (!userId) {
      setResumeError(
        "Sign in first so we can attach your resume to your profile.",
      );
      return;
    }

    setResumeError(null);
    setParsingResume(true);
    updateData({ resumeFilename: file.name });

    mergeProfile(
      {
        resume: {
          filename: file.name,
          uploadedAt: new Date().toISOString(),
        },
      },
      "resume",
      "Got your resume",
    );

    try {
      const uploadUrl = await generateUploadUrl({});
      const res = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/pdf" },
        body: file,
      });
      if (!res.ok) {
        throw new Error(`upload_failed_${res.status}`);
      }
      const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
      updateData({ resumeStorageId: storageId as unknown as string });

      void streamResumeIntake({
        fileId: storageId as unknown as string,
        filename: file.name,
      }).catch((err) => {
        logProfileEvent("resume", "Resume intake route failed", "error", {
          message: err instanceof Error ? err.message : String(err),
        });
      });

      logProfileEvent("resume", "Resume uploaded to Convex storage", "success", {
        filename: file.name,
        storageId,
      });

      advance(`Uploaded ${file.name}`, "connect");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setResumeError(message);
      logProfileEvent("resume", "Resume upload failed", "error", { message });
    } finally {
      setParsingResume(false);
    }
  };

  const handleLinkSocialGithub = useCallback(async () => {
    try {
      // Account linking keeps the current email/demo session. Better Auth does
      // not mint a new cross-domain one-time token for link callbacks, so this
      // must return directly to the app instead of /api/auth/complete-oauth.
      const result = await authClient.linkSocial({
        provider: "github",
        callbackURL: buildOAuthLinkCallbackURL(
          window.location.origin,
          "/onboarding?step=3",
        ),
        errorCallbackURL: new URL(
          "/onboarding?step=3&github_error=oauth",
          window.location.origin,
        ).toString(),
      });
      // Better Auth's redirect plugin auto-navigates when the response body
      // contains `{ url, redirect: true }`. If the navigation didn't happen
      // (e.g. plugin order, fetch wrapper swallowing onSuccess), fall back
      // to a manual redirect so the user actually reaches GitHub.
      const data = (result as { data?: { url?: string; redirect?: boolean } } | null)?.data;
      if (data?.url && typeof window !== "undefined") {
        window.location.href = data.url;
        return;
      }
      const errorMessage = (result as { error?: { message?: string; code?: string } } | null)
        ?.error?.message;
      if (errorMessage) {
        logProfileEvent("github", "GitHub link failed", "error", {
          message: errorMessage,
        });
      }
    } catch (error) {
      logProfileEvent("github", "GitHub link failed", "error", {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }, []);

  const handleRunGithubIntake = useCallback(
    async (force = false) => {
      if (!userId || !githubConnected) return;
      try {
        await runGithubIntake({ userId, force });
      } catch (error) {
        logProfileEvent("github", "GitHub intake failed to start", "error", {
          message: error instanceof Error ? error.message : String(error),
        });
      }
    },
    [githubConnected, runGithubIntake, userId],
  );

  const handleLinkedinSubmit = useCallback(async () => {
    const url = normalizeLinkedinProfileUrl(data.links.linkedin);
    if (!url || !userId || !isLinkedinProfileUrl(url)) return false;
    updateData({ links: { linkedin: url } });
    mergeProfile({ links: { linkedin: url } }, "linkedin", "Saved LinkedIn URL");
    try {
      const { drain } = await startLinkedinIntake(url);
      void drain.catch((err) => {
        logProfileEvent("linkedin", "LinkedIn intake stream failed", "error", {
          message: err instanceof Error ? err.message : String(err),
        });
      });
      return true;
    } catch (err) {
      logProfileEvent("linkedin", "LinkedIn intake route failed", "error", {
        message: err instanceof Error ? err.message : String(err),
      });
      return false;
    }
  }, [data.links.linkedin, updateData, userId]);

  const handleWebSubmit = useCallback(
    async (kind: "devpost" | "website", url: string) => {
      const trimmed = url.trim();
      if (!trimmed || !userId) return;
      mergeProfile(
        { links: { [kind]: trimmed } },
        kind,
        `Saved ${kind} URL`,
      );
      void runWebIntake({ userId, url: trimmed, kind }).catch((err) => {
        logProfileEvent(kind, `${kind} intake action failed`, "error", {
          message: err instanceof Error ? err.message : String(err),
        });
      });
    },
    [runWebIntake, userId],
  );

  const mergeFinalProfile = () => {
    if (selectedRoles.length === 0) return;
    const links = trimLinks(data.links);
    mergeProfile(
      {
        email: accountEmail.trim() || undefined,
        links,
        prefs: {
          roles: selectedRoles,
          workAuth: data.prefs.workAuth || undefined,
          locations: data.prefs.location ? [data.prefs.location] : [],
        },
      },
      "chat",
      "Confirmed onboarding intake",
    );
  };

  const handleLaunch = () => {
    setActivating(true);
    playActivate();
    setOnboardingCookie();
    if (userId) {
      void markOnboardingComplete({ userId }).catch((err) => {
        console.error("[onboarding] markOnboardingComplete failed", err);
      });
    }
    // 1.5s lets the orbit complete and the confetti land before the route
    // change. The original 700ms was tuned to the old static reveal.
    window.setTimeout(() => router.push("/ready"), 1500);
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (splashHydrated && showSplash) {
    return (
      <main
        className={cx(
          "flex min-h-screen flex-col overflow-x-hidden",
          mistClasses.page,
        )}
      >
        <header className="sticky top-0 z-30 border-b border-white/40 bg-white/55 backdrop-blur-xl">
          <div className="flex items-center justify-between px-5 py-4 md:px-8">
            <Link href="/">
              <Wordmark size="sm" />
            </Link>
            <Link href="/" aria-label="Close">
              <ActionButton variant="ghost" size="icon">
                <X className="h-4 w-4" />
              </ActionButton>
            </Link>
          </div>
        </header>
        <SquadWelcome onContinue={dismissSplash} />
      </main>
    );
  }

  return (
    <main
      className={cx(
        "flex min-h-screen flex-col overflow-x-hidden",
        mistClasses.page,
      )}
    >
      <header className="sticky top-0 z-30 border-b border-white/40 bg-white/55 backdrop-blur-xl">
        <div className="flex items-center justify-between px-5 py-4 md:px-8">
          <Link href="/">
            <Wordmark size="sm" />
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            <TestimonialBadge />
            <span className="hidden font-mono text-[11px] uppercase tracking-[0.16em] text-slate-500 sm:inline">
              {completeCount} saved
            </span>
            <SoundToggle />
            <Link href="/" aria-label="Close">
              <ActionButton variant="ghost" size="icon">
                <X className="h-4 w-4" />
              </ActionButton>
            </Link>
          </div>
        </div>
        <ProgressBar
          stepIndex={stepIndex}
          totalSteps={totalSteps}
          currentStep={step}
          canGoBack={stepIndex > 0 && !typing && !activating}
          onBack={handleBack}
        />
      </header>

      <div className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 gap-6 px-5 pt-6 pb-8 md:px-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section className="min-w-0">
          <GlassCard
            density="spacious"
            className="flex min-h-[calc(100dvh-156px)] flex-col lg:h-[calc(100dvh-196px)] lg:min-h-[600px]"
          >
            <div className="mb-6 flex items-start gap-4 border-b border-white/45 pb-6">
              <AgentCharacter id="scout" awake size={52} />
              <div className="min-w-0">
                <div
                  className={cx(mistClasses.sectionLabel, "text-sky-600")}
                >
                  Scout intake
                </div>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
                  Quick setup, one question at a time.
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                  Sign in, drop your resume, link any sources. Background pulls
                  fire instantly.
                </p>
              </div>
            </div>

            <div
              ref={scrollRef}
              className="flex-none overflow-visible pr-0 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-1"
            >
              <div className="space-y-5 pb-5">
                {messages.map((message) =>
                  message.kind === "agent" ? (
                    <ScoutMessage key={message.id}>{message.text}</ScoutMessage>
                  ) : (
                    <UserMessage key={message.id}>{message.text}</UserMessage>
                  ),
                )}
                {typing && <TypingIndicator from="scout" />}
                {!typing && (
                  <div className="pl-0 sm:pl-11">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={step}
                        initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -4 }}
                        transition={{
                          duration: reduceMotion ? 0 : 0.22,
                          ease: [0.22, 1, 0.36, 1],
                        }}
                      >
                        {step === "account" && (
                          <AccountStepCard
                            isAuthenticated={Boolean(userId)}
                            onGithubSignIn={handleGithubSignIn}
                            onEmailContinue={handleEmailContinue}
                            onAdvance={advance}
                          />
                        )}
                        {step === "resume" && (
                          <ResumeStepCard
                            data={data}
                            parsingResume={parsingResume}
                            resumeError={resumeError}
                            fileInputRef={fileInputRef}
                            resumeRun={resumeRun}
                            onResumeFile={handleResumeFile}
                            onAdvance={advance}
                            updateData={updateData}
                          />
                        )}
                        {step === "connect" && (
                          <ConnectStepCard
                            data={data}
                            linkCount={linkCount}
                            githubConnected={githubConnected}
                            githubRun={githubRun}
                            linkedinRun={linkedinRun}
                            webRun={webRun}
                            onLinkSocialGithub={handleLinkSocialGithub}
                            onRunGithubIntake={handleRunGithubIntake}
                            onLinkedinSubmit={handleLinkedinSubmit}
                            onWebSubmit={handleWebSubmit}
                            updateData={updateData}
                            onAdvance={advance}
                          />
                        )}
                        {step === "prefs" && (
                          <PrefsStepCard
                            data={data}
                            selectedRoles={selectedRoles}
                            toggleRole={toggleRole}
                            updateData={updateData}
                            onAdvance={advance}
                          />
                        )}
                        {step === "activate" && (
                          <ActivateStepCard
                            data={data}
                            accountEmail={accountEmail}
                            selectedRoles={selectedRoles}
                            linkCount={linkCount}
                            onMergeFinalProfile={mergeFinalProfile}
                            onLaunch={handleLaunch}
                          />
                        )}
                      </motion.div>
                    </AnimatePresence>
                  </div>
                )}
              </div>
            </div>
          </GlassCard>
        </section>

        <aside className="min-w-0 space-y-5 lg:sticky lg:top-24 lg:self-start">
          <IntakeSummary
            data={data}
            accountEmail={accountEmail}
            selectedRoles={selectedRoles}
            linkCount={linkCount}
            completeCount={completeCount}
            githubConnected={githubConnected}
            githubRun={githubRun}
            resumeRun={resumeRun}
            linkedinRun={linkedinRun}
            webRun={webRun}
          />
          <ProfileCard userId={canReadConvex ? userId : null} />
          <TrustRow />
        </aside>
      </div>

      <AnimatePresence>
        {activating && (
          <motion.div
            className="fixed inset-0 z-[70] flex items-center justify-center bg-white/70 px-5 backdrop-blur-xl"
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{
              duration: reduceMotion ? 0 : 0.2,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            <ActivationOrbit />
          </motion.div>
        )}
      </AnimatePresence>

      <ScoutDock userId={userId} surface="onboarding" />
    </main>
  );
}
