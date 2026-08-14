import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";
import { getLocalNodeD1, isNodeRuntime } from "./local-d1";

async function getEnvironment() {
  const { env } = await import("cloudflare:workers");
  return env;
}

async function probeD1(db: D1Database): Promise<boolean> {
  try {
    await db.prepare("SELECT 1 AS ok").first();
    return true;
  } catch {
    return false;
  }
}

export async function getDb() {
  const d1 = await getD1();
  return drizzle(d1, { schema });
}

export async function getD1(): Promise<D1Database> {
  try {
    const env = await getEnvironment();
    if (env.DB && (await probeD1(env.DB as D1Database))) {
      return env.DB as D1Database;
    }
  } catch {
    // vinext start など Workers 外
  }

  if (isNodeRuntime()) {
    const local = getLocalNodeD1();
    if (await probeD1(local)) return local;
  }

  throw new Error("Cloudflare D1 binding `DB` is unavailable.");
}
