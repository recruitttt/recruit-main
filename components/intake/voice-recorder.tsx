"use client";

// Voice recorder — captures a single take of the user describing their
// background, posts it to `/api/intake/voice`, and renders the SSE event
// stream so the user can see transcription and field-extraction progress.
//
// Pairs with the voice IntakeAdapter (`lib/intake/voice/adapter.ts`). The
// adapter handles persistence; this component just records audio and shows
// progress.

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Square, Trash2 } from "lucide-react";
import { ActionButton, cx } from "@/components/design-system";
import { speak } from "@/lib/speech";

type Phase = "idle" | "recording" | "uploading" | "done" | "error";

interface ProgressEntry {
  stage: string;
  message?: string;
  level?: "info" | "warn" | "error";
  data?: { fields?: unknown };
}

function formatFieldList(fields: string[]): string {
  if (fields.length === 0) return "";
  if (fields.length === 1) return fields[0];
  if (fields.length === 2) return `${fields[0]} and ${fields[1]}`;
  return `${fields.slice(0, -1).join(", ")}, and ${fields[fields.length - 1]}`;
}

function readbackFor(events: ProgressEntry[]): string | null {
  for (let i = events.length - 1; i >= 0; i--) {
    const evt = events[i];
    if (evt.stage !== "extract-fields") continue;
    const fields = Array.isArray(evt.data?.fields)
      ? (evt.data!.fields as unknown[]).filter((f): f is string => typeof f === "string")
      : [];
    if (fields.length > 0) {
      return `Got it — I added ${formatFieldList(fields)} to your profile.`;
    }
    return "Got it. I didn't catch anything new to add — feel free to try again.";
  }
  return null;
}

export interface VoiceRecorderProps {
  /** Top-level profile keys to extract — forwarded to the adapter as `targets` CSV. */
  extractTargets?: string[];
  /** Optional callback when the run finishes successfully. */
  onComplete?: () => void;
  className?: string;
}

const DEFAULT_TARGETS = ["headline", "summary", "experience", "skills", "prefs"];

