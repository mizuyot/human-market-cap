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
