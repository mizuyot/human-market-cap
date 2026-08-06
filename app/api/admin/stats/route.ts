import { getD1 } from "../../../../db";
import { getTier } from "../../../model";
import { errorResponse, json, requireAdminToken } from "../../../server/http";

const DUMMY_PREFIX = "dummy-jp-%";

async function eventCount(db: D1Database, name: string, since: number): Promise<number> {
  const row = await db.prepare(`
    SELECT COUNT(*) AS c FROM hmc_analytics_events
    WHERE name = ?1 AND created_at >= ?2
  `).bind(name, since).first<{ c: number }>();
  return Number(row?.c ?? 0);
}

async function uniqueSessions(db: D1Database, name: string, since: number): Promise<number> {
  const row = await db.prepare(`
    SELECT COUNT(DISTINCT session_id) AS c FROM hmc_analytics_events
    WHERE name = ?1 AND created_at >= ?2
  `).bind(name, since).first<{ c: number }>();
  return Number(row?.c ?? 0);
}

function rate(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

export async function GET(request: Request) {
  try {
    await requireAdminToken(request);
    const db = await getD1();
    const since7d = Date.now() - 7 * 24 * 60 * 60 * 1000;

    const counts = await db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM hmc_score_history) AS history_count,
        (SELECT COUNT(*) FROM hmc_scores) AS ranking_count,
        (SELECT COUNT(*) FROM hmc_scores WHERE uid LIKE ?1) AS dummy_ranking_count,
        (SELECT COUNT(*) FROM hmc_score_history WHERE uid LIKE ?1) AS dummy_history_count
    `).bind(DUMMY_PREFIX).first<{
      history_count: number;
      ranking_count: number;
      dummy_ranking_count: number;
      dummy_history_count: number;
    }>();

    const scoreRows = await db.prepare(`
      SELECT score FROM hmc_score_history ORDER BY score ASC
    `).all<{ score: number }>();
    const scores = (scoreRows.results ?? []).map((row) => Number(row.score));
    const manScores = scores.map((score) => score / 10_000);

    let avg = 0;
    let median = 0;
    let min = 0;
    let max = 0;
    if (manScores.length > 0) {
      avg = manScores.reduce((sum, value) => sum + value, 0) / manScores.length;
      const mid = Math.floor(manScores.length / 2);
      median = manScores.length % 2 === 0
        ? (manScores[mid - 1] + manScores[mid]) / 2
        : manScores[mid];
      min = manScores[0];
      max = manScores[manScores.length - 1];
    }

    const tierCounts: Record<"S" | "A" | "B" | "C" | "D", number> = {
      S: 0, A: 0, B: 0, C: 0, D: 0,
    };
    for (const man of manScores) {
      tierCounts[getTier(man)] += 1;
    }

    const quizRows = await db.prepare(`
      SELECT quiz_correct AS correct, COUNT(*) AS count
      FROM hmc_score_history
      GROUP BY quiz_correct
      ORDER BY quiz_correct ASC
    `).all<{ correct: number; count: number }>();
    const quizDistribution = [0, 1, 2, 3, 4, 5].map((correct) => {
      const found = (quizRows.results ?? []).find((row) => Number(row.correct) === correct);
      return { correct, count: Number(found?.count ?? 0) };
    });

    let funnel = {
      windowDays: 7,
      pageViews: 0,
      challengeVisits: 0,
      quizStarts: 0,
      valuations: 0,
      shareClicks: 0,
      shareSuccesses: 0,
      apiErrors: 0,
      uniqueVisitors: 0,
      quizStartRate: null as number | null,
      valuationRate: null as number | null,
      shareClickRate: null as number | null,
      challengeConversionRate: null as number | null,
    };

    try {
      const [
        pageViews,
        challengeVisits,
        quizStarts,
        valuations,
        shareClicks,
        shareSuccesses,
        apiErrors,
        uniqueVisitors,
      ] = await Promise.all([
        eventCount(db, "page_view", since7d),
        eventCount(db, "challenge_visit", since7d),
        eventCount(db, "quiz_start", since7d),
        eventCount(db, "valuation_complete", since7d),
        eventCount(db, "share_click", since7d),
        eventCount(db, "share_success", since7d),
        eventCount(db, "api_error", since7d),
        uniqueSessions(db, "page_view", since7d),
      ]);
      const visits = pageViews + challengeVisits;
      funnel = {
        windowDays: 7,
        pageViews,
        challengeVisits,
        quizStarts,
        valuations,
        shareClicks,
        shareSuccesses,
        apiErrors,
        uniqueVisitors,
        quizStartRate: rate(quizStarts, visits),
        valuationRate: rate(valuations, quizStarts),
        shareClickRate: rate(shareClicks, valuations),
        challengeConversionRate: rate(valuations, challengeVisits),
      };
    } catch {
      // Analytics table may be missing before migration; keep defaults.
    }

    return json({
      historyCount: Number(counts?.history_count ?? 0),
      rankingCount: Number(counts?.ranking_count ?? 0),
      dummyRankingCount: Number(counts?.dummy_ranking_count ?? 0),
      dummyHistoryCount: Number(counts?.dummy_history_count ?? 0),
      score: {
        avgMan: Math.round(avg),
        medianMan: Math.round(median),
        minMan: Math.round(min),
        maxMan: Math.round(max),
      },
      tierCounts,
      quizDistribution,
      funnel,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
