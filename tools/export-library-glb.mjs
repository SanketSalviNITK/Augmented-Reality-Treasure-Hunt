#!/usr/bin/env node
/* ============================================================
   export-library-glb.mjs
   ------------------------------------------------------------
   Exports the web app's built-in 3D asset library (js/asset-
   library.js) to standalone binary glTF (.glb) files for the
   native Android app, which bundles them as raw assets instead
   of re-implementing the Three.js procedural builders on-device.

   For each `kind: 'procedural'` entry it calls the entry's
   build() to get a THREE.Group, then exports that group with
   three's GLTFExporter (binary: true). The one `kind: 'file'`
   entry (the Khronos sample duck) is simply copied as-is, since
   it's already a real .glb.

   Every exported file is then re-loaded with GLTFLoader.parse()
   and checked: valid GLB magic/version, parseable JSON chunk,
   >=1 mesh and material, and a bounding-box height within 5% of
   the source group's height (source height N/A for the copied
   duck.glb, which is instead byte-compared to its source file).

   Output: android/app/src/main/assets/models/<id>.glb

   ── How to run ────────────────────────────────────────────
   This script needs three@0.160.0 (the exact version the web
   app loads at js/asset-library.js / index.html) available on
   disk, including its examples/jsm exporters and loaders. It
   resolves the bare `three` specifier used by asset-library.js
   itself via a custom ESM loader hook, so nothing needs to be
   installed inside the repo (no node_modules is left behind).

     1. In some scratch directory (NOT inside this repo):
          npm init -y
          npm install three@0.160.0

     2. Run this script from the repo root, pointing THREE_DIR at
        that scratch install's three package:

          THREE_DIR=/path/to/scratch/node_modules/three \
            node tools/export-library-glb.mjs

        If THREE_DIR is omitted, the script falls back to
        <repo-root>/node_modules/three (useful if three is ever
        added as a real devDependency later) and finally to a
        node_modules/three next to this script.

   The script is idempotent/re-runnable: it always regenerates
   every .glb in android/app/src/main/assets/models/.
   ============================================================ */

import { register } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const OUT_DIR = join(REPO_ROOT, 'android/app/src/main/assets/models');
const ASSET_LIB_PATH = join(REPO_ROOT, 'js/asset-library.js');
const DUCK_SRC = join(REPO_ROOT, 'assets/models/duck.glb');

// ── Resolve where three@0.160.0 lives on disk ─────────────────

function resolveThreeDir() {
  const candidates = [
    process.env.THREE_DIR,
    join(REPO_ROOT, 'node_modules/three'),
    join(__dirname, 'node_modules/three'),
  ].filter(Boolean);

  for (const c of candidates) {
    if (existsSync(join(c, 'package.json'))) return c;
  }

  console.error(
    'ERROR: could not find an installed three@0.160.0.\n' +
    'Set THREE_DIR to point at a three package directory, e.g.:\n' +
    '  THREE_DIR=/path/to/scratch/node_modules/three node tools/export-library-glb.mjs\n' +
    '(See the header comment of this file for full setup steps.)'
  );
  process.exit(1);
}

const THREE_DIR = resolveThreeDir();
const threePkg = JSON.parse(readFileSync(join(THREE_DIR, 'package.json'), 'utf8'));
if (threePkg.version !== '0.160.0') {
  console.warn(`WARNING: expected three@0.160.0, found three@${threePkg.version} at ${THREE_DIR}`);
}

// ── ESM loader hook: redirect bare "three" / "three/..." imports
//    (as used by js/asset-library.js) to THREE_DIR, without
//    touching the repo or installing anything inside it. ──────

const loaderSource = `
import { pathToFileURL } from 'node:url';
const THREE_DIR = ${JSON.stringify(THREE_DIR)};
export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'three') {
    return { url: pathToFileURL(THREE_DIR + '/build/three.module.js').href, shortCircuit: true };
  }
  if (specifier.startsWith('three/')) {
    return { url: pathToFileURL(THREE_DIR + specifier.slice('three'.length)).href, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
`;
register('data:text/javascript;base64,' + Buffer.from(loaderSource, 'utf8').toString('base64'));

// ── Minimal FileReader shim: GLTFExporter's binary path uses the
//    browser FileReader API to turn Blobs into ArrayBuffers. Node
//    22 has a global Blob, so a tiny wrapper is all that's needed.

class FileReaderShim {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((buf) => {
      this.result = buf;
      if (typeof this.onloadend === 'function') this.onloadend();
    });
  }
  readAsDataURL(blob) {
    blob.arrayBuffer().then((buf) => {
      const base64 = Buffer.from(buf).toString('base64');
      this.result = `data:${blob.type || 'application/octet-stream'};base64,${base64}`;
      if (typeof this.onloadend === 'function') this.onloadend();
    });
  }
}
globalThis.FileReader = globalThis.FileReader || FileReaderShim;

// GLTFLoader's texture-loading path (used when verifying the copied
// duck.glb, which has an embedded texture) references `self` and
// `self.URL`/`self.webkitURL`, which only exist in browsers/workers.
globalThis.self = globalThis.self || globalThis;

// ── Imports that depend on the loader hook / shim above ───────

const { ASSET_LIBRARY } = await import(pathToFileURL(ASSET_LIB_PATH).href);
const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js');
const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
const THREE = await import('three');

mkdirSync(OUT_DIR, { recursive: true });

