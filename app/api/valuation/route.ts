import { buildLogHistogramBins } from "../../ranking-display";
import type {
  RankingSnapshot,
  ValuationRequest,
  ValuationResponse,
} from "../../api-types";
import {
  APPEARANCES,
  OCCUPATIONS,
  resolveEducationKey,
  type CalculatorInputs,
} from "../../model";
import { getD1 } from "../../../db";
import { calculateMarketCap } from "../../server/calculation";
import { ApiError, assertSameOrigin, enforceRateLimit, errorResponse, json, parseJson } from "../../server/http";
import { buildQuizReviews, getQuizSetsByIds, normalizeAnswers, scoreQuiz } from "../../server/quiz";

interface AttemptRow {
  question_ids: string;
  answers_json: string | null;
  correct_count: number | null;
  uid: string | null;
  expires_at: number;
  completed_at: number | null;
}

interface ScoreRow {
  id: string;
  uid: string;
  score: number;
}

/** Append-only history cap. */
const HISTORY_MAX_ROWS = 20_000;
const LEADERBOARD_MAX_ROWS = 1000;
const DUMMY_UID_PREFIX = "dummy-jp-%";

const isKey = <T extends readonly { key: string }[]>(items: T, key: unknown) =>
  typeof key === "string" && items.some((item) => item.key === key);

function boundedNumber(value: unknown, label: string, min: number, max: number): number {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || number > max) {
    throw new ApiError(400, `${label}の入力値を確認してください。`);
  }
  return number;
}

function validateInputs(raw: unknown): CalculatorInputs {
  if (!raw || typeof raw !== "object") throw new ApiError(400, "査定条件を確認してください。");
  const input = raw as Partial<CalculatorInputs>;
  const age = boundedNumber(input.age, "年齢", 18, 80);
  if (!Number.isInteger(age)) throw new ApiError(400, "年齢は整数で入力してください。");
  if (typeof input.education !== "string") throw new ApiError(400, "学歴を選択してください。");
  const education = resolveEducationKey(input.education);
  if (!education) throw new ApiError(400, "学歴を選択してください。");
  if (!isKey(APPEARANCES, input.appearance)) throw new ApiError(400, "容姿を選択してください。");
  if (!isKey(OCCUPATIONS, input.occupation)) throw new ApiError(400, "職業を選択してください。");
  return {
    age,
    annualIncome: boundedNumber(input.annualIncome, "年収", 0, 100_000),
    education,
    appearance: input.appearance as CalculatorInputs["appearance"],
    occupation: input.occupation as CalculatorInputs["occupation"],
    financialAssets: boundedNumber(input.financialAssets, "金融資産", 0, 1_000_000),
    realEstateAssets: boundedNumber(input.realEstateAssets, "不動産資産", 0, 1_000_000),
    otherAssets: boundedNumber(input.otherAssets, "その他資産", 0, 1_000_000),
    reinvestmentRate: boundedNumber(input.reinvestmentRate, "再投資率", 0, .8),
  };
}

function validateUid(value: unknown): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9-]{16,80}$/.test(value)) {
    throw new ApiError(400, "匿名IDを確認できませんでした。ページを再読み込みしてください。");
  }
  return value;
}

