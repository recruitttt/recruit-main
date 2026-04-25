"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useAnimation } from "motion/react";
import { Wordmark } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";
import { AgentRail } from "@/components/onboarding/agent-rail";
import { AgentMessage, UserMessage, TypingIndicator } from "@/components/onboarding/chat";
import { AGENTS, AGENT_ORDER, type AgentId } from "@/lib/agents";
import { CompanyLogo } from "@/components/ui/logo";
import { onboardingMatches } from "@/lib/mock-data";
import { ArrowRight, Check, FileText, Upload, Volume2, VolumeX, X } from "lucide-react";
import { AgentCharacter } from "@/components/onboarding/characters";
import { isMuted, setMuted, playSend, playReceive, playWake, playActivate } from "@/lib/sounds";
import { cn } from "@/lib/utils";
import { SceneTransition } from "@/components/room/scene-transition";
import { preloadRoomScene } from "@/components/room/room-canvas-client";
import { ProfileCard } from "@/components/onboarding/profile-card";
import { mergeProfile, type UserProfile } from "@/lib/profile";
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
  { k: "agent", from: "scout", text: "Got a resume? Drop it here. If you don't have one yet, that's fine. We'll build one as we go." },
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
    setMutedState(isMuted());
  }, []);

  useEffect(() => {
    router.prefetch("/dashboard");
    const id = setTimeout(() => preloadRoomScene(), 600);
    return () => window.clearTimeout(id);
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
    setData(next);
  }, []);

  // persist
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE, JSON.stringify(data));
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
      // Navigation happens from the SceneTransition's onComplete callback.
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
    const result = await parseResume(file);
    if (!result.ok) return;
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
  };

  const enrichFromLinks = async (links: Data["links"]) => {
    const tasks: Promise<void>[] = [];

    if (links.github?.trim()) {
      tasks.push(
        (async () => {
          const r = await scrapeAndExtract(links.github, "github");
          if (!r.ok) return;
          mergeProfile(r.structured, "github", `Read your GitHub`);
        })(),
      );
    }
    if (links.linkedin?.trim()) {
      tasks.push(
        (async () => {
          const r = await scrapeLinkedIn(links.linkedin);
          if (!r.ok) return;
          mergeProfile(r.structured, "linkedin", `Read your LinkedIn`);
        })(),
      );
    }
    if (links.devpost?.trim()) {
      tasks.push(
        (async () => {
          const r = await scrapeAndExtract(links.devpost, "devpost");
          if (!r.ok) return;
          mergeProfile(r.structured, "devpost", `Read your DevPost`);
        })(),
      );
    }
    if (links.website?.trim()) {
      tasks.push(
        (async () => {
          const r = await scrapeAndExtract(links.website, "website");
          if (!r.ok) return;
          mergeProfile(r.structured, "website", `Read your website`);
        })(),
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
    <motion.div animate={shakeCtrl} className="flex min-h-screen flex-col">
      {/* header */}
      <header className="flex items-center justify-between px-5 py-4 md:px-8">
        <Link href="/">
          <Wordmark size="sm" />
        </Link>
        <div className="flex items-center gap-4">
          <div className="hidden items-center gap-2 sm:flex">
            <div className="h-1 w-24 overflow-hidden rounded-full bg-[var(--color-border)]">
              <motion.div
                className="h-full bg-[var(--color-accent)]"
                initial={{ width: 0 }}
                animate={{ width: `${progress * 100}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
              />
            </div>
            <span className="text-[11px] font-mono text-[var(--color-fg-subtle)] tabular-nums">
              {awake.size} / 5
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleMute}
            aria-label={muted ? "Unmute chat sounds" : "Mute chat sounds"}
            title={muted ? "Unmute chat sounds" : "Mute chat sounds"}
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </Button>
          <Link href="/" aria-label="Close">
            <Button variant="ghost" size="icon">
              <X className="h-4 w-4" />
            </Button>
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
          <div ref={scrollRef} className="relative max-h-[calc(100vh-140px)] overflow-y-auto pr-1">
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
                {typing && <TypingIndicator key={`t-${typing}-${pointer.current}`} from={typing} />}
              </AnimatePresence>

              {activating && (
                <SceneTransition
                  onComplete={() => router.push("/dashboard")}
                />
              )}
            </div>
          </div>

          {/* profile card */}
          <div className="lg:sticky lg:top-24 lg:self-start lg:max-h-[calc(100vh-110px)] lg:overflow-y-auto">
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
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
      className="mt-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]/60 p-4"
    >
      {children}
    </motion.div>
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
        <input
          ref={ref}
          value={v}
          onChange={(e) => setV(e.target.value)}
          placeholder="Your full name"
          className="flex-1 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-[14px] text-[var(--color-fg)] placeholder:text-[var(--color-fg-subtle)] outline-none focus:border-[var(--color-accent)]"
        />
        <Button type="submit" variant="accent" size="md" disabled={!v.trim()}>
          Send <ArrowRight className="h-3.5 w-3.5" />
        </Button>
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
          <input
            ref={ref}
            type="email"
            value={v}
            onChange={(e) => setV(e.target.value)}
            placeholder="you@gmail.com"
            className="flex-1 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-[14px] text-[var(--color-fg)] placeholder:text-[var(--color-fg-subtle)] outline-none focus:border-[var(--color-accent)]"
          />
          <Button type="submit" variant="accent" size="md" disabled={!valid}>
            Send <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-[var(--color-fg-subtle)] font-mono">
          <span className="text-[var(--color-fg-muted)]">or</span>
          <button
            type="button"
            onClick={() => onSubmit("email", "Continued with Google", { email: "you@gmail.com" })}
            className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-1)] px-2.5 py-1 text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] transition-colors"
          >
            Continue with Google
          </button>
          <button
            type="button"
            onClick={() => onSubmit("email", "Continued with GitHub", { email: "you@users.noreply.github.com" })}
            className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-1)] px-2.5 py-1 text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] transition-colors"
          >
            Continue with GitHub
          </button>
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
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full items-center gap-3 rounded-md border border-dashed border-[var(--color-border-strong)] bg-[var(--color-bg)] px-4 py-5 text-left hover:border-[var(--color-accent)] transition-colors"
        >
          <Upload className="h-4 w-4 text-[var(--color-fg-muted)]" />
          <div className="flex-1">
            <div className="text-[13px] text-[var(--color-fg)]">
              Drop your resume or click to upload
            </div>
            <div className="text-[11px] text-[var(--color-fg-subtle)] font-mono">
              PDF, DOCX · up to 10 MB
            </div>
          </div>
        </button>
      ) : (
        <div className="flex items-center gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3">
          <FileText className="h-4 w-4 text-[var(--color-accent)]" />
          <div className="flex-1 min-w-0">
            <div className="truncate text-[13px] text-[var(--color-fg)]">{filename}</div>
            <div className="text-[11px] text-[var(--color-fg-subtle)] font-mono">
              {parsing ? "Parsing resume…" : "Ready"}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {parsing ? (
              <div className="h-3 w-3 rounded-full border-2 border-[var(--color-accent)] border-t-transparent animate-spin" />
            ) : (
              <Check className="h-4 w-4 text-emerald-600" strokeWidth={2.5} />
            )}
            <button
              type="button"
              onClick={clearFile}
              className="rounded p-0.5 text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface-2)] transition-colors"
              aria-label="Remove resume"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
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
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {fields.map((f) => (
          <div key={f.k} className="flex items-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2">
            <span className="shrink-0 text-[11px] font-mono text-[var(--color-fg-subtle)] w-[58px]">
              {f.label}
            </span>
            <input
              value={links[f.k]}
              onChange={(e) => setLinks({ ...links, [f.k]: e.target.value })}
              placeholder={f.placeholder}
              className="flex-1 bg-transparent text-[13px] text-[var(--color-fg)] placeholder:text-[var(--color-fg-subtle)] outline-none"
            />
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between">
        <span className="text-[11px] font-mono text-[var(--color-fg-subtle)]">
          {count === 0 ? "Leave blank if you prefer, you can add these later." : `${count} link${count === 1 ? "" : "s"}`}
        </span>
        <Button
          variant="accent"
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
        </Button>
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
        <div>
          <Label>What roles?</Label>
          <Chips
            options={ROLE_OPTIONS}
            selected={roles}
            multi
            onToggle={toggleRole}
          />
        </div>
        <div>
          <Label>Where?</Label>
          <Chips
            options={LOCATION_OPTIONS}
            selected={location ? [location] : []}
            onToggle={(v) => setLocation(v === location ? "" : v)}
          />
        </div>
        <div>
          <Label>Work authorization?</Label>
          <Chips
            options={AUTH_OPTIONS}
            selected={workAuth ? [workAuth] : []}
            onToggle={(v) => setWorkAuth(v === workAuth ? "" : v)}
          />
        </div>
      </div>
      <div className="mt-5 flex justify-end">
        <Button
          variant="accent"
          size="md"
          disabled={!ready}
          onClick={() => {
            const echo = `${roles.join(", ")} · ${location} · ${workAuth}`;
            onSubmit("prefs", echo, { prefs: { roles, location, workAuth } });
          }}
        >
          Send <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </Well>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2 text-[11px] uppercase tracking-[0.15em] text-[var(--color-fg-subtle)] font-mono">
      {children}
    </div>
  );
}

function Chips({
  options,
  selected,
  multi = false,
  onToggle,
}: {
  options: string[];
  selected: string[];
  multi?: boolean;
  onToggle: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = selected.includes(o);
        return (
          <button
            key={o}
            type="button"
            onClick={() => onToggle(o)}
            className={cn(
              "rounded-full border px-3 py-1 text-[12px] transition-colors",
              on
                ? "border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-accent)]"
                : "border-[var(--color-border)] bg-[var(--color-surface-1)] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:border-[var(--color-border-strong)]"
            )}
          >
            {o}
          </button>
        );
      })}
    </div>
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
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mt-6 rounded-xl border border-[var(--color-accent)]/30 bg-[var(--color-accent-soft)] p-5"
    >
      <div className="mb-4 flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-accent)] font-mono">
          Splitting up · 5 applications in flight
        </div>
        <span className="flex items-center gap-1.5 text-[10px] font-mono text-[var(--color-fg-muted)]">
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
              className="flex items-center gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-1)]/60 px-3 py-2"
            >
              <AgentCharacter id={a.agent} awake size={30} />
              <span className="text-[13px] font-medium text-[var(--color-fg)] w-[54px]">
                {agent.name}
              </span>
              <span className="text-[var(--color-fg-subtle)]">→</span>
              <div className="flex items-center gap-2 min-w-0">
                <CompanyLogo
                  bg={a.company.logoBg}
                  text={a.company.logoText}
                  size={22}
                  className="rounded-[5px]"
                />
                <span className="text-[13px] text-[var(--color-fg)]">{a.company.company}</span>
                <span className="text-[12px] text-[var(--color-fg-subtle)] truncate">
                  {a.company.role}
                </span>
              </div>
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 + i * 0.3, duration: 0.3 }}
                className="ml-auto flex items-center gap-1.5 text-[10px] uppercase tracking-[0.15em] font-mono text-[var(--color-accent)]"
              >
                <span className="h-1 w-1 rounded-full bg-[var(--color-accent)]" style={{ animation: "pulse-soft 1.2s ease-in-out infinite" }} />
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
        className="mt-4 text-[11px] font-mono text-[var(--color-fg-subtle)]"
      >
        Redirecting to mission control…
      </motion.div>
    </motion.div>
  );
}
