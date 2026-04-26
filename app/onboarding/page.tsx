"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import type * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowRight,
  Briefcase,
  Check,
  ChevronLeft,
  Clock3,
  FileText,
  Link2,
  Mail,
  MapPin,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { Wordmark, CompanyLogo } from "@/components/ui/logo";
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
import { onboardingMatches } from "@/lib/mock-data";
import { isMuted, playActivate, playReceive, playSend, setMuted } from "@/lib/sounds";
import { logProfileEvent, mergeProfile, readProfile, type ProvenanceSource, type UserProfile } from "@/lib/profile";
import { parseResume, scrapeAndExtract, scrapeLinkedIn } from "@/lib/scrapers";
import { SceneTransition, useSceneTransition } from "@/components/room/scene-transition";

type Data = {
  name: string;
  email: string;
  resumeFilename: string;
  links: { github: string; linkedin: string; twitter: string; devpost: string; website: string };
  prefs: { roles: string[]; workAuth: string; location: string };
};

type DataUpdate = Partial<Omit<Data, "links" | "prefs">> & {
  links?: Partial<Data["links"]>;
  prefs?: Partial<Data["prefs"]>;
};

type Step = "role" | "resume" | "links" | "email" | "prefs" | "review";

const STEP_ORDER: Step[] = ["role", "resume", "links", "email", "prefs", "review"];

const STEP_LABEL: Record<Step, string> = {
  role: "Role",
  resume: "Resume",
  links: "Links",
  email: "Email",
  prefs: "Preferences",
  review: "Review",
};

type ChatEntry =
  | { id: string; kind: "agent"; text: string }
  | { id: string; kind: "user"; text: string };

type LaunchStage = "idle" | "starting" | "error";

const EMPTY: Data = {
  name: "",
  email: "",
  resumeFilename: "",
  links: { github: "", linkedin: "", twitter: "", devpost: "", website: "" },
  prefs: { roles: [], workAuth: "", location: "" },
};

const STORAGE = "recruit:onboarding";
const SOURCE_NAME = { github: "GitHub", linkedin: "LinkedIn", devpost: "DevPost", website: "website" } as const;

const ROLE_OPTIONS = [
  "Software Engineer",
  "Product Engineer",
  "Founding Engineer",
  "Frontend",
  "ML / AI",
  "Design Engineer",
];

const AUTH_OPTIONS = ["US citizen", "US permanent resident", "Need sponsorship"];

const LINK_FIELDS = [
  { k: "github" as const, label: "GitHub", placeholder: "github.com/yourhandle" },
  { k: "linkedin" as const, label: "LinkedIn", placeholder: "linkedin.com/in/you" },
  { k: "website" as const, label: "Website", placeholder: "yoursite.com" },
  { k: "devpost" as const, label: "DevPost", placeholder: "devpost.com/you" },
  { k: "twitter" as const, label: "X / Twitter", placeholder: "x.com/yourhandle" },
];

const STEP_PROMPTS: Record<Step, string> = {
  role: "What kind of role should I start with?",
  resume: "Upload your resume so I can tailor applications accurately.",
  links: "Any public links I should read before applying?",
  email: "Where should I send application updates?",
  prefs: "Last bit. Any location or work authorization constraints?",
  review: "Review this before I save it to Convex.",
};

export default function OnboardingChatPage() {
  return (
    <Suspense fallback={<OnboardingFallback />}>
      <OnboardingChatContent />
    </Suspense>
  );
}

function OnboardingChatContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roleParam = searchParams.get("role");
  const { active: transitionActive, trigger: triggerTransition, handleComplete } = useSceneTransition();
  const [data, setData] = useState<Data>(EMPTY);
  const [step, setStep] = useState<Step>("role");
  const [messages, setMessages] = useState<ChatEntry[]>([
    { id: "a-role", kind: "agent", text: STEP_PROMPTS.role },
  ]);
  const [muted, setMutedState] = useState(false);
  const [parsingResume, setParsingResume] = useState(false);
  const [typing, setTyping] = useState(false);
  const [activating, setActivating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const historyRef = useRef<{ step: Step; data: Data; messages: ChatEntry[] }[]>([]);

  const stepIndex = STEP_ORDER.indexOf(step);
  const totalSteps = STEP_ORDER.length;

  useEffect(() => {
    const id = window.setTimeout(() => setMutedState(isMuted()), 0);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    router.prefetch("/3d");
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
  }, [messages, typing, step, activating]);

  const selectedRoles = useMemo(() => {
    if (!roleParam || data.prefs.roles.includes(roleParam)) return data.prefs.roles;
    return [roleParam, ...data.prefs.roles];
  }, [data.prefs.roles, roleParam]);

  const linkCount = Object.values(data.links).filter((v) => v.trim()).length;
  const completeCount = [
    selectedRoles.length > 0,
    Boolean(data.resumeFilename),
    linkCount > 0,
    /.+@.+\..+/.test(data.email),
    Boolean(data.prefs.location || data.prefs.workAuth),
  ].filter(Boolean).length;

  const updateData = (updates: DataUpdate) => {
    setData((current) => ({
      ...current,
      ...updates,
      links: { ...current.links, ...(updates.links ?? {}) },
      prefs: { ...current.prefs, ...(updates.prefs ?? {}) },
    }));
  };

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    setMutedState(next);
  };

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

  const handleResumeFile = (file: File | null) => {
    if (!file) return;
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
    void enrichFromResume(file).finally(() => setParsingResume(false));
    advance(`Uploaded ${file.name}`, "links");
  };

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
    if (Object.values(links).some(Boolean)) {
      void enrichFromLinks(links);
    }
  };

  const handleLaunch = () => {
    setActivating(true);
    playActivate();
    window.setTimeout(triggerTransition, 900);
  };

  return (
    <>
      <AnimatePresence>
        {transitionActive && <SceneTransition onComplete={handleComplete} />}
      </AnimatePresence>
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
            <ActionButton
              variant="ghost"
              size="icon"
              onClick={toggleMute}
              aria-label={muted ? "Unmute chat sounds" : "Mute chat sounds"}
              title={muted ? "Unmute chat sounds" : "Mute chat sounds"}
            >
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </ActionButton>
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

      <div className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 gap-6 px-5 pb-8 md:px-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section className="min-w-0">
          <GlassCard density="spacious" className="flex h-[calc(100vh-172px)] min-h-[600px] flex-col">
            <div className="mb-5 flex items-start gap-4 border-b border-white/45 pb-5">
              <AgentCharacter id="scout" awake size={52} />
              <div className="min-w-0">
                <div className={cx(mistClasses.sectionLabel, "text-sky-600")}>Scout intake</div>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
                  Quick setup, one question at a time.
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                  Start with a role and resume. Links, updates, and preferences can come later.
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
                          fileInputRef={fileInputRef}
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
          <IntakeSummary data={data} selectedRoles={selectedRoles} linkCount={linkCount} completeCount={completeCount} />
        </aside>
      </div>
      </main>
    </>
  );
}

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

