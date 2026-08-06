import { getD1 } from "../../db";
import { SECURITY_HEADER_VALUES } from "../security-headers";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      ...SECURITY_HEADER_VALUES,
    },
  });
}

export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("Origin");
  if (!origin) return;
  try {
    if (new URL(origin).host !== new URL(request.url).host) {
      throw new ApiError(403, "このリクエストは受け付けられません。");
    }
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(403, "このリクエストは受け付けられません。");
  }
}

export async function parseJson<T>(request: Request): Promise<T> {
  const length = Number(request.headers.get("Content-Length") ?? 0);
  if (length > 48_000) throw new ApiError(413, "送信内容が大きすぎます。");
  if (!request.headers.get("Content-Type")?.toLowerCase().includes("application/json")) {
    throw new ApiError(415, "JSON形式で送信してください。");
  }
  try {
    return await request.json() as T;
  } catch {
    throw new ApiError(400, "送信内容を読み取れませんでした。");
  }
}

async function requestFingerprint(request: Request): Promise<string> {
  const forwarded = request.headers.get("CF-Connecting-IP")
    ?? request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim()
    ?? "unknown";
  const day = new Date().toISOString().slice(0, 10);
  const bytes = new TextEncoder().encode(`hmc-v16:${day}:${forwarded}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest).slice(0, 12), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function enforceRateLimit(request: Request, action: "start" | "value" | "admin" | "analytics", max: number): Promise<void> {
  const db = await getD1();
  const now = Date.now();
  const windowStart = Math.floor(now / 3_600_000) * 3_600_000;
  const key = `${action}:${windowStart}:${await requestFingerprint(request)}`;
  const expiresAt = windowStart + 7_200_000;
  const result = await db.prepare(`
    INSERT INTO hmc_rate_limits (key, count, expires_at)
    VALUES (?1, 1, ?2)
    ON CONFLICT(key) DO UPDATE SET count = count + 1
    RETURNING count
  `).bind(key, expiresAt).first<{ count: number }>();
  if (!result || Number(result.count) > max) {
    throw new ApiError(429, "アクセスが集中しています。しばらく待ってからお試しください。");
  }
  await db.prepare("DELETE FROM hmc_rate_limits WHERE expires_at < ?1").bind(now).run();
}

export function errorResponse(error: unknown): Response {
  if (error instanceof ApiError) return json({ error: error.message }, error.status);
  const errorId = crypto.randomUUID().slice(0, 8);
  const message = error instanceof Error ? error.message : String(error);
  console.error(JSON.stringify({
    level: "error",
    service: "hmc",
    errorId,
    message,
    stack: error instanceof Error ? error.stack?.slice(0, 2000) : undefined,
  }));
  return json({
    error: "査定サーバーで問題が発生しました。少し待ってからもう一度お試しください。",
    errorId,
  }, 500);
}

export async function requireAdminToken(request: Request): Promise<void> {
  await enforceRateLimit(request, "admin", 30);
  const { env } = await import("cloudflare:workers");
  const expected = env.ADMIN_TOKEN;
  if (typeof expected !== "string" || !expected) {
    throw new ApiError(503, "管理機能は現在利用できません。");
  }
  const auth = request.headers.get("Authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!bearer || bearer !== expected) {
    throw new ApiError(401, "認証に失敗しました。");
  }
}
