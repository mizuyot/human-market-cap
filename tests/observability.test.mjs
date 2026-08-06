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
  assert.match(health, /SELECT 1 AS ok/);
  assert.match(http, /errorId/);
  assert.match(toml, /\[observability\]/);
  assert.match(adminLayout, /index:\s*false/);
});
