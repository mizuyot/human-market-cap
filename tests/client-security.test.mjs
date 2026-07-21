import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

test("client bundle excludes quiz answers and valuation engine", async () => {
  const assets = new URL("../dist/client/assets/", import.meta.url);
  const files = (await readdir(assets)).filter((file) => file.endsWith(".js"));
  const source = (await Promise.all(files.map((file) => readFile(join(fileURLToPath(assets), file), "utf8")))).join("\n");

  assert.doesNotMatch(source, /保険は得するためではなく/);
  assert.doesNotMatch(source, /投入する元本はどちらも480万円/);
  assert.doesNotMatch(source, /function calculateMarketCap/);
  assert.doesNotMatch(source, /NEXT_PUBLIC_SUPABASE|SUPABASE_ANON_KEY/);
});
