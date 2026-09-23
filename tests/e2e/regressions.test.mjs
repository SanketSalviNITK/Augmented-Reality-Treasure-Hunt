/* ============================================================
   Regression suite: one check per just-fixed bug, each isolated
   to its own fresh page/context so a failure in one case can't
   cascade into the next.

   1. main.js `startMarkerConfig` keeps a draft's already-
      configured markers across Back -> Continue, but a brand new
      draft (via #btn-create-event) still starts empty.
   2. js/db.js `updatePlayerInDB`/`patchEventInDB` merge into the
      latest copy of the event instead of clobbering concurrent
      writers.
   3. Rejoining a hunt the player already completed shows the
      post-hunt leaderboard instead of restarting AR.
   4. Rejoining a hunt the player exited early (endTime set, not
      all markers found) resumes it instead of getting stuck.
   5. A deep link to an archived (status: 'inactive') event is
      rejected with a toast, not silently joined.
   6. js/cropper.js: all four crop-box resize handles (tl/tr/bl/br)
      actually resize the crop box.
   7. The event-creation wizard seeds #time-limit from
      state.settings.globalQuestTimer.
   8. The power-saver overlay is cleared when AR is stopped, not
      just when the camera is toggled back on.
   ============================================================ */

import { newPage, waitStart, clickStart, adminLogin, markerImageFile, Reporter, sleep } from './helpers.mjs';

function seedDB(page, db) {
  return page.addInitScript((dbArg) => {
    localStorage.setItem('arthunt_demo_db', JSON.stringify(dbArg));
  }, db);
}

function oneEventDB(eventId, data) {
  return {
    tables: {
      events: [
        {
          id: eventId,
          created_at: '2026-01-01T00:00:00Z',
          data: { players: [], timeLimit: 0, theme: 'standard', ...data },
        },
      ],
    },
    storage: {},
  };
}

function displayOf(page, id) {
  return page.evaluate((elId) => {
    const el = document.getElementById(elId);
    return el ? getComputedStyle(el).display : null;
  }, id);
}

function hasClass(page, id, cls) {
  return page.evaluate(({ elId, c }) => {
    const el = document.getElementById(elId);
    return !!el && el.classList.contains(c);
  }, { elId: id, c: cls });
}

async function isActive(page, selector) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    return !!el && el.classList.contains('active');
  }, selector);
}

async function enterHunterPortal(page) {
  await clickStart(page);
  await page.click('#btn-enter-hunter');
  await page.waitForFunction(() => {
    const el = document.getElementById('setup-screen');
    return el && getComputedStyle(el).display !== 'none';
  }, { timeout: 5000 });
  await page.click('#btn-player-login');
  await page.waitForSelector('#step-player-dashboard.active', { timeout: 10000 });
}

async function joinAndFillIdentity(page, name, age) {
  await page.evaluate(() => { window.joinEvent(0); });
  await page.waitForFunction(() => {
    const el = document.getElementById('identity-overlay');
    return el && getComputedStyle(el).display === 'flex';
  }, { timeout: 5000 });
  await page.fill('#identity-name', name);
  await page.fill('#identity-age', age);
  await page.click('#btn-identity-start');
}

