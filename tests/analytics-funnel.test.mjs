import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("product analytics funnel", () => {
  test("analytics API and event table exist", () => {
    const route = readFileSync(join(root, "app/api/analytics/route.ts"), "utf8");
    const schema = readFileSync(join(root, "db/schema.ts"), "utf8");
    const migration = readFileSync(join(root, "drizzle/0005_analytics_events.sql"), "utf8");
    assert.match(route, /hmc_analytics_events/);
    assert.match(schema, /analyticsEvents/);
    assert.match(migration, /CREATE TABLE `hmc_analytics_events`/);
  });

  test("client tracks visit quiz valuation and share", () => {
    const app = readFileSync(join(root, "app/HumanMarketCapApp.tsx"), "utf8");
    assert.match(app, /trackEvent\("quiz_start"/);
    assert.match(app, /trackEvent\("valuation_complete"/);
    assert.match(app, /trackEvent\("share_click"/);
    assert.match(app, /challenge_visit|page_view/);
  });

  test("admin stats expose funnel rates", () => {
    const stats = readFileSync(join(root, "app/api/admin/stats/route.ts"), "utf8");
    const page = readFileSync(join(root, "app/admin/page.tsx"), "utf8");
    assert.match(stats, /quizStartRate/);
    assert.match(stats, /valuationRate/);
    assert.match(page, /利用ファネル/);
    assert.match(page, /訪問→クイズ開始/);
  });

  test("contact page uses info@humanmarketcap.com", () => {
    const contact = readFileSync(join(root, "app/contact/page.tsx"), "utf8");
    assert.match(contact, /info@humanmarketcap\.com/);
  });
});
