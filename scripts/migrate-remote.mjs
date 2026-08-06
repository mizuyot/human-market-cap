/**
 * Apply Drizzle SQL migrations to a remote D1 database.
 * Usage: node scripts/migrate-remote.mjs
 *        node scripts/migrate-remote.mjs --db human-market-cap-staging
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const drizzleDir = join(root, "drizzle");

const args = process.argv.slice(2);
const dbFlagIndex = args.indexOf("--db");
const DB_NAME = dbFlagIndex >= 0
  ? args[dbFlagIndex + 1]
  : (process.env.HMC_D1_NAME || "human-market-cap");

if (!DB_NAME) {
  console.error("Missing database name. Pass --db <name>.");
  process.exit(1);
}

const IGNORABLE = [
  "already exists",
  "duplicate column",
  "duplicate column name",
  "duplicate index",
  "no such column",
  "no such table",
];

function wrangler(wranglerArgs) {
  return spawnSync("npx", ["wrangler", ...wranglerArgs], {
    cwd: root,
    encoding: "utf-8",
    env: process.env,
  });
}

function isIgnorable(output) {
  const text = output.toLowerCase();
  return IGNORABLE.some((needle) => text.includes(needle));
}

function remoteTablesInclude(name) {
  const result = wrangler([
    "d1",
    "execute",
    DB_NAME,
    "--remote",
    "--command",
    "SELECT name FROM sqlite_master WHERE type='table';",
  ]);
  return `${result.stdout ?? ""}${result.stderr ?? ""}`.includes(name);
}

function migrationFiles() {
  return readdirSync(drizzleDir)
    .filter((file) => /^\d{4}_.*\.sql$/.test(file))
    .sort();
}

function statementsFromSql(sql) {
  return sql
    .split(/--> statement-breakpoint/g)
    .map((part) => part.trim())
    .filter(Boolean);
}

function runStatement(statement) {
  const result = wrangler([
    "d1",
    "execute",
    DB_NAME,
    "--remote",
    "--command",
    statement,
  ]);
  if (result.status === 0) return;
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  if (isIgnorable(output)) {
    console.warn(`Skipped (idempotent): ${statement.slice(0, 72).replace(/\s+/g, " ")}…`);
    return;
  }
  console.error(output);
  process.exit(result.status ?? 1);
}

console.log(`Migrating remote D1: ${DB_NAME}`);

if (remoteTablesInclude("hmc_score_history")) {
  console.log("Core tables present; re-applying migrations with idempotent skips.");
}

for (const file of migrationFiles()) {
  console.log(`Applying ${file}…`);
  const sql = readFileSync(join(drizzleDir, file), "utf-8");
  for (const statement of statementsFromSql(sql)) {
    runStatement(statement);
  }
}

console.log(`Remote D1 migrations finished for ${DB_NAME}.`);
