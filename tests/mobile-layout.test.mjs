import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const appRoot = new URL("../", import.meta.url);

test("mobile viewport and safe-area support are configured", async () => {
  const [layout, css] = await Promise.all([
    readFile(new URL("app/layout.tsx", appRoot), "utf8"),
    readFile(new URL("app/globals.css", appRoot), "utf8"),
  ]);

  assert.match(layout, /width:\s*"device-width"/);
  assert.match(layout, /viewportFit:\s*"cover"/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.match(css, /min-height:\s*100dvh/);
});

test("small screens keep controls readable and responsive", async () => {
  const css = await readFile(new URL("app/globals.css", appRoot), "utf8");

  assert.match(css, /select\s*\{[\s\S]*?font-size:\s*16px/);
  assert.match(css, /\.choice-grid label,[\s\S]*?min-height:\s*54px/);
  assert.match(css, /@media \(max-width:\s*420px\)/);
  assert.match(css, /@media \(max-width:\s*340px\)/);
  assert.match(css, /-webkit-overflow-scrolling:\s*touch/);
  assert.match(css, /scroll-snap-type:\s*x proximity/);
});
