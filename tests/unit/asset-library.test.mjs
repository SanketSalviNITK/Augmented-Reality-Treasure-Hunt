import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// utils.js (imported transitively by loaders.js) touches `document` at
// module-load time (`sections = { welcome: $('#step-0'), ... }`), so a
// minimal stand-in must exist before anything imports it.
globalThis.document = {
  querySelector: () => null,
  querySelectorAll: () => [],
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');

const THREE = await import('three');
const {
  ASSET_LIBRARY,
  isLibraryUrl,
  libraryIdFromUrl,
  getLibraryAsset,
} = await import('../../js/asset-library.js');
const { loadModel } = await import('../../js/loaders.js');

test('isLibraryUrl', () => {
  assert.equal(isLibraryUrl('library:chest'), true);
  assert.equal(isLibraryUrl('models/foo.glb'), false);
  assert.equal(isLibraryUrl(''), false);
  assert.equal(isLibraryUrl(undefined), false);
  assert.equal(isLibraryUrl(null), false);
});

test('libraryIdFromUrl', () => {
  assert.equal(libraryIdFromUrl('library:chest'), 'chest');
  assert.equal(libraryIdFromUrl('library:duck'), 'duck');
  assert.equal(libraryIdFromUrl('models/foo.glb'), null);
});

test('getLibraryAsset', () => {
  const chest = getLibraryAsset('chest');
  assert.ok(chest);
  assert.equal(chest.id, 'chest');
  assert.equal(chest.kind, 'procedural');
  assert.equal(getLibraryAsset('does-not-exist'), null);
});

test('every procedural asset builds a sane Group', async (t) => {
  const procedural = ASSET_LIBRARY.filter((a) => a.kind === 'procedural');
  assert.ok(procedural.length > 0, 'expected at least one procedural asset');

  for (const asset of procedural) {
    await t.test(asset.id, () => {
      const group = asset.build();
      assert.equal(group.isGroup ?? group.type === 'Group', true, `${asset.id} should build a THREE.Group`);

      let meshCount = 0;
      group.traverse((obj) => { if (obj.isMesh) meshCount++; });
      assert.ok(meshCount >= 1, `${asset.id} should contain at least one mesh`);

      const box = new THREE.Box3().setFromObject(group);
      assert.ok(Number.isFinite(box.min.x) && Number.isFinite(box.max.x), `${asset.id} bbox.x should be finite`);
      assert.ok(Number.isFinite(box.min.y) && Number.isFinite(box.max.y), `${asset.id} bbox.y should be finite`);
      assert.ok(Number.isFinite(box.min.z) && Number.isFinite(box.max.z), `${asset.id} bbox.z should be finite`);

      const height = box.max.y - box.min.y;
      assert.ok(height >= 0.25 && height <= 1.8, `${asset.id} height ${height} should be within [0.25, 1.8]`);
    });
  }
});

test('loadModel("library:chest", ...) centers the model on x/z and returns a spinner mixer', async () => {
  const { model, mixer } = await loadModel('library:chest', 'unused-name.glb', 0.5);

  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  assert.ok(Math.abs(center.x) < 1e-6, `expected centered x, got ${center.x}`);
  assert.ok(Math.abs(center.z) < 1e-6, `expected centered z, got ${center.z}`);

  assert.equal(typeof mixer.update, 'function');
  const before = model.rotation.y;
  mixer.update(1);
  assert.notEqual(model.rotation.y, before, 'spinner mixer should rotate the model on update()');
});

test('loadModel rejects an unknown library id', async () => {
  await assert.rejects(() => loadModel('library:not-a-real-asset', 'x', 0.5));
});

test('assets/models/duck.glb starts with the glTF binary magic bytes', () => {
  const buf = fs.readFileSync(path.join(REPO_ROOT, 'assets', 'models', 'duck.glb'));
  assert.equal(buf.subarray(0, 4).toString('ascii'), 'glTF');
});
