/**
 * vinext start（Node）用のローカル D1 互換。
 * Workers 本番では使わない。env.DB が使えないときだけ。
 *
 * vinext build は node:fs / node:sqlite を unenv のスタブに置換する。
 * そのため globalThis.process.getBuiltinModule で本物を読む。
 */

import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

type SqlParams = unknown[];

type DatabaseSyncInstance = {
  prepare: (sql: string) => {
    get: (...params: SqlParams) => unknown;
    run: (...params: SqlParams) => { changes?: number; lastInsertRowid?: number | bigint };
    all: (...params: SqlParams) => unknown[];
  };
  exec: (sql: string) => void;
};

type DatabaseSyncCtor = new (path: string) => DatabaseSyncInstance;

type NodeFs = {
  existsSync: (path: string) => boolean;
  readdirSync: (path: string) => string[];
};

function nodeFs(): NodeFs {
  const fs = (
    globalThis as typeof globalThis & {
      process?: { getBuiltinModule?: (id: string) => NodeFs | undefined };
    }
  ).process?.getBuiltinModule?.("node:fs");
  if (fs?.existsSync && fs.readdirSync) return fs;
  return createRequire(import.meta.url)("node:fs") as NodeFs;
}

function loadDatabaseSync(): DatabaseSyncCtor {
  try {
    const gbm = (
      globalThis as typeof globalThis & {
        process?: {
          getBuiltinModule?: (
            id: string,
          ) => { DatabaseSync: DatabaseSyncCtor } | undefined;
        };
      }
    ).process?.getBuiltinModule;
    const builtin = gbm?.("node:sqlite");
    if (builtin?.DatabaseSync) return builtin.DatabaseSync;
  } catch {
    /* continue */
  }

  const require = createRequire(import.meta.url);
  try {
    const mod = require("node:sqlite") as { DatabaseSync: DatabaseSyncCtor };
    return mod.DatabaseSync;
  } catch (error) {
    throw new Error(
      `node:sqlite unavailable (${error instanceof Error ? error.message : error})`,
    );
  }
}

function projectRootCandidates(): string[] {
  const roots = [process.cwd()];
  try {
    const here = dirname(fileURLToPath(import.meta.url));
    roots.push(join(here, "../.."), join(here, "../../.."), join(here, ".."));
  } catch {
    /* ignore */
  }
  return [...new Set(roots)];
}

function findLocalSqlitePath(): string {
  const fs = nodeFs();
  const tried: string[] = [];
  for (const root of projectRootCandidates()) {
    const dir = join(
      root,
      ".wrangler",
      "state",
      "v3",
      "d1",
      "miniflare-D1DatabaseObject",
    );
    tried.push(dir);
    if (!fs.existsSync(dir)) continue;
    const file = fs
      .readdirSync(dir)
      .find((name) => name.endsWith(".sqlite") && name !== "metadata.sqlite");
    if (file) return join(dir, file);
  }

  throw new Error(
    `Local D1 sqlite not found. Tried: ${tried.join(" | ")}. cwd=${process.cwd()}`,
  );
}

function createStatement(db: DatabaseSyncInstance, sql: string, params: SqlParams) {
  const bound = params.map((value) => (value === undefined ? null : value));
  return {
    async first<T = Record<string, unknown>>(): Promise<T | null> {
      const row = db.prepare(sql).get(...bound) as T | undefined;
      return row ?? null;
    },
    async run(): Promise<D1Result> {
      const info = db.prepare(sql).run(...bound);
      return {
        success: true,
        meta: {
          changes: Number(info.changes ?? 0),
          last_row_id: Number(info.lastInsertRowid ?? 0),
          duration: 0,
          size_after: 0,
          rows_read: 0,
          rows_written: Number(info.changes ?? 0),
        },
        results: [],
      };
    },
    async all<T = Record<string, unknown>>(): Promise<D1Result<T>> {
      const results = db.prepare(sql).all(...bound) as T[];
      return {
        success: true,
        meta: {
          changes: 0,
          last_row_id: 0,
          duration: 0,
          size_after: 0,
          rows_read: results.length,
          rows_written: 0,
        },
        results,
      };
    },
    async raw<T = unknown[]>(): Promise<T[]> {
      const rows = db.prepare(sql).all(...bound) as Record<string, unknown>[];
      return rows.map((row) => Object.values(row)) as T[];
    },
  };
}

let cached: D1Database | null = null;

export function getLocalNodeD1(): D1Database {
  if (cached) return cached;
  const DatabaseSync = loadDatabaseSync();
  const sqlite = new DatabaseSync(findLocalSqlitePath());
  cached = {
    prepare(sql: string) {
      const base = {
        bind(...params: SqlParams) {
          return createStatement(sqlite, sql, params);
        },
        ...createStatement(sqlite, sql, []),
      };
      return base as D1PreparedStatement;
    },
    async dump() {
      return new ArrayBuffer(0);
    },
    async batch<T = unknown>(statements: D1PreparedStatement[]) {
      const out: D1Result<T>[] = [];
      for (const statement of statements) {
        out.push((await statement.all()) as D1Result<T>);
      }
      return out;
    },
    async exec(query: string) {
      sqlite.exec(query);
      return { count: 0, duration: 0 };
    },
    withSession() {
      return this as D1Database;
    },
  } as D1Database;
  return cached;
}

export function isNodeRuntime(): boolean {
  return typeof process !== "undefined" && Boolean(process.versions?.node);
}
