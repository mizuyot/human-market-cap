import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const sourceUrl = new URL("../app/HumanMarketCapApp.tsx", import.meta.url);

test("result sharing creates a social image with a mobile fallback", async () => {
  const source = await readFile(sourceUrl, "utf8");

  assert.match(source, /canvas\.width = 1200/);
  assert.match(source, /canvas\.height = 630/);
  assert.match(source, /#人間時価総額/);
  assert.match(source, /あなたも算出してみる →/);
  assert.match(source, /navigator\.canShare/);
  assert.match(source, /new File\(\[bytes\], "human-market-cap-result\.png"/);
  assert.match(source, /https:\/\/x\.com\/intent\/post/);
});