function StepCard({
  step,
  data,
  selectedRoles,
  linkCount,
  parsingResume,
  fileInputRef,
  toggleRole,
  updateData,
  onResumeFile,
  onAdvance,
  onMergeFinalProfile,
  onLaunch,
}: {
  step: Step;
  data: Data;
  selectedRoles: string[];
  linkCount: number;
  parsingResume: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  toggleRole: (role: string) => void;
  updateData: (updates: DataUpdate) => void;
  onResumeFile: (file: File | null) => void;
  onAdvance: (userText: string, nextStep: Step) => void;
  onMergeFinalProfile: () => void;
  onLaunch: () => void;
}) {
  if (step === "role") {
    return (
      <ChatCard icon={<Briefcase className="h-4 w-4 text-sky-600" />}>
        <ChoiceChipGroup options={ROLE_OPTIONS} selected={selectedRoles} multi onToggle={toggleRole} />
        <div className="mt-4 flex justify-end">
          <ActionButton
            variant="primary"
            disabled={selectedRoles.length === 0}
            onClick={() => onAdvance(selectedRoles.join(", "), "resume")}
          >
            Use {selectedRoles.length === 1 ? selectedRoles[0] : "these roles"} <ArrowRight className="h-3.5 w-3.5" />
          </ActionButton>
        </div>
      </ChatCard>
    );
  }

  if (step === "resume") {
    return (
      <ChatCard icon={<FileText className="h-4 w-4 text-sky-600" />}>
        <FileUploadControl
          fileName={data.resumeFilename || undefined}
          parsing={parsingResume}
          onBrowse={() => fileInputRef.current?.click()}
          onClear={data.resumeFilename ? () => updateData({ resumeFilename: "" }) : undefined}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.doc,.docx"
          className="hidden"
          onChange={(e) => onResumeFile(e.target.files?.[0] ?? null)}
        />
      </ChatCard>
    );
  }

  if (step === "links") {
    return (
      <ChatCard icon={<Link2 className="h-4 w-4 text-sky-600" />}>
        <div className="grid gap-3 sm:grid-cols-2">
          {LINK_FIELDS.map((field) => (
            <TextField
              key={field.k}
              label={field.label}
              value={data.links[field.k]}
              placeholder={field.placeholder}
              readOnly={false}
              onChange={(e) => updateData({ links: { [field.k]: e.target.value } })}
            />
          ))}
        </div>
        <div className="mt-4 flex justify-end">
          <ActionButton
            variant={linkCount > 0 ? "primary" : "secondary"}
            onClick={() => onAdvance(linkCount > 0 ? `${linkCount} public link${linkCount === 1 ? "" : "s"}` : "Skipped links for now", "email")}
          >
            {linkCount > 0 ? "Use links" : "Skip for now"} <ArrowRight className="h-3.5 w-3.5" />
          </ActionButton>
        </div>
      </ChatCard>
    );
  }

  if (step === "email") {
    const valid = /.+@.+\..+/.test(data.email);
    return (
      <ChatCard icon={<Mail className="h-4 w-4 text-sky-600" />}>
        <TextField
          type="email"
          value={data.email}
          placeholder="you@gmail.com"
          readOnly={false}
          onChange={(e) => updateData({ email: e.target.value })}
        />
        <div className="mt-3 flex flex-wrap justify-end gap-2">
          <ActionButton variant="secondary" onClick={() => onAdvance("Skipped email updates", "prefs")}>
            Skip for now
          </ActionButton>
          <ActionButton
            variant="primary"
            disabled={!valid}
            onClick={() => onAdvance(data.email.trim(), "prefs")}
          >
            Use email <ArrowRight className="h-3.5 w-3.5" />
          </ActionButton>
        </div>
      </ChatCard>
    );
  }

  if (step === "prefs") {
    return (
      <ChatCard icon={<MapPin className="h-4 w-4 text-sky-600" />}>
        <div className="grid gap-3 md:grid-cols-2">
          <TextField
            label="Location"
            value={data.prefs.location}
            placeholder="Remote, San Francisco, New York"
            readOnly={false}
            onChange={(e) => updateData({ prefs: { location: e.target.value } })}
          />
          <div>
            <div className="mb-2 block text-xs font-semibold text-slate-500">Work authorization</div>
            <ChoiceChipGroup
              options={AUTH_OPTIONS}
              selected={data.prefs.workAuth ? [data.prefs.workAuth] : []}
              onToggle={(value) => updateData({ prefs: { workAuth: value === data.prefs.workAuth ? "" : value } })}
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <ActionButton
            variant="primary"
            onClick={() => {
              const parts = [data.prefs.location, data.prefs.workAuth].filter(Boolean);
              onAdvance(parts.length > 0 ? parts.join(" · ") : "No extra constraints", "review");
            }}
          >
            Continue <ArrowRight className="h-3.5 w-3.5" />
          </ActionButton>
        </div>
      </ChatCard>
    );
  }

  return (
    <ReviewCard
      data={data}
      selectedRoles={selectedRoles}
      linkCount={linkCount}
      onMergeFinalProfile={onMergeFinalProfile}
      onLaunch={onLaunch}
    />
  );
}

