/* ============================================================
   UI smoke suite: toast notifications (js/toast.js) and the
   printable hunt kit popup (window.printEventKit).
   ============================================================ */

import { newPage, waitStart, adminLogin, markerImageFile, Reporter, sleep } from './helpers.mjs';

export default async function run(browser, baseUrl) {
  const r = new Reporter('ui-smoke');
  const page = await newPage(browser, { stubAR: true });

  await waitStart(page, baseUrl);

  // ── Toasts ────────────────────────────────────────────────
  const toastAppeared = await page.evaluate(async () => {
    const { toast } = await import('/js/toast.js');
    toast('hello', { type: 'success', duration: 300 });
    await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
    return !!document.querySelector('#toast-container .toast.toast-success');
  });
  r.check("toast('hello', {type:'success'}) renders a .toast.toast-success", toastAppeared);

  // dismiss() fires at `duration`, adds .toast-out, then removes after 250ms more.
  await sleep(300 + 250 + 200);
  const toastGone = await page.evaluate(() => !document.querySelector('#toast-container .toast.toast-success'));
  r.check('toast is removed from the DOM after its duration', toastGone);

  // ── Print kit ─────────────────────────────────────────────
  await adminLogin(page);
  await page.click('#btn-create-event');
  await page.waitForSelector('#step-admin-count.active', { timeout: 5000 });
  await page.fill('#event-name', 'UI Smoke Hunt');
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

  const eventIndex = await page.evaluate(async () => {
    const { state } = await import('/js/state.js');
    const { saveEventToDB, getEventsFromDB } = await import('/js/db.js');
    await saveEventToDB(state.eventName, state.markers, 0, 'standard');
    state.events = await getEventsFromDB();
    return state.events.findIndex((e) => e.name === 'UI Smoke Hunt');
  });
  r.check('event saved and findable in state.events', eventIndex !== -1);

  const [popup] = await Promise.all([
    page.context().waitForEvent('page', { timeout: 5000 }),
    page.evaluate((idx) => { window.printEventKit(idx); }, eventIndex),
  ]);
  await popup.waitForLoadState('domcontentloaded');
  const html = await popup.content();
  r.check('print kit popup contains an SVG QR code', html.includes('<svg'));
  r.check('print kit popup mentions the event name', html.includes('UI Smoke Hunt'));
  await popup.close();

  r.check('no page errors', page.errors.length === 0);
  if (page.errors.length) console.error('  page errors:', page.errors.map((e) => e.message));

  await page.context().close();
  return r.summary();
}
