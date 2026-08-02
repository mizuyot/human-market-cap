import { getD1 } from "../../../../db";
import { errorResponse, json, requireAdminToken } from "../../../server/http";

interface HistoryRow {
  id: string;
  uid: string;
  score: number;
  quiz_correct: number;
  age: number;
  annual_income: number;
  education: string;
  appearance: string;
  occupation: string;
  financial_assets: number;
  real_estate_assets: number;
  other_assets: number;
  reinvestment_rate: number;
  created_at: number;
}

export async function GET(request: Request) {
  try {
    await requireAdminToken(request);
    const url = new URL(request.url);
    const limitRaw = Number(url.searchParams.get("limit") ?? 100);
    const limit = Number.isFinite(limitRaw)
      ? Math.min(500, Math.max(1, Math.floor(limitRaw)))
      : 100;
    const db = await getD1();
    const result = await db.prepare(`
      SELECT
        id, uid, score, quiz_correct,
        age, annual_income, education, appearance, occupation,
        financial_assets, real_estate_assets, other_assets, reinvestment_rate, created_at
      FROM hmc_score_history
      ORDER BY created_at DESC
      LIMIT ?1
    `).bind(limit).all<HistoryRow>();
    return json({ rows: result.results ?? [] });
  } catch (error) {
    return errorResponse(error);
  }
}