export function VoiceRecorder({
  extractTargets = DEFAULT_TARGETS,
  onComplete,
  className,
}: VoiceRecorderProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [events, setEvents] = useState<ProgressEntry[]>([]);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startedAtRef = useRef<number>(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopMediaTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const stopTimer = useCallback(() => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      stopTimer();
      stopMediaTracks();
    };
  }, [stopMediaTracks, stopTimer]);

  const reset = useCallback(() => {
    stopTimer();
    stopMediaTracks();
    chunksRef.current = [];
    recorderRef.current = null;
    startedAtRef.current = 0;
    setElapsedMs(0);
    setEvents([]);
    setError(null);
    setPhase("idle");
  }, [stopMediaTracks, stopTimer]);

  async function uploadCurrent() {
    stopMediaTracks();
    const chunks = chunksRef.current;
    if (chunks.length === 0) {
      setError("No audio was captured.");
      setPhase("error");
      return;
    }
    const type = chunks[0].type || "audio/webm";
    const blob = new Blob(chunks, { type });
    setPhase("uploading");

    try {
      const form = new FormData();
      form.append("audio", blob, "recording.webm");
      form.append("targets", extractTargets.join(","));

      const res = await fetch("/api/intake/voice", { method: "POST", body: form });
      if (!res.ok || !res.body) {
        const body = await res.text().catch(() => "");
        throw new Error(body || `request failed (${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      // Read SSE frames. Frames are terminated by `\n\n`; payload lines start
      // with `data: `. We tolerate split chunks by buffering between reads.
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx = buffer.indexOf("\n\n");
        while (idx !== -1) {
          const frame = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 2);
          const dataLine = frame.split("\n").find((l) => l.startsWith("data: "));
          if (dataLine) {
            try {
              const parsed = JSON.parse(dataLine.slice(6)) as ProgressEntry & {
                error?: string;
              };
              if (parsed.stage === "error") {
                setError(parsed.error || parsed.message || "voice intake failed");
              }
              setEvents((prev) => [...prev, parsed]);
            } catch {
              // ignore malformed frames
            }
          }
          idx = buffer.indexOf("\n\n");
        }
      }
      setPhase("done");
      // Read back what was extracted. Honors the global mute flag in lib/sounds.
      // The setter callback gives us the latest events list — earlier setEvents
      // calls inside the SSE loop may not have flushed to closure scope yet.
      setEvents((prev) => {
        const line = readbackFor(prev);
        if (line) void speak(line);
        return prev;
      });
      onComplete?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "upload failed";
      setError(msg);
      setPhase("error");
    }
  }

  const start = useCallback(async () => {
    setError(null);
    setEvents([]);
    setElapsedMs(0);
    if (typeof window === "undefined" || !navigator?.mediaDevices?.getUserMedia) {
      setError("Microphone access isn't available in this browser.");
      setPhase("error");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime = pickSupportedMime();
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        void uploadCurrent();
      };
      recorder.start();
      startedAtRef.current = Date.now();
      tickRef.current = setInterval(() => {
        setElapsedMs(Date.now() - startedAtRef.current);
      }, 200);
      setPhase("recording");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not start recorder";
      setError(msg);
      setPhase("error");
      stopMediaTracks();
    }
    // uploadCurrent is intentionally a local function so MediaRecorder.onstop
    // can call the current render's extractor targets and completion handler.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopMediaTracks]);

  const stop = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    stopTimer();
  }, [stopTimer]);

  const isBusy = phase === "recording" || phase === "uploading";

  return (
    <div
      className={cx(
        "rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-card-bg)] p-4 text-[var(--color-fg)]",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        {phase === "recording" ? (
          <ActionButton variant="dangerStrong" size="md" onClick={stop} aria-label="Stop recording">
            <Square className="h-3.5 w-3.5" /> Stop
          </ActionButton>
        ) : (
          <ActionButton
            variant="primary"
            size="md"
            onClick={() => void start()}
            disabled={phase === "uploading"}
            aria-label="Start recording"
          >
            <Mic className="h-3.5 w-3.5" />
            {phase === "done" ? "Re-record" : "Record"}
          </ActionButton>
        )}

        <div className="flex-1 text-sm">
          <div className="font-semibold">
            {phase === "idle" && "Tell us about yourself"}
            {phase === "recording" && (
              <span className="inline-flex items-center gap-2">
                <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--color-danger)]" />
                Recording — {formatTime(elapsedMs)}
              </span>
            )}
            {phase === "uploading" && "Transcribing & extracting…"}
            {phase === "done" && "Voice intake complete"}
            {phase === "error" && "Something went wrong"}
          </div>
          <div className="text-xs text-[var(--color-fg-muted)]">
            Speak for 30–90 seconds. Mention your role, recent experience, and what you&apos;re looking for next.
          </div>
        </div>

        {(phase === "done" || phase === "error") && (
          <ActionButton variant="ghost" size="icon" onClick={reset} aria-label="Reset recorder">
            <Trash2 className="h-3.5 w-3.5" />
          </ActionButton>
        )}
      </div>

      {error && (
        <div className="mt-3 rounded-xl border border-[var(--color-danger-border)] bg-[var(--color-danger-soft)] px-3 py-2 text-xs text-[var(--color-danger)]">
          {error}
        </div>
      )}

      {events.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs text-[var(--color-fg-muted)]">
          {events.map((evt, i) => (
            <li key={i} className="flex gap-2">
              <span className="font-mono text-[10px] uppercase tracking-wide text-[var(--color-fg-subtle)]">
                {evt.stage}
              </span>
              <span className={cx(evt.level === "error" && "text-[var(--color-danger)]")}>
                {evt.message ?? ""}
              </span>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-3 text-[10px] uppercase tracking-[0.12em] text-[var(--color-fg-subtle)]">
        Audio is sent to ElevenLabs Scribe for transcription and discarded. Only the transcript is kept.
      </p>

      {/* Disable the button when busy to avoid double-fires. */}
      {isBusy && <span className="sr-only">Working…</span>}
    </div>
  );
}

function formatTime(ms: number): string {
  const total = Math.floor(ms / 1000);
  const mm = Math.floor(total / 60).toString().padStart(2, "0");
  const ss = (total % 60).toString().padStart(2, "0");
  return `${mm}:${ss}`;
}

function pickSupportedMime(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
  ];
  for (const c of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(c)) return c;
    } catch {
      // older browsers throw; just move on.
    }
  }
  return null;
}
