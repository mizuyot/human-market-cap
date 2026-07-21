import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("ranking stores only anonymous id, latest score, and update time", async () => {
  const [route, schema, types, client] = await Promise.all([
    readFile(new URL("../app/api/valuation/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api-types.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/HumanMarketCapApp.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(route, /INSERT INTO hmc_scores \(uid, score, updated_at\)/);
  assert.doesNotMatch(route, /segmentRank|kind: "occupation"|SELECT uid, score, occupation/);
  assert.doesNotMatch(schema, /occupation: text\("occupation"\)|age: integer\("age"\)|education: text\("education"\)/);
  assert.doesNotMatch(types, /SegmentRanking|segments:/);
  assert.doesNotMatch(client, /segment-rankings|ranking\.segments|flavor\.division/);
});
