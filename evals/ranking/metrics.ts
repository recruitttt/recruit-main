// Information-retrieval metrics for ranking eval. Pure functions, no I/O.
// Labels map to graded relevance (great=3, good=2, meh=1, bad=0). All metrics
// take a list already ordered by the ranker; rank=1 is the top hit.

export type LabelLevel = "great" | "good" | "meh" | "bad";

export const LABEL_RELEVANCE: Record<LabelLevel, number> = {
  great: 3,
  good: 2,
  meh: 1,
  bad: 0,
};

export type RankedItem = {
  id: string;
  rank: number;
  label: LabelLevel;
};

export function ndcgAtK(items: RankedItem[], k: number): number {
  if (items.length === 0 || k <= 0) return 0;
  const sorted = [...items].sort((a, b) => a.rank - b.rank).slice(0, k);
  const dcg = sorted.reduce((acc, item, idx) => {
    const gain = LABEL_RELEVANCE[item.label];
    return acc + gain / Math.log2(idx + 2);
  }, 0);

  const idealOrder = [...items]
    .map((item) => LABEL_RELEVANCE[item.label])
    .sort((a, b) => b - a)
    .slice(0, k);
  const idcg = idealOrder.reduce((acc, gain, idx) => {
    return acc + gain / Math.log2(idx + 2);
  }, 0);

  if (idcg === 0) return 0;
  return dcg / idcg;
}

export function precisionAtK(
  items: RankedItem[],
  k: number,
  threshold: LabelLevel = "good"
): number {
  if (items.length === 0 || k <= 0) return 0;
  const minRel = LABEL_RELEVANCE[threshold];
  const topK = [...items].sort((a, b) => a.rank - b.rank).slice(0, k);
  const hits = topK.filter((item) => LABEL_RELEVANCE[item.label] >= minRel).length;
  return hits / Math.min(k, items.length);
}

export function meanReciprocalRank(
  items: RankedItem[],
  threshold: LabelLevel = "good"
): number {
  if (items.length === 0) return 0;
  const minRel = LABEL_RELEVANCE[threshold];
  const sorted = [...items].sort((a, b) => a.rank - b.rank);
  for (const item of sorted) {
    if (LABEL_RELEVANCE[item.label] >= minRel) {
      return 1 / item.rank;
    }
  }
  return 0;
}