function ReviewCard({
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
            Confirm this is accurate. I’ll save the snapshot to Convex before starting.
          </p>
          {hasConvex ? (
            <ConnectedConfirmButton onMergeFinalProfile={onMergeFinalProfile} onLaunch={onLaunch} />
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

  async function handleConfirm() {
    try {
      setError("");
      setSaving(true);
      setStage("starting");
      onMergeFinalProfile();
      const profile = readProfile();

      const response = await fetch("/api/onboarding/launch-pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile }),
      });
      const body = await response.json().catch(() => null) as
        | { ok: true; runId?: string; status?: "started"; message?: string }
        | { ok: false; reason?: string }
        | null;

      if (!response.ok || !body?.ok) {
        throw new Error(body && !body.ok ? body.reason ?? `launch_${response.status}` : `launch_${response.status}`);
      }

      onLaunch();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStage("error");
      setSaving(false);
    }
  }

  const buttonLabel = stage === "error" ? "Retry launch" : saving ? "Starting dashboard" : "Confirm and start";

  return (
    <div className="flex w-full flex-col gap-3 sm:w-auto sm:items-end">
      {stage === "starting" && (
        <div className="w-full rounded-[18px] border border-sky-200/70 bg-sky-50/45 px-3 py-2 text-xs leading-5 text-sky-800 sm:w-72">
          Saving your profile and opening the dashboard. Jobs and tailored resumes will continue there.
        </div>
      )}
      <ActionButton variant="primary" size="lg" loading={saving} onClick={handleConfirm}>
        {buttonLabel} <ArrowRight className="h-4 w-4" />
      </ActionButton>
      {error && <span className="max-w-64 text-right text-xs leading-5 text-red-600">{error}</span>}
    </div>
  );
}

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
    { label: "Email", value: data.email || "None added" },
    { label: "Preferences", value: [data.prefs.location, data.prefs.workAuth].filter(Boolean).join(" · ") || "None added" },
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
}: {
  data: Data;
  selectedRoles: string[];
  linkCount: number;
  completeCount: number;
}) {
  const rows = [
    { label: "Role", value: selectedRoles.join(", ") || "Needed" },
    { label: "Resume", value: data.resumeFilename || "Needed" },
    { label: "Links", value: linkCount > 0 ? `${linkCount} saved` : "Optional" },
    { label: "Email", value: data.email || "Optional" },
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

async function enrichFromResume(file: File) {
  logProfileEvent("resume", "Started resume parse", "info", { filename: file.name });
  const result = await parseResume(file);
  if (!result.ok) {
    logProfileEvent("resume", "Resume parse failed", "error", { filename: file.name, reason: result.reason });
    return;
  }
  const updates: Partial<UserProfile> = {
    resume: {
      filename: result.filename ?? file.name,
      rawText: result.rawText,
      uploadedAt: new Date().toISOString(),
    },
  };
  if (result.structured) {
    const s = result.structured;
    Object.assign(updates, {
      name: s.name,
      email: s.email,
      location: s.location,
      headline: s.headline,
      summary: s.summary,
      skills: s.skills,
      experience: s.experience,
      education: s.education,
    });
  }
  mergeProfile(updates, "resume", result.structured ? "Read your resume" : "Saved your resume");
  logProfileEvent("resume", "Resume parse completed", "success", {
    filename: result.filename ?? file.name,
    structured: Boolean(result.structured),
  });
}

async function enrichFromLinks(links: Data["links"]) {
  const tasks: Promise<void>[] = [];
  const runLink = async (
    source: Extract<ProvenanceSource, "github" | "linkedin" | "devpost" | "website">,
    url: string,
    action: () => Promise<{ ok: boolean; reason?: string; structured?: Partial<UserProfile> }>
  ) => {
    logProfileEvent(source, "Started link enrichment", "info", { url });
    const result = await action();
    if (!result.ok || !result.structured) {
      logProfileEvent(source, "Link enrichment failed", "error", { url, reason: result.reason ?? "no_structured_profile" });
      return;
    }
    mergeProfile(result.structured, source, `Read your ${SOURCE_NAME[source]}`);
  };

  if (links.github) {
    tasks.push(runLink("github", links.github, () => scrapeAndExtract(links.github, "github")));
  }
  if (links.linkedin) {
    tasks.push(runLink("linkedin", links.linkedin, () => scrapeLinkedIn(links.linkedin)));
  }
  if (links.devpost) {
    tasks.push(runLink("devpost", links.devpost, () => scrapeAndExtract(links.devpost, "devpost")));
  }
  if (links.website) {
    tasks.push(runLink("website", links.website, () => scrapeAndExtract(links.website, "website")));
  }

  await Promise.allSettled(tasks);
}
