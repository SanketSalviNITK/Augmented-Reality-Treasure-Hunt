/* ============================================================
   Demo lifecycle suite: a full dummy run through demo mode —
   creator saves a hunt, the app reloads, a hunter browses and
   joins it (identity + consent), progress is simulated via
   db.js, and the post-hunt leaderboard + demo badge show up.
   ============================================================ */

import { newPage, waitStart, adminLogin, markerImageFile, Reporter, sleep } from './helpers.mjs';

export default async function run(browser, baseUrl) {
  const r = new Reporter('demo-lifecycle');
  const page = await newPage(browser, { stubAR: true });

  // ── Creator: build and save a one-marker hunt.
  await waitStart(page, baseUrl);
  await adminLogin(page);

  await page.click('#btn-create-event');
  await page.waitForSelector('#step-admin-count.active', { timeout: 5000 });
  await page.fill('#event-name', 'Demo Lifecycle Hunt');
  await page.click('#btn-confirm-count');
  await page.waitForSelector('#step-marker-config.active', { timeout: 5000 });

  const markerFile = await markerImageFile(page, 'marker.png');
  await page.setInputFiles('#marker-file-input', markerFile);
  await page.waitForSelector('#step-crop.active', { timeout: 5000 });
  await page.click('#btn-confirm-crop');
  await page.waitForSelector('#step-marker-config.active', { timeout: 5000 });
  await page.click('.asset-tile[data-asset-id="chest"]');
  await page.click('#btn-next-marker');
  await page.waitForSelector('#step-review.active', { timeout: 5000 });

  const saved = await page.evaluate(async () => {
    const { state } = await import('/js/state.js');
    const { saveEventToDB } = await import('/js/db.js');
    return saveEventToDB(state.eventName, state.markers, 0, 'standard');
  });
  r.check('creator saved the hunt', !!saved && !!saved.id);

  // ── Reload the app (same page/context, so localStorage — the demo "cloud" — persists).
  await waitStart(page, baseUrl);
  r.check('#demo-badge present after reload', await page.evaluate(() => !!document.getElementById('demo-badge')));

  await page.click('#btn-enter-hunter');
  await page.waitForFunction(() => {
    const el = document.getElementById('setup-screen');
    return el && getComputedStyle(el).display !== 'none';
  }, { timeout: 5000 });
  await page.click('#btn-player-login');
  await page.waitForSelector('#step-player-dashboard.active', { timeout: 10000 });

  const eventIndex = await page.evaluate(async () => {
    const { state } = await import('/js/state.js');
    return state.events.findIndex((e) => e.name === 'Demo Lifecycle Hunt');
  });
  r.check('hunter sees the saved hunt after reload', eventIndex !== -1);

  // ── Join (fire-and-forget — the call resolves only once identity+consent settle).
  await page.evaluate((idx) => { window.joinEvent(idx); }, eventIndex);
  await page.waitForFunction(() => {
    const el = document.getElementById('identity-overlay');
    return el && getComputedStyle(el).display === 'flex';
  }, { timeout: 5000 });
  await page.fill('#identity-name', 'Grace');
  await page.fill('#identity-age', '28');
  await page.click('#btn-identity-start');

  await page.waitForFunction(() => {
    const el = document.getElementById('consent-overlay');
    return el && getComputedStyle(el).display === 'flex';
  }, { timeout: 5000 });
  await page.click('#btn-consent-agree');
  await page.waitForFunction(() => window.__startARCalled === true, { timeout: 5000 });
  r.check('AR started after join', await page.evaluate(() => window.__startARCalled === true));

  // ── Simulate hunt progress directly through db.js.
  const playerName = await page.evaluate(async () => {
    const { state } = await import('/js/state.js');
    const { logTelemetry, updateEventInDB } = await import('/js/db.js');

    state.activePlayerRecord.detectedMarkers = [1];
    logTelemetry(state.activeEventId, state.activePlayerRecord.name, 'scan', 1);
    logTelemetry(state.activeEventId, state.activePlayerRecord.name, 'complete');

    const ev = state.events.find((e) => e.id === state.activeEventId);
    if (ev) {
      const idx = ev.players.findIndex((p) => p.name === state.activePlayerRecord.name);
      if (idx !== -1) ev.players[idx] = state.activePlayerRecord;
      await updateEventInDB(ev.id, ev);
    }
    return state.activePlayerRecord.name;
  });

  await sleep(200);

  const kinds = await page.evaluate(async () => {
    const { getTelemetryRows } = await import('/js/db.js');
    const rows = await getTelemetryRows();
    return rows.map((row) => row.kind);
  });
  r.check('telemetry includes join', kinds.includes('join'));
  r.check('telemetry includes scan', kinds.includes('scan'));
  r.check('telemetry includes complete', kinds.includes('complete'));

  // ── Post-hunt leaderboard shows the player.
  await page.evaluate(() => { window.showPostHuntLeaderboard(); });
  await page.waitForFunction((name) => {
    const el = document.getElementById('post-hunt-leaderboard-list');
    return !!el && el.textContent.includes(name);
  }, playerName, { timeout: 5000 });
  const leaderboardText = await page.textContent('#post-hunt-leaderboard-list');
  r.check('post-hunt leaderboard lists the player', leaderboardText.includes(playerName));

  r.check('no page errors', page.errors.length === 0);
  if (page.errors.length) console.error('  page errors:', page.errors.map((e) => e.message));

  await page.context().close();
  return r.summary();
}
