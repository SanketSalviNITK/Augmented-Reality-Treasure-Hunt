/* ============================================================
   Floor-plan marker pinning suite: upload a venue floor plan on
   the review screen, click to place/move a marker pin, and
   confirm the normalized position + floor plan survive a save.

   Continues a normal creator flow (single marker, chest asset)
   up to the review screen, same as creator-assets.test.mjs.
   ============================================================ */

import { newPage, waitStart, adminLogin, markerImageFile, Reporter, sleep } from './helpers.mjs';

async function getMarkerPos(page, index = 0) {
  return page.evaluate(async (i) => {
    const { state } = await import('/js/state.js');
    return state.markers[i]?.pos || null;
  }, index);
}

async function clickAtPercent(page, selector, xPct, yPct) {
  const locator = page.locator(selector);
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) throw new Error(`No bounding box for ${selector}`);
  // Position is relative to the element itself, so Playwright's own
  // auto-scroll-into-view keeps the click on-screen regardless of the
  // element's absolute page coordinates (it can sit below the viewport).
  await locator.click({ position: { x: box.width * xPct, y: box.height * yPct } });
}

export default async function run(browser, baseUrl) {
  const r = new Reporter('floorplan');
  const page = await newPage(browser, { stubAR: false });

  await waitStart(page, baseUrl);
  await adminLogin(page);

  // ── Get to the review screen with one saved marker (chest, cropped image).
  await page.click('#btn-create-event');
  await page.waitForSelector('#step-admin-count.active', { timeout: 5000 });
  await page.fill('#event-name', 'Floorplan Test Hunt');
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

  // ── Floor plan wrap starts hidden.
  r.check('#floorplan-wrap hidden before any floor plan', await page.evaluate(() => {
    const el = document.getElementById('floorplan-wrap');
    return !!el && getComputedStyle(el).display === 'none';
  }));

  const floorplanFile = await markerImageFile(page, 'floorplan.png');
  await page.setInputFiles('#floorplan-input', floorplanFile);
  await page.waitForFunction(() => {
    const el = document.getElementById('floorplan-wrap');
    return el && getComputedStyle(el).display === 'block';
  }, { timeout: 5000 });
  r.check('#floorplan-wrap visible after upload', await page.evaluate(() => {
    const el = document.getElementById('floorplan-wrap');
    return getComputedStyle(el).display === 'block';
  }));

  const status1 = await page.textContent('#floorplan-status');
  r.check("floorplan status mentions 'Marker 1 of 1'", status1.includes('Marker 1 of 1'));

  // ── First click places the (only) marker's pin at ~25%,75%.
  await clickAtPercent(page, '#floorplan-wrap', 0.25, 0.75);
  await sleep(50);
  let pos = await getMarkerPos(page, 0);
  r.check('marker pos set after first click', !!pos);
  r.check('marker pos.x ~ 0.25', !!pos && Math.abs(pos.x - 0.25) <= 0.03);
  r.check('marker pos.y ~ 0.75', !!pos && Math.abs(pos.y - 0.75) <= 0.03);
  const pinCount1 = await page.locator('.floorplan-pin').count();
  r.check('exactly one floorplan pin after first click', pinCount1 === 1);

  // ── Second click moves the (already-placed) pin to ~60%,40%.
  await clickAtPercent(page, '#floorplan-wrap', 0.6, 0.4);
  await sleep(50);
  pos = await getMarkerPos(page, 0);
  r.check('marker pos moved on second click', !!pos && Math.abs(pos.x - 0.6) <= 0.03 && Math.abs(pos.y - 0.4) <= 0.03);
  const pinCount2 = await page.locator('.floorplan-pin').count();
  r.check('still exactly one floorplan pin after moving it', pinCount2 === 1);

  // ── Save: the marker keeps its pos, and the floor plan uploads as a data: URL (demo storage).
  const saved = await page.evaluate(async () => {
    const { state } = await import('/js/state.js');
    const { saveEventToDB } = await import('/js/db.js');
    return saveEventToDB(state.eventName, state.markers, 0, 'standard');
  });
  r.check('saveEventToDB returned a row', !!saved && !!saved.data);
  const savedPos = saved && saved.data && saved.data.markers && saved.data.markers[0] && saved.data.markers[0].pos;
  r.check('saved marker[0] carries its pos', !!savedPos && Math.abs(savedPos.x - 0.6) <= 0.03 && Math.abs(savedPos.y - 0.4) <= 0.03);
  r.check(
    'saved event.floorPlanUrl is a data: URL',
    !!saved && !!saved.data && typeof saved.data.floorPlanUrl === 'string' && saved.data.floorPlanUrl.startsWith('data:')
  );

  r.check('no page errors', page.errors.length === 0);
  if (page.errors.length) console.error('  page errors:', page.errors.map((e) => e.message));

  await page.context().close();
  return r.summary();
}
