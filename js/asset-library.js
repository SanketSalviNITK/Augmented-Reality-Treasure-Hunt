/* ============================================================
   Built-in 3D Asset Library
   ------------------------------------------------------------
   Ready-to-use reward models a creator can pick without sourcing
   or uploading their own files. Most are built procedurally from
   Three.js primitives (no downloads, no licensing constraints,
   zero storage cost); file-based entries reference models bundled
   under assets/models/.

   A library selection is stored as modelUrl = "library:<id>" in
   the marker/event data. loaders.js resolves that scheme both for
   the creator's AR test and for hunters joining the event.
   ============================================================ */

import * as THREE from 'three';

export const LIBRARY_SCHEME = 'library:';

export function isLibraryUrl(url) {
  return typeof url === 'string' && url.startsWith(LIBRARY_SCHEME);
}

export function libraryIdFromUrl(url) {
  return isLibraryUrl(url) ? url.slice(LIBRARY_SCHEME.length) : null;
}

export function getLibraryAsset(id) {
  return ASSET_LIBRARY.find(a => a.id === id) || null;
}

// ─── Material helpers ────────────────────────────────────────

const mat = (color, opts = {}) => new THREE.MeshStandardMaterial({
  color, roughness: 0.4, metalness: 0.15, ...opts
});
const goldMat = (opts = {}) => mat(0xd4a017, {
  metalness: 0.75, roughness: 0.25, emissive: 0x3d2c00, emissiveIntensity: 0.35, ...opts
});
const add = (group, geometry, material, { p = [0, 0, 0], r = [0, 0, 0], s = null } = {}) => {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...p);
  mesh.rotation.set(...r);
  if (s) mesh.scale.set(...s);
  group.add(mesh);
  return mesh;
};

// ─── Procedural builders (each returns a THREE.Group ~1 unit tall) ──

function buildChest() {
  const g = new THREE.Group();
  const wood = mat(0x8b5a2b, { roughness: 0.7 });
  const woodDark = mat(0x6b4320, { roughness: 0.8 });
  add(g, new THREE.BoxGeometry(1, 0.5, 0.65), wood, { p: [0, 0.25, 0] });
  add(g, new THREE.CylinderGeometry(0.325, 0.325, 1, 24, 1, false, 0, Math.PI), woodDark,
    { p: [0, 0.5, 0], r: [0, 0, Math.PI / 2] });
  // Gold bands + lock
  [-0.32, 0.32].forEach(x => {
    add(g, new THREE.BoxGeometry(0.08, 0.52, 0.67), goldMat(), { p: [x, 0.25, 0] });
    add(g, new THREE.CylinderGeometry(0.335, 0.335, 0.08, 24, 1, false, 0, Math.PI), goldMat(),
      { p: [x, 0.5, 0], r: [0, 0, Math.PI / 2] });
  });
  add(g, new THREE.BoxGeometry(0.16, 0.2, 0.06), goldMat(), { p: [0, 0.42, 0.34] });
  return g;
}

function buildCoin() {
  const g = new THREE.Group();
  add(g, new THREE.CylinderGeometry(0.5, 0.5, 0.09, 40), goldMat(), { p: [0, 0.5, 0], r: [Math.PI / 2, 0, 0] });
  add(g, new THREE.TorusGeometry(0.44, 0.05, 12, 40), goldMat({ color: 0xb8860b }), { p: [0, 0.5, 0] });
  add(g, new THREE.CylinderGeometry(0.26, 0.26, 0.12, 5), goldMat({ color: 0xf0c420 }), { p: [0, 0.5, 0], r: [Math.PI / 2, 0, 0] });
  return g;
}

function buildGem() {
  const g = new THREE.Group();
  add(g, new THREE.OctahedronGeometry(0.5, 0), mat(0x8b5cf6, {
    metalness: 0.3, roughness: 0.1, emissive: 0x4c1d95, emissiveIntensity: 0.5,
    transparent: true, opacity: 0.92
  }), { p: [0, 0.55, 0], s: [1, 1.35, 1] });
  return g;
}

function buildTrophy() {
  const g = new THREE.Group();
  add(g, new THREE.CylinderGeometry(0.32, 0.3, 0.1, 24), mat(0x3f3f46, { metalness: 0.4 }), { p: [0, 0.05, 0] });
  add(g, new THREE.CylinderGeometry(0.07, 0.09, 0.28, 16), goldMat(), { p: [0, 0.24, 0] });
  add(g, new THREE.CylinderGeometry(0.34, 0.16, 0.42, 24), goldMat(), { p: [0, 0.6, 0] });
  add(g, new THREE.TorusGeometry(0.15, 0.035, 10, 24), goldMat(), { p: [-0.36, 0.63, 0] });
  add(g, new THREE.TorusGeometry(0.15, 0.035, 10, 24), goldMat(), { p: [0.36, 0.63, 0] });
  add(g, new THREE.SphereGeometry(0.09, 16, 12), goldMat({ color: 0xf0c420 }), { p: [0, 0.87, 0] });
  return g;
}

function buildKey() {
  const g = new THREE.Group();
  add(g, new THREE.TorusGeometry(0.2, 0.06, 12, 28), goldMat(), { p: [0, 0.75, 0] });
  add(g, new THREE.CylinderGeometry(0.05, 0.05, 0.6, 12), goldMat(), { p: [0, 0.28, 0] });
  add(g, new THREE.BoxGeometry(0.18, 0.06, 0.06), goldMat(), { p: [0.08, 0.06, 0] });
  add(g, new THREE.BoxGeometry(0.13, 0.06, 0.06), goldMat(), { p: [0.06, 0.18, 0] });
  return g;
}