function exportGLB(group) {
  const exporter = new GLTFExporter();
  return new Promise((resolve, reject) => {
    exporter.parse(
      group,
      (result) => resolve(result), // ArrayBuffer when binary: true
      (err) => reject(err),
      { binary: true }
    );
  });
}

function boxHeight(object3d) {
  const box = new THREE.Box3().setFromObject(object3d);
  return box.max.y - box.min.y;
}

function checkGlbHeader(buf) {
  const magic = buf.toString('ascii', 0, 4);
  const version = buf.readUInt32LE(4);
  const totalLength = buf.readUInt32LE(8);
  const jsonChunkLength = buf.readUInt32LE(12);
  const jsonChunkType = buf.toString('ascii', 16, 20);
  const jsonText = buf.toString('utf8', 20, 20 + jsonChunkLength);
  let json;
  try {
    json = JSON.parse(jsonText);
  } catch (e) {
    throw new Error(`GLB JSON chunk did not parse: ${e.message}`);
  }
  return { magic, version, totalLength, jsonChunkType, json };
}

async function loadAndVerify(glbPath, expectedHeight) {
  const buf = readFileSync(glbPath);
  const header = checkGlbHeader(buf);

  const problems = [];
  if (header.magic !== 'glTF') problems.push(`bad magic '${header.magic}'`);
  if (header.version !== 2) problems.push(`unexpected version ${header.version}`);
  if (header.jsonChunkType !== 'JSON') problems.push(`unexpected first chunk type '${header.jsonChunkType}'`);
  if (header.totalLength !== buf.length) problems.push(`header length ${header.totalLength} != file size ${buf.length}`);

  const meshCount = Array.isArray(header.json.meshes) ? header.json.meshes.length : 0;
  const materialCount = Array.isArray(header.json.materials) ? header.json.materials.length : 0;
  if (meshCount < 1) problems.push('no meshes in glTF JSON');
  if (materialCount < 1) problems.push('no materials in glTF JSON');

  let loadedHeight = null;
  let heightPct = null;
  await new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    loader.parse(
      buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
      '',
      (gltf) => {
        loadedHeight = boxHeight(gltf.scene);
        if (expectedHeight != null && expectedHeight > 0) {
          heightPct = Math.abs(loadedHeight - expectedHeight) / expectedHeight * 100;
          if (heightPct > 5) problems.push(`bbox height off by ${heightPct.toFixed(1)}% (expected ~${expectedHeight.toFixed(4)}, got ${loadedHeight.toFixed(4)})`);
        }
        resolve();
      },
      (err) => reject(err)
    );
  });

  return { ...header, meshCount, materialCount, loadedHeight, heightPct, problems, fileSize: buf.length };
}

// ── Export every procedural asset ──────────────────────────────

const results = [];

for (const asset of ASSET_LIBRARY) {
  if (asset.kind !== 'procedural') continue;
  const group = asset.build();
  const sourceHeight = boxHeight(group);
  const arrayBuffer = await exportGLB(group);
  const outPath = join(OUT_DIR, `${asset.id}.glb`);
  writeFileSync(outPath, Buffer.from(arrayBuffer));
  results.push({ id: asset.id, outPath, sourceHeight });
}

// ── Copy the bundled duck.glb as-is ────────────────────────────

const duckAsset = ASSET_LIBRARY.find((a) => a.kind === 'file');
if (duckAsset) {
  const duckOut = join(OUT_DIR, `${duckAsset.id}.glb`);
  const duckBytes = readFileSync(DUCK_SRC);
  writeFileSync(duckOut, duckBytes);
  results.push({ id: duckAsset.id, outPath: duckOut, sourceHeight: null, copiedFrom: DUCK_SRC });
}

// ── Verify every output file ───────────────────────────────────

console.log(`\nthree@${threePkg.version} from ${THREE_DIR}`);
console.log(`Exporting ${results.length} models to ${OUT_DIR}\n`);

let anyFailed = false;
const rows = [];

for (const r of results) {
  const verdict = await loadAndVerify(r.outPath, r.sourceHeight);
  const sizeKB = (verdict.fileSize / 1024).toFixed(1);
  const ok = verdict.problems.length === 0;
  if (!ok) anyFailed = true;

  let extra = '';
  if (r.copiedFrom) {
    const same = statSync(DUCK_SRC).size === verdict.fileSize;
    extra = same ? '(copied, size matches source)' : '(copied, SIZE MISMATCH vs source!)';
    if (!same) anyFailed = true;
  } else {
    extra = `height ${verdict.loadedHeight.toFixed(4)} (src ${r.sourceHeight.toFixed(4)}, ${verdict.heightPct.toFixed(2)}% diff)`;
  }

  rows.push({
    id: r.id,
    sizeKB,
    meshes: verdict.meshCount,
    materials: verdict.materialCount,
    status: ok ? 'OK' : 'FAIL: ' + verdict.problems.join('; '),
    extra,
  });
}

for (const row of rows) {
  console.log(
    `${row.id.padEnd(8)} ${row.sizeKB.padStart(8)} KB  meshes=${row.meshes}  materials=${row.materials}  ${row.extra}  ${row.status}`
  );
}

console.log(anyFailed ? '\nFAILED: one or more models did not verify.' : '\nAll models exported and verified successfully.');
process.exit(anyFailed ? 1 : 0);
