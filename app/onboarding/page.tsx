"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAction, useMutation, useQuery } from "convex/react";
import { AnimatePresence, motion } from "motion/react";
import {
  Activity,
  ArrowRight,
  Briefcase,
  Check,
  ChevronLeft,
  Clock3,
  Link2,
  Loader2,
  MapPin,
  Sparkles,
  X,
} from "lucide-react";
import { Wordmark, CompanyLogo } from "@/components/ui/logo";
import { GithubIcon, LinkedinIcon } from "@/components/ui/brand-icons";
import {
  ActionButton,
  ChoiceChipGroup,
  FileUploadControl,
  GlassCard,
  TextField,
  cx,
  mistClasses,
  mistRadii,
} from "@/components/design-system";
import { UserMessage, TypingIndicator } from "@/components/onboarding/chat";
import { AgentCharacter } from "@/components/onboarding/characters";
import { authClient } from "@/lib/auth-client";
import { buildOAuthCompletionURL } from "@/lib/auth-flow";
import { setOnboardingCookie } from "@/lib/onboarding-cookie";
import {
  canStartSourceRun,
  isLinkedinProfileUrl,
  isGithubConnected,
  normalizeLinkedinProfileUrl,
  shouldAutoStartGithubIntake,
} from "@/lib/intake/shared/source-state";
import { onboardingMatches } from "@/lib/mock-data";
import { playActivate, playReceive, playSend } from "@/lib/sounds";
import { logProfileEvent, mergeProfile } from "@/lib/profile";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

// ----------------------------------------------------------------------------
// Step model — locked at 5 to match spec §8 (Account, Resume, Connect, Prefs,
// Activate). Step indices stay stable for the progress-bar visual sync.
// On Activate the page hands off to /ready (the 2D Ready Room) instead of
// the legacy 3D scene transition.
// ----------------------------------------------------------------------------

type Step = "account" | "resume" | "connect" | "prefs" | "activate";

const STEP_ORDER: Step[] = ["account", "resume", "connect", "prefs", "activate"];
const STEP_INDEX: Record<Step, number> = {
  account: 0,
  resume: 1,
  connect: 2,
  prefs: 3,
  activate: 4,
};

const STEP_LABEL: Record<Step, string> = {
  account: "Account",
  resume: "Resume",
  connect: "Connect",
  prefs: "Preferences",
  activate: "Activate",
};

const STEP_PROMPTS: Record<Step, string> = {
  account: "Sign in to start. GitHub gets you the richest profile fastest.",
  resume: "Upload your resume so I can ground every application in real history.",
  connect: "Link any other sources. Background pulls fire instantly so you can keep moving.",
  prefs: "Last bit. Any roles, locations, or work-auth constraints I should respect?",
  activate: "Everything queued. Confirm and I'll open the Ready Room while sources finish.",
};

type IntakeKind = "github" | "linkedin" | "resume" | "web" | "ai-report";

const SOURCE_NAME: Record<IntakeKind, string> = {
  github: "GitHub",
  linkedin: "LinkedIn",
  resume: "Resume",
  web: "Web",
  "ai-report": "AI report",
};

const ROLE_OPTIONS = [
  "Software Engineer",
  "Product Engineer",
  "Founding Engineer",
  "Frontend",
  "ML / AI",
  "Design Engineer",
];

const AUTH_OPTIONS = ["US citizen", "US permanent resident", "Need sponsorship"];

// ----------------------------------------------------------------------------
// Local form state — written to BOTH localStorage (chat sidebar hydration) and
// Convex via mergeProfile-compatible patches. The legacy
// `recruit:onboarding` key continues to be persisted because the chat
// sidebar's hydration code (per onboarding-storage.ts comment) reads it.
// ----------------------------------------------------------------------------

type Data = {
  name: string;
  email: string;
  resumeFilename: string;
  resumeStorageId: string | null;
  links: { github: string; linkedin: string; twitter: string; devpost: string; website: string };
  prefs: { roles: string[]; workAuth: string; location: string };
};

type DataUpdate = Partial<Omit<Data, "links" | "prefs">> & {
  links?: Partial<Data["links"]>;
  prefs?: Partial<Data["prefs"]>;
};

const EMPTY: Data = {
  name: "",
  email: "",
  resumeFilename: "",
  resumeStorageId: null,
  links: { github: "", linkedin: "", twitter: "", devpost: "", website: "" },
  prefs: { roles: [], workAuth: "", location: "" },
};

const STORAGE = "recruit:onboarding";

type ChatEntry =
  | { id: string; kind: "agent"; text: string }
  | { id: string; kind: "user"; text: string };

type LaunchStage = "idle" | "starting" | "error";

const TESTIMONIAL = {
  quote: "I'd pay 10% of my yearly expected income for this. 10% of $2 million—$200k.",
  author: "Victor Cheng",
  meta: "YC F24",
} as const;

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export default function OnboardingChatPage() {
  return (
    <Suspense fallback={<OnboardingFallback />}>
      <OnboardingChatContent />
    </Suspense>
  );
}

function resolveStartingStep(stepParam: string | null): Step {
  if (!stepParam) return "account";
  const numeric = Number.parseInt(stepParam, 10);
  if (Number.isFinite(numeric) && numeric >= 1 && numeric <= STEP_ORDER.length) {
    return STEP_ORDER[numeric - 1];
  }
  if ((STEP_ORDER as string[]).includes(stepParam)) return stepParam as Step;
  return "account";
}

function OnboardingChatContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roleParam = searchParams.get("role");
  const stepParam = searchParams.get("step");
  const session = authClient.useSession();
  const userId = session.data?.user?.id ?? null;

  const initialStep = useMemo(() => resolveStartingStep(stepParam), [stepParam]);

  const [data, setData] = useState<Data>(EMPTY);
  const [step, setStep] = useState<Step>(initialStep);
  const [messages, setMessages] = useState<ChatEntry[]>([
    { id: `a-${initialStep}`, kind: "agent", text: STEP_PROMPTS[initialStep] },
  ]);
  const [parsingResume, setParsingResume] = useState(false);
  const [resumeError, setResumeError] = useState<string | null>(null);
  const [typing, setTyping] = useState(false);
  const [activating, setActivating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<{ step: Step; data: Data; messages: ChatEntry[] }[]>([]);
  const githubAutoStartRef = useRef<string | null>(null);

  const stepIndex = STEP_INDEX[step];
  const totalSteps = STEP_ORDER.length;

  // ---------------------------------------------------------------------------
  // Convex hooks — adapter actions (will resolve once subagents B-E land
  // their implementations) + storage upload + live progress queries.
  // ---------------------------------------------------------------------------

  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const markOnboardingComplete = useMutation(api.userProfiles.markOnboardingComplete);
  // Resume intake runs as a Next route (not a Convex action) because the PDF
  // adapter pulls `unpdf` → `pdfjs-dist`, which dynamically imports
  // `pdf.worker.mjs` at runtime — Convex's bundler can't ship that file.
  // We POST to `/api/intake/resume`, drain the SSE stream so the request
  // stays open, and let the existing `useQuery(api.intakeRuns.byUserKind, ...)`
  // below surface live progress badges (the route writes the same events).
  // GitHub intake starts from the `session.create.after` hook for GitHub
  // sign-in, and from a guarded client effect for email-first `linkSocial`
  // flows because linking a provider does not create a new session.
  // LinkedIn intake is a Next route (not a Convex action) because its adapter
  // pulls `playwright-core`, which the Convex bundler can't ship. We POST to
  // `/api/intake/linkedin`, drain the SSE stream so the request stays open,
  // and let the existing `useQuery(api.intakeRuns.byUserKind, ...)` below
  // surface live progress badges (the route writes the same `intakeRuns`
  // events).
  const runGithubIntake = useAction(api.intakeActions.runGithubIntake);
  const runWebIntake = useAction(api.intakeActions.runWebIntake);

  // Live-progress subscriptions per kind. Each returns `null` while the user
  // is unauthenticated (prevents the query from running with an empty userId).
  const githubRun = useQuery(
    api.intakeRuns.byUserKind,
    userId ? { userId, kind: "github" } : "skip"
  );
  const accountConnections = useQuery(
    api.auth.connectedAccounts,
    userId ? { userId } : "skip"
  );
  const linkedinRun = useQuery(
    api.intakeRuns.byUserKind,
    userId ? { userId, kind: "linkedin" } : "skip"
  );
  const resumeRun = useQuery(
    api.intakeRuns.byUserKind,
    userId ? { userId, kind: "resume" } : "skip"
  );
  const webRun = useQuery(
    api.intakeRuns.byUserKind,
    userId ? { userId, kind: "web" } : "skip"
  );
  const githubConnected = isGithubConnected(accountConnections);

  // ---------------------------------------------------------------------------
  // Effects
  // ---------------------------------------------------------------------------

  useEffect(() => {
    router.prefetch("/ready");
  }, [router]);

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

  // Pre-seed selected role from URL query.
  useEffect(() => {
    if (!roleParam) return;
    const id = window.setTimeout(() => {
      setData((current) => {
        if (current.prefs.roles.includes(roleParam)) return current;
        return {
          ...current,
          prefs: { ...current.prefs, roles: [roleParam, ...current.prefs.roles] },
        };
      });
    }, 0);
    return () => window.clearTimeout(id);
  }, [roleParam]);

  // Persist local form state to localStorage on every change. The chat
  // sidebar's hydration code (lib/onboarding-storage.ts) reads this key.
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

  // Auto-scroll the chat to the bottom as new messages, typing indicator, or
  // step transitions arrive.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, typing, step, activating]);

  // Email-first users link GitHub through `linkSocial`, which does not create
  // a new session, so the server-side session.create hook will not fire. When
  // the real linked-account row appears and no GitHub run exists yet, start
  // intake once from the client. Existing/running/completed runs stay untouched.
  useEffect(() => {
    if (!userId) return;
    if (
      !shouldAutoStartGithubIntake({
        connected: githubConnected,
        run: githubRun,
      })
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
  }, [githubConnected, githubRun, runGithubIntake, userId]);

  // ---------------------------------------------------------------------------
  // Derived state
  // ---------------------------------------------------------------------------

  const selectedRoles = useMemo(() => {
    if (!roleParam || data.prefs.roles.includes(roleParam)) return data.prefs.roles;
    return [roleParam, ...data.prefs.roles];
  }, [data.prefs.roles, roleParam]);

  const linkCount = Object.values(data.links).filter((v) => v.trim()).length;

  const completeCount = [
    Boolean(session.data?.user),
    Boolean(data.resumeFilename),
    linkCount > 0 || githubConnected,
    selectedRoles.length > 0,
    Boolean(data.prefs.location || data.prefs.workAuth),
  ].filter(Boolean).length;

  // ---------------------------------------------------------------------------
  // Mutators
  // ---------------------------------------------------------------------------

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
        { id: `a-${current.length}-${nextStep}`, kind: "agent", text: STEP_PROMPTS[nextStep] },
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
      return trimmed.length > 0 ? trimmed : [{ id: `a-${prev}`, kind: "agent", text: STEP_PROMPTS[prev] }];
    });
  };

  // ---------------------------------------------------------------------------
  // Step 1: Account — GitHub OAuth or email passthrough
  // ---------------------------------------------------------------------------

  const handleGithubSignIn = useCallback(async () => {
    try {
      // GitHub returns to the fixed Convex callback, then the completion route
      // exchanges the one-time token and lands back on /onboarding?step=2.
      // The auth callback hook auto-fires runGithubIntake on first link.
      await authClient.signIn.social({
        provider: "github",
        callbackURL: buildOAuthCompletionURL(
          window.location.origin,
          "/onboarding?step=2"
        ),
        errorCallbackURL: new URL(
          "/sign-in?error=oauth_restart_required",
          window.location.origin
        ).toString(),
      });
    } catch (error) {
      logProfileEvent("github", "GitHub OAuth failed to start", "error", {
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }, []);

  const handleEmailContinue = () => {
    // Email signup happens on /sign-up. From there better-auth bounces back
    // here (the user picks "Sign up with email" and completes the flow).
    router.push("/sign-up?redirect_url=/onboarding?step=2");
  };

  // ---------------------------------------------------------------------------
  // Step 2: Resume — upload to Convex `_storage`, then start resume intake
  // ---------------------------------------------------------------------------

  const handleResumeFile = async (file: File | null) => {
    if (!file) return;
    if (!userId) {
      setResumeError("Sign in first so we can attach your resume to your profile.");
      return;
    }

    setResumeError(null);
    setParsingResume(true);
    updateData({ resumeFilename: file.name });

    // Local mirror — keep the chat sidebar's view of the resume in sync.
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

      // Fire-and-forget the resume intake route. The user can advance to step
      // 3 immediately; events stream into intakeRuns via the byUserKind query.
      void streamResumeIntake({ fileId: storageId as unknown as string, filename: file.name }).catch((err) => {
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

  // ---------------------------------------------------------------------------
  // Step 3: Connect — fire adapters per pasted source
  // ---------------------------------------------------------------------------

  const handleLinkSocialGithub = useCallback(async () => {
    try {
      // The OAuth redirect flow leaves this page; the `session.create.after`
      // hook handles GitHub sign-in. Email-first account linking returns to
      // this page without creating a new session, so the connected-account
      // effect above starts intake once the Better Auth account row exists.
      await authClient.linkSocial({
        provider: "github",
        callbackURL: new URL("/onboarding?step=3", window.location.origin).toString(),
        errorCallbackURL: new URL(
          "/onboarding?step=3&github_error=oauth",
          window.location.origin
        ).toString(),
      });
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
      // Fire-and-forget after the route accepts the request. Draining the SSE
      // stream keeps the request open while the route persists `intakeRuns`.
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
      mergeProfile({ links: { [kind]: trimmed } }, kind, `Saved ${kind} URL`);
      void runWebIntake({ userId, url: trimmed, kind }).catch((err) => {
        logProfileEvent(kind, `${kind} intake action failed`, "error", {
          message: err instanceof Error ? err.message : String(err),
        });
      });
    },
    [runWebIntake, userId],
  );

  // ---------------------------------------------------------------------------
  // Step 5: Activate — fire AI report (Phase 4 wire-up) + redirect
  // ---------------------------------------------------------------------------

  const mergeFinalProfile = () => {
    if (selectedRoles.length === 0) return;
    const links = trimLinks(data.links);
    mergeProfile(
      {
        email: data.email.trim() || undefined,
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
    // Brief activation reveal flash, then route into the 2D Ready Room.
    // The job pipeline no longer fires here — the user kicks it off from
    // /ready when they hit "Start searching for jobs" (see
    // components/ready/start-search-cta.tsx).
    window.setTimeout(() => router.push("/ready"), 700);
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <main className={cx("flex min-h-screen flex-col overflow-x-hidden", mistClasses.page)}>
      <header className="sticky top-0 z-30 border-b border-white/40 bg-white/55 backdrop-blur-xl">
        <div className="flex items-center justify-between px-5 py-4 md:px-8">
          <Link href="/">
            <Wordmark size="sm" />
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden font-mono text-[11px] uppercase tracking-[0.16em] text-slate-500 sm:inline">
              {completeCount} saved
            </span>
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
          <GlassCard density="spacious" className="flex h-[calc(100vh-196px)] min-h-[600px] flex-col">
            <div className="mb-6 flex items-start gap-4 border-b border-white/45 pb-6">
              <AgentCharacter id="scout" awake size={52} />
              <div className="min-w-0">
                <div className={cx(mistClasses.sectionLabel, "text-sky-600")}>Scout intake</div>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
                  Quick setup, one question at a time.
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                  Sign in, drop your resume, link any sources. Background pulls fire instantly.
                </p>
              </div>
            </div>

            <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto pr-1">
              <div className="space-y-5 pb-5">
                {messages.map((message) =>
                  message.kind === "agent" ? (
                    <ScoutMessage key={message.id}>
                      {message.text}
                    </ScoutMessage>
                  ) : (
                    <UserMessage key={message.id}>{message.text}</UserMessage>
                  ),
                )}
                {typing && <TypingIndicator from="scout" />}
                {!typing && !activating && (
                  <div className="pl-11">
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={step}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                      >
                        <StepCard
                          step={step}
                          data={data}
                          selectedRoles={selectedRoles}
                          linkCount={linkCount}
                          parsingResume={parsingResume}
                          resumeError={resumeError}
                          fileInputRef={fileInputRef}
                          isAuthenticated={Boolean(userId)}
                          githubConnected={githubConnected}
                          githubRun={githubRun}
                          linkedinRun={linkedinRun}
                          resumeRun={resumeRun}
                          webRun={webRun}
                          onGithubSignIn={handleGithubSignIn}
                          onEmailContinue={handleEmailContinue}
                          onLinkSocialGithub={handleLinkSocialGithub}
                          onRunGithubIntake={handleRunGithubIntake}
                          onLinkedinSubmit={handleLinkedinSubmit}
                          onWebSubmit={handleWebSubmit}
                          toggleRole={toggleRole}
                          updateData={updateData}
                          onResumeFile={handleResumeFile}
                          onAdvance={advance}
                          onMergeFinalProfile={mergeFinalProfile}
                          onLaunch={handleLaunch}
                        />
                      </motion.div>
                    </AnimatePresence>
                  </div>
                )}
                {activating && <ActivationReveal />}
              </div>
            </div>
          </GlassCard>
        </section>

        <aside className="min-w-0 space-y-5 lg:sticky lg:top-24 lg:self-start">
          <IntakeSummary
            data={data}
            selectedRoles={selectedRoles}
            linkCount={linkCount}
            completeCount={completeCount}
            githubConnected={githubConnected}
            githubRun={githubRun}
            resumeRun={resumeRun}
            linkedinRun={linkedinRun}
            webRun={webRun}
          />
          <TestimonialCard />
        </aside>
      </div>
    </main>
  );
}

// ----------------------------------------------------------------------------
// Sub-components
// ----------------------------------------------------------------------------

function ProgressBar({
  stepIndex,
  totalSteps,
  currentStep,
  canGoBack,
  onBack,
}: {
  stepIndex: number;
  totalSteps: number;
  currentStep: Step;
  canGoBack: boolean;
  onBack: () => void;
}) {
  const stepNumber = stepIndex + 1;
  const progress = Math.max(0, Math.min(1, stepIndex / Math.max(1, totalSteps - 1)));

  return (
    <div className="flex items-center gap-3 border-t border-white/40 px-5 py-2.5 md:px-8">
      <ActionButton
        variant="ghost"
        size="icon"
        onClick={onBack}
        disabled={!canGoBack}
        aria-label="Go back to the previous step"
        title={canGoBack ? "Go back" : "Already at the first step"}
      >
        <ChevronLeft className="h-4 w-4" />
      </ActionButton>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-slate-500">
          Step {stepNumber} of {totalSteps}
        </span>
        <span className="hidden truncate text-[12px] font-medium text-slate-700 sm:inline">
          {STEP_LABEL[currentStep]}
        </span>
        <div
          className="relative ml-2 hidden h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-white/55 sm:block"
          aria-hidden="true"
        >
          <motion.div
            className="absolute inset-y-0 left-0 rounded-full bg-sky-500/80"
            initial={false}
            animate={{ width: `${progress * 100}%` }}
            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
      </div>
      <span
        className="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/55 bg-white/45 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500"
        title="Approximate time remaining"
      >
        <Clock3 className="h-3 w-3" />
        ~3 min
      </span>
    </div>
  );
}

function ScoutMessage({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="flex items-start gap-3"
    >
      <div className="flex w-8 shrink-0 justify-center">
        <AgentCharacter id="scout" awake size={38} />
      </div>
      <div className="min-w-0 flex-1 pt-0.5">
        <div className="mb-1 text-[13px] font-medium tracking-tight text-sky-700">
          Scout
        </div>
        <div className="text-[15px] leading-snug text-slate-950">
          {children}
        </div>
      </div>
    </motion.div>
  );
}

// ----------------------------------------------------------------------------
// Step card router
// ----------------------------------------------------------------------------

type IntakeRunRow = {
  status: "queued" | "running" | "completed" | "failed";
  events?: Array<{ stage?: string; message?: string; done?: number; total?: number; level?: string }>;
  startedAt?: string;
  completedAt?: string;
  error?: string;
} | null | undefined;

function StepCard(props: {
  step: Step;
  data: Data;
  selectedRoles: string[];
  linkCount: number;
  parsingResume: boolean;
  resumeError: string | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  isAuthenticated: boolean;
  githubConnected: boolean;
  githubRun: IntakeRunRow;
  linkedinRun: IntakeRunRow;
  resumeRun: IntakeRunRow;
  webRun: IntakeRunRow;
  onGithubSignIn: () => Promise<void>;
  onEmailContinue: () => void;
  onLinkSocialGithub: () => Promise<void>;
  onRunGithubIntake: (force?: boolean) => Promise<void>;
  onLinkedinSubmit: () => Promise<boolean>;
  onWebSubmit: (kind: "devpost" | "website", url: string) => Promise<void>;
  toggleRole: (role: string) => void;
  updateData: (updates: DataUpdate) => void;
  onResumeFile: (file: File | null) => void;
  onAdvance: (userText: string, nextStep: Step) => void;
  onMergeFinalProfile: () => void;
  onLaunch: () => void;
}) {
  const {
    step,
    data,
    selectedRoles,
    linkCount,
    parsingResume,
    resumeError,
    fileInputRef,
    isAuthenticated,
    githubConnected,
    githubRun,
    linkedinRun,
    resumeRun,
    webRun,
    onGithubSignIn,
    onEmailContinue,
    onLinkSocialGithub,
    onRunGithubIntake,
    onLinkedinSubmit,
    onWebSubmit,
    toggleRole,
    updateData,
    onResumeFile,
    onAdvance,
    onMergeFinalProfile,
    onLaunch,
  } = props;

  if (step === "account") {
    return (
      <AccountStepCard
        isAuthenticated={isAuthenticated}
        onGithubSignIn={onGithubSignIn}
        onEmailContinue={onEmailContinue}
        onAdvance={onAdvance}
      />
    );
  }

  if (step === "resume") {
    return (
      <ResumeStepCard
        data={data}
        parsingResume={parsingResume}
        resumeError={resumeError}
        fileInputRef={fileInputRef}
        resumeRun={resumeRun}
        onResumeFile={onResumeFile}
        onAdvance={onAdvance}
        updateData={updateData}
      />
    );
  }

  if (step === "connect") {
    return (
      <ConnectStepCard
        data={data}
        linkCount={linkCount}
        githubConnected={githubConnected}
        githubRun={githubRun}
        linkedinRun={linkedinRun}
        webRun={webRun}
        onLinkSocialGithub={onLinkSocialGithub}
        onRunGithubIntake={onRunGithubIntake}
        onLinkedinSubmit={onLinkedinSubmit}
        onWebSubmit={onWebSubmit}
        updateData={updateData}
        onAdvance={onAdvance}
      />
    );
  }

  if (step === "prefs") {
    return (
      <PrefsStepCard
        data={data}
        selectedRoles={selectedRoles}
        toggleRole={toggleRole}
        updateData={updateData}
        onAdvance={onAdvance}
      />
    );
  }

  return (
    <ActivateStepCard
      data={data}
      selectedRoles={selectedRoles}
      linkCount={linkCount}
      onMergeFinalProfile={onMergeFinalProfile}
      onLaunch={onLaunch}
    />
  );
}

// ----------------------------------------------------------------------------
// Step 1: Account
// ----------------------------------------------------------------------------

function AccountStepCard({
  isAuthenticated,
  onGithubSignIn,
  onEmailContinue,
  onAdvance,
}: {
  isAuthenticated: boolean;
  onGithubSignIn: () => Promise<void>;
  onEmailContinue: () => void;
  onAdvance: (userText: string, nextStep: Step) => void;
}) {
  const [pending, setPending] = useState(false);

  const handleGithub = async () => {
    setPending(true);
    try {
      await onGithubSignIn();
    } finally {
      setPending(false);
    }
  };

  return (
    <ChatCard icon={<GithubIcon className="h-4 w-4 text-sky-600" />}>
      {isAuthenticated ? (
        <div className="space-y-4">
          <p className="text-sm leading-6 text-slate-700">
            Okay, signed in. Continue to upload your resume.
          </p>
          <div className="flex justify-end">
            <ActionButton variant="primary" onClick={() => onAdvance("Continued with existing account", "resume")}>
              Continue <ArrowRight className="h-3.5 w-3.5" />
            </ActionButton>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm leading-6 text-slate-700">
            GitHub sign-in unlocks your repos right away — Scout starts pulling them in the background while you finish onboarding.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <ActionButton
              variant="primary"
              size="lg"
              loading={pending}
              onClick={handleGithub}
            >
              <GithubIcon className="h-4 w-4" />
              Continue with GitHub
            </ActionButton>
            <ActionButton variant="secondary" size="lg" onClick={onEmailContinue}>
              Sign up with email
            </ActionButton>
          </div>
          <p className="font-mono text-[11px] leading-5 text-slate-500">
            We never post anything. Read-only access to public profile + repos.
          </p>
        </div>
      )}
    </ChatCard>
  );
}

// ----------------------------------------------------------------------------
// Step 2: Resume
// ----------------------------------------------------------------------------

function ResumeStepCard({
  data,
  parsingResume,
  resumeError,
  fileInputRef,
  resumeRun,
  onResumeFile,
  onAdvance,
  updateData,
}: {
  data: Data;
  parsingResume: boolean;
  resumeError: string | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  resumeRun: IntakeRunRow;
  onResumeFile: (file: File | null) => void;
  onAdvance: (userText: string, nextStep: Step) => void;
  updateData: (updates: DataUpdate) => void;
}) {
  const hasUpload = Boolean(data.resumeFilename);
  const hasFinishedRun =
    resumeRun?.status === "completed" || resumeRun?.status === "failed";

  return (
    <div className="mt-2 space-y-4">
      <FileUploadControl
        fileName={data.resumeFilename || undefined}
        parsing={parsingResume}
        onBrowse={() => fileInputRef.current?.click()}
        onClear={
          data.resumeFilename
            ? () => updateData({ resumeFilename: "", resumeStorageId: null })
            : undefined
        }
      />
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx"
        className="hidden"
        onChange={(e) => onResumeFile(e.target.files?.[0] ?? null)}
      />

      {resumeError && (
        <div className={cx("border border-red-200/70 bg-red-50/50 px-3 py-2 text-xs text-red-700", mistRadii.nested)}>
          {resumeError}
        </div>
      )}

      {hasUpload && resumeRun && (
        <ProgressBadge kind="resume" run={resumeRun} />
      )}

      <div className="flex justify-end">
        <ActionButton
          variant={hasUpload ? "primary" : "secondary"}
          disabled={parsingResume}
          onClick={() =>
            onAdvance(
              hasUpload ? `Uploaded ${data.resumeFilename}` : "Skipped resume for now",
              "connect",
            )
          }
        >
          {hasUpload ? (hasFinishedRun ? "Continue" : "Continue while parsing") : "Skip for now"}
          <ArrowRight className="h-3.5 w-3.5" />
        </ActionButton>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------------
// Step 3: Connect
// ----------------------------------------------------------------------------

function ConnectStepCard({
  data,
  linkCount,
  githubConnected,
  githubRun,
  linkedinRun,
  webRun,
  onLinkSocialGithub,
  onRunGithubIntake,
  onLinkedinSubmit,
  onWebSubmit,
  updateData,
  onAdvance,
}: {
  data: Data;
  linkCount: number;
  githubConnected: boolean;
  githubRun: IntakeRunRow;
  linkedinRun: IntakeRunRow;
  webRun: IntakeRunRow;
  onLinkSocialGithub: () => Promise<void>;
  onRunGithubIntake: (force?: boolean) => Promise<void>;
  onLinkedinSubmit: () => Promise<boolean>;
  onWebSubmit: (kind: "devpost" | "website", url: string) => Promise<void>;
  updateData: (updates: DataUpdate) => void;
  onAdvance: (userText: string, nextStep: Step) => void;
}) {
  const [linkedinPending, setLinkedinPending] = useState(false);
  const [devpostPending, setDevpostPending] = useState(false);
  const [websitePending, setWebsitePending] = useState(false);
  const [githubPending, setGithubPending] = useState(false);
  const [linkedinSaved, setLinkedinSaved] = useState(false);

  const handleLinkedin = async () => {
    setLinkedinPending(true);
    try {
      const saved = await onLinkedinSubmit();
      if (saved) setLinkedinSaved(true);
    } finally {
      setLinkedinPending(false);
    }
  };

  const handleGithub = async () => {
    setGithubPending(true);
    try {
      if (githubConnected) {
        await onRunGithubIntake(
          githubRun?.status === "completed" || githubRun?.status === "failed"
        );
      } else {
        await onLinkSocialGithub();
      }
    } finally {
      setGithubPending(false);
    }
  };

  const handleDevpost = async () => {
    setDevpostPending(true);
    try {
      await onWebSubmit("devpost", data.links.devpost);
    } finally {
      setDevpostPending(false);
    }
  };

  const handleWebsite = async () => {
    setWebsitePending(true);
    try {
      await onWebSubmit("website", data.links.website);
    } finally {
      setWebsitePending(false);
    }
  };

  const githubRunActive = githubRun ? !canStartSourceRun(githubRun) : false;
  const githubActionLabel = githubConnected
    ? githubRun?.status === "failed"
      ? "Retry"
      : "Refresh"
    : "Connect";
  const connectedSources = linkCount + (githubConnected ? 1 : 0);

  return (
    <ChatCard icon={<Link2 className="h-4 w-4 text-sky-600" />}>
      <div className="space-y-4">
        <div className={cx("space-y-3 border border-white/55 bg-white/30 p-3", mistRadii.nested)}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <GithubIcon className="h-4 w-4 text-slate-600" />
              <span className="text-[13px] font-semibold text-slate-800">GitHub</span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {githubRun ? (
                <ProgressBadge kind="github" run={githubRun} compact />
              ) : githubConnected ? (
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-emerald-600">
                  Connected
                </span>
              ) : null}
              <ActionButton
                variant={githubConnected ? "secondary" : "primary"}
                size="sm"
                loading={githubPending || githubRunActive}
                disabled={githubPending || githubRunActive}
                onClick={handleGithub}
              >
                {githubRunActive ? "Syncing" : githubActionLabel}
                <ArrowRight className="h-3 w-3" />
              </ActionButton>
            </div>
          </div>
          {githubRun && githubRun.status !== "completed" && githubRun.status !== "failed" && (
            <p className="font-mono text-[11px] leading-5 text-slate-500">
              Repos pulling in the background — keep going, this will finish on its own.
            </p>
          )}
          {githubRun && !githubConnected && (
            <p className="font-mono text-[11px] leading-5 text-amber-600">
              Previous GitHub data exists, but no active GitHub token is linked. Reconnect to refresh it.
            </p>
          )}
        </div>

        <SourceField
          label="LinkedIn URL"
          icon={<LinkedinIcon className="h-4 w-4 text-slate-600" />}
          placeholder="linkedin.com/in/yourhandle"
          value={data.links.linkedin}
          onChange={(value) => {
            setLinkedinSaved(false);
            updateData({ links: { linkedin: value } });
          }}
          onSubmit={handleLinkedin}
          submitLabel="Save"
          pending={linkedinPending}
          run={linkedinRun}
          runKind="linkedin"
          savedMessage={
            linkedinSaved
              ? "It's saved and I have processed it in the backend."
              : undefined
          }
          showRunBadge={false}
          disableWhileActive={false}
        />

        <SourceField
          label="DevPost (optional)"
          icon={<Sparkles className="h-4 w-4 text-slate-600" />}
          placeholder="devpost.com/yourhandle"
          value={data.links.devpost}
          onChange={(value) => updateData({ links: { devpost: value } })}
          onSubmit={handleDevpost}
          submitLabel="Save"
          pending={devpostPending}
          run={webRun}
          runKind="web"
        />

        <SourceField
          label="Personal site (optional)"
          icon={<Activity className="h-4 w-4 text-slate-600" />}
          placeholder="yoursite.com"
          value={data.links.website}
          onChange={(value) => updateData({ links: { website: value } })}
          onSubmit={handleWebsite}
          submitLabel="Save"
          pending={websitePending}
          run={webRun}
          runKind="web"
        />

        <div className="flex justify-end">
          <ActionButton
            variant={connectedSources > 0 ? "primary" : "secondary"}
            onClick={() =>
              onAdvance(
                connectedSources > 0
                  ? `${connectedSources} source${connectedSources === 1 ? "" : "s"} connected`
                  : "Skipped extra sources",
                "prefs",
              )
            }
          >
            {connectedSources > 0 ? "Continue" : "Skip for now"}
            <ArrowRight className="h-3.5 w-3.5" />
          </ActionButton>
        </div>
      </div>
    </ChatCard>
  );
}

function SourceField({
  label,
  icon,
  placeholder,
  value,
  onChange,
  onSubmit,
  submitLabel,
  pending,
  run,
  runKind,
  savedMessage,
  showRunBadge = true,
  disableWhileActive = true,
}: {
  label: string;
  icon: React.ReactNode;
  placeholder: string;
  value: string;
  onChange: (next: string) => void;
  onSubmit: () => void;
  submitLabel: string;
  pending: boolean;
  run: IntakeRunRow;
  runKind: IntakeKind;
  savedMessage?: string;
  showRunBadge?: boolean;
  disableWhileActive?: boolean;
}) {
  const runActive = run ? !canStartSourceRun(run) : false;
  return (
    <div className={cx("space-y-2 border border-white/55 bg-white/30 p-3", mistRadii.nested)}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-[13px] font-semibold text-slate-800">{label}</span>
        </div>
        {showRunBadge && run && <ProgressBadge kind={runKind} run={run} compact />}
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1">
          <TextField
            value={value}
            placeholder={placeholder}
            readOnly={false}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
        <ActionButton
          variant="secondary"
          size="sm"
          loading={pending || (disableWhileActive && runActive)}
          disabled={!value.trim() || pending || (disableWhileActive && runActive)}
          onClick={onSubmit}
        >
          {disableWhileActive && runActive ? "Running" : submitLabel}
        </ActionButton>
      </div>
      {savedMessage ? (
        <p className="font-mono text-[11px] leading-5 text-emerald-700">
          {savedMessage}
        </p>
      ) : null}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Step 4: Preferences
// ----------------------------------------------------------------------------

function PrefsStepCard({
  data,
  selectedRoles,
  toggleRole,
  updateData,
  onAdvance,
}: {
  data: Data;
  selectedRoles: string[];
  toggleRole: (role: string) => void;
  updateData: (updates: DataUpdate) => void;
  onAdvance: (userText: string, nextStep: Step) => void;
}) {
  const canAdvance = selectedRoles.length > 0;
  return (
    <ChatCard icon={<Briefcase className="h-4 w-4 text-sky-600" />}>
      <div className="space-y-4">
        <div>
          <div className="mb-2 block text-xs font-semibold text-slate-500">Role focus</div>
          <ChoiceChipGroup
            options={ROLE_OPTIONS}
            selected={selectedRoles}
            multi
            onToggle={toggleRole}
          />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <div className="mb-2 block text-xs font-semibold text-slate-500">Location</div>
            <TextField
              value={data.prefs.location}
              placeholder="Remote, San Francisco, New York"
              readOnly={false}
              onChange={(e) => updateData({ prefs: { location: e.target.value } })}
            />
          </div>
          <div>
            <div className="mb-2 block text-xs font-semibold text-slate-500">Work authorization</div>
            <ChoiceChipGroup
              options={AUTH_OPTIONS}
              selected={data.prefs.workAuth ? [data.prefs.workAuth] : []}
              onToggle={(value) =>
                updateData({ prefs: { workAuth: value === data.prefs.workAuth ? "" : value } })
              }
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pl-1">
          <MapPin className="h-3.5 w-3.5 text-slate-400" />
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-slate-500">
            Stored locally and in your profile
          </span>
        </div>

        <div className="flex justify-end">
          <ActionButton
            variant="primary"
            disabled={!canAdvance}
            onClick={() => {
              const parts = [
                selectedRoles.join(", "),
                data.prefs.location,
                data.prefs.workAuth,
              ].filter(Boolean);
              onAdvance(parts.length > 0 ? parts.join(" · ") : "Defaults", "activate");
            }}
          >
            Continue <ArrowRight className="h-3.5 w-3.5" />
          </ActionButton>
        </div>
      </div>
    </ChatCard>
  );
}

// ----------------------------------------------------------------------------
// Step 5: Activate
// ----------------------------------------------------------------------------

function ActivateStepCard({
  data,
  selectedRoles,
  linkCount,
  onMergeFinalProfile,
  onLaunch,
}: {
  data: Data;
  selectedRoles: string[];
  linkCount: number;
  onMergeFinalProfile: () => void;
  onLaunch: () => void;
}) {
  const hasConvex = Boolean(process.env.NEXT_PUBLIC_CONVEX_URL);

  return (
    <ChatCard icon={<Check className="h-4 w-4 text-emerald-700" />}>
      <div className="space-y-4">
        <ReviewSummary data={data} selectedRoles={selectedRoles} linkCount={linkCount} />
        <div className="flex flex-col gap-3 border-t border-white/45 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm leading-6 text-slate-600">
            Confirm this is accurate. Scout will open the Ready Room so you can chat while intake finishes.
          </p>
          {hasConvex ? (
            <ConnectedConfirmButton
              onMergeFinalProfile={onMergeFinalProfile}
              onLaunch={onLaunch}
            />
          ) : (
            <ActionButton variant="secondary" size="lg" disabled>
              Convex not configured
            </ActionButton>
          )}
        </div>
      </div>
    </ChatCard>
  );
}

function ConnectedConfirmButton({
  onMergeFinalProfile,
  onLaunch,
}: {
  onMergeFinalProfile: () => void;
  onLaunch: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [stage, setStage] = useState<LaunchStage>("idle");

  function handleConfirm() {
    try {
      setError("");
      setSaving(true);
      setStage("starting");
      onMergeFinalProfile();
      // The job pipeline used to fire here; it now kicks off from /ready when
      // the user explicitly hits "Start searching for jobs". Onboarding's
      // final step just routes into the Ready Room.
      onLaunch();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStage("error");
      setSaving(false);
    }
  }

  const buttonLabel =
    stage === "error" ? "Retry" : saving ? "Opening Ready Room" : "Confirm and continue";

  return (
    <div className="flex w-full flex-col gap-3 sm:w-auto sm:items-end">
      {stage === "starting" && (
        <div className="w-full rounded-[18px] border border-sky-200/70 bg-sky-50/45 px-3 py-2 text-xs leading-5 text-sky-800 sm:w-72">
          Saving your profile. We&apos;ll wait for your sources in the Ready Room.
        </div>
      )}
      <ActionButton variant="primary" size="lg" loading={saving} onClick={handleConfirm}>
        {buttonLabel} <ArrowRight className="h-4 w-4" />
      </ActionButton>
      {error && <span className="max-w-64 text-right text-xs leading-5 text-red-600">{error}</span>}
    </div>
  );
}

// ----------------------------------------------------------------------------
// Live progress badge — renders the latest event message for an intake run.
// ----------------------------------------------------------------------------

function ProgressBadge({
  kind,
  run,
  compact = false,
}: {
  kind: IntakeKind;
  run: NonNullable<IntakeRunRow>;
  compact?: boolean;
}) {
  const events = Array.isArray(run.events) ? run.events : [];
  const latest = events[events.length - 1];
  const status = run.status;

  const tone =
    status === "failed"
      ? "border-red-200/70 bg-red-50/60 text-red-700"
      : status === "completed"
        ? "border-emerald-200/70 bg-emerald-50/60 text-emerald-700"
        : "border-sky-200/70 bg-sky-50/60 text-sky-700";

  const Icon =
    status === "failed"
      ? X
      : status === "completed"
        ? Check
        : Loader2;

  const message =
    status === "failed"
      ? run.error ?? "Failed"
      : latest?.message
        ? `${SOURCE_NAME[kind]}: ${latest.message}`
        : status === "completed"
          ? `${SOURCE_NAME[kind]} synced`
          : `${SOURCE_NAME[kind]}: starting…`;

  const progress =
    typeof latest?.done === "number" && typeof latest?.total === "number" && latest.total > 0
      ? ` (${latest.done}/${latest.total})`
      : "";

  return (
    <span
      className={cx(
        "inline-flex max-w-full items-center gap-1.5 truncate rounded-full border px-2.5",
        compact ? "py-0.5 text-[10px]" : "py-1 text-[11px]",
        tone,
      )}
      title={message}
    >
      <Icon
        className={cx(
          compact ? "h-3 w-3" : "h-3.5 w-3.5",
          status === "running" || status === "queued" ? "animate-spin" : "",
        )}
      />
      <span className="truncate font-mono">{message}{progress}</span>
    </span>
  );
}

// ----------------------------------------------------------------------------
// Review summary + sidebar
// ----------------------------------------------------------------------------

function ReviewSummary({
  data,
  selectedRoles,
  linkCount,
}: {
  data: Data;
  selectedRoles: string[];
  linkCount: number;
}) {
  const rows = [
    { label: "Role target", value: selectedRoles.join(", ") || "Missing" },
    { label: "Resume", value: data.resumeFilename || "Missing" },
    { label: "Links", value: linkCount > 0 ? compactLinks(data.links).join(", ") : "None added" },
    { label: "Email", value: data.email || "From sign-in" },
    {
      label: "Preferences",
      value:
        [data.prefs.location, data.prefs.workAuth].filter(Boolean).join(" · ") || "None added",
    },
  ];

  return (
    <div className="grid gap-2">
      {rows.map((row) => (
        <div key={row.label} className={cx("border border-white/55 bg-white/30 px-3 py-2", mistRadii.nested)}>
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500">{row.label}</div>
          <div className="mt-1 break-words text-sm leading-5 text-slate-800">{row.value}</div>
        </div>
      ))}
    </div>
  );
}

function ChatCard({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <GlassCard density="normal" className="mt-2">
      <div className="flex items-start gap-3">
        <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/60 bg-white/38">
          {icon}
        </span>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </GlassCard>
  );
}

function IntakeSummary({
  data,
  selectedRoles,
  linkCount,
  completeCount,
  githubConnected,
  githubRun,
  resumeRun,
  linkedinRun,
  webRun,
}: {
  data: Data;
  selectedRoles: string[];
  linkCount: number;
  completeCount: number;
  githubConnected: boolean;
  githubRun: IntakeRunRow;
  resumeRun: IntakeRunRow;
  linkedinRun: IntakeRunRow;
  webRun: IntakeRunRow;
}) {
  const liveRuns: Array<{ kind: IntakeKind; run: NonNullable<IntakeRunRow> }> = [];
  if (githubRun) liveRuns.push({ kind: "github", run: githubRun });
  if (resumeRun) liveRuns.push({ kind: "resume", run: resumeRun });
  if (linkedinRun) liveRuns.push({ kind: "linkedin", run: linkedinRun });
  if (webRun) liveRuns.push({ kind: "web", run: webRun });

  const rows = [
    { label: "Account", value: data.email || "Needed" },
    { label: "Resume", value: data.resumeFilename || "Needed" },
    {
      label: "Sources",
      value:
        linkCount + (githubConnected ? 1 : 0) > 0
          ? `${linkCount + (githubConnected ? 1 : 0)} linked`
          : "Optional",
    },
    { label: "Roles", value: selectedRoles.join(", ") || "Needed" },
    { label: "Prefs", value: [data.prefs.location, data.prefs.workAuth].filter(Boolean).join(" · ") || "Optional" },
  ];

  return (
    <GlassCard density="spacious">
      <div className="mb-4 flex items-center justify-between">
        <span className={mistClasses.sectionLabel}>Intake</span>
        <span className="font-mono text-[11px] text-slate-500">{completeCount} saved</span>
      </div>
      <div className="space-y-2">
        {rows.map((row) => {
          const complete = row.value !== "Optional" && row.value !== "Needed";
          return (
            <div key={row.label} className={cx("border border-white/55 bg-white/28 px-3 py-2", mistRadii.nested)}>
              <div className="flex items-center justify-between gap-3">
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500">{row.label}</span>
                {complete && <Check className="h-3.5 w-3.5 text-emerald-700" />}
              </div>
              <div className={cx("mt-1 truncate text-sm", row.value === "Needed" ? "text-sky-700" : "text-slate-700")}>
                {row.value}
              </div>
            </div>
          );
        })}
      </div>

      {liveRuns.length > 0 && (
        <div className="mt-5 border-t border-white/45 pt-3">
          <div className={cx("mb-2", mistClasses.sectionLabel)}>Background intake</div>
          <div className="space-y-1.5">
            {liveRuns.map(({ kind, run }) => (
              <ProgressBadge key={kind} kind={kind} run={run} />
            ))}
          </div>
        </div>
      )}
    </GlassCard>
  );
}

function TestimonialCard() {
  return (
    <GlassCard density="spacious">
      <div className="mb-4 flex items-center justify-between gap-3">
        <span className={mistClasses.sectionLabel}>Testimonial</span>
        <span className="rounded-full border border-emerald-200/80 bg-emerald-50/70 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-emerald-800">
          YC founder
        </span>
      </div>
      <div className={cx("border border-white/55 bg-white/28 px-4 py-4", mistRadii.nested)}>
        <blockquote className="font-serif text-[22px] leading-[1.12] tracking-[-0.02em] text-slate-950">
          “{TESTIMONIAL.quote}”
        </blockquote>
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/50 pt-3">
          <div>
            <div className="text-sm font-semibold tracking-tight text-slate-900">{TESTIMONIAL.author}</div>
            <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500">
              {TESTIMONIAL.meta}
            </div>
          </div>
        </div>
      </div>
    </GlassCard>
  );
}

function ActivationReveal() {
  const match = onboardingMatches[0];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="pl-11"
    >
      <GlassCard variant="selected" density="normal">
        <div className="mb-3 flex items-center justify-between">
          <div className={cx(mistClasses.sectionLabel, "text-sky-600")}>Starting application</div>
          <span className="flex items-center gap-1.5 font-mono text-[10px] text-slate-500">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" style={{ animation: "pulse-soft 1.4s ease-in-out infinite" }} />
            LIVE
          </span>
        </div>
        <div className={cx("flex items-center gap-3 border border-white/55 bg-white/30 px-3 py-2", mistRadii.nested)}>
          <AgentCharacter id="scout" awake size={30} />
          <span className="w-[54px] text-[13px] font-medium text-slate-900">Scout</span>
          <span className="text-slate-400">→</span>
          <div className="flex min-w-0 items-center gap-2">
            <CompanyLogo bg={match.logoBg} text={match.logoText} size={22} className="rounded-[5px]" />
            <span className="text-[13px] text-slate-900">{match.company}</span>
            <span className="truncate text-[12px] text-slate-500">{match.role}</span>
          </div>
          <span className="ml-auto flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.15em] text-sky-600">
            applying
          </span>
        </div>
      </GlassCard>
    </motion.div>
  );
}

function OnboardingFallback() {
  return (
    <main className={cx("min-h-screen", mistClasses.page)}>
      <header className="flex items-center justify-between px-5 py-4 md:px-8">
        <Wordmark size="sm" />
      </header>
      <div className="mx-auto max-w-6xl px-5 pb-10 md:px-8">
        <GlassCard density="spacious">
          <div className={cx(mistClasses.sectionLabel, "text-sky-600")}>Scout intake</div>
          <div className="mt-3 h-8 w-72 max-w-full rounded-full bg-white/45" />
          <div className="mt-4 h-4 w-96 max-w-full rounded-full bg-white/35" />
        </GlassCard>
      </div>
    </main>
  );
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

// ----------------------------------------------------------------------------
// startLinkedinIntake — POST to the LinkedIn route, wait until the backend has
// accepted and saved the URL, then return a background drain promise.
//
// We don't actually need each event in the UI here (the Connect step renders
// progress from `useQuery(api.intakeRuns.byUserKind, ...)`, which the route
// also writes to). The drain promise keeps the request open until the stream
// closes, so the route handler completes its full pipeline (auth, scrape,
// summarize, persist, complete) and `intakeRuns` gets the final
// "completed"/"failed" status.
//
// Errors thrown here surface via the `.catch()` in `handleLinkedinSubmit` and
// land in `logProfileEvent`. We do NOT throw on stage="error" SSE messages —
// those are already persisted into `intakeRuns.error` by the driver.
// ----------------------------------------------------------------------------

async function streamResumeIntake(input: {
  fileId: string;
  filename?: string;
}): Promise<void> {
  const response = await fetch("/api/intake/resume", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`resume_intake_${response.status}: ${text || "no body"}`);
  }
  // Drain the SSE body so the route handler stays alive through the full
  // pipeline. We don't read individual events — the byUserKind subscription
  // surfaces them.
  const reader = response.body?.getReader();
  if (!reader) return;
  while (!(await reader.read()).done) {
    /* keep draining */
  }
}

async function startLinkedinIntake(
  profileUrl: string,
): Promise<{ drain: Promise<void> }> {
  const response = await fetch("/api/intake/linkedin", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ profileUrl }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`linkedin_route_${response.status}: ${text || response.statusText}`);
  }

  return { drain: drainLinkedinIntake(response) };
}

async function drainLinkedinIntake(response: Response): Promise<void> {
  const reader = response.body?.getReader();
  if (!reader) return;
  try {
    while (!(await reader.read()).done) {
      /* keep draining */
    }
  } finally {
    reader.releaseLock();
  }
}

function trimLinks(links: Data["links"]): Data["links"] {
  return {
    github: links.github.trim(),
    linkedin: links.linkedin.trim(),
    twitter: links.twitter.trim(),
    devpost: links.devpost.trim(),
    website: links.website.trim(),
  };
}

function compactLinks(links: Data["links"]) {
  return Object.entries(trimLinks(links))
    .filter(([, value]) => value)
    .map(([key, value]) => `${key}: ${value}`);
}
