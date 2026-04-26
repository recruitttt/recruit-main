"use client";

// TODO(unit-6): real implementations live in Unit 6. The pieces in this file
// are stubs so that Unit 7 (job conveyors + craft animations + calendar pins)
// can land in parallel. Once Unit 6 merges, this file is replaced with:
//   - a hook that diffs successive `LiveRoom` snapshots and emits one-shot
//     events (~50 buffer, 30s self-cleanup),
//   - a `useLiveRoom` augmented with `tailoring`, `followUps`, etc.

import { useLiveRoom } from "./use-live-room";

export type ScoreTier = "gold" | "silver" | "bronze";

export type PipelineEvent =
  | { kind: "job-fetched"; source: string; at: number }
  | {
      kind: "score-stamped";
      company: string;
      score: number;
      tier: ScoreTier;
      at: number;
    }
  | { kind: "tailoring-complete"; company: string; at: number }
  | { kind: "submission-confirmed"; company: string; at: number }
  | { kind: "interview-booked"; company: string; date: string; at: number };

export type PipelineEventKind = PipelineEvent["kind"];

/**
 * Subscribe to pipeline events, optionally filtered by kind.
 *
 * Stub returns an empty array. Real impl will track recent events
 * (50-event buffer, 30s self-cleanup) and re-render subscribers when matching
 * events arrive.
 */
export function usePipelineEvents(
  _kinds?: readonly PipelineEventKind[],
): readonly PipelineEvent[] {
  return EMPTY_EVENTS;
}

const EMPTY_EVENTS: readonly PipelineEvent[] = Object.freeze([]);

export type TailoringSnapshot = {
  inProgress: boolean;
  completed: number;
  target: number;
};

export type FollowUpsSnapshot = {
  interviewCount: number;
};

export type ExtendedLiveRoom = {
  tailoring: TailoringSnapshot;
  followUps: FollowUpsSnapshot;
};

/**
 * Stubbed augmentation of `useLiveRoom`.
 *
 * Real Unit 6 will combine `/api/dashboard/live` with direct Convex queries
 * (`api.followups.followUpSummary`, etc.) to yield real counts. For now we
 * derive only the busy bit so the craft animation can play, and report zero
 * interviews so the calendar stays pristine.
 */
export function useExtendedLiveRoom(): ExtendedLiveRoom {
  const live = useLiveRoom();
  return {
    tailoring: {
      inProgress: live.isBusy,
      completed: 0,
      target: 0,
    },
    followUps: {
      interviewCount: 0,
    },
  };
}
