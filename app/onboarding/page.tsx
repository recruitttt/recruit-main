"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useAnimation } from "motion/react";
import { Wordmark } from "@/components/ui/logo";
import {
  ActionButton,
  ChoiceChipGroup,
  FileUploadControl,
  GlassCard,
  ProgressMeter,
  TextField,
  cx,
  mistClasses,
  mistRadii,
} from "@/components/design-system";
import { AgentRail } from "@/components/onboarding/agent-rail";
import { AgentMessage, UserMessage, TypingIndicator } from "@/components/onboarding/chat";
import { AGENTS, AGENT_ORDER, type AgentId } from "@/lib/agents";
import { CompanyLogo } from "@/components/ui/logo";
import { onboardingMatches } from "@/lib/mock-data";
import { ArrowRight, Volume2, VolumeX, X } from "lucide-react";
import { AgentCharacter } from "@/components/onboarding/characters";
import { isMuted, setMuted, playSend, playReceive, playWake, playActivate } from "@/lib/sounds";
import { ProfileCard } from "@/components/onboarding/profile-card";
import { logProfileEvent, mergeProfile, type ProvenanceSource, type UserProfile } from "@/lib/profile";
import {
  parseResume,
  scrapeAndExtract,
  scrapeLinkedIn,
} from "@/lib/scrapers";

type InputKind = "name" | "email" | "resume" | "links" | "prefs";

type Beat =
  | { k: "agent"; from: AgentId; text: string | ((d: Data) => string) }
  | { k: "wake"; who: AgentId }
  | { k: "input"; kind: InputKind; from: AgentId }
  | { k: "pause"; ms: number }
  | { k: "activate" };

type Data = {
  name: string;
  email: string;
  resumeFilename: string;
  links: { github: string; linkedin: string; twitter: string; devpost: string; website: string };
  prefs: { roles: string[]; workAuth: string; location: string };
};

const EMPTY: Data = {
  name: "",
  email: "",
  resumeFilename: "",
  links: { github: "", linkedin: "", twitter: "", devpost: "", website: "" },
  prefs: { roles: [], workAuth: "", location: "" },
};

const STORAGE = "recruit:onboarding";
const SOURCE_NAME = { github: "GitHub", linkedin: "LinkedIn", devpost: "DevPost", website: "website" } as const;

const beats: Beat[] = [
  { k: "pause", ms: 300 },
  { k: "agent", from: "scout", text: "Hey. I'm Scout, one of your 5 agents." },
  { k: "agent", from: "scout", text: "We each apply to a different job in parallel. I'll handle the questions. The others are just warming up." },
  { k: "agent", from: "scout", text: "What should I call you?" },
  { k: "input", kind: "name", from: "scout" },
  { k: "agent", from: "scout", text: (d) => `Nice to meet you, ${d.name.split(" ")[0]}.` },
  { k: "agent", from: "scout", text: "What's the best email for updates?" },
  { k: "input", kind: "email", from: "scout" },
  { k: "wake", who: "scout" },
  { k: "pause", ms: 600 },

  { k: "wake", who: "mimi" },
  { k: "agent", from: "scout", text: "Mimi's online. Agent two." },
  { k: "agent", from: "scout", text: "Got a resume? Drop it here." },
  { k: "input", kind: "resume", from: "scout" },
  { k: "pause", ms: 500 },

  { k: "wake", who: "pip" },
  { k: "agent", from: "scout", text: "Pip just came online. Three of us ready." },
  { k: "agent", from: "scout", text: "Any public links? GitHub, LinkedIn, your site. The squad will read each one and fill out your profile." },
  { k: "input", kind: "links", from: "scout" },
  { k: "pause", ms: 400 },

  { k: "wake", who: "juno" },
  { k: "agent", from: "scout", text: "Juno's up. Four agents live." },
  { k: "agent", from: "scout", text: "Last question. What are we actually hunting?" },
  { k: "input", kind: "prefs", from: "scout" },
  { k: "pause", ms: 400 },

  { k: "wake", who: "bodhi" },
  { k: "agent", from: "scout", text: "Bodhi's in. Full squad." },
  { k: "pause", ms: 500 },
  { k: "agent", from: "scout", text: "Alright. We split up now. Each of us grabs a different role and applies in parallel." },
  { k: "activate" },
];

type Rendered =
  | { id: string; kind: "agent"; from: AgentId; text: string; revealed: number }
  | { id: string; kind: "user"; text: string }
  | { id: string; kind: "input"; inputKind: InputKind; from: AgentId };