export default async function run(browser, baseUrl) {
  const r = new Reporter('regressions');

  // ── 1. Wizard keeps markers on Back -> Continue; a new draft starts fresh
  {
    const page = await newPage(browser, { stubAR: false });
    await waitStart(page, baseUrl);
    await adminLogin(page);

    await page.click('#btn-create-event');
    await page.waitForSelector('#step-admin-count.active', { timeout: 5000 });
    await page.fill('#event-name', 'Regression Wizard Hunt');
    await page.click('#btn-count-plus'); // markerCount: 1 -> 2
    await page.click('#btn-confirm-count');
    await page.waitForSelector('#step-marker-config.active', { timeout: 5000 });

    // Configure marker 1 fully: uploaded/cropped image + chest asset.
    const file = await markerImageFile(page, 'marker1.png');
    await page.setInputFiles('#marker-file-input', file);
    await page.waitForSelector('#step-crop.active', { timeout: 5000 });
    await page.click('#btn-confirm-crop');
    await page.waitForSelector('#step-marker-config.active', { timeout: 5000 });
    await page.click('.asset-tile[data-asset-id="chest"]');
    r.check('marker 1 complete (Next enabled)', !(await page.isDisabled('#btn-next-marker')));

    // Advance to marker 2 (left empty).
    await page.click('#btn-next-marker');
    await sleep(100);

    // Back twice: marker 2 -> marker 1 -> event details.
    await page.click('#btn-back-marker');
    await sleep(100);
    await page.click('#btn-back-marker');
    await page.waitForSelector('#step-admin-count.active', { timeout: 5000 });
    r.check('two Backs land on event details (#step-admin-count.active)', await hasClass(page, 'step-admin-count', 'active'));

    // Continue again -> re-enters startMarkerConfig().
    await page.click('#btn-confirm-count');
    await page.waitForSelector('#step-marker-config.active', { timeout: 5000 });

    const marker1State = await page.evaluate(async () => {
      const { state } = await import('/js/state.js');
      return {
        modelUrl: state.markers[0] && state.markers[0].modelUrl,
        hasDataUrl: !!(state.markers[0] && state.markers[0].dataUrl),
        count: state.markers.length,
      };
    });
    r.check(
      "marker 1 kept its model (state.markers[0].modelUrl === 'library:chest')",
      marker1State.modelUrl === 'library:chest'
    );
    r.check('marker 1 kept its image (state.markers[0].dataUrl truthy)', marker1State.hasDataUrl);
    r.check('markers array still has both entries after Back -> Continue', marker1State.count === 2);

    const hasPreview = await page.evaluate(() => {
      const img = document.getElementById('marker-preview-img');
      return !!img && getComputedStyle(img).display !== 'none' && !!img.src;
    });
    r.check('marker preview still shown for marker 1 after Back -> Continue', hasPreview);
    r.check('chest tile still active for marker 1 after Back -> Continue', await isActive(page, '.asset-tile[data-asset-id="chest"]'));

    // Exit the wizard (confirm dialog) back to the admin dashboard.
    page.once('dialog', (d) => d.accept());
    await page.click('#btn-cancel-config');
    await page.waitForSelector('#step-admin-dashboard.active', { timeout: 5000 });

    // A brand-new draft must NOT inherit the old draft's markers.
    await page.click('#btn-create-event');
    await page.waitForSelector('#step-admin-count.active', { timeout: 5000 });
    const freshMarkerCount = await page.evaluate(async () => {
      const { state } = await import('/js/state.js');
      return state.markers.length;
    });
    r.check('a new draft (#btn-create-event) starts with an empty markers array', freshMarkerCount === 0);

    r.check('no page errors (wizard back/continue)', page.errors.length === 0);
    if (page.errors.length) console.error('  page errors:', page.errors.map((e) => e.message));
    await page.context().close();
  }

  // ── 2. Concurrent player saves merge instead of clobbering (js/db.js)
  {
    const page = await newPage(browser);
    const eventId = 'reg-concurrent';
    await seedDB(page, oneEventDB(eventId, {
      name: 'Concurrent Hunt',
      status: 'active',
      markers: [{ type: 'text', text: 'a', color: '#fff' }],
      players: [],
    }));
    await waitStart(page, baseUrl);

    const merged = await page.evaluate(async (id) => {
      const { updatePlayerInDB, getEventsFromDB } = await import('/js/db.js');
      await updatePlayerInDB(id, { name: 'A', detectedMarkers: [1] });
      await updatePlayerInDB(id, { name: 'B', detectedMarkers: [1, 2] });
      await updatePlayerInDB(id, { name: 'A', detectedMarkers: [1, 2] });
      const events = await getEventsFromDB();
      const ev = events.find((e) => e.id === id);
      const a = ev.players.find((p) => p.name === 'A');
      const b = ev.players.find((p) => p.name === 'B');
      return { playerCount: ev.players.length, aLen: a && a.detectedMarkers.length, bLen: b && b.detectedMarkers.length };
    }, eventId);

    r.check('both concurrent players are present (2 players, not clobbered)', merged.playerCount === 2);
    r.check("player A's later save is reflected (2 markers)", merged.aLen === 2);
    r.check("player B's save survived A's later, unrelated save (2 markers)", merged.bLen === 2);

    const patched = await page.evaluate(async (id) => {
      const { patchEventInDB, getEventsFromDB } = await import('/js/db.js');
      await patchEventInDB(id, { status: 'inactive' });
      const events = await getEventsFromDB();
      const ev = events.find((e) => e.id === id);
      return { status: ev.status, playerCount: ev.players.length };
    }, eventId);
    r.check('patchEventInDB applies the patch (status -> inactive)', patched.status === 'inactive');
    r.check('patchEventInDB leaves players intact', patched.playerCount === 2);

    r.check('no page errors (db merge)', page.errors.length === 0);
    if (page.errors.length) console.error('  page errors:', page.errors.map((e) => e.message));
    await page.context().close();
  }

  // ── 3. Rejoining a completed hunt shows standings, not AR
  {
    const page = await newPage(browser, { stubAR: true });
    const eventId = 'reg-completed';
    await seedDB(page, oneEventDB(eventId, {
      name: 'Completed Hunt',
      status: 'active',
      markers: [{ type: 'text', text: 'a', color: '#fff' }],
      players: [{
        name: 'Done', age: '20', detectedMarkers: [1], customPath: [0],
        startTime: Date.now() - 60000, endTime: Date.now() - 1000, avatarId: 3,
      }],
    }));
    await waitStart(page, baseUrl);
    await enterHunterPortal(page);

    await joinAndFillIdentity(page, 'Done', '20');

    await page.waitForSelector('#step-post-hunt-leaderboard.active', { timeout: 5000 });
    r.check('rejoining a completed hunt lands on the post-hunt leaderboard', await hasClass(page, 'step-post-hunt-leaderboard', 'active'));
    r.check('AR did not start for an already-completed hunt', !(await page.evaluate(() => window.__startARCalled)));
    r.check('consent overlay was never shown for an already-completed hunt', (await displayOf(page, 'consent-overlay')) !== 'flex');

    r.check('no page errors (rejoin completed)', page.errors.length === 0);
    if (page.errors.length) console.error('  page errors:', page.errors.map((e) => e.message));
    await page.context().close();
  }

  // ── 4. An early-exited hunt (endTime set, not finished) resumes
  {
    const page = await newPage(browser, { stubAR: true });
    const eventId = 'reg-resume';
    await seedDB(page, oneEventDB(eventId, {
      name: 'Resume Hunt',
      status: 'active',
      markers: [
        { type: 'text', text: 'a', color: '#fff' },
        { type: 'text', text: 'b', color: '#fff' },
      ],
      players: [{
        name: 'Retry', age: '22', detectedMarkers: [],
        startTime: Date.now() - 30000, endTime: Date.now() - 500, avatarId: 5,
      }],
    }));
    await waitStart(page, baseUrl);
    await enterHunterPortal(page);

    await joinAndFillIdentity(page, 'Retry', '22');
    await page.waitForFunction(() => {
      const el = document.getElementById('consent-overlay');
      return el && getComputedStyle(el).display === 'flex';
    }, { timeout: 5000 });
    await page.click('#btn-consent-agree');
    await page.waitForFunction(() => window.__startARCalled === true, { timeout: 5000 });
    r.check('AR started for an early-exited hunt that gets resumed', await page.evaluate(() => window.__startARCalled === true));

    const resumedHasEndTime = await page.evaluate(async (id) => {
      const { getEventsFromDB } = await import('/js/db.js');
      const events = await getEventsFromDB();
      const ev = events.find((e) => e.id === id);
      const p = ev.players.find((pp) => pp.name === 'Retry');
      return !!(p && 'endTime' in p);
    }, eventId);
    r.check('resumed player record no longer carries endTime', !resumedHasEndTime);

    r.check('no page errors (resume)', page.errors.length === 0);
    if (page.errors.length) console.error('  page errors:', page.errors.map((e) => e.message));
    await page.context().close();
  }

  // ── 5. A deep link to an archived (status: 'inactive') hunt is rejected
  {
    const page = await newPage(browser, { stubAR: true });
    const eventId = 'reg-archived';
    await seedDB(page, oneEventDB(eventId, {
      name: 'Archived Hunt',
      status: 'inactive',
      markers: [{ type: 'text', text: 'a', color: '#fff' }],
      players: [],
    }));
    await waitStart(page, baseUrl, `?event=${eventId}&demo=1`);
    await page.click('#btn-start-experience');

    await page.waitForSelector('#step-player-dashboard.active', { timeout: 10000 });
    await page.waitForSelector('#toast-container .toast', { timeout: 5000 });
    r.check('a toast appears for an archived hunt deep link', (await page.locator('#toast-container .toast').count()) > 0);
    r.check('identity overlay is NOT shown for an archived hunt deep link', (await displayOf(page, 'identity-overlay')) !== 'flex');
    r.check('AR did not start for an archived hunt deep link', !(await page.evaluate(() => window.__startARCalled)));

    r.check('no page errors (archived deep link)', page.errors.length === 0);
    if (page.errors.length) console.error('  page errors:', page.errors.map((e) => e.message));
    await page.context().close();
  }

  // ── 6. All four crop-box resize handles resize the crop box (js/cropper.js)
  {
    const page = await newPage(browser, { stubAR: false });
    await waitStart(page, baseUrl);
    await adminLogin(page);

    await page.click('#btn-create-event');
    await page.waitForSelector('#step-admin-count.active', { timeout: 5000 });
    await page.fill('#event-name', 'Crop Handles Hunt');
    await page.click('#btn-confirm-count');
    await page.waitForSelector('#step-marker-config.active', { timeout: 5000 });

    const file = await markerImageFile(page, 'marker.png');
    await page.setInputFiles('#marker-file-input', file);
    await page.waitForSelector('#step-crop.active', { timeout: 5000 });
    // Panels slide in (fadeSlideIn, 0.5s); measuring handle positions mid-
    // animation makes the first drag miss its handle.
    await page.waitForFunction(() => document.getAnimations().every(a => a.playState !== 'running'), null, { timeout: 5000 });

    const handles = [
      { cls: 'tl', dx: -40, dy: -40 },
      { cls: 'tr', dx: 40, dy: -40 },
      { cls: 'bl', dx: -40, dy: 40 },
      { cls: 'br', dx: 40, dy: 40 },
    ];

    for (const h of handles) {
      const before = await page.evaluate(async () => {
        const { state } = await import('/js/state.js');
        return { w: state.cropPos.w, h: state.cropPos.h };
      });

      const box = await page.locator(`.crop-handle.${h.cls}`).boundingBox();
      const cx = box.x + box.width / 2;
      const cy = box.y + box.height / 2;
      await page.mouse.move(cx, cy);
      await page.mouse.down();
      await page.mouse.move(cx + h.dx, cy + h.dy, { steps: 5 });
      await page.mouse.up();

      const after = await page.evaluate(async () => {
        const { state } = await import('/js/state.js');
        return { w: state.cropPos.w, h: state.cropPos.h };
      });
      r.check(`dragging the ${h.cls} handle changes the crop box size`, after.w !== before.w || after.h !== before.h);
    }

    r.check('no page errors (crop handles)', page.errors.length === 0);
    if (page.errors.length) console.error('  page errors:', page.errors.map((e) => e.message));
    await page.context().close();
  }

  // ── 7. The wizard seeds #time-limit from state.settings.globalQuestTimer
  {
    const page = await newPage(browser, { stubAR: false });
    await waitStart(page, baseUrl);
    await adminLogin(page);

    await page.evaluate(async () => {
      const { state } = await import('/js/state.js');
      state.settings.globalQuestTimer = 25;
    });

    await page.click('#btn-create-event');
    await page.waitForSelector('#step-admin-count.active', { timeout: 5000 });
    const timeLimitValue = await page.inputValue('#time-limit');
    r.check('#time-limit defaults to the configured Global Countdown Limit (25)', timeLimitValue === '25');

    r.check('no page errors (settings default time limit)', page.errors.length === 0);
    if (page.errors.length) console.error('  page errors:', page.errors.map((e) => e.message));
    await page.context().close();
  }

  // ── 8. Power-saver overlay is cleared when AR is stopped
  {
    const page = await newPage(browser, { stubAR: true });
    const eventId = 'reg-powersave';
    await seedDB(page, oneEventDB(eventId, {
      name: 'Power Saver Hunt',
      status: 'active',
      markers: [
        { type: 'text', text: 'a', color: '#fff' },
        { type: 'text', text: 'b', color: '#fff' },
      ],
      players: [],
    }));
    await waitStart(page, baseUrl);
    await enterHunterPortal(page);

    await joinAndFillIdentity(page, 'Power', '30');
    await page.waitForFunction(() => {
      const el = document.getElementById('consent-overlay');
      return el && getComputedStyle(el).display === 'flex';
    }, { timeout: 5000 });
    await page.click('#btn-consent-agree');
    await page.waitForFunction(() => window.__startARCalled === true, { timeout: 5000 });

    await page.click('#btn-toggle-camera');
    await page.waitForFunction(() => {
      const el = document.getElementById('power-save-overlay');
      return el && getComputedStyle(el).display === 'flex';
    }, { timeout: 5000 });
    r.check('power-save overlay shown after toggling the camera off', (await displayOf(page, 'power-save-overlay')) === 'flex');

    // The power-save overlay (z-index 850) visually sits above the AR HUD
    // (z-index 510), so #btn-stop-ar is genuinely hit-tested underneath it
    // while paused — not the bug under test here (overlay cleanup on stop),
    // so dispatch the click directly on the button rather than resuming
    // first (a real mouse click, even with Playwright's `force`, would
    // still be routed by the browser to the topmost overlay element).
    await page.evaluate(() => document.getElementById('btn-stop-ar').click());
    await page.waitForFunction(() => {
      const el = document.getElementById('power-save-overlay');
      return el && getComputedStyle(el).display === 'none';
    }, { timeout: 5000 });
    r.check('power-save overlay cleared after stopping AR', (await displayOf(page, 'power-save-overlay')) === 'none');

    r.check('no page errors (power saver)', page.errors.length === 0);
    if (page.errors.length) console.error('  page errors:', page.errors.map((e) => e.message));
    await page.context().close();
  }

  return r.summary();
}
