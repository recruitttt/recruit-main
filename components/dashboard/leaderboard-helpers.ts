export type LeaderboardRecommendationInput = {
  jobId?: string | null;
  rank?: number | null;
  score?: number | null;
};

export type NormalizedLeaderboardRecommendation<T extends LeaderboardRecommendationInput> =
  Omit<T, "jobId" | "rank" | "score"> & {
    jobId: string;
    rank: number;
    score: number;
    trueRank: number;
    sourceRank: number | null;
    originalIndex: number;
  };

export type LeaderboardSelectionResult<T extends { jobId: string }> = {
  selected: T | null;
  selectedJobId: string | null;
};

export type LeaderboardVisualOrder<T extends { jobId: string }> = {
  shuffled: T[];
  settled: T[];
};

export function normalizeLeaderboardRecommendations<T extends LeaderboardRecommendationInput>(
  recommendations: readonly T[],
): Array<NormalizedLeaderboardRecommendation<T>> {
  const deduped = new Map<string, { item: T; originalIndex: number }>();

  recommendations.forEach((recommendation, originalIndex) => {
    const jobId = normalizeJobId(recommendation.jobId);
    if (!jobId) return;

    const current = deduped.get(jobId);
    if (!current || compareCandidates(recommendation, originalIndex, current.item, current.originalIndex) < 0) {
      deduped.set(jobId, { item: recommendation, originalIndex });
    }
  });

  return [...deduped.values()]
    .sort((left, right) => compareCandidates(left.item, left.originalIndex, right.item, right.originalIndex))
    .map(({ item, originalIndex }, index) => ({
      ...item,
      jobId: normalizeJobId(item.jobId)!,
      rank: normalizeRank(item.rank, index),
      score: normalizeScore(item.score),
      trueRank: index + 1,
      sourceRank: typeof item.rank === "number" && Number.isFinite(item.rank) ? item.rank : null,
      originalIndex,
    }));
}

export function preserveLeaderboardSelection<T extends { jobId: string }>(
  recommendations: readonly T[],
  previousSelectedJobId?: string | null,
  options: { fallbackToFirst?: boolean } = {},
): LeaderboardSelectionResult<T> {
  const normalizedSelectedJobId = normalizeJobId(previousSelectedJobId);
  const selected = normalizedSelectedJobId
    ? recommendations.find((recommendation) => recommendation.jobId === normalizedSelectedJobId) ?? null
    : null;

  if (selected) {
    return { selected, selectedJobId: selected.jobId };
  }

  if (options.fallbackToFirst === false) {
    return { selected: null, selectedJobId: null };
  }

  const fallback = recommendations[0] ?? null;
  return { selected: fallback, selectedJobId: fallback?.jobId ?? null };
}

export function shouldTriggerCosmeticShuffle<T extends { jobId: string }>(
  previous: readonly T[],
  next: readonly T[],
): boolean {
  if (previous.length < 2 || next.length < 2) return false;
  if (previous.length !== next.length) return true;

  for (let index = 0; index < previous.length; index += 1) {
    if (previous[index]?.jobId !== next[index]?.jobId) {
      return true;
    }
  }

  return false;
}

export function buildLeaderboardVisualOrder<T extends { jobId: string }>(
  recommendations: readonly T[],
  options: { seed?: number | string; pinnedJobId?: string | null } = {},
): LeaderboardVisualOrder<T> {
  const settled = [...recommendations];
  if (settled.length < 2) {
    return { shuffled: settled, settled };
  }

  const pinnedJobId = normalizeJobId(options.pinnedJobId);
  const movable: Array<{ item: T; settledIndex: number }> = [];
  let pinnedIndex: number | null = null;
  let pinnedItem: T | null = null;

  settled.forEach((item, settledIndex) => {
    if (pinnedJobId && item.jobId === pinnedJobId && pinnedItem === null) {
      pinnedIndex = settledIndex;
      pinnedItem = item;
      return;
    }
    movable.push({ item, settledIndex });
  });

  if (movable.length < 2) {
    return { shuffled: settled, settled };
  }

  const shuffledMovable = [...movable];
  const random = createSeededRandom(options.seed ?? settled.map((item) => item.jobId).join("|"));

  for (let index = shuffledMovable.length - 1; index > 0; index -= 1) {
    const nextIndex = Math.floor(random() * (index + 1));
    [shuffledMovable[index], shuffledMovable[nextIndex]] = [shuffledMovable[nextIndex], shuffledMovable[index]];
  }

  if (matchesSettledOrder(shuffledMovable, movable)) {
    const first = shuffledMovable[0]!;
    shuffledMovable[0] = shuffledMovable[1]!;
    shuffledMovable[1] = first;
  }

  const shuffled = new Array<T>(settled.length);
  let movableIndex = 0;

  for (let settledIndex = 0; settledIndex < settled.length; settledIndex += 1) {
    if (pinnedIndex === settledIndex && pinnedItem) {
      shuffled[settledIndex] = pinnedItem;
      continue;
    }

    shuffled[settledIndex] = shuffledMovable[movableIndex]!.item;
    movableIndex += 1;
  }

  return { shuffled, settled };
}

function compareCandidates<T extends LeaderboardRecommendationInput>(
  left: T,
  leftIndex: number,
  right: T,
  rightIndex: number,
): number {
  const leftRank = sortableRank(left.rank, leftIndex);
  const rightRank = sortableRank(right.rank, rightIndex);
  if (leftRank !== rightRank) return leftRank - rightRank;

  const leftScore = normalizeScore(left.score);
  const rightScore = normalizeScore(right.score);
  if (leftScore !== rightScore) return rightScore - leftScore;

  return leftIndex - rightIndex;
}

function sortableRank(rank: number | null | undefined, fallbackIndex: number): number {
  return typeof rank === "number" && Number.isFinite(rank) ? rank : Number.MAX_SAFE_INTEGER - 1000 + fallbackIndex;
}

function normalizeRank(rank: number | null | undefined, fallbackIndex: number): number {
  return typeof rank === "number" && Number.isFinite(rank) ? rank : fallbackIndex + 1;
}

function normalizeScore(score: number | null | undefined): number {
  return typeof score === "number" && Number.isFinite(score) ? score : 0;
}

function normalizeJobId(jobId: string | null | undefined): string | null {
  if (typeof jobId !== "string") return null;
  const value = jobId.trim();
  return value ? value : null;
}

function matchesSettledOrder<T extends { item: { jobId: string } }>(
  left: readonly T[],
  right: readonly T[],
): boolean {
  return left.every((entry, index) => entry.item.jobId === right[index]?.item.jobId);
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
