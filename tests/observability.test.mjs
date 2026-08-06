import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

test("health endpoint and structured error ids exist", () => {
  const health = readFileSync(join(root, "app/api/health/route.ts"), "utf8");
  const http = readFileSync(join(root, "app/server/http.ts"), "utf8");
  const toml = readFileSync(join(root, "wrangler.toml"), "utf8");
  const adminLayout = readFileSync(join(root, "app/admin/layout.tsx"), "utf8");
  const headers = readFileSync(join(root, "app/security-headers.ts"), "utf8");
  const worker = readFileSync(join(root, "worker/index.ts"), "utf8");
  const migrate = readFileSync(join(root, "scripts/migrate-remote.mjs"), "utf8");
  assert.match(health, /SELECT 1 AS ok/);
  assert.match(http, /errorId/);
  assert.match(toml, /\[observability\]/);
  assert.match(adminLayout, /index:\s*false/);
  assert.match(headers, /Content-Security-Policy/);
  assert.match(headers, /frame-ancestors 'none'/);
  assert.match(worker, /withSecurityHeaders/);
  assert.match(migrate, /hmc_schema_migrations/);
  assert.doesNotMatch(migrate, /no such table/);
});

test("fonts are self-hosted and google fonts css import is gone", () => {
  const layout = readFileSync(join(root, "app/layout.tsx"), "utf8");
  const css = readFileSync(join(root, "app/globals.css"), "utf8");
  assert.match(layout, /next\/font\/google/);
  assert.doesNotMatch(css, /fonts\.googleapis\.com/);
});

test("sitemap and robots disallow admin", () => {
  const sitemap = readFileSync(join(root, "public/sitemap.xml"), "utf8");
  const robots = readFileSync(join(root, "app/robots.ts"), "utf8");
  assert.match(sitemap, /humanmarketcap\.com/);
  assert.match(robots, /disallow: \["\/admin"/);
});
