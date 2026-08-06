import { getD1 } from "../../../db";
import { errorResponse, json } from "../../server/http";

export async function GET() {
  try {
    const started = Date.now();
    const db = await getD1();
    await db.prepare("SELECT 1 AS ok").first<{ ok: number }>();
    return json({
      ok: true,
      service: "human-market-cap",
      db: "up",
      latencyMs: Date.now() - started,
      at: new Date().toISOString(),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
