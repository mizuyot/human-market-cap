/**
 * Build, then deploy production or staging Worker.
 * Usage: node scripts/deploy.mjs              # production
 *        node scripts/deploy.mjs --env staging
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const envFlag = args.includes("--env") ? args[args.indexOf("--env") + 1] : "production";
const isStaging = envFlag === "staging";

const STAGING = {
  name: "human-market-cap-staging",
  database_name: "human-market-cap-staging",
  database_id: "61ff36a6-fd9d-4b61-a47c-37b6bb7ee061",
};

const PRODUCTION = {
  name: "human-market-cap",
  database_name: "human-market-cap",
  database_id: "08431a90-97e9-4b8b-bc43-d7c7ebc524b5",
};

const target = isStaging ? STAGING : PRODUCTION;

function run(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, {
    cwd: root,
    encoding: "utf-8",
    env: process.env,
    stdio: "inherit",
    ...options,
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log(`Building for ${isStaging ? "staging" : "production"}…`);
run("npm", ["run", "build"]);

const wranglerPath = join(root, "dist/server/wrangler.json");
const config = JSON.parse(readFileSync(wranglerPath, "utf-8"));
config.name = target.name;
config.topLevelName = target.name;
if (Array.isArray(config.d1_databases) && config.d1_databases[0]) {
  config.d1_databases[0].database_name = target.database_name;
  config.d1_databases[0].database_id = target.database_id;
  config.d1_databases[0].binding = "DB";
}
config.observability = {
  enabled: true,
  head_sampling_rate: 1,
};
config.workers_dev = true;
config.preview_urls = true;
// Production only: attach apex + www custom domains (staging stays on workers.dev).
if (!isStaging) {
  config.routes = [
    { pattern: "humanmarketcap.com", custom_domain: true },
    { pattern: "www.humanmarketcap.com", custom_domain: true },
  ];
} else {
  delete config.routes;
}
writeFileSync(wranglerPath, JSON.stringify(config));
console.log(`Patched ${wranglerPath} → Worker ${target.name} / D1 ${target.database_name}`);

run("npx", ["wrangler", "deploy", "-c", "dist/server/wrangler.json"]);
console.log(`${isStaging ? "Staging" : "Production"} deploy finished.`);
