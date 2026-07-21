import type { QuizStartResponse } from "../../../api-types";
import { getD1 } from "../../../../db";
import { ApiError, assertSameOrigin, enforceRateLimit, errorResponse, json } from "../../../server/http";
import { pickQuizSets, toPublicQuizSet } from "../../../server/quiz";

const ATTEMPT_LIFETIME_MS = 30 * 60 * 1000;

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await enforceRateLimit(request, "start", 30);
    const db = await getD1();
    const now = Date.now();
    const sets = pickQuizSets(5);
    if (sets.length !== 5) throw new ApiError(500, "クイズを準備できませんでした。");
    const attemptId = crypto.randomUUID();
    const expiresAt = now + ATTEMPT_LIFETIME_MS;
    await db.prepare(`
      INSERT INTO hmc_quiz_attempts (id, question_ids, created_at, expires_at)
      VALUES (?1, ?2, ?3, ?4)
    `).bind(attemptId, JSON.stringify(sets.map((set) => set.id)), now, expiresAt).run();
    await db.prepare("DELETE FROM hmc_quiz_attempts WHERE expires_at < ?1").bind(now).run();
    const payload: QuizStartResponse = {
      attemptId,
      sets: sets.map(toPublicQuizSet),
      expiresAt,
    };
    return json(payload, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
