import type {
  QuizAnswers,
  RankingSnapshot,
  ValuationRequest,
  ValuationResponse,
} from "../../api-types";
import {
  APPEARANCES,
  EDUCATIONS,
  OCCUPATIONS,
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
  uid: string;
  score: number;
}

/** Append-only history cap. Latest row per uid is never pruned. */
const HISTORY_MAX_ROWS = 20_000;

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
  if (!isKey(EDUCATIONS, input.education)) throw new ApiError(400, "学歴を選択してください。");
  if (!isKey(APPEARANCES, input.appearance)) throw new ApiError(400, "容姿を選択してください。");
  if (!isKey(OCCUPATIONS, input.occupation)) throw new ApiError(400, "職業を選択してください。");
  return {
    age,
    annualIncome: boundedNumber(input.annualIncome, "年収", 0, 100_000),
    education: input.education as CalculatorInputs["education"],
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

function rankingFromScores(scores: number[], ownScore: number): RankingSnapshot {
  const sorted = [...scores].sort((a, b) => b - a);
  const index = sorted.findIndex((score) => score <= ownScore);
  const rank = (index < 0 ? sorted.length - 1 : index) + 1;
  const mean = sorted.reduce((sum, score) => sum + score, 0) / Math.max(1, sorted.length);
  const sd = Math.sqrt(sorted.reduce((sum, score) => sum + (score - mean) ** 2, 0) / Math.max(1, sorted.length));
  const minScore = Math.min(...sorted, ownScore);
  const maxScore = Math.max(...sorted, ownScore);
  const span = Math.max(1, maxScore - minScore);
  const bins = Array.from({ length: 12 }, () => 0);
  sorted.forEach((score) => {
    bins[Math.min(11, Math.floor((score - minScore) / span * 12))] += 1;
  });
  return {
    rank,
    total: sorted.length,
    deviation: sd ? Math.min(99, Math.max(1, 50 + (ownScore - mean) / sd * 10)) : 50,
    topPercent: rank / Math.max(1, sorted.length) * 100,
    bins,
    minScore,
    maxScore,
    mode: "global",
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
    let attempt = await db.prepare(`
      SELECT question_ids, answers_json, correct_count, uid, expires_at, completed_at
      FROM hmc_quiz_attempts WHERE id = ?1
    `).bind(attemptId).first<AttemptRow>();
    if (!attempt || Number(attempt.expires_at) < now) {
      throw new ApiError(410, "クイズの有効期限が切れました。もう一度受けてください。");
    }
    const questionIds = JSON.parse(attempt.question_ids) as string[];
    const sets = Array.isArray(questionIds) ? getQuizSetsByIds(questionIds) : [];
    if (sets.length !== 5) throw new ApiError(400, "クイズをもう一度開始してください。");

    let answers: QuizAnswers;
    let quizCorrect: number;
    if (attempt.completed_at !== null) {
      if (attempt.uid !== uid || !attempt.answers_json || attempt.correct_count === null) {
        throw new ApiError(409, "このクイズはすでに使用されています。もう一度受けてください。");
      }
      answers = JSON.parse(attempt.answers_json) as QuizAnswers;
      quizCorrect = Number(attempt.correct_count);
    } else {
      answers = normalizeAnswers(sets, payload.answers ?? {});
      quizCorrect = scoreQuiz(sets, answers);
      const updated = await db.prepare(`
        UPDATE hmc_quiz_attempts
        SET answers_json = ?1, correct_count = ?2, uid = ?3, completed_at = ?4
        WHERE id = ?5 AND completed_at IS NULL
        RETURNING id
      `).bind(JSON.stringify(answers), quizCorrect, uid, now, attemptId).first<{ id: string }>();
      if (!updated) {
        attempt = await db.prepare(`
          SELECT question_ids, answers_json, correct_count, uid, expires_at, completed_at
          FROM hmc_quiz_attempts WHERE id = ?1
        `).bind(attemptId).first<AttemptRow>();
        if (!attempt || attempt.uid !== uid || !attempt.answers_json || attempt.correct_count === null) {
          throw new ApiError(409, "このクイズはすでに使用されています。もう一度受けてください。");
        }
        answers = JSON.parse(attempt.answers_json) as QuizAnswers;
        quizCorrect = Number(attempt.correct_count);
      }
    }

    const calculation = calculateMarketCap({ ...inputs, correctAnswers: quizCorrect });
    const scoreYen = Math.round(calculation.marketCapMan * 10_000);
    if (!Number.isSafeInteger(scoreYen)) throw new ApiError(400, "入力値が大きすぎて査定できませんでした。");
    await db.prepare(`
      INSERT INTO hmc_scores (uid, score, updated_at)
      VALUES (?1, ?2, ?3)
      ON CONFLICT(uid) DO UPDATE SET
        score = excluded.score,
        updated_at = excluded.updated_at
    `).bind(uid, scoreYen, now).run();
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
    const excess = Math.max(0, Number(historyCount?.c ?? 0) - HISTORY_MAX_ROWS);
    if (excess > 0) {
      await db.prepare(`
        DELETE FROM hmc_score_history
        WHERE id IN (
          SELECT h.id
          FROM hmc_score_history h
          WHERE h.id NOT IN (
            SELECT id FROM hmc_score_history
            WHERE (uid, created_at) IN (
              SELECT uid, MAX(created_at) FROM hmc_score_history GROUP BY uid
            )
          )
          ORDER BY h.created_at ASC
          LIMIT ?1
        )
      `).bind(excess).run();
    }
    await db.prepare(`
      DELETE FROM hmc_scores
      WHERE uid IN (
        SELECT uid FROM hmc_scores ORDER BY score DESC, updated_at DESC LIMIT -1 OFFSET 1000
      )
    `).run();
    const rows = await db.prepare(`
      SELECT uid, score
      FROM hmc_scores ORDER BY score DESC LIMIT 1000
    `).all<ScoreRow>();
    const rankingRows = rows.results.some((row) => row.uid === uid)
      ? rows.results
      : [...rows.results, { uid, score: scoreYen }];
    const scores = rankingRows.map((row) => Number(row.score)).filter(Number.isFinite);
    const globalRanking = rankingFromScores(scores, scoreYen);
    const response: ValuationResponse = {
      calculation,
      scoreYen,
      quizCorrect,
      reviews: buildQuizReviews(sets, answers),
      ranking: globalRanking,
    };
    return json(response);
  } catch (error) {
    return errorResponse(error);
  }
}
