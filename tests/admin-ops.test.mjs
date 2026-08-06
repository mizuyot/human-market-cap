import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("admin stats and dummy cleanup", () => {
  test("admin page loads stats and delete-dummies controls", () => {
    const page = readFileSync(join(root, "app/admin/page.tsx"), "utf8");
    assert.match(page, /\/api\/admin\/stats/);
    assert.match(page, /\/api\/admin\/delete-dummies/);
    assert.match(page, /ダミーを削除/);
    assert.match(page, /TIER分布/);
  });

  test("stats and delete-dummies API routes exist", () => {
    const stats = readFileSync(join(root, "app/api/admin/stats/route.ts"), "utf8");
    const del = readFileSync(join(root, "app/api/admin/delete-dummies/route.ts"), "utf8");
    assert.match(stats, /dummy-jp-%/);
    assert.match(stats, /tierCounts/);
    assert.match(del, /DELETE FROM hmc_scores WHERE uid LIKE/);
    assert.match(del, /DELETE FROM hmc_score_history WHERE uid LIKE/);
  });

  test("staging and production deploy targets are separated", () => {
    const toml = readFileSync(join(root, "wrangler.toml"), "utf8");
    const pkg = readFileSync(join(root, "package.json"), "utf8");
    const deploy = readFileSync(join(root, "scripts/deploy.mjs"), "utf8");
    assert.match(toml, /\[env\.staging\]/);
    assert.match(toml, /human-market-cap-staging/);
    assert.match(pkg, /deploy:staging/);
    assert.match(pkg, /db:migrate:staging/);
    assert.match(deploy, /human-market-cap-staging/);
    assert.match(deploy, /61ff36a6-fd9d-4b61-a47c-37b6bb7ee061/);
  });
});
