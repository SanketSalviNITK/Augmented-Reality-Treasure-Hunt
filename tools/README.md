# tools/

## export-library-glb.mjs

Exports the web app's 11 built-in 3D library models (`js/asset-library.js`,
`ASSET_LIBRARY`) to standalone binary glTF files for the native Android app:

- 10 procedural entries (chest, coin, gem, trophy, key, crown, star, rocket,
  ghost, gift) are built with their `build()` function and exported with
  three.js's `GLTFExporter` (`binary: true`).
- The 1 file-based entry (`duck`, already a real `.glb` at
  `assets/models/duck.glb`) is copied as-is.

Output goes to `android/app/src/main/assets/models/<id>.glb`, one file per
library entry, so the Android app can load them as raw bundled assets
without re-implementing the Three.js procedural builders on-device.

The script also re-loads every exported file with `GLTFLoader.parse()` and
checks: valid GLB magic (`glTF`) + version 2, a parseable JSON chunk, at
least one mesh and one material, and (for the procedural models) a
bounding-box height within 5% of the source `THREE.Group`'s height. It
prints a pass/fail report with file sizes and exits non-zero on any
verification failure.

### Running it

The script needs `three@0.160.0` on disk (the exact version pinned in
`index.html` / used by `js/asset-library.js`). It is **not** installed
inside this repo — install it somewhere outside the worktree and point
`THREE_DIR` at it:

```bash
# 1. Somewhere outside the repo:
mkdir -p /tmp/three-export-deps && cd /tmp/three-export-deps
npm init -y
npm install three@0.160.0

# 2. From the repo root:
THREE_DIR=/tmp/three-export-deps/node_modules/three \
  node tools/export-library-glb.mjs
```

If `THREE_DIR` is omitted, it falls back to `node_modules/three` at the
repo root, then next to the script itself.

The script resolves `js/asset-library.js`'s bare `import * as THREE from
'three'` via a small in-process ESM loader hook (`node:module`'s
`register()`), so nothing needs to be added to this repo's dependency tree
and no `node_modules` is left behind.

It is safe to re-run at any time — it always regenerates every `.glb` in
`android/app/src/main/assets/models/`.
