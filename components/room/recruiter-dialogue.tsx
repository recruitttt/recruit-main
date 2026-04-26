"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAction, useQuery } from "convex/react";
import { Loader2, Mic, MicOff, Send, Sparkles, Volume2, X } from "lucide-react";
import { convexRefs } from "@/lib/convex-refs";
import { pickRecruiterVoiceId } from "@/lib/recruiter/appearance";
import { speak, cancelSpeech } from "@/lib/speech";
import { isMuted } from "@/lib/sounds";
import { useRoomStore } from "./room-store";

type Props = {
  userId: string | null;
};

type Message = { role: string; content: string; timestamp?: string };

type RecruiterRow = {
  _id: string;
  recruiterName: string;
  companyName: string;
  appearanceSeed: number;
  status?: "active" | "applied" | "departed";
};

export function RecruiterDialogue({ userId }: Props) {
  const activeRecruiterId = useRoomStore((s) => s.activeRecruiterId);
  const setActiveRecruiterId = useRoomStore((s) => s.setActiveRecruiterId);
  const setTerminalActive = useRoomStore((s) => s.setTerminalActive);
  const recruiter = useQuery(
    convexRefs.recruiters.getById,
    activeRecruiterId ? { recruiterId: activeRecruiterId as never } : "skip",
  ) as RecruiterRow | null | undefined;
  const conversation = useQuery(
    convexRefs.recruiters.getConversation,
    activeRecruiterId ? { recruiterId: activeRecruiterId as never } : "skip",
  ) as { messages: Message[] } | null | undefined;
  const sendMessage = useAction(convexRefs.recruiterActions.sendMessage);
  const applyThroughRecruiter = useAction(convexRefs.recruiterActions.applyThroughRecruiter);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [applying, setApplying] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastSpokenRef = useRef<string>("");
  const prevMessageCountRef = useRef(0);

  const voiceId = recruiter ? pickRecruiterVoiceId(recruiter.appearanceSeed) : undefined;
  const messages = conversation?.messages ?? [];

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  useEffect(() => {
    if (!recruiter || !voiceId) return;
    const prev = prevMessageCountRef.current;
    prevMessageCountRef.current = messages.length;
    if (messages.length <= prev) return;
    const latest = messages[messages.length - 1];
    if (!latest || latest.role !== "assistant") return;
    if (lastSpokenRef.current === latest.content) return;
    if (isMuted()) return;
    lastSpokenRef.current = latest.content;
    setSpeaking(true);
    speak(latest.content, { voiceId }).finally(() => setSpeaking(false));
  }, [messages, messages.length, recruiter, voiceId]);

  useEffect(() => {
    return () => cancelSpeech();
  }, [activeRecruiterId]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        if (blob.size < 100) return;
        setTranscribing(true);
        try {
          const form = new FormData();
          form.append("file", blob, "voice.webm");
          const res = await fetch("/api/transcribe", { method: "POST", body: form });
          const json = await res.json();
          if (json.text?.trim()) setDraft((prev) => (prev ? prev + " " : "") + json.text.trim());
        } finally {
          setTranscribing(false);
        }
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      // mic permission denied
    }
  }, []);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    setRecording(false);
  }, []);

  if (!activeRecruiterId || !recruiter) return null;

  const firstName = recruiter.recruiterName.split(" ")[0];

  async function handleSend() {
    if (!draft.trim() || !userId || !activeRecruiterId) return;
    cancelSpeech();
    setSending(true);
    try {
      await sendMessage({ recruiterId: activeRecruiterId as never, userId, userMessage: draft });
      setDraft("");
    } finally {
      setSending(false);
    }
  }

  async function handleApply() {
    if (!userId || !activeRecruiterId) return;
    cancelSpeech();
    setApplying(true);
    try {
      await applyThroughRecruiter({ recruiterId: activeRecruiterId as never, userId });
      setTerminalActive(true);
      setActiveRecruiterId(null);
    } finally {
      setApplying(false);
    }
  }

  function handleClose() {
    cancelSpeech();
    setActiveRecruiterId(null);
  }

  return (
    <div className="pointer-events-auto absolute right-6 top-6 z-30 w-96 max-h-[70vh] flex flex-col rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-panel-bg)] shadow-[var(--theme-panel-shadow)] backdrop-blur-2xl">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--glass-border)]">
        <div className="flex items-center gap-3">
          <div>
            <div className="font-medium text-sm text-[var(--color-fg)]">{recruiter.recruiterName}</div>
            <div className="text-xs text-[var(--color-fg-subtle)]">{recruiter.companyName}</div>
          </div>
          {speaking && (
            <Volume2 className="h-3.5 w-3.5 animate-pulse text-[var(--color-accent)]" />
          )}
        </div>
        <button onClick={handleClose} className="text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)]">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-[120px] max-h-[45vh]">
        {messages.length === 0 && !sending && (
          <div className="py-6 text-center text-xs text-[var(--color-fg-subtle)]">
            Start a conversation with {firstName}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "text-right" : "text-left"}>
            <div
              className={
                "inline-block max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-relaxed " +
                (m.role === "user"
                  ? "bg-[var(--color-accent)] text-[var(--color-accent-contrast)] rounded-br-md"
                  : "bg-[var(--theme-compat-bg)] text-[var(--color-fg)] rounded-bl-md")
              }
            >
              {m.content}
            </div>
          </div>
        ))}
        {sending && (
          <div className="text-left">
            <div className="inline-flex items-center gap-1.5 px-3 py-2 rounded-2xl rounded-bl-md bg-[var(--theme-compat-bg)] text-[var(--color-fg-subtle)] text-sm">
              <Loader2 className="h-3 w-3 animate-spin" />
              {firstName} is thinking…
            </div>
          </div>
        )}
      </div>
      <div className="flex flex-col gap-2 p-3 border-t border-[var(--glass-border)]">
        <div className="flex items-center gap-2">
          <button
            onClick={recording ? stopRecording : startRecording}
            disabled={transcribing}
            className={
              "shrink-0 p-2 rounded-xl transition " +
              (recording
                ? "bg-[var(--color-danger)] text-white animate-pulse"
                : "bg-[var(--theme-compat-bg)] text-[var(--color-fg-subtle)] hover:text-[var(--color-fg)] hover:bg-[var(--glass-control-hover)]")
            }
            title={recording ? "Stop recording" : "Hold to speak"}
          >
            {transcribing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : recording ? (
              <MicOff className="h-4 w-4" />
            ) : (
              <Mic className="h-4 w-4" />
            )}
          </button>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder={`Ask ${firstName} about ${recruiter.companyName}…`}
            className="flex-1 px-3 py-2 text-sm rounded-xl border border-[var(--glass-border)] bg-[var(--theme-compat-bg-soft)] text-[var(--color-fg)] placeholder:text-[var(--color-fg-subtle)] focus:outline-none focus:border-[var(--color-accent)]"
            disabled={sending || transcribing}
          />
          <button
            onClick={handleSend}
            disabled={sending || !draft.trim() || transcribing}
            className="shrink-0 p-2 rounded-xl bg-[var(--color-accent)] text-[var(--color-accent-contrast)] disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
        <button
          onClick={handleApply}
          disabled={applying || recruiter.status === "applied"}
          className="flex items-center justify-center gap-1.5 w-full px-3 py-2 text-xs font-semibold rounded-xl bg-[var(--color-success)] text-white disabled:opacity-40 hover:brightness-110 transition"
        >
          <Sparkles className="h-3.5 w-3.5" />
          {recruiter.status === "applied" ? "Already applied" : applying ? "Routing to terminal…" : `Apply via ${firstName}`}
        </button>
      </div>
    </div>
  );
}