const TYPING_INDICATOR_MS = 380;
const REVEAL_MS_PER_CHAR = 30;
const POST_MESSAGE_PAUSE = 520;

export default function OnboardingChatPage() {
  const router = useRouter();
  const [data, setData] = useState<Data>(EMPTY);
  const [rendered, setRendered] = useState<Rendered[]>([]);
  const [typing, setTyping] = useState<AgentId | null>(null);
  const [awake, setAwake] = useState<Set<AgentId>>(new Set());
  const [activating, setActivating] = useState(false);
  const [phase, setPhase] = useState<"playing" | "awaiting-input" | "done">("playing");
  const [pendingInput, setPendingInput] = useState<{ kind: InputKind; from: AgentId } | null>(null);
  const [beatTick, setBeatTick] = useState(0);
  const [muted, setMutedState] = useState(false);
  const [wakingAgent, setWakingAgent] = useState<AgentId | null>(null);
  const shakeCtrl = useAnimation();
  const pointer = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // hydrate mute state
  useEffect(() => {
    const id = window.setTimeout(() => setMutedState(isMuted()), 0);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    router.prefetch("/dashboard");
  }, [router]);

  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    setMutedState(next);
  };

  // hydrate from localStorage + URL ?role=
  useEffect(() => {
    let next = EMPTY;
    try {
      const raw = localStorage.getItem(STORAGE);
      if (raw) next = { ...EMPTY, ...JSON.parse(raw) };
    } catch {}
    try {
      const role = new URLSearchParams(window.location.search).get("role");
      if (role && !next.prefs.roles.includes(role)) {
        next = { ...next, prefs: { ...next.prefs, roles: [role, ...next.prefs.roles] } };
      }
    } catch {}
    const id = window.setTimeout(() => setData(next), 0);
    return () => window.clearTimeout(id);
  }, []);

  // persist
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE, JSON.stringify(data));
      if (data.name || data.email || data.resumeFilename) {
        logProfileEvent("chat", "Persisted onboarding state", "info", {
          hasName: Boolean(data.name),
          hasEmail: Boolean(data.email),
          resumeFilename: data.resumeFilename || undefined,
          roles: data.prefs.roles,
        });
      }
    } catch {}
  }, [data]);

  // play beats
  useEffect(() => {
    if (phase !== "playing") return;
    const beat = beats[pointer.current];
    if (!beat) {
      setPhase("done");
      return;
    }

    let cancelled = false;
    const timers: number[] = [];
    const intervals: number[] = [];

    const after = (ms: number, fn: () => void) => {
      const t = window.setTimeout(() => {
        if (cancelled) return;
        fn();
      }, ms);
      timers.push(t);
    };

    const advance = () => {
      if (cancelled) return;
      pointer.current += 1;
      setBeatTick((t) => t + 1);
    };

    if (beat.k === "agent") {
      const text = typeof beat.text === "function" ? beat.text(data) : beat.text;
      setTyping(beat.from);
      after(TYPING_INDICATOR_MS, () => {
        setTyping(null);
        const msgId = `b-${pointer.current}`;
        setRendered((r) => [
          ...r,
          { id: msgId, kind: "agent", from: beat.from, text, revealed: 0 },
        ]);
        // character-by-character typewriter
        let i = 0;
        const iv = window.setInterval(() => {
          if (cancelled) {
            window.clearInterval(iv);
            return;
          }
          i += 1;
          setRendered((r) =>
            r.map((m) =>
              m.id === msgId && m.kind === "agent" ? { ...m, revealed: i } : m
            )
          );
          if (i >= text.length) {
            window.clearInterval(iv);
            playReceive();
            after(POST_MESSAGE_PAUSE, advance);
          }
        }, REVEAL_MS_PER_CHAR);
        intervals.push(iv);
      });
    } else if (beat.k === "pause") {
      after(beat.ms, advance);
    } else if (beat.k === "wake") {
      setAwake((s) => {
        const next = new Set(s);
        next.add(beat.who);
        return next;
      });
      setWakingAgent(beat.who);
      playWake();
      // subtle camera shake
      shakeCtrl.start({
        x: [0, -1.5, 2, -1.5, 1, 0],
        transition: { duration: 0.35, ease: "easeOut" },
      });
      // clear the waking marker once the effect has played out
      after(900, () => setWakingAgent(null));
      after(600, advance);
    } else if (beat.k === "input") {
      setPendingInput({ kind: beat.kind, from: beat.from });
      setRendered((r) => [
        ...r,
        { id: `i-${pointer.current}`, kind: "input", inputKind: beat.kind, from: beat.from },
      ]);
      setPhase("awaiting-input");
    } else if (beat.k === "activate") {
      setActivating(true);
      playActivate();
      after(900, () => router.push("/dashboard"));
    }

    return () => {
      cancelled = true;
      timers.forEach((t) => window.clearTimeout(t));
      intervals.forEach((i) => window.clearInterval(i));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, beatTick, data, router]);

  // auto-scroll on new content
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [rendered, typing, activating]);

  const handleInputSubmit = (
    kind: InputKind,
    echo: string,
    updates: Partial<Data>,
    extras?: { resumeFile?: File | null },
  ) => {
    setData((d) => ({
      ...d,
      ...updates,
      links: { ...d.links, ...(updates.links ?? {}) },
      prefs: { ...d.prefs, ...(updates.prefs ?? {}) },
    }));

    // Mirror the chat answer into the canonical profile (outside setData
    // so React's strict-mode double-invoke doesn't double-log).
    if (kind === "name" && updates.name) {
      mergeProfile({ name: updates.name }, "chat", `Got your name`);
    } else if (kind === "email" && updates.email) {
      mergeProfile({ email: updates.email }, "chat", `Got your email`);
    } else if (kind === "resume" && extras?.resumeFile) {
      mergeProfile(
        {
          resume: {
            filename: extras.resumeFile.name,
            uploadedAt: new Date().toISOString(),
          },
        },
        "resume",
        `Got your resume`,
      );
    } else if (kind === "links" && updates.links) {
      mergeProfile({ links: updates.links }, "chat", `Got your links`);
    } else if (kind === "prefs" && updates.prefs) {
      mergeProfile(
        {
          prefs: {
            roles: updates.prefs.roles,
            workAuth: updates.prefs.workAuth,
            locations: updates.prefs.location ? [updates.prefs.location] : [],
          },
        },
        "chat",
        `Got your preferences`,
      );
    }

    // Kick off enrichment async - don't block the chat.
    if (kind === "resume" && extras?.resumeFile) {
      enrichFromResume(extras.resumeFile);
    } else if (kind === "links" && updates.links) {
      enrichFromLinks(updates.links);
    }

    playSend();
    // replace the input placeholder with a user-message echo
    setRendered((r) => {
      const idx = r.findIndex((x) => x.kind === "input" && x.inputKind === kind);
      if (idx === -1) return [...r, { id: `u-${pointer.current}`, kind: "user", text: echo }];
      const copy = [...r];
      copy[idx] = { id: `u-${pointer.current}`, kind: "user", text: echo };
      return copy;
    });
    setPendingInput(null);
    pointer.current += 1;
    setBeatTick((t) => t + 1);
    setPhase("playing");
  };

  const enrichFromResume = async (file: File) => {
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
    mergeProfile(
      updates,
      "resume",
      result.structured ? `Read your resume` : `Saved your resume`,
    );
    logProfileEvent("resume", "Resume parse completed", "success", {
      filename: result.filename ?? file.name,
      structured: Boolean(result.structured),
    });
  };

  const enrichFromLinks = async (links: Data["links"]) => {
    const tasks: Promise<void>[] = [];
    const runLink = async (
      source: Extract<ProvenanceSource, "github" | "linkedin" | "devpost" | "website">,
      url: string,
      action: () => Promise<{ ok: boolean; reason?: string; structured?: Partial<UserProfile> }>
    ) => {
      logProfileEvent(source, "Started link enrichment", "info", { url });
      const r = await action();
      if (!r.ok || !r.structured) {
        logProfileEvent(source, "Link enrichment failed", "error", { url, reason: r.reason ?? "no_structured_profile" });
        return;
      }
      mergeProfile(r.structured, source, `Read your ${SOURCE_NAME[source]}`);
    };

    if (links.github?.trim()) {
      tasks.push(
        runLink("github", links.github, () => scrapeAndExtract(links.github, "github")),
      );
    }
    if (links.linkedin?.trim()) {
      tasks.push(
        runLink("linkedin", links.linkedin, () => scrapeLinkedIn(links.linkedin)),
      );
    }
    if (links.devpost?.trim()) {
      tasks.push(
        runLink("devpost", links.devpost, () => scrapeAndExtract(links.devpost, "devpost")),
      );
    }
    if (links.website?.trim()) {
      tasks.push(
        runLink("website", links.website, () => scrapeAndExtract(links.website, "website")),
      );
    }

    await Promise.allSettled(tasks);
  };

  const activeAgent = useMemo(() => {
    if (typing) return typing;
    if (pendingInput) return pendingInput.from;
    return null;
  }, [typing, pendingInput]);

  const progress = awake.size / AGENT_ORDER.length;

  return (
    <motion.div animate={shakeCtrl} className={cx("flex min-h-screen flex-col overflow-x-hidden", mistClasses.page)}>
      {/* header */}
      <header className="flex items-center justify-between px-5 py-4 md:px-8">
        <Link href="/">
          <Wordmark size="sm" />
        </Link>
        <div className="flex items-center gap-4">
          <ProgressMeter value={progress} label={`${awake.size} / 5`} className="hidden sm:flex" />
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
      </header>

      {/* body: rail + chat + profile card */}
      <div className="flex-1">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-5 pb-10 md:px-8 lg:grid-cols-[140px_minmax(0,1fr)_320px] lg:gap-10">
          {/* rail (top strip on mobile, side on desktop) */}
          <div className="lg:sticky lg:top-24 lg:self-start">
            <AgentRail awake={awake} speaking={activeAgent} waking={wakingAgent} />
          </div>

          {/* chat */}
          <div ref={scrollRef} className="relative min-w-0 max-h-[calc(100vh-140px)] overflow-y-auto pr-1">
            <div className="space-y-5 pb-24">
              {rendered.map((m) => {
                if (m.kind === "agent") {
                  const shown = m.text.slice(0, m.revealed);
                  const typing = m.revealed < m.text.length;
                  return (
                    <AgentMessage key={m.id} from={m.from}>
                      {shown}
                      {typing && <Caret />}
                    </AgentMessage>
                  );
                }
                if (m.kind === "user") {
                  return (
                    <UserMessage key={m.id}>
                      {m.text}
                    </UserMessage>
                  );
                }
                // input
                return (
                  <div key={m.id} className="pl-11">
                    <InputWell
                      kind={m.inputKind}
                      data={data}
                      onSubmit={handleInputSubmit}
                    />
                  </div>
                );
              })}

              <AnimatePresence>
                {typing && <TypingIndicator key={`t-${typing}-${beatTick}`} from={typing} />}
              </AnimatePresence>

              {activating && <ActivationReveal />}
            </div>
          </div>

          {/* profile card */}
          <div className="min-w-0 lg:sticky lg:top-24 lg:self-start lg:max-h-[calc(100vh-110px)] lg:overflow-y-auto">
            <ProfileCard />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function Caret() {
  return (
    <span
      className="inline-block align-[-2px] ml-[2px]"
      style={{
        width: "2px",
        height: "1em",
        background: "currentColor",
        animation: "caret-blink 0.8s steps(1) infinite",
        opacity: 0.75,
      }}
    />
  );
}

// ---------------- inputs ----------------

type SubmitFn = (
  kind: InputKind,
  echo: string,
  updates: Partial<Data>,
  extras?: { resumeFile?: File | null },
) => void;

function InputWell({
  kind,
  data,
  onSubmit,
}: {
  kind: InputKind;
  data: Data;
  onSubmit: SubmitFn;
}) {
  if (kind === "name") return <NameInput initial={data.name} onSubmit={onSubmit} />;
  if (kind === "email") return <EmailInput initial={data.email} onSubmit={onSubmit} />;
  if (kind === "resume") return <ResumeInput initial={data.resumeFilename} onSubmit={onSubmit} />;
  if (kind === "links") return <LinksInput initial={data.links} onSubmit={onSubmit} />;
  if (kind === "prefs") return <PrefsInput initial={data.prefs} onSubmit={onSubmit} />;
  return null;
}

function Well({ children }: { children: React.ReactNode }) {
  return (
    <GlassCard density="normal" className="mt-2">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        {children}
      </motion.div>
    </GlassCard>
  );
}

function NameInput({
  initial,
  onSubmit,
}: {
  initial: string;
  onSubmit: SubmitFn;
}) {
  const [v, setV] = useState(initial);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return (
    <Well>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!v.trim()) return;
          onSubmit("name", v.trim(), { name: v.trim() });
        }}
        className="flex gap-2"
      >
        <TextField
          inputRef={ref}
          value={v}
          onChange={(e) => setV(e.target.value)}
          placeholder="Your full name"
          autoFocus
          readOnly={false}
          rootClassName="flex-1"
        />
        <ActionButton type="submit" variant="primary" size="md" disabled={!v.trim()}>
          Send <ArrowRight className="h-3.5 w-3.5" />
        </ActionButton>
      </form>
    </Well>
  );
}

