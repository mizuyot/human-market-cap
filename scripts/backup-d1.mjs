/**
 * Export a remote D1 database snapshot to ./backups/
 * Usage: node scripts/backup-d1.mjs
 *        node scripts/backup-d1.mjs --db human-market-cap-staging
 */
import { mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const dbFlagIndex = args.indexOf("--db");
const DB_NAME = dbFlagIndex >= 0
  ? args[dbFlagIndex + 1]
  : (process.env.HMC_D1_NAME || "human-market-cap");

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const outDir = join(root, "backups");
mkdirSync(outDir, { recursive: true });
const output = join(outDir, `${DB_NAME}-${stamp}.sql`);

console.log(`Exporting remote D1 ${DB_NAME} → ${output}`);
const result = spawnSync(
  "npx",
  ["wrangler", "d1", "export", DB_NAME, "--remote", "--output", output, "-y"],
  { cwd: root, encoding: "utf-8", env: process.env, stdio: "inherit" },
);
if (result.status !== 0) process.exit(result.status ?? 1);
console.log(`Backup finished: ${output}`);
