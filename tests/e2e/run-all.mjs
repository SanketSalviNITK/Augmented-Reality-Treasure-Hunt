/* ============================================================
   E2E test runner: starts the static file server, launches
   Chromium once, runs every suite with a fresh page each, and
   prints per-suite + total results. Exits non-zero on failure.
   ============================================================ */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pkg from 'playwright';
import { startServer } from './helpers.mjs';

const { chromium } = pkg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SUITE_FILES = [
  'navigation.test.mjs',
  'creator-assets.test.mjs',
  'floorplan.test.mjs',
  'demo-lifecycle.test.mjs',
  'ui-smoke.test.mjs',
  'regressions.test.mjs',
];

async function main() {
  const startedAt = Date.now();
  const server = await startServer();
  console.log(`Static server up at ${server.url}`);

  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    headless: true,
  });

  const results = [];

  try {
    for (const file of SUITE_FILES) {
      const suiteName = file.replace(/\.test\.mjs$/, '');
      const mod = await import(path.join(__dirname, file));
      const t0 = Date.now();
      let result;
      try {
        result = await mod.default(browser, server.url);
      } catch (err) {
        console.error(`Suite "${suiteName}" threw:`, err && err.stack || err);
        result = { pass: 0, fail: 1, failures: [`suite threw: ${err && err.message}`] };
      }
      const ms = Date.now() - t0;
      const pass = result?.pass || 0;
      const fail = result?.fail || 0;
      const failures = result?.failures || [];
      results.push({ suiteName, pass, fail, failures, ms });
      console.log(`${fail > 0 ? 'FAIL' : 'PASS'}  ${suiteName}  (${pass} passed, ${fail} failed, ${ms}ms)`);
    }
  } finally {
    await browser.close();
    await server.close();
  }

  const totalPass = results.reduce((s, r) => s + r.pass, 0);
  const totalFail = results.reduce((s, r) => s + r.fail, 0);
  const totalMs = Date.now() - startedAt;

  console.log('─'.repeat(60));
  for (const r of results) {
    if (r.failures.length) {
      console.log(`\n${r.suiteName} failures:`);
      r.failures.forEach((f) => console.log(`  - ${f}`));
    }
  }
  console.log('─'.repeat(60));
  console.log(`TOTAL: ${totalPass} passed, ${totalFail} failed across ${results.length} suites (${totalMs}ms)`);

  process.exit(totalFail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal e2e runner error:', err && err.stack || err);
  process.exit(1);
});
