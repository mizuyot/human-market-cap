import { getD1 } from "../../../db";
import { isAnalyticsEventName } from "../../analytics-events";
import { ApiError, assertSameOrigin, enforceRateLimit, errorResponse, json, parseJson } from "../../server/http";

const EVENTS_MAX_ROWS = 50_000;

interface AnalyticsBody {
  name?: unknown;
  sessionId?: unknown;
  uid?: unknown;
  path?: unknown;
  referrer?: unknown;
  props?: unknown;
}

function cleanText(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

function cleanUid(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (!/^[A-Za-z0-9-]{8,80}$/.test(value)) return null;
  return value;
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await enforceRateLimit(request, "analytics", 120);
    const payload = await parseJson<AnalyticsBody>(request);
    if (!isAnalyticsEventName(payload.name)) {
      throw new ApiError(400, "不明なイベントです。");
    }
    const sessionId = cleanText(payload.sessionId, 80);
    if (!/^[A-Za-z0-9-]{8,80}$/.test(sessionId)) {
      throw new ApiError(400, "セッションを確認できませんでした。");
    }
    const props = payload.props && typeof payload.props === "object" && !Array.isArray(payload.props)
      ? payload.props
      : {};
    let propsJson = "{}";
    try {
      propsJson = JSON.stringify(props).slice(0, 1_500);
    } catch {
      propsJson = "{}";
    }

    const db = await getD1();
    const now = Date.now();
    await db.prepare(`
      INSERT INTO hmc_analytics_events (
        id, name, session_id, uid, path, referrer, props_json, created_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
    `).bind(
      crypto.randomUUID(),
      payload.name,
      sessionId,
      cleanUid(payload.uid),
      cleanText(payload.path, 240) || "/",
      cleanText(payload.referrer, 240),
      propsJson,
      now,
    ).run();

    const count = await db.prepare(`SELECT COUNT(*) AS c FROM hmc_analytics_events`).first<{ c: number }>();
    const excess = Math.max(0, Number(count?.c ?? 0) - EVENTS_MAX_ROWS);
    if (excess > 0) {
      await db.prepare(`
        DELETE FROM hmc_analytics_events
        WHERE id IN (
          SELECT id FROM hmc_analytics_events
          ORDER BY created_at ASC
          LIMIT ?1
        )
      `).bind(excess).run();
    }

    return json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