function EmailInput({
  initial,
  onSubmit,
}: {
  initial: string;
  onSubmit: SubmitFn;
}) {
  const [v, setV] = useState(initial);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => ref.current?.focus(), []);
  const valid = /.+@.+\..+/.test(v);
  return (
    <Well>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid) return;
          onSubmit("email", v.trim(), { email: v.trim() });
        }}
        className="space-y-2"
      >
        <div className="flex gap-2">
          <TextField
            inputRef={ref}
            type="email"
            value={v}
            onChange={(e) => setV(e.target.value)}
            placeholder="you@gmail.com"
            autoFocus
            readOnly={false}
            rootClassName="flex-1"
          />
          <ActionButton type="submit" variant="primary" size="md" disabled={!valid}>
            Send <ArrowRight className="h-3.5 w-3.5" />
          </ActionButton>
        </div>
        <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-slate-500">
          <span>or</span>
          <ActionButton
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => onSubmit("email", "Continued with Google", { email: "you@gmail.com" })}
          >
            Continue with Google
          </ActionButton>
          <ActionButton
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => onSubmit("email", "Continued with GitHub", { email: "you@users.noreply.github.com" })}
          >
            Continue with GitHub
          </ActionButton>
        </div>
      </form>
    </Well>
  );
}

