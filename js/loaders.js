/* ============================================================
   3D & Asset Loaders
   ============================================================ */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { ColladaLoader } from 'three/addons/loaders/ColladaLoader.js';
import { PLYLoader } from 'three/addons/loaders/PLYLoader.js';
import { roundRect } from './utils.js';
import { isLibraryUrl, libraryIdFromUrl, getLibraryAsset } from './asset-library.js';

// Scale the model and rest it centred on top of the marker plane.
function finalizeModel(model, scale) {
  model.scale.set(scale, scale, scale);
  const box = new THREE.Box3().setFromObject(model);
  const center = box.getCenter(new THREE.Vector3());
  model.position.sub(center);
  model.position.y += (box.max.y - box.min.y) * scale * 0.5;
  return model;
}

// Gentle idle spin for library models. Duck-typed as a mixer so the
// AR engine's existing `mixer.update(delta)` loop drives it unchanged.
function makeSpinner(model) {
  return { update: (delta) => { model.rotation.y += delta * 0.8; } };
}

async function loadLibraryModel(id, scale) {
  const asset = getLibraryAsset(id);
  if (!asset) throw new Error(`Unknown library asset: ${id}`);

  if (asset.kind === 'procedural') {
    const model = finalizeModel(asset.build(), scale);
    return { model, mixer: makeSpinner(model) };
  }

  // File-based library entry (bundled with the app)
  const data = await new Promise((res, rej) => new GLTFLoader().load(asset.url, res, undefined, rej));
  const model = finalizeModel(data.scene || data, scale);
  let mixer;
  if (data.animations?.length) {
    mixer = new THREE.AnimationMixer(model);
    data.animations.forEach(c => mixer.clipAction(c).play());
  } else {
    mixer = makeSpinner(model);
  }
  return { model, mixer };
}

export async function loadModel(url, name, scale) {
  if (isLibraryUrl(url)) {
    return loadLibraryModel(libraryIdFromUrl(url), scale);
  }

  const ext = name.toLowerCase().split('.').pop();
  const loader = getLoaderForExt(ext);

  const data = await new Promise((res, rej) => loader.load(url, res, undefined, rej));
  let model, mixer;

  if (ext === 'glb' || ext === 'gltf' || ext === 'fbx') {
    model = data.scene || data;
    if (data.animations?.length) {
      mixer = new THREE.AnimationMixer(model);
      data.animations.forEach(c => mixer.clipAction(c).play());
    }
  } else if (ext === 'stl' || ext === 'ply') {
    model = new THREE.Group();
    model.add(new THREE.Mesh(data, new THREE.MeshStandardMaterial({ color: 0xa78bfa })));
  } else {
    model = data.scene || data;
  }

  finalizeModel(model, scale);
  return { model, mixer };
}

function getLoaderForExt(ext) {
  switch(ext) {
    case 'glb':
    case 'gltf': return new GLTFLoader();
    case 'fbx': return new FBXLoader();
    case 'obj': return new OBJLoader();
    case 'stl': return new STLLoader();
    case 'dae': return new ColladaLoader();
    case 'ply': return new PLYLoader();
    default: return new GLTFLoader();
  }
}

export function createTextCard(text, color) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = 512; canvas.height = 256;
  ctx.fillStyle = color; 
  roundRect(ctx, 0, 0, 512, 256, 40, true);
  ctx.fillStyle = '#ffffff'; 
  ctx.font = 'bold 32px Inter, sans-serif'; 
  ctx.textAlign = 'center';
  text.split('\n').forEach((l, i) => ctx.fillText(l, 256, 128 + (i - 0.5) * 40));
  const tex = new THREE.CanvasTexture(canvas);
  return new THREE.Mesh(new THREE.PlaneGeometry(1, 0.5), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
}
