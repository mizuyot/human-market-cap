import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("ranking appends a new score row on every valuation", async () => {
  const [route, schema, types, client] = await Promise.all([
    readFile(new URL("../app/api/valuation/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api-types.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/HumanMarketCapApp.tsx", import.meta.url), "utf8"),
  ]);

  const rankingTable = schema.slice(
    schema.indexOf('export const scores = sqliteTable("hmc_scores"'),
    schema.indexOf("export const scoreHistory"),
  );
  assert.match(route, /INSERT INTO hmc_scores \(id, uid, score, updated_at\)/);
  assert.doesNotMatch(route, /ON CONFLICT\(uid\)/);
  assert.doesNotMatch(route, /segmentRank|kind: "occupation"|SELECT uid, score, occupation/);
  assert.match(rankingTable, /id: text\("id"\)\.primaryKey\(\)/);
  assert.match(rankingTable, /uid: text\("uid"\)\.notNull\(\)/);
  assert.doesNotMatch(rankingTable, /occupation:|age:|education:/);
  assert.doesNotMatch(types, /SegmentRanking|segments:/);
  assert.doesNotMatch(client, /segment-rankings|ranking\.segments|flavor\.division/);
});

test("valuation history appends input snapshot separately from ranking", async () => {
  const [route, schema, migration] = await Promise.all([
    readFile(new URL("../app/api/valuation/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0003_nostalgic_hobgoblin.sql", import.meta.url), "utf8"),
  ]);

  assert.match(schema, /sqliteTable\("hmc_score_history"/);
  assert.match(schema, /annualIncome: integer\("annual_income"\)/);
  assert.match(schema, /occupation: text\("occupation"\)/);
  assert.match(migration, /CREATE TABLE `hmc_score_history`/);
  assert.match(route, /INSERT INTO hmc_score_history/);
  assert.match(route, /HISTORY_MAX_ROWS/);
});

test("completed quiz attempts cannot be reused to inflate ranking", async () => {
  const route = await readFile(new URL("../app/api/valuation/route.ts", import.meta.url), "utf8");
  assert.match(route, /すでに査定済みです/);
  assert.match(route, /completed_at !== null/);
  assert.doesNotMatch(route, /このクイズはすでに使用されています/);
});

test("privacy copy discloses saved valuation fields", async () => {
  const [client, privacyUi] = await Promise.all([
    readFile(new URL("../app/HumanMarketCapApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/hmc/ui.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(client, /査定ごとに記録/);
  assert.match(privacyUi, /匿名ID・スコア・年齢・年収・学歴・容姿・職業・資産/);
  assert.match(privacyUi, /href="\/privacy"/);
  assert.doesNotMatch(client, /年収・資産・容姿・職業・年齢・学歴・クイズ回答の本文は保存しません/);
  assert.doesNotMatch(client, /最新スコアのみ/);
});

test("wizard splits valuation form into four steps", async () => {
  const client = await readFile(new URL("../app/HumanMarketCapApp.tsx", import.meta.url), "utf8");
  assert.match(client, /wizardStep/);
  assert.match(client, /想定就労年齢/);
  assert.match(client, /ネットワーク指数/);
  assert.match(client, /PrivacySummary/);
  assert.doesNotMatch(client, />WORK END</);
  assert.doesNotMatch(client, />NW力</);
});

test("admin API accepts Bearer auth only", async () => {
  const http = await readFile(new URL("../app/server/http.ts", import.meta.url), "utf8");
  assert.match(http, /Authorization/);
  assert.match(http, /enforceRateLimit\(request, "admin"/);
  assert.doesNotMatch(http, /searchParams\.get\("token"\)/);
  assert.doesNotMatch(http, /X-Admin-Token/);
});

test("population stats use history while leaderboard stays capped", async () => {
  const [route, types, client] = await Promise.all([
    readFile(new URL("../app/api/valuation/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api-types.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/HumanMarketCapApp.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(route, /populationFromScores/);
  assert.match(route, /hmc_score_history[\s\S]*NOT LIKE/);
  assert.match(route, /LEADERBOARD_MAX_ROWS/);
  assert.match(route, /leaderboardRank/);
  assert.match(types, /mode: "population"/);
  assert.match(types, /leaderboardRank/);
  assert.match(client, /査定履歴全体との比較/);
  assert.match(client, /掲示板/);
});
