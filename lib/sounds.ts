/**
 * Tiny synth-tone SFX for the onboarding chat.
 * No audio files — everything is generated with Web Audio API.
 *
 * Usage:
 *   import { playSend, playReceive, setMuted, isMuted } from "@/lib/sounds";
 *
 * Calls are safe on the server (no-op) and before the user gestures.
 * Browsers may require a user interaction before AudioContext can resume.
 */

const MUTE_KEY = "recruit:muted";

let _ctx: AudioContext | null = null;
let _master: GainNode | null = null;
let _muted = false;
let _hydrated = false;

function ensureContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!_ctx) {
    type CtxCtor = typeof AudioContext;
    const Ctor: CtxCtor | undefined =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: CtxCtor }).webkitAudioContext;
    if (!Ctor) return null;
    _ctx = new Ctor();
    _master = _ctx.createGain();
    _master.gain.value = 0.5;
    _master.connect(_ctx.destination);
  }
  if (_ctx.state === "suspended") {
    // fire-and-forget — will resolve after a user gesture
    _ctx.resume().catch(() => {});
  }
  return _ctx;
}

function hydrate() {
  if (_hydrated || typeof window === "undefined") return;
  _hydrated = true;
  try {
    _muted = localStorage.getItem(MUTE_KEY) === "1";
  } catch {}
}

export function isMuted(): boolean {
  hydrate();
  return _muted;
}

export function setMuted(muted: boolean) {
  _muted = muted;
  try {
    localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  } catch {}
}

/** Short crisp pluck — user sends a message. */
export function playSend() {
  hydrate();
  if (_muted) return;
  const ctx = ensureContext();
  if (!ctx || !_master) return;
  const t = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(880, t);
  osc.frequency.exponentialRampToValueAtTime(1380, t + 0.06);

  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(0.18, t + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);

  osc.connect(gain).connect(_master);
  osc.start(t);
  osc.stop(t + 0.15);
}

/** Soft ping — agent finishes a message. */
export function playReceive() {
  hydrate();
  if (_muted) return;
  const ctx = ensureContext();
  if (!ctx || !_master) return;
  const t = ctx.currentTime;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(520, t);
  osc.frequency.linearRampToValueAtTime(480, t + 0.25);

  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(0.12, t + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);

  osc.connect(gain).connect(_master);
  osc.start(t);
  osc.stop(t + 0.35);
}

/** Low-tone arp for the "agent woke up" moment. */
export function playWake() {
  hydrate();
  if (_muted) return;
  const ctx = ensureContext();
  if (!ctx || !_master) return;
  const t = ctx.currentTime;
  const freqs = [440, 660];
  freqs.forEach((f, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(f, t + i * 0.07);
    gain.gain.setValueAtTime(0, t + i * 0.07);
    gain.gain.linearRampToValueAtTime(0.08, t + i * 0.07 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.07 + 0.22);
    osc.connect(gain).connect(_master!);
    osc.start(t + i * 0.07);
    osc.stop(t + i * 0.07 + 0.25);
  });
}

/** Warm chord for the final activation moment. */
export function playActivate() {
  hydrate();
  if (_muted) return;
  const ctx = ensureContext();
  if (!ctx || !_master) return;
  const t = ctx.currentTime;
  const freqs = [330, 440, 660];
  freqs.forEach((f) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(f, t);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.07, t + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    osc.connect(gain).connect(_master!);
    osc.start(t);
    osc.stop(t + 0.95);
  });
}