function buildCrown() {
  const g = new THREE.Group();
  add(g, new THREE.CylinderGeometry(0.42, 0.42, 0.3, 28), goldMat(), { p: [0, 0.15, 0] });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    add(g, new THREE.ConeGeometry(0.1, 0.3, 8), goldMat(), { p: [Math.cos(a) * 0.34, 0.42, Math.sin(a) * 0.34] });
    add(g, new THREE.SphereGeometry(0.045, 10, 8),
      mat(i % 2 ? 0xdc2626 : 0x2563eb, { emissive: i % 2 ? 0x7f1d1d : 0x1e3a8a, emissiveIntensity: 0.6 }),
      { p: [Math.cos(a) * 0.43, 0.15, Math.sin(a) * 0.43] });
  }
  return g;
}

function buildStar() {
  const shape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? 0.5 : 0.21;
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    i === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y);
  }
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.14, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2 });
  const g = new THREE.Group();
  add(g, geo, mat(0xfbbf24, { emissive: 0x92600a, emissiveIntensity: 0.5, metalness: 0.4, roughness: 0.3 }), { p: [0, 0.55, -0.07] });
  return g;
}

function buildRocket() {
  const g = new THREE.Group();
  add(g, new THREE.CylinderGeometry(0.2, 0.24, 0.55, 20), mat(0xe4e4e7, { metalness: 0.3 }), { p: [0, 0.5, 0] });
  add(g, new THREE.ConeGeometry(0.2, 0.32, 20), mat(0xdc2626), { p: [0, 0.94, 0] });
  add(g, new THREE.SphereGeometry(0.085, 14, 10), mat(0x38bdf8, { emissive: 0x0c4a6e, emissiveIntensity: 0.6 }), { p: [0, 0.58, 0.19] });
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    add(g, new THREE.BoxGeometry(0.06, 0.28, 0.22), mat(0xdc2626),
      { p: [Math.cos(a) * 0.24, 0.18, Math.sin(a) * 0.24], r: [0, -a, 0] });
  }
  add(g, new THREE.ConeGeometry(0.13, 0.28, 14), mat(0xf97316, { emissive: 0xea580c, emissiveIntensity: 0.9 }), { p: [0, 0.05, 0], r: [Math.PI, 0, 0] });
  return g;
}

function buildGhost() {
  const g = new THREE.Group();
  const body = mat(0xf4f4f5, { roughness: 0.55, transparent: true, opacity: 0.94 });
  add(g, new THREE.SphereGeometry(0.36, 22, 16), body, { p: [0, 0.62, 0] });
  add(g, new THREE.CylinderGeometry(0.36, 0.42, 0.45, 22), body, { p: [0, 0.32, 0] });
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    add(g, new THREE.SphereGeometry(0.13, 12, 10), body, { p: [Math.cos(a) * 0.3, 0.1, Math.sin(a) * 0.3] });
  }
  add(g, new THREE.SphereGeometry(0.055, 10, 8), mat(0x18181b), { p: [-0.12, 0.68, 0.3] });
  add(g, new THREE.SphereGeometry(0.055, 10, 8), mat(0x18181b), { p: [0.12, 0.68, 0.3] });
  return g;
}

function buildGift() {
  const g = new THREE.Group();
  add(g, new THREE.BoxGeometry(0.7, 0.6, 0.7), mat(0xdc2626, { roughness: 0.5 }), { p: [0, 0.3, 0] });
  add(g, new THREE.BoxGeometry(0.72, 0.62, 0.14), mat(0x10b981), { p: [0, 0.3, 0] });
  add(g, new THREE.BoxGeometry(0.14, 0.62, 0.72), mat(0x10b981), { p: [0, 0.3, 0] });
  add(g, new THREE.TorusGeometry(0.09, 0.035, 10, 20), mat(0x10b981), { p: [-0.09, 0.66, 0], r: [0, 0, 0.5] });
  add(g, new THREE.TorusGeometry(0.09, 0.035, 10, 20), mat(0x10b981), { p: [0.09, 0.66, 0], r: [0, 0, -0.5] });
  return g;
}

// ─── The library catalogue ───────────────────────────────────
// kind: 'procedural' → build() returns a Group
// kind: 'file'       → url points to a bundled model under assets/

export const ASSET_LIBRARY = [
  { id: 'chest',  name: 'Treasure Chest', icon: '🧰', kind: 'procedural', build: buildChest },
  { id: 'coin',   name: 'Gold Coin',      icon: '🪙', kind: 'procedural', build: buildCoin },
  { id: 'gem',    name: 'Crystal Gem',    icon: '💎', kind: 'procedural', build: buildGem },
  { id: 'trophy', name: 'Trophy',         icon: '🏆', kind: 'procedural', build: buildTrophy },
  { id: 'key',    name: 'Golden Key',     icon: '🗝️', kind: 'procedural', build: buildKey },
  { id: 'crown',  name: 'Royal Crown',    icon: '👑', kind: 'procedural', build: buildCrown },
  { id: 'star',   name: 'Star',           icon: '⭐', kind: 'procedural', build: buildStar },
  { id: 'rocket', name: 'Rocket',         icon: '🚀', kind: 'procedural', build: buildRocket },
  { id: 'ghost',  name: 'Ghost',          icon: '👻', kind: 'procedural', build: buildGhost },
  { id: 'gift',   name: 'Gift Box',       icon: '🎁', kind: 'procedural', build: buildGift },
  // Khronos glTF sample duck, bundled with the repo
  { id: 'duck',   name: 'Rubber Duck',    icon: '🦆', kind: 'file', url: 'assets/models/duck.glb' },
];
