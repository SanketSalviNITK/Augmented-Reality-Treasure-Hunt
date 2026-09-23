/* ============================================================
   Test helpers: static file server, page factory (with CDN
   interception), navigation shortcuts, and a tiny reporter.
   ------------------------------------------------------------
   External CDNs (unpkg, jsdelivr, Google Fonts, mixkit) are
   unreachable from this sandbox / CI, so every e2e page routes
   requests to those hosts to local stand-ins:
     - three@0.160.0  -> served from node_modules/three (REAL three.js)
     - mind-ar         -> tiny stub module (no camera/WebXR in headless
                           Chromium, so MindAR itself is never exercised
                           here; ar-engine.js is optionally replaced
                           wholesale with a stub — see stubAR below)
     - supabase-js, chart.js, Google Fonts, mixkit sfx, any .mp3
                       -> fulfilled empty (unused: demo mode installs
                          its own localStorage backend, and toasts work
                          without audio)
   ============================================================ */

import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const REPO_ROOT = path.resolve(__dirname, '..', '..');
const THREE_ROOT = path.join(REPO_ROOT, 'node_modules', 'three');

// ─── Static file server (no python, no build step) ────────────────────

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.json': 'application/json; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
};

function contentTypeFor(filePath) {
  return CONTENT_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
}

export function startServer(root = REPO_ROOT) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        const rawPath = decodeURIComponent((req.url || '/').split('?')[0].split('#')[0]);
        let filePath = path.join(root, rawPath === '/' ? '' : rawPath);

        // Guard against path traversal outside the repo root.
        if (!filePath.startsWith(root)) {
          res.writeHead(403);
          res.end('Forbidden');
          return;
        }

        fs.stat(filePath, (statErr, stat) => {
          if (!statErr && stat.isDirectory()) {
            filePath = path.join(filePath, 'index.html');
          }
          fs.readFile(filePath, (err, data) => {
            if (err) {
              res.writeHead(404, { 'Content-Type': 'text/plain' });
              res.end('Not found: ' + rawPath);
              return;
            }
            res.writeHead(200, { 'Content-Type': contentTypeFor(filePath) });
            res.end(data);
          });
        });
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end(String(e && e.stack || e));
      }
    });

    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({
        url: `http://127.0.0.1:${port}`,
        close: () => new Promise((res) => server.close(() => res())),
      });
    });
  });
}

// ─── CDN interception + page factory ───────────────────────────────────

const MINDAR_STUB = `export const MindARThree = class {};\nexport const Compiler = class {};\n`;

// Replaces the whole ar-engine module (no camera/MindAR in headless
// Chromium). Mirrors the real module's screen-swap behaviour closely
// enough for navigation tests, without touching a camera or GL context.
const AR_ENGINE_STUB = `
export function startAR() {
  window.__startARCalled = true;
  const setup = document.getElementById('setup-screen');
  if (setup) setup.style.display = 'none';
  const ar = document.getElementById('ar-screen');
  if (ar) ar.style.display = 'block';
}
export function stopAR() {
  const ar = document.getElementById('ar-screen');
  if (ar) ar.style.display = 'none';
}
export function pauseAR() {}
export async function resumeAR() {}
export async function captureARImage() { return null; }
`;

