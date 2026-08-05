/** Log-scale helpers for market-position histogram (resists high outliers). */

const BIN_COUNT = 12;

export function logScore(score: number): number {
  return Math.log10(Math.max(1, score));
}

export function buildLogHistogramBins(scores: number[], minScore: number, maxScore: number, binCount = BIN_COUNT): number[] {
  const bins = Array.from({ length: binCount }, () => 0);
  const lo = logScore(minScore);
  const hi = logScore(maxScore);
  if (hi <= lo) {
    bins[0] = scores.length;
    return bins;
  }
  const span = hi - lo;
  for (const score of scores) {
    const t = (logScore(score) - lo) / span;
    const index = Math.min(binCount - 1, Math.max(0, Math.floor(t * binCount)));
    bins[index] += 1;
  }
  return bins;
}

export function logHistogramMarkerPercent(score: number, minScore: number, maxScore: number): number {
  const lo = logScore(minScore);
  const hi = logScore(maxScore);
  if (hi <= lo) return 50;
  const t = (logScore(score) - lo) / (hi - lo);
  return Math.min(97, Math.max(3, t * 100));
}

export function formatAxisMan(scoreYen: number): string {
  const man = Math.max(0, scoreYen / 10_000);
  if (man >= 10_000) return `${Math.round(man / 10_000)}億`;
  if (man >= 100) return `${Math.round(man / 100) / 10}億`;
  return `${Math.round(man)}万`;
}
