/* ============================================================
   Navigation suite: portal -> hunter flow, identity/consent
   gates, AR start/stop via Back, deep links, and soft reset.
   ============================================================ */

import { newPage, waitStart, Reporter, sleep } from './helpers.mjs';

function seedEvent() {
  const db = {
    tables: {
      events: [
        {
          id: 'e1',
          created_at: '2026-01-01T00:00:00Z',
          data: {
            name: 'Test Hunt',
            status: 'active',
            markers: [
              { type: 'text', text: 'a', color: '#fff' },
              { type: 'text', text: 'b', color: '#fff' },
            ],
            players: [],
            timeLimit: 0,
            theme: 'standard',
          },
        },
      ],
    },
    storage: {},
  };
  localStorage.setItem('arthunt_demo_db', JSON.stringify(db));
}

async function enterHunterPortal(page) {
  await page.click('#btn-enter-hunter');
  await page.waitForFunction(() => {
    const el = document.getElementById('setup-screen');
    return el && getComputedStyle(el).display !== 'none';
  }, { timeout: 5000 });
  await page.click('#btn-player-login');
  await page.waitForSelector('#step-player-dashboard.active', { timeout: 10000 });
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

export default async function run(browser, baseUrl) {
  const r = new Reporter('navigation');

  // ── Main flow: portal -> browse -> join -> identity -> consent -> AR -> back
  {
    const page = await newPage(browser, { stubAR: true });
    await page.addInitScript(seedEvent);
    await waitStart(page, baseUrl);

    await enterHunterPortal(page);
    r.check('player dashboard active after Browse Quests', await hasClass(page, 'step-player-dashboard', 'active'));

    // Join without prior identity -> identity overlay opens.
    await page.evaluate(() => { window.joinEvent(0); });
    await page.waitForFunction(() => {
      const el = document.getElementById('identity-overlay');
      return el && getComputedStyle(el).display === 'flex';
    }, { timeout: 5000 });
    r.check('identity overlay opens on join', await displayOf(page, 'identity-overlay') === 'flex');

    // Empty submit shows the identity error.
    await page.click('#btn-identity-start');
    r.check('empty identity submit shows error', await displayOf(page, 'identity-error') === 'block');

    // Fill identity -> consent overlay opens.
    await page.fill('#identity-name', 'Ada');
    await page.fill('#identity-age', '30');
    await page.click('#btn-identity-start');
    await page.waitForFunction(() => {
      const el = document.getElementById('consent-overlay');
      return el && getComputedStyle(el).display === 'flex';
    }, { timeout: 5000 });
    r.check('consent overlay opens after identity', await displayOf(page, 'consent-overlay') === 'flex');

    // Decline consent -> no AR, still on the player dashboard.
    await page.click('#btn-consent-decline');
    await sleep(200);
    r.check('consent overlay closes after decline', await displayOf(page, 'consent-overlay') === 'none');
    r.check('AR did not start after declining consent', await page.evaluate(() => !window.__startARCalled));
    r.check('still on player dashboard after decline', await hasClass(page, 'step-player-dashboard', 'active'));

    // Re-join: identity already known -> skip straight to consent.
    await page.evaluate(() => { window.joinEvent(0); });
    await page.waitForFunction(() => {
      const el = document.getElementById('consent-overlay');
      return el && getComputedStyle(el).display === 'flex';
    }, { timeout: 5000 });
    r.check('identity overlay skipped on re-join', await displayOf(page, 'identity-overlay') === 'none');
    r.check('consent overlay shown directly on re-join', await displayOf(page, 'consent-overlay') === 'flex');

    // Agree -> AR starts.
    await page.click('#btn-consent-agree');
    await page.waitForFunction(() => window.__startARCalled === true, { timeout: 5000 });
    r.check('AR started after consenting', await page.evaluate(() => window.__startARCalled === true));
    r.check('ar-screen visible after AR start', await displayOf(page, 'ar-screen') === 'block');

    // Back button leaves AR (stop-ar branch of resolveBackAction).
    await page.goBack();
    await page.waitForFunction(() => {
      const el = document.getElementById('ar-screen');
      return el && getComputedStyle(el).display === 'none';
    }, { timeout: 5000 });
    r.check('ar-screen hidden after browser Back', await displayOf(page, 'ar-screen') === 'none');

    r.check('no page errors (main flow)', page.errors.length === 0);
    if (page.errors.length) console.error('  page errors:', page.errors.map(e => e.message));
    await page.context().close();
  }

  // ── Deep link: ?event=e1 drops straight into the identity overlay.
  {
    const page = await newPage(browser, { stubAR: true });
    await page.addInitScript(seedEvent);
    await waitStart(page, baseUrl, '?event=e1&demo=1');
    await page.click('#btn-start-experience');

    await page.waitForSelector('#step-player-dashboard.active', { timeout: 10000 });
    r.check('deep link lands on player dashboard', await hasClass(page, 'step-player-dashboard', 'active'));

    await page.waitForFunction(() => {
      const el = document.getElementById('identity-overlay');
      return el && getComputedStyle(el).display === 'flex';
    }, { timeout: 10000 });
    r.check('deep link auto-opens identity overlay', await displayOf(page, 'identity-overlay') === 'flex');

    r.check('no page errors (deep link)', page.errors.length === 0);
    if (page.errors.length) console.error('  page errors:', page.errors.map(e => e.message));
    await page.context().close();
  }

  // ── Soft reset: Logout returns to the landing portal without a reload.
  {
    const page = await newPage(browser, { stubAR: true });
    await page.addInitScript(seedEvent);
    await waitStart(page, baseUrl);
    await enterHunterPortal(page);

    await page.click('#btn-player-back');
    await sleep(150);
    r.check('landing-root no longer hidden after soft reset', !(await hasClass(page, 'landing-root', 'hidden')));
    r.check('setup-screen hidden after soft reset', await displayOf(page, 'setup-screen') === 'none');

    r.check('no page errors (soft reset)', page.errors.length === 0);
    if (page.errors.length) console.error('  page errors:', page.errors.map(e => e.message));
    await page.context().close();
  }

  return r.summary();
}
