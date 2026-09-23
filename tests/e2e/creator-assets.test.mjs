/* ============================================================
   Creator asset-library suite: event creation wizard, marker
   image crop, built-in 3D asset picking/switching, review, the
   loaders.js library-model loader, and saveEventToDB.

   Uses real three.js (no stubAR) since it exercises loaders.js.
   ============================================================ */

import { newPage, waitStart, adminLogin, markerImageFile, Reporter } from './helpers.mjs';

async function isActive(page, selector) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    return !!el && el.classList.contains('active');
  }, selector);
}

async function panelActive(page, id) {
  return page.evaluate((elId) => {
    const el = document.getElementById(elId);
    return !!el && el.classList.contains('active');
  }, id);
}

export default async function run(browser, baseUrl) {
  const r = new Reporter('creator-assets');
  const page = await newPage(browser, { stubAR: false });

  await waitStart(page, baseUrl);
  await adminLogin(page);

  await page.click('#btn-create-event');
  await page.waitForSelector('#step-admin-count.active', { timeout: 5000 });

  await page.fill('#event-name', 'Creator Test Hunt');
  r.check('#btn-confirm-count enabled after a valid name', !(await page.isDisabled('#btn-confirm-count')));

  await page.click('#btn-confirm-count');
  await page.waitForSelector('#step-marker-config.active', { timeout: 5000 });

  const libLen = await page.evaluate(async () => {
    const { ASSET_LIBRARY } = await import('/js/asset-library.js');
    return ASSET_LIBRARY.length;
  });
  const tileCount = await page.locator('.asset-tile').count();
  r.check(`.asset-tile count (${tileCount}) matches ASSET_LIBRARY length (${libLen})`, tileCount === libLen && libLen === 11);

  r.check('#btn-next-marker disabled before any image', await page.isDisabled('#btn-next-marker'));

  // Upload a marker image (a PNG screenshot works fine as a fixture).
  const file = await markerImageFile(page, 'marker.png');
  await page.setInputFiles('#marker-file-input', file);
  await page.waitForSelector('#step-crop.active', { timeout: 5000 });

  await page.click('#btn-confirm-crop');
  await page.waitForSelector('#step-marker-config.active', { timeout: 5000 });
  const hasPreview = await page.evaluate(() => {
    const img = document.getElementById('marker-preview-img');
    return !!img && getComputedStyle(img).display !== 'none' && !!img.src;
  });
  r.check('marker preview shown after crop', hasPreview);

  r.check('#btn-next-marker still disabled (no model chosen)', await page.isDisabled('#btn-next-marker'));

  // Pick the treasure chest.
  await page.click('.asset-tile[data-asset-id="chest"]');
  r.check('chest tile becomes active', await isActive(page, '.asset-tile[data-asset-id="chest"]'));
  r.check('scale control visible once a model is chosen', await page.evaluate(() => {
    const el = document.getElementById('scale-control');
    return !!el && getComputedStyle(el).display !== 'none';
  }));
  r.check('#btn-next-marker enabled once complete', !(await page.isDisabled('#btn-next-marker')));

  // Switching to gem moves the active tile.
  await page.click('.asset-tile[data-asset-id="gem"]');
  r.check('gem tile becomes active after switching', await isActive(page, '.asset-tile[data-asset-id="gem"]'));
  r.check('chest tile no longer active after switching', !(await isActive(page, '.asset-tile[data-asset-id="chest"]')));

  // Switch back to chest so the saved marker below is deterministic.
  await page.click('.asset-tile[data-asset-id="chest"]');
  r.check('chest tile active again', await isActive(page, '.asset-tile[data-asset-id="chest"]'));

  await page.click('#btn-next-marker');
  await page.waitForSelector('#step-review.active', { timeout: 5000 });
  const reviewText = await page.textContent('#review-list');
  r.check("review list mentions 'Treasure Chest (built-in)'", reviewText.includes('Treasure Chest (built-in)'));

  // loaders.js: a library model builds a real Object3D with a spinning mixer.
  const loaderResult = await page.evaluate(async () => {
    const { loadModel } = await import('/js/loaders.js');
    const { model, mixer } = await loadModel('library:gem', 'x', 0.5);
    let meshCount = 0;
    model.traverse((o) => { if (o.isMesh) meshCount++; });
    const before = model.rotation.y;
    mixer.update(1);
    const after = model.rotation.y;
    return { isObject3D: !!model.isObject3D, meshCount, before, after };
  });
  r.check('loadModel returns an Object3D', loaderResult.isObject3D);
  r.check('loadModel result has at least one mesh', loaderResult.meshCount >= 1);
  r.check('mixer.update spins the model', loaderResult.after !== loaderResult.before);

  const unknownRejects = await page.evaluate(async () => {
    const { loadModel } = await import('/js/loaders.js');
    try {
      await loadModel('library:not-a-real-asset', 'x', 0.5);
      return false;
    } catch (_) {
      return true;
    }
  });
  r.check('loadModel rejects an unknown library id', unknownRejects);

  // Save the event (demo backend) and inspect the persisted row.
  const saved = await page.evaluate(async () => {
    const { state } = await import('/js/state.js');
    const { saveEventToDB } = await import('/js/db.js');
    return saveEventToDB(state.eventName, state.markers, 0, 'standard');
  });
  r.check('saveEventToDB returned a row', !!saved && !!saved.data);
  r.check(
    "saved marker[0].modelUrl === 'library:chest'",
    !!saved && !!saved.data && Array.isArray(saved.data.markers) && saved.data.markers[0]?.modelUrl === 'library:chest'
  );
  r.check('saved event has a settings snapshot', !!saved && !!saved.data && !!saved.data.settings);

  r.check('no page errors', page.errors.length === 0);
  if (page.errors.length) console.error('  page errors:', page.errors.map((e) => e.message));

  await page.context().close();
  return r.summary();
}