function ResumeInput({
  initial,
  onSubmit,
}: {
  initial: string;
  onSubmit: SubmitFn;
}) {
  const [filename, setFilename] = useState(initial);
  const [parsing, setParsing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const parseTimerRef = useRef<number | null>(null);

  const clearFile = () => {
    if (parseTimerRef.current !== null) {
      window.clearTimeout(parseTimerRef.current);
      parseTimerRef.current = null;
    }
    setFilename("");
    setParsing(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleFile = (file: File | null, nameOverride?: string) => {
    const name = file?.name ?? nameOverride ?? "";
    setFilename(name);
    setParsing(true);
    parseTimerRef.current = window.setTimeout(() => {
      parseTimerRef.current = null;
      setParsing(false);
      onSubmit("resume", `Uploaded ${name}`, { resumeFilename: name }, { resumeFile: file });
    }, 700);
  };

  return (
    <Well>
      {!filename ? (
        <FileUploadControl onBrowse={() => inputRef.current?.click()} />
      ) : (
        <FileUploadControl fileName={filename} parsing={parsing} onBrowse={() => inputRef.current?.click()} onClear={clearFile} />
      )}

      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.doc,.docx"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
        }}
      />
    </Well>
  );
}

function LinksInput({
  initial,
  onSubmit,
}: {
  initial: Data["links"];
  onSubmit: SubmitFn;
}) {
  const [links, setLinks] = useState(initial);
  const fields = [
    { k: "github" as const, label: "GitHub", placeholder: "github.com/yourhandle" },
    { k: "linkedin" as const, label: "LinkedIn", placeholder: "linkedin.com/in/you" },
    { k: "website" as const, label: "Website", placeholder: "yoursite.com" },
    { k: "devpost" as const, label: "DevPost", placeholder: "devpost.com/you" },
    { k: "twitter" as const, label: "X / Twitter", placeholder: "x.com/yourhandle" },
  ];
  const count = Object.values(links).filter((v) => v.trim()).length;
  return (
    <Well>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {fields.map((f) => (
          <TextField
            key={f.k}
            label={f.label}
            value={links[f.k]}
            onChange={(e) => setLinks({ ...links, [f.k]: e.target.value })}
            placeholder={f.placeholder}
            readOnly={false}
          />
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between">
        <span className="font-mono text-[11px] text-slate-500">
          {count === 0 ? "Leave blank if you prefer, you can add these later." : `${count} link${count === 1 ? "" : "s"}`}
        </span>
        <ActionButton
          variant="primary"
          size="md"
          onClick={() => {
            const provided = Object.entries(links)
              .filter(([, v]) => v.trim())
              .map(([k]) => k[0].toUpperCase() + k.slice(1))
              .join(", ");
            onSubmit(
              "links",
              provided || "Skipped for now",
              { links }
            );
          }}
        >
          {count === 0 ? "Skip for now" : "Send"} <ArrowRight className="h-3.5 w-3.5" />
        </ActionButton>
      </div>
    </Well>
  );
}

const ROLE_OPTIONS = [
  "Software Engineer",
  "Product Engineer",
  "Founding Engineer",
  "Frontend",
  "ML / AI",
  "Design Engineer",
];

const LOCATION_OPTIONS = [
  "Remote",
  "San Francisco",
  "New York",
  "Seattle",
  "Anywhere US",
];

const AUTH_OPTIONS = ["US citizen", "US permanent resident", "Need sponsorship"];

function PrefsInput({
  initial,
  onSubmit,
}: {
  initial: Data["prefs"];
  onSubmit: SubmitFn;
}) {
  const [roles, setRoles] = useState<string[]>(initial.roles);
  const [location, setLocation] = useState(initial.location);
  const [workAuth, setWorkAuth] = useState(initial.workAuth);

  const ready = roles.length > 0 && location && workAuth;
  const toggleRole = (r: string) =>
    setRoles((s) => (s.includes(r) ? s.filter((x) => x !== r) : [...s, r]));

  return (
    <Well>
      <div className="space-y-4">
        <ChoiceChipGroup label="What roles?" options={ROLE_OPTIONS} selected={roles} multi onToggle={toggleRole} />
        <ChoiceChipGroup label="Where?" options={LOCATION_OPTIONS} selected={location ? [location] : []} onToggle={(v) => setLocation(v === location ? "" : v)} />
        <ChoiceChipGroup label="Work authorization?" options={AUTH_OPTIONS} selected={workAuth ? [workAuth] : []} onToggle={(v) => setWorkAuth(v === workAuth ? "" : v)} />
      </div>
      <div className="mt-5 flex justify-end">
        <ActionButton
          variant="primary"
          size="md"
          disabled={!ready}
          onClick={() => {
            const echo = `${roles.join(", ")} · ${location} · ${workAuth}`;
            onSubmit("prefs", echo, { prefs: { roles, location, workAuth } });
          }}
        >
          Send <ArrowRight className="h-3.5 w-3.5" />
        </ActionButton>
      </div>
    </Well>
  );
}

// ---------------- activation reveal ----------------

function ActivationReveal() {
  const assignments = [
    { agent: "scout" as const, company: onboardingMatches[0] },
    { agent: "mimi" as const, company: onboardingMatches[1] },
    { agent: "pip" as const, company: onboardingMatches[2] },
    { agent: "juno" as const, company: onboardingMatches[3] },
    { agent: "bodhi" as const, company: onboardingMatches[4] },
  ];

  return (
    <GlassCard variant="selected" density="spacious" className="mt-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className={cx(mistClasses.sectionLabel, "text-sky-600")}>
            Splitting up · 5 applications in flight
          </div>
          <span className="flex items-center gap-1.5 font-mono text-[10px] text-slate-500">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" style={{ animation: "pulse-soft 1.4s ease-in-out infinite" }} />
            LIVE
          </span>
        </div>

      <div className="space-y-2.5">
        {assignments.map((a, i) => {
          const agent = AGENTS[a.agent];
          return (
            <motion.div
              key={a.agent}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.2 + i * 0.3 }}
              className={cx("flex items-center gap-3 border border-white/55 bg-white/30 px-3 py-2", mistRadii.nested)}
            >
              <AgentCharacter id={a.agent} awake size={30} />
              <span className="w-[54px] text-[13px] font-medium text-slate-900">
                {agent.name}
              </span>
              <span className="text-slate-400">→</span>
              <div className="flex min-w-0 items-center gap-2">
                <CompanyLogo
                  bg={a.company.logoBg}
                  text={a.company.logoText}
                  size={22}
                  className="rounded-[5px]"
                />
                <span className="text-[13px] text-slate-900">{a.company.company}</span>
                <span className="truncate text-[12px] text-slate-500">
                  {a.company.role}
                </span>
              </div>
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 + i * 0.3, duration: 0.3 }}
                className="ml-auto flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.15em] text-sky-600"
              >
                <span className="h-1 w-1 rounded-full bg-sky-500" style={{ animation: "pulse-soft 1.2s ease-in-out infinite" }} />
                applying
              </motion.span>
            </motion.div>
          );
        })}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2.6, duration: 0.5 }}
        className="mt-4 font-mono text-[11px] text-slate-500"
      >
        Redirecting to mission control...
      </motion.div>
      </motion.div>
    </GlassCard>
  );
}
