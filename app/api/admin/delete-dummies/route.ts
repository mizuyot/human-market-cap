import { getD1 } from "../../../../db";
import { errorResponse, json, requireAdminToken } from "../../../server/http";

const DUMMY_PREFIX = "dummy-jp-%";

export async function POST(request: Request) {
  try {
    await requireAdminToken(request);
    const db = await getD1();

    const before = await db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM hmc_scores WHERE uid LIKE ?1) AS ranking,
        (SELECT COUNT(*) FROM hmc_score_history WHERE uid LIKE ?1) AS history
    `).bind(DUMMY_PREFIX).first<{ ranking: number; history: number }>();

    await db.prepare("DELETE FROM hmc_scores WHERE uid LIKE ?1").bind(DUMMY_PREFIX).run();
    await db.prepare("DELETE FROM hmc_score_history WHERE uid LIKE ?1").bind(DUMMY_PREFIX).run();

    return json({
      deletedRanking: Number(before?.ranking ?? 0),
      deletedHistory: Number(before?.history ?? 0),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
