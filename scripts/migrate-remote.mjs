/**
 * Apply Drizzle SQL migrations to a remote D1 database with an applied-history table.
 * Usage: node scripts/migrate-remote.mjs
 *        node scripts/migrate-remote.mjs --db human-market-cap-staging
 *
 * Records each file in hmc_schema_migrations after a successful apply.
 * Existing databases are bootstrapped once (mark current files applied without re-run)
 * when core tables already exist and the history table is empty.
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

/** Only treat true idempotent DDL collisions as skippable. */
const IGNORABLE = [
  "already exists",
  "duplicate column",
  "duplicate column name",
  "duplicate index",
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

function runCommand(command) {
  return wrangler(["d1", "execute", DB_NAME, "--remote", "--command", command]);
}

function remoteTablesInclude(name) {
  const result = runCommand("SELECT name FROM sqlite_master WHERE type='table';");
  return `${result.stdout ?? ""}${result.stderr ?? ""}`.includes(name);
}

function ensureMigrationsTable() {
  const result = runCommand(`
    CREATE TABLE IF NOT EXISTS hmc_schema_migrations (
      id TEXT PRIMARY KEY NOT NULL,
      applied_at INTEGER NOT NULL
    )
  `);
  if (result.status !== 0) {
    console.error(`${result.stdout ?? ""}\n${result.stderr ?? ""}`);
    process.exit(result.status ?? 1);
  }
}

function appliedMigrationIds() {
  const result = runCommand("SELECT id FROM hmc_schema_migrations ORDER BY id");
  if (result.status !== 0) {
    console.error(`${result.stdout ?? ""}\n${result.stderr ?? ""}`);
    process.exit(result.status ?? 1);
  }
  const text = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  const ids = new Set();
  for (const match of text.matchAll(/"id"\s*:\s*"([^"]+)"/g)) {
    ids.add(match[1]);
  }
  // wrangler table output fallback: lines that look like migration filenames
  for (const match of text.matchAll(/\b(\d{4}_[A-Za-z0-9_]+\.sql)\b/g)) {
    ids.add(match[1]);
  }
  return ids;
}

function markApplied(id) {
  const now = Date.now();
  const result = runCommand(
    `INSERT OR IGNORE INTO hmc_schema_migrations (id, applied_at) VALUES ('${id.replace(/'/g, "''")}', ${now})`,
  );
  if (result.status !== 0) {
    console.error(`${result.stdout ?? ""}\n${result.stderr ?? ""}`);
    process.exit(result.status ?? 1);
  }
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
  const result = runCommand(statement);
  if (result.status === 0) return;
  const output = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
  if (isIgnorable(output)) {
    console.warn(`Skipped (idempotent): ${statement.slice(0, 72).replace(/\s+/g, " ")}…`);
    return;
  }
  console.error(output);
  process.exit(result.status ?? 1);
}

function applyFile(file) {
  console.log(`Applying ${file}…`);
  const sql = readFileSync(join(drizzleDir, file), "utf-8");
  for (const statement of statementsFromSql(sql)) {
    runStatement(statement);
  }
  markApplied(file);
  console.log(`Recorded ${file} in hmc_schema_migrations.`);
}

console.log(`Migrating remote D1: ${DB_NAME}`);
ensureMigrationsTable();

const files = migrationFiles();
let applied = appliedMigrationIds();

if (applied.size === 0 && remoteTablesInclude("hmc_score_history")) {
  console.log("Bootstrapping migration history for existing database (mark current files applied, no re-run).");
  for (const file of files) {
    markApplied(file);
    console.log(`Bootstrapped ${file}`);
  }
  applied = appliedMigrationIds();
}

for (const file of files) {
  if (applied.has(file)) {
    console.log(`Skip (already applied): ${file}`);
    continue;
  }
  applyFile(file);
}

console.log(`Remote D1 migrations finished for ${DB_NAME}.`);
