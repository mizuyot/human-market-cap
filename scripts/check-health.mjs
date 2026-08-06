/**
 * Uptime check for staging/production health endpoints.
 * Usage: node scripts/check-health.mjs
 *        node scripts/check-health.mjs --base https://humanmarketcap.com
 */
const args = process.argv.slice(2);
const baseFlag = args.indexOf("--base");
const bases = baseFlag >= 0
  ? [args[baseFlag + 1]]
  : [
    "https://humanmarketcap.com",
    "https://www.humanmarketcap.com",
    "https://human-market-cap.mizuyot.workers.dev",
    "https://human-market-cap-staging.mizuyot.workers.dev",
  ];

let failed = 0;
for (const base of bases) {
  const url = `${base.replace(/\/$/, "")}/api/health`;
  try {
    const started = Date.now();
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    const body = await response.json().catch(() => ({}));
    const ms = Date.now() - started;
    const ok = response.ok && body?.ok === true && body?.db === "up";
    console.log(`${ok ? "OK" : "FAIL"} ${url} status=${response.status} ${ms}ms`, body);
    if (!ok) failed += 1;
  } catch (error) {
    failed += 1;
    console.error(`FAIL ${url}`, error instanceof Error ? error.message : error);
  }
}

process.exit(failed > 0 ? 1 : 0);
