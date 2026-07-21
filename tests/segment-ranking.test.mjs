import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("ranking storage and response support occupation, age, and education divisions", async () => {
  const [route, migration, types] = await Promise.all([
    readFile(new URL("../app/api/valuation/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../drizzle/0001_rapid_nuke.sql", import.meta.url), "utf8"),
    readFile(new URL("../app/api-types.ts", import.meta.url), "utf8"),
  ]);

  assert.match(migration, /ADD `occupation` text/);
  assert.match(migration, /ADD `age` integer/);
  assert.match(migration, /ADD `education` text/);
  assert.match(route, /kind: "occupation"/);
  assert.match(route, /kind: "age"/);
  assert.match(route, /kind: "education"/);
  assert.match(types, /segments: SegmentRanking\[\]/);
});
