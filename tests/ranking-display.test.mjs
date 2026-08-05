import test from "node:test";
import assert from "node:assert/strict";
import { buildLogHistogramBins, logHistogramMarkerPercent, logScore } from "../app/ranking-display.ts";

test("log histogram spreads clustered mid values away from a high outlier", () => {
  const scores = [
    1e8, 1.2e8, 1.5e8, 1.8e8, 2e8, 2.2e8, 2.5e8, 3e8,
    5e9, // outlier
  ];
  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);
  const logBins = buildLogHistogramBins(scores, minScore, maxScore);

  const linearBins = Array.from({ length: 12 }, () => 0);
  const span = maxScore - minScore;
  for (const score of scores) {
    linearBins[Math.min(11, Math.floor((score - minScore) / span * 12))] += 1;
  }

  const occupiedLog = logBins.filter((count) => count > 0).length;
  const occupiedLinear = linearBins.filter((count) => count > 0).length;
  assert.ok(occupiedLog > occupiedLinear, `expected log bins (${occupiedLog}) to use more columns than linear (${occupiedLinear})`);
  assert.equal(logBins.reduce((sum, count) => sum + count, 0), scores.length);
});

test("log marker sits near the high end for the top score", () => {
  const minScore = 1e8;
  const maxScore = 5e9;
  assert.ok(logHistogramMarkerPercent(maxScore, minScore, maxScore) > 90);
  assert.ok(logHistogramMarkerPercent(minScore, minScore, maxScore) < 10);
  assert.ok(logScore(1000) > logScore(100));
});