export async function newPage(browser, { stubAR = false } = {}) {
  const context = await browser.newContext();
  const page = await context.newPage();

  page.errors = [];
  page.on('pageerror', (err) => page.errors.push(err));

  // chart.js is stubbed away (fulfilled empty) — provide a harmless global
  // so `new window.Chart(...)` in main.js doesn't throw.
  await page.addInitScript(() => {
    window.Chart = class {
      constructor() {}
      destroy() {}
    };
  });

  await page.route('**/*', async (route) => {
    const req = route.request();
    const url = req.url();
    let u;
    try {
      u = new URL(url);
    } catch (_) {
      return route.continue();
    }

    // Optional: swap the AR engine module out entirely before anything
    // else (it's same-origin, so the localhost passthrough below would
    // otherwise win).
    if (stubAR && u.pathname.endsWith('/js/ar-engine.js')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/javascript; charset=utf-8',
        body: AR_ENGINE_STUB,
      });
    }

    // Our own static server: let it through untouched.
    if (u.hostname === '127.0.0.1' || u.hostname === 'localhost') {
      return route.continue();
    }

    // three@0.160.0 from unpkg -> real three.js from node_modules.
    if (u.hostname === 'unpkg.com' && u.pathname.includes('/three@0.160.0/')) {
      const rel = u.pathname.split('/three@0.160.0/')[1] || '';
      const filePath = path.join(THREE_ROOT, rel);
      try {
        const body = await fs.promises.readFile(filePath);
        return route.fulfill({
          status: 200,
          contentType: 'application/javascript; charset=utf-8',
          body,
        });
      } catch (_) {
        return route.fulfill({ status: 404, body: `three.js file not found: ${rel}` });
      }
    }

    // mind-ar from jsdelivr -> tiny stub (never instantiated unless a test
    // deliberately calls the real startAR(), which this suite never does).
    if (u.hostname === 'cdn.jsdelivr.net' && u.pathname.includes('mind-ar@1.2.5')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/javascript; charset=utf-8',
        body: MINDAR_STUB,
      });
    }

    // Everything else external (supabase-js, chart.js, Google Fonts,
    // mixkit sound effects, any stray .mp3) -> fulfilled empty. Demo mode
    // never touches window.supabase from this script, and audio failures
    // are caught by the app itself.
    if (
      u.hostname === 'cdn.jsdelivr.net' ||
      u.hostname === 'fonts.googleapis.com' ||
      u.hostname === 'fonts.gstatic.com' ||
      u.hostname === 'assets.mixkit.co' ||
      url.endsWith('.mp3')
    ) {
      return route.fulfill({ status: 200, contentType: 'text/plain', body: '' });
    }

    return route.continue();
  });

  return page;
}

// ─── Navigation shortcuts ───────────────────────────────────────────────

export async function waitStart(page, base, query = '?demo=1') {
  await page.goto(`${base}/${query}`);
  await page.waitForFunction(() => {
    const btn = document.getElementById('btn-start-experience');
    return !!btn && getComputedStyle(btn).display !== 'none';
  }, { timeout: 15000 });
}

// Click the Start button and wait out its fade so the (still-clickable
// until then) loading overlay stops intercepting pointer events.
export async function clickStart(page) {
  await page.click('#btn-start-experience');
  await page.waitForFunction(() => {
    const el = document.getElementById('loading-overlay');
    return !el || getComputedStyle(el).display === 'none';
  }, { timeout: 5000 });
}

// Click through Start -> Enter Studio -> Admin Login. Assumes the page has
// already been navigated (waitStart) so #btn-start-experience is visible.
export async function adminLogin(page) {
  await clickStart(page);
  await page.waitForTimeout(300);
  await page.click('#btn-enter-creator');
  await page.waitForTimeout(900); // 600ms setup-screen transition + margin
  await page.fill('#admin-pass', 'ARTHunt321');
  await page.click('#btn-admin-login');
  await page.waitForSelector('#step-admin-dashboard.active', { timeout: 10000 });
}

// A real (small) PNG to use as a marker / floor-plan image fixture.
export async function markerImageBuffer(page) {
  return page.screenshot();
}

export async function markerImageFile(page, name = 'marker.png') {
  const buffer = await markerImageBuffer(page);
  return { name, mimeType: 'image/png', buffer };
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Tiny pass/fail reporter ────────────────────────────────────────────

export class Reporter {
  constructor(suiteName) {
    this.suite = suiteName;
    this.pass = 0;
    this.fail = 0;
    this.failures = [];
  }

  check(desc, cond) {
    if (cond) {
      this.pass++;
    } else {
      this.fail++;
      this.failures.push(desc);
      console.error(`  [FAIL] ${this.suite} :: ${desc}`);
    }
    return cond;
  }

  async checkAsync(desc, fn) {
    try {
      const cond = await fn();
      return this.check(desc, cond);
    } catch (err) {
      this.fail++;
      this.failures.push(`${desc} (threw: ${err && err.message})`);
      console.error(`  [FAIL] ${this.suite} :: ${desc} threw:`, err && err.stack || err);
      return false;
    }
  }

  summary() {
    return { suite: this.suite, pass: this.pass, fail: this.fail, failures: this.failures };
  }
}
