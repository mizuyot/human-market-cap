/**
 * Simple uptime check for staging/production health endpoints.
 * Usage: node scripts/check-health.mjs
 *        node scripts/check-health.mjs --base https://human-market-cap.mizuyot.workers.dev
 */
const args = process.argv.slice(2);
const baseIndex = args.indexOf("--base");
const bases = baseIndex >= 0
  ? [args[baseIndex + 1]]
  : [
    "https://human-market-cap-staging.mizuyot.workers.dev",
    "https://human-market-cap.mizuyot.workers.dev",
  ];

let failed = false;
for (const base of bases) {
  const url = `${base.replace(/\/$/, "")}/api/health`;
  try {
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    const body = await response.text();
    console.log(`${response.status} ${url}`);
    console.log(body);
    if (!response.ok) failed = true;
    else {
      const parsed = JSON.parse(body);
      if (!parsed.ok || parsed.db !== "up") failed = true;
    }
  } catch (error) {
    failed = true;
    console.error(`FAIL ${url}`, error);
  }
  console.log("");
}

process.exit(failed ? 1 : 0);
