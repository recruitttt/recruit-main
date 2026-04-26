"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import type { LeaderboardRow } from "./dashboard-types";

type RankedListItem = Pick<LeaderboardRow, "jobId" | "rank">;

export type RankedListMotionPhase = "settled" | "pre-rank";

export type RankedListMotionOptions<T extends RankedListItem> = {
  enabled?: boolean;
  preRankRows?: readonly T[];
  settleDelayMs?: number;
  seed?: number | string;
  getKey?: (item: T) => string;
};

export type RankedListMotionResult<T extends RankedListItem> = {
  displayRows: T[];
  phase: RankedListMotionPhase;
  isSettling: boolean;
};

const DEFAULT_SETTLE_DELAY_MS = 650;

type MotionState = {
  phase: RankedListMotionPhase;
  signature: string | null;
};

export function useRankedListMotion<T extends RankedListItem>(
  rows: readonly T[],
  options: RankedListMotionOptions<T> = {},
): RankedListMotionResult<T> {
  const {
    enabled = true,
    preRankRows: explicitPreRankRows,
    settleDelayMs = DEFAULT_SETTLE_DELAY_MS,
    seed,
    getKey = getDefaultKey,
  } = options;
  const reduceMotion = useReducedMotion();
  const [motionState, setMotionState] = useState<MotionState>({
    phase: "settled",
    signature: null,
  });
  const previousSignatureRef = useRef<string | null>(null);

  const signature = useMemo(
    () => rows.map((row) => `${getKey(row)}:${row.rank}`).join("|"),
    [getKey, rows],
  );

  const preRankRows = useMemo(
    () => explicitPreRankRows
      ? alignPreRankRows(rows, explicitPreRankRows, getKey)
      : buildPreRankOrder(rows, { seed, getKey }),
    [explicitPreRankRows, getKey, rows, seed],
  );

  const hasPreRankDifference = useMemo(
    () => preRankRows.some((row, index) => getKey(row) !== getKey(rows[index]!)),
    [getKey, preRankRows, rows],
  );

  useEffect(() => {
    const canAnimate =
      enabled &&
      reduceMotion === false &&
      rows.length > 1 &&
      hasPreRankDifference;

    if (!canAnimate) {
      return undefined;
    }

    const previousSignature = previousSignatureRef.current;
    if (previousSignature === signature) {
      return undefined;
    }
    previousSignatureRef.current = signature;

    setMotionState({ phase: "pre-rank", signature });
    const settleTimer = window.setTimeout(() => {
      setMotionState({ phase: "settled", signature });
    }, Math.max(0, settleDelayMs));

    return () => {
      window.clearTimeout(settleTimer);
    };
  }, [enabled, hasPreRankDifference, reduceMotion, rows.length, settleDelayMs, signature]);

  const phase =
    enabled && reduceMotion === false && motionState.signature === signature
      ? motionState.phase
      : "settled";
  const displayRows = phase === "pre-rank" ? preRankRows : rows;

  return {
    displayRows: displayRows as T[],
    phase,
    isSettling: phase === "pre-rank",
  };
}

export function buildPreRankOrder<T extends RankedListItem>(
  rows: readonly T[],
  options: Pick<RankedListMotionOptions<T>, "seed" | "getKey"> = {},
): T[] {
  const getKey = options.getKey ?? getDefaultKey;
  const ordered = [...rows];

  if (ordered.length < 2) {
    return ordered;
  }

  const random = createSeededRandom(
    options.seed ?? ordered.map((row) => `${getKey(row)}:${row.rank}`).join("|"),
  );

  for (let index = ordered.length - 1; index > 0; index -= 1) {
    const nextIndex = Math.floor(random() * (index + 1));
    [ordered[index], ordered[nextIndex]] = [ordered[nextIndex]!, ordered[index]!];
  }

  if (ordered.every((row, index) => getKey(row) === getKey(rows[index]!))) {
    [ordered[0], ordered[1]] = [ordered[1]!, ordered[0]!];
  }

  return ordered;
}

function alignPreRankRows<T extends RankedListItem>(
  finalRows: readonly T[],
  preRankRows: readonly T[],
  getKey: (item: T) => string,
): T[] {
  const finalByKey = new Map(finalRows.map((row) => [getKey(row), row]));
  const ordered: T[] = [];

  for (const row of preRankRows) {
    const finalRow = finalByKey.get(getKey(row));
    if (!finalRow) continue;
    ordered.push(finalRow);
    finalByKey.delete(getKey(row));
  }

  return [...ordered, ...finalByKey.values()];
}

function getDefaultKey<T extends RankedListItem>(item: T): string {
  return item.jobId;
}

function createSeededRandom(seed: number | string): () => number {
  let state = hashSeed(seed) || 0x9e3779b9;

  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let next = Math.imul(state ^ (state >>> 15), 1 | state);
    next ^= next + Math.imul(next ^ (next >>> 7), 61 | next);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(seed: number | string): number {
  const value = String(seed);
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(31, hash) + value.charCodeAt(index);
    hash |= 0;
  }

  return hash;
}
