"use client";

import { useEffect, useMemo, useRef, useSyncExternalStore } from "react";
import { useLiveRoom, type LiveRoom } from "@/lib/room/use-live-room";

/**
 * Tier of a recommendation, derived from its total score.
 */
export type ScoreTier = "gold" | "silver" | "bronze";

/**
 * One-shot event derived from diffing successive {@link LiveRoom} snapshots.
 *
 * Each event represents a discrete pipeline transition (a job was fetched,
 * a recommendation was scored, a tailored doc finished, etc.). Consumers
 * can subscribe via {@link usePipelineEvents} for visual side effects.
 */
export type PipelineEvent =
  | { kind: "job-fetched"; source?: string; at: number }
  | {
      kind: "score-stamped";
      company: string;
      score: number;
      tier: ScoreTier;
      at: number;
    }
  | { kind: "tailoring-complete"; company: string; at: number }
  | { kind: "submission-confirmed"; company: string; at: number }
  | { kind: "interview-booked"; company: string; at: number };

export type PipelineEventKind = PipelineEvent["kind"];

const MAX_BUFFERED_EVENTS = 50;
const EVENT_TTL_MS = 30_000;

type Listener = () => void;

type EventSnapshot = {
  events: PipelineEvent[];
};

const listeners = new Set<Listener>();
let snapshot: EventSnapshot = { events: [] };

// Single shared diff state. Multiple consumers all reference the same
// previous-snapshot, so events are computed once per LiveRoom transition
// regardless of how many components subscribe.
type DiffSnapshot = {
  fetchedCount: number;
  recommendedCount: number;
  tailoringCompleted: number;
  interviewCount: number;
  submissionAppliedCount: number;
};

let lastDiffSnapshot: DiffSnapshot | null = null;

function emitChange(): void {
  for (const listener of listeners) listener();
}

function pruneExpired(now: number, list: readonly PipelineEvent[]): PipelineEvent[] {
  const cutoff = now - EVENT_TTL_MS;
  return list.filter((event) => event.at >= cutoff);
}

function appendEvents(toAdd: readonly PipelineEvent[]): void {
  if (toAdd.length === 0) return;
  const now = Date.now();
  const merged = [...pruneExpired(now, snapshot.events), ...toAdd];
  const trimmed =
    merged.length > MAX_BUFFERED_EVENTS
      ? merged.slice(merged.length - MAX_BUFFERED_EVENTS)
      : merged;
  snapshot = { events: trimmed };
  emitChange();
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const SERVER_SNAPSHOT: EventSnapshot = { events: [] };

function getSnapshot(): EventSnapshot {
  return snapshot;
}

function getServerSnapshot(): EventSnapshot {
  return SERVER_SNAPSHOT;
}

/**
 * Test-only reset for the buffer and the shared diff cursor.
 */
export function __resetPipelineEvents(): void {
  snapshot = { events: [] };
  lastDiffSnapshot = null;
  emitChange();
}

function tierForScore(score: number): ScoreTier {
  if (score >= 90) return "gold";
  if (score >= 75) return "silver";
  return "bronze";
}

function snapshotFor(room: LiveRoom): DiffSnapshot {
  return {
    fetchedCount: room.ingestion.fetchedCount,
    recommendedCount: room.ingestion.recommendedCount,
    tailoringCompleted: room.tailoring.completed,
    interviewCount: room.followUps.interviewCount,
    submissionAppliedCount: room.followUps.appliedCount,
  };
}

function diffEvents(prev: DiffSnapshot, next: DiffSnapshot, room: LiveRoom, now: number): PipelineEvent[] {
  const out: PipelineEvent[] = [];
  const sortedJobs = [...room.tailoring.jobs].sort((a, b) => a.rank - b.rank);

  const fetchedDelta = next.fetchedCount - prev.fetchedCount;
  for (let i = 0; i < fetchedDelta; i += 1) {
    out.push({ kind: "job-fetched", at: now + i });
  }

  const recDelta = next.recommendedCount - prev.recommendedCount;
  if (recDelta > 0) {
    const startIdx = Math.max(0, sortedJobs.length - recDelta);
    for (let i = 0; i < recDelta; i += 1) {
      const job = sortedJobs[startIdx + i];
      const score = job?.matchScore ?? 0;
      out.push({
        kind: "score-stamped",
        company: job?.company ?? "Unknown",
        score,
        tier: tierForScore(score),
        at: now + i,
      });
    }
  }

  const tailoringDelta = next.tailoringCompleted - prev.tailoringCompleted;
  if (tailoringDelta > 0) {
    const newlyCompleted = sortedJobs.slice(prev.tailoringCompleted, next.tailoringCompleted);
    for (const job of newlyCompleted) {
      out.push({ kind: "tailoring-complete", company: job.company, at: now });
    }
  }

  const submissionDelta = next.submissionAppliedCount - prev.submissionAppliedCount;
  for (let i = 0; i < submissionDelta; i += 1) {
    const job = sortedJobs[i];
    out.push({
      kind: "submission-confirmed",
      company: job?.company ?? "Unknown",
      at: now + i,
    });
  }

  const interviewDelta = next.interviewCount - prev.interviewCount;
  for (let i = 0; i < interviewDelta; i += 1) {
    out.push({
      kind: "interview-booked",
      company: "—",
      at: now + i,
    });
  }

  return out;
}

/**
 * Track how many consumers are mounted; only the first one drives diffing
 * each tick so events are not emitted multiple times when several
 * components subscribe simultaneously.
 */
let activeConsumerCount = 0;

function useDiffPublisher(): void {
  const room = useLiveRoom();
  const isLeaderRef = useRef(false);

  useEffect(() => {
    activeConsumerCount += 1;
    if (activeConsumerCount === 1) {
      isLeaderRef.current = true;
    }
    return () => {
      activeConsumerCount = Math.max(0, activeConsumerCount - 1);
      if (isLeaderRef.current) {
        isLeaderRef.current = false;
        // The next consumer to mount will become the leader; reset the
        // diff cursor so it re-aligns on the next snapshot.
        lastDiffSnapshot = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!isLeaderRef.current) return;
    if (!room.hasData) return;
    const next = snapshotFor(room);
    const prev = lastDiffSnapshot;
    lastDiffSnapshot = next;
    if (!prev) return;
    const events = diffEvents(prev, next, room, Date.now());
    if (events.length > 0) appendEvents(events);
  }, [room]);
}

/**
 * Subscribe to pipeline events. Returns the buffered events (oldest first),
 * optionally narrowed by `filter`.
 *
 * Events older than 30s are pruned automatically as new events arrive.
 *
 * @param filter Restrict the returned events to a subset of kinds.
 */
export function usePipelineEvents(filter?: readonly PipelineEventKind[]): PipelineEvent[] {
  useDiffPublisher();
  const store = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return useMemo(() => {
    if (!filter || filter.length === 0) return store.events;
    const allowed = new Set(filter);
    return store.events.filter((event) => allowed.has(event.kind));
  }, [store, filter]);
}

/**
 * Imperatively push a custom event into the pipeline event stream. Used by
 * non-LiveRoom triggers (e.g., manual user actions) that the room store
 * wants to surface as visual cues. Events older than 30s are pruned.
 */
export function pushPipelineEvent(event: PipelineEvent): void {
  appendEvents([event]);
}
