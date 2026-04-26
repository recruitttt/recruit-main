// Client-side speak helper — plays /api/tts output via an HTMLAudioElement.
//
// Pairs with `lib/sounds.ts`: respects the same `isMuted()` flag so a single
// mute control silences both Web-Audio SFX and ElevenLabs TTS.
//
// One-at-a-time semantics: calling speak() while another utterance is
// playing cancels the previous one. Components that fire on mount don't have
// to coordinate — newest wins.

import { isMuted, subscribeMuted } from "./sounds";

// Cancel any in-flight TTS the moment the user mutes. Subscribing at module
// scope is safe — this file is client-only ("use client" via its consumers)
// and the listener set is a tiny Set of closures.
if (typeof window !== "undefined") {
  subscribeMuted((muted) => {
    if (muted) cancelSpeech();
  });
}

interface SpeakOptions {
  voiceId?: string;
  /** When true, ignore the global mute flag (e.g. a "preview voice" button). */
  force?: boolean;
}

let currentAudio: HTMLAudioElement | null = null;
let currentObjectUrl: string | null = null;
let currentAbort: AbortController | null = null;

function disposeCurrent() {
  try {
    currentAudio?.pause();
  } catch {
    // already detached / disposed
  }
  if (currentAudio) {
    currentAudio.src = "";
    currentAudio = null;
  }
  if (currentObjectUrl) {
    try {
      URL.revokeObjectURL(currentObjectUrl);
    } catch {
      // safari sometimes throws on already-revoked URLs; ignore.
    }
    currentObjectUrl = null;
  }
  currentAbort?.abort();
  currentAbort = null;
}

export function cancelSpeech(): void {
  disposeCurrent();
}

export async function speak(text: string, options: SpeakOptions = {}): Promise<void> {
  if (typeof window === "undefined") return;
  const trimmed = typeof text === "string" ? text.trim() : "";
  if (!trimmed) return;
  if (!options.force && isMuted()) return;

  // Cancel any in-flight playback before starting a new one.
  disposeCurrent();

  const controller = new AbortController();
  currentAbort = controller;

  let res: Response;
  try {
    res = await fetch("/api/tts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: trimmed, voiceId: options.voiceId }),
      signal: controller.signal,
    });
  } catch {
    // network error or aborted; silently fail — TTS is non-critical.
    return;
  }

  if (!res.ok || !res.body) return;

  let blob: Blob;
  try {
    blob = await res.blob();
  } catch {
    return;
  }

  // The user might have toggled mute while we were waiting for bytes.
  if (!options.force && isMuted()) return;
  // Or canceled by a later speak() call.
  if (controller.signal.aborted) return;

  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  currentAudio = audio;
  currentObjectUrl = url;

  // Resolve when playback ends (or errors out) so callers awaiting speak()
  // can chain — used by speakSequence() to play multiple voices in order.
  return new Promise<void>((resolve) => {
    const finish = () => {
      if (currentAudio === audio) disposeCurrent();
      resolve();
    };
    audio.addEventListener("ended", finish, { once: true });
    audio.addEventListener("error", finish, { once: true });
    audio.play().catch(() => {
      // Autoplay rejection — resolve immediately so chains continue.
      finish();
    });
  });
}

/**
 * Play a sequence of utterances back-to-back, each with its own voice.
 * Honors mute mid-sequence — if the user mutes while the chain is running
 * the rest is skipped.
 */
export async function speakSequence(
  items: ReadonlyArray<{ text: string; voiceId?: string }>,
): Promise<void> {
  for (const item of items) {
    if (isMuted()) return;
    await speak(item.text, { voiceId: item.voiceId });
  }
}
