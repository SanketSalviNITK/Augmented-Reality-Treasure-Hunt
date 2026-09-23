# Automated tests

Two layers:

- **`tests/unit/`** — plain `node:test` unit tests against pure JS modules
  (no DOM, no browser).
- **`tests/e2e/`** — Playwright-driven end-to-end tests that boot the real
  `index.html` in headless Chromium against a tiny built-in static server,
  running the app in **demo mode** (`?demo=1`), which swaps in
  `js/demo-backend.js` as `window.supabase` so there is no real Supabase
  project to configure.

## Running

```bash
npm install

# One-time, on a normal dev machine (installs Playwright's own browser):
npx playwright install chromium

npm test              # unit + e2e
npm run test:unit     # node:test only
npm run test:e2e      # Playwright suites only
```

In this sandbox (and CI images without `playwright install` access), a
Chromium binary is already provided out-of-band. Point the tests at it
instead of installing one:

```bash
CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome npm test
```

If `CHROMIUM_PATH` is unset, Playwright falls back to the browser it would
normally manage itself (`chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })`),
so the same test code works unmodified on a normal dev machine.

## Why external CDNs are stubbed

`index.html` loads Three.js, MindAR, Supabase-js, Chart.js and Google Fonts
from `unpkg.com` / `cdn.jsdelivr.net` / `fonts.googleapis.com`, and sound
effects from `assets.mixkit.co`. None of those hosts are reachable from this
sandbox or from CI, so every e2e page (`tests/e2e/helpers.mjs`, `newPage()`)
installs a `page.route('**/*', ...)` handler that intercepts those requests:

| Request                                   | What happens |
|--------------------------------------------|--------------|
| `unpkg.com/three@0.160.0/...`               | Fulfilled from `node_modules/three/...` — **real** Three.js, so geometry/materials/loaders behave exactly as in production. |
| `cdn.jsdelivr.net/npm/mind-ar@1.2.5/...`    | Fulfilled with a two-line stub (`MindARThree`, `Compiler` as empty classes). Headless Chromium has no camera, so MindAR itself is never meaningfully exercised. |
| supabase-js, chart.js, Google Fonts, mixkit sfx, any `.mp3` | Fulfilled empty. Demo mode never touches the supabase-js script (it replaces `window.supabase` itself), and audio failures are already caught by the app. `window.Chart` is replaced with a harmless no-op class via `page.addInitScript`. |
| everything on `127.0.0.1`/`localhost`       | Passed straight through to the local static server (the app's own files, local assets, local audio). |

Additionally, when a suite passes `{ stubAR: true }` to `newPage()`,
`js/ar-engine.js` itself is replaced wholesale with a tiny stub
(`startAR`/`stopAR`/`pauseAR`/`resumeAR`/`captureARImage`) that flips the
`#setup-screen`/`#ar-screen` visibility the same way the real module does,
without ever touching `MindARThree` or a camera. This is used by suites that
only care about *navigation into and out of* the AR screen (`navigation`,
`demo-lifecycle`, `ui-smoke`). Suites that exercise the creator's 3D asset
pipeline (`creator-assets`, `floorplan`) leave the real `ar-engine.js` in
place — it's still imported and initialized by `main.js`, but its AR-camera
code path (`startAR()`/`initARSession()`) is never invoked by those tests,
so the (stubbed) MindAR classes are never instantiated.

## Suites

**`tests/unit/navigation.test.mjs`** — `js/navigation.js`'s pure functions:
`parseDeepLinkEventId` (query `?event=`/`?e=`, hash `#/join/<id>`,
decoding, malformed input, empty/unrelated input), `buildEventShareLink`
(strips any existing query/hash, URL-encodes the id), and
`resolveBackAction` (priority: open overlay > visible AR screen > portal-exit
> per-panel button mapping > default reset-to-portal).

**`tests/unit/asset-library.test.mjs`** — `js/asset-library.js` +
`js/loaders.js` in plain Node (no browser): `isLibraryUrl` /
`libraryIdFromUrl` / `getLibraryAsset`; every procedural built-in asset
(chest, coin, gem, trophy, key, crown, star, rocket, ghost, gift) builds a
`THREE.Group` with at least one mesh and a finite bounding box between
0.25–1.8 units tall; `loadModel('library:chest', ...)` centers the model on
x/z and returns a spinner "mixer" that actually rotates the model on
`update()`; an unknown library id rejects; and `assets/models/duck.glb`
starts with the `glTF` binary magic bytes. A minimal `globalThis.document`
stub is installed before importing anything, since `js/utils.js` touches
`document.querySelector` at module-load time.

**`tests/e2e/navigation.test.mjs`** — portal → "Start Quest" → browse quests
→ join → identity gate (empty submit shows the error; filling it in opens
the consent gate) → declining consent leaves the player dashboard with no
AR; re-joining skips the identity gate (already known) straight to consent;
agreeing starts AR (`window.__startARCalled`, `#ar-screen` visible); the
browser Back button stops AR. Also covers a `?event=<id>` deep link (lands
on the player dashboard with the identity overlay already open) and the
"Logout" soft reset (`#btn-player-back` → back at the landing portal without
a full page reload).

**`tests/e2e/creator-assets.test.mjs`** — the event-creation wizard: name →
marker count → per-marker image upload/crop → picking a built-in 3D asset
(and switching between assets) → review. Confirms the asset-tile grid size
matches `ASSET_LIBRARY.length` (11), that "Next" stays disabled until a
marker has both an image and a model/text, and that `js/loaders.js`'
`loadModel('library:<id>', ...)` returns a real, spinning `Object3D` (and
rejects an unknown id). Finishes by saving the event through `js/db.js`
directly and checking the persisted row.

**`tests/e2e/floorplan.test.mjs`** — continues a creator flow to the review
screen, uploads a floor-plan image, and clicks it to place/move a marker
pin, checking the normalized `{x, y}` position (±0.03) and the single
`.floorplan-pin` element. Confirms the saved event carries both the
marker's `pos` and a `data:` URL `floorPlanUrl` (the demo backend's
localStorage-based "storage").

**`tests/e2e/demo-lifecycle.test.mjs`** — an end-to-end dummy run: a creator
saves a hunt, the page reloads (same browser context, so the demo
localStorage "cloud" persists), a hunter browses and joins it through
identity + consent, hunt progress is simulated directly through
`js/db.js` (`logTelemetry`, `updateEventInDB`), and the post-hunt
leaderboard (`window.showPostHuntLeaderboard()`) lists the player. Also
checks the `#demo-badge` is present.

**`tests/e2e/ui-smoke.test.mjs`** — `js/toast.js` (a toast renders and is
removed from the DOM after its duration) and the printable hunt kit
(`window.printEventKit(index)` opens a popup containing an SVG QR code and
the event name).

## A note on `npm run test:unit`

Node's `--test` flag does not do directory-recursion when given an explicit
plain directory path as a positional argument (only when *no* path is given
at all, or when the path contains a glob like `*`). `tests/unit/*.test.mjs`
is used instead of a bare `tests/unit/` so `node --test` actually discovers
and runs both files.