/** Population stats from full history (not the capped leaderboard). */
function populationFromScores(
  scores: number[],
  ownScore: number,
): Omit<RankingSnapshot, "leaderboardRank" | "leaderboardTotal" | "mode"> {
  const sorted = [...scores].sort((a, b) => b - a);
  const higher = sorted.filter((score) => score > ownScore).length;
  const rank = higher + 1;
  const mean = sorted.reduce((sum, score) => sum + score, 0) / Math.max(1, sorted.length);
  const sd = Math.sqrt(sorted.reduce((sum, score) => sum + (score - mean) ** 2, 0) / Math.max(1, sorted.length));
  const minScore = Math.min(...sorted, ownScore);
  const maxScore = Math.max(...sorted, ownScore);
  const bins = buildLogHistogramBins(sorted, minScore, maxScore);
  return {
    rank,
    total: sorted.length,
    deviation: sd ? Math.min(99, Math.max(1, 50 + (ownScore - mean) / sd * 10)) : 50,
    topPercent: rank / Math.max(1, sorted.length) * 100,
    bins,
    minScore,
    maxScore,
  };
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await enforceRateLimit(request, "value", 20);
    const payload = await parseJson<ValuationRequest>(request);
    const attemptId = typeof payload.attemptId === "string" ? payload.attemptId : "";
    if (!/^[0-9a-f-]{36}$/i.test(attemptId)) throw new ApiError(400, "クイズをもう一度開始してください。");
    const uid = validateUid(payload.uid);
    const inputs = validateInputs(payload.inputs);
    const db = await getD1();
    const now = Date.now();
    const attempt = await db.prepare(`
      SELECT question_ids, answers_json, correct_count, uid, expires_at, completed_at
      FROM hmc_quiz_attempts WHERE id = ?1
    `).bind(attemptId).first<AttemptRow>();
    if (!attempt || Number(attempt.expires_at) < now) {
      throw new ApiError(410, "クイズの有効期限が切れました。もう一度受けてください。");
    }
    const questionIds = JSON.parse(attempt.question_ids) as string[];
    const sets = Array.isArray(questionIds) ? getQuizSetsByIds(questionIds) : [];
    if (sets.length !== 5) throw new ApiError(400, "クイズをもう一度開始してください。");

    // One valuation per quiz attempt. Completed attempts must start a new quiz.
    if (attempt.completed_at !== null) {
      throw new ApiError(409, "このクイズはすでに査定済みです。もう一度受けてください。");
    }
    const answers = normalizeAnswers(sets, payload.answers ?? {});
    const quizCorrect = scoreQuiz(sets, answers);
    const updated = await db.prepare(`
      UPDATE hmc_quiz_attempts
      SET answers_json = ?1, correct_count = ?2, uid = ?3, completed_at = ?4
      WHERE id = ?5 AND completed_at IS NULL
      RETURNING id
    `).bind(JSON.stringify(answers), quizCorrect, uid, now, attemptId).first<{ id: string }>();
    if (!updated) {
      throw new ApiError(409, "このクイズはすでに査定済みです。もう一度受けてください。");
    }

    const calculation = calculateMarketCap({ ...inputs, correctAnswers: quizCorrect });
    const scoreYen = Math.round(calculation.marketCapMan * 10_000);
    if (!Number.isSafeInteger(scoreYen)) throw new ApiError(400, "入力値が大きすぎて査定できませんでした。");
    const scoreId = crypto.randomUUID();
    await db.prepare(`
      INSERT INTO hmc_scores (id, uid, score, updated_at)
      VALUES (?1, ?2, ?3, ?4)
    `).bind(scoreId, uid, scoreYen, now).run();
    await db.prepare(`
      INSERT INTO hmc_score_history (
        id, uid, score, quiz_correct,
        age, annual_income, education, appearance, occupation,
        financial_assets, real_estate_assets, other_assets, reinvestment_rate, created_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)
    `).bind(
      crypto.randomUUID(),
      uid,
      scoreYen,
      quizCorrect,
      Math.round(inputs.age),
      Math.round(inputs.annualIncome),
      inputs.education,
      inputs.appearance,
      inputs.occupation,
      Math.round(inputs.financialAssets),
      Math.round(inputs.realEstateAssets),
      Math.round(inputs.otherAssets),
      inputs.reinvestmentRate,
      now,
    ).run();
    const historyCount = await db.prepare(`SELECT COUNT(*) AS c FROM hmc_score_history`).first<{ c: number }>();
    const historyExcess = Math.max(0, Number(historyCount?.c ?? 0) - HISTORY_MAX_ROWS);
    if (historyExcess > 0) {
      await db.prepare(`
        DELETE FROM hmc_score_history
        WHERE id IN (
          SELECT id FROM hmc_score_history
          ORDER BY created_at ASC
          LIMIT ?1
        )
      `).bind(historyExcess).run();
    }
    const rankingCount = await db.prepare(`SELECT COUNT(*) AS c FROM hmc_scores`).first<{ c: number }>();
    const rankingExcess = Math.max(0, Number(rankingCount?.c ?? 0) - LEADERBOARD_MAX_ROWS);
    if (rankingExcess > 0) {
      await db.prepare(`
        DELETE FROM hmc_scores
        WHERE id IN (
          SELECT id FROM hmc_scores
          ORDER BY score ASC, updated_at ASC
          LIMIT ?1
        )
      `).bind(rankingExcess).run();
    }

    // Population stats: full history (exclude seeded dummies). Leaderboard stays capped separately.
    const historyRows = await db.prepare(`
      SELECT score FROM hmc_score_history
      WHERE uid NOT LIKE ?1
    `).bind(DUMMY_UID_PREFIX).all<{ score: number }>();
    let populationScores = (historyRows.results ?? [])
      .map((row) => Number(row.score))
      .filter(Number.isFinite);
    if (!populationScores.includes(scoreYen)) populationScores = [...populationScores, scoreYen];
    const population = populationFromScores(populationScores, scoreYen);

    const leaderboardRows = await db.prepare(`
      SELECT id, uid, score
      FROM hmc_scores ORDER BY score DESC LIMIT ?1
    `).bind(LEADERBOARD_MAX_ROWS).all<ScoreRow>();
    const board = leaderboardRows.results.some((row) => row.id === scoreId)
      ? leaderboardRows.results
      : [...leaderboardRows.results, { id: scoreId, uid, score: scoreYen }];
    const boardScores = board.map((row) => Number(row.score)).filter(Number.isFinite).sort((a, b) => b - a);
    const leaderboardHigher = boardScores.filter((score) => score > scoreYen).length;
    const ranking: RankingSnapshot = {
      ...population,
      mode: "population",
      leaderboardRank: leaderboardHigher + 1,
      leaderboardTotal: boardScores.length,
    };

    const response: ValuationResponse = {
      calculation,
      scoreYen,
      quizCorrect,
      reviews: buildQuizReviews(sets, answers),
      ranking,
    };
    return json(response);
  } catch (error) {
    return errorResponse(error);
  }
}
