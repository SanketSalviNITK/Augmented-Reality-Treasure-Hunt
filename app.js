/* ============================================================
   AR Treasure Hunt — Application Logic
   ============================================================ */

import { MindARThree } from 'mindar-image-three';
import { Compiler } from 'mindar-image';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { ColladaLoader } from 'three/addons/loaders/ColladaLoader.js';
import { PLYLoader } from 'three/addons/loaders/PLYLoader.js';

// ─── Constants ───────────────────────────────────────────────
const SUPPORTED_EXTENSIONS = ['.glb', '.gltf', '.fbx', '.obj', '.stl', '.dae', '.ply'];
const ADMIN_PASSWORD = 'admin';

// ─── State ───────────────────────────────────────────────────
const state = {
  isAdmin: false,
  eventName: '',
  markerCount: 1,
  currentMarkerIndex: 0,
  markers: [],
  
  // Cropping
  rawImage: null,
  cropPos: { x: 50, y: 50, w: 300, h: 300 }, 
  
  // AR Session
  mindarThree: null,
  cameraStream: null,
  compiledBlobUrl: null,
  mixers: [],
};

// ─── DOM Elements ─────────────────────────────────────────────
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

const sections = {
  welcome: $('#step-0'),
  adminCount: $('#step-admin-count'),
  config: $('#step-marker-config'),
  crop: $('#step-crop'),
  review: $('#step-review'),
  ar: $('#ar-screen'),
  setup: $('#setup-screen')
};

// ─── Navigation ──────────────────────────────────────────────

function showPanel(panel) {
  $$('.step-panel').forEach(p => p.classList.remove('active'));
  panel.classList.add('active');
}

// ─── Admin Login ─────────────────────────────────────────────

$('#btn-admin-toggle').addEventListener('click', () => {
  state.isAdmin = !state.isAdmin;
  $('#btn-admin-toggle').classList.toggle('active', state.isAdmin);
  $('#login-form').style.display = state.isAdmin ? 'block' : 'none';
  $('#welcome-title').textContent = state.isAdmin ? 'Hunt Creator' : 'AR Treasure Hunt';
  $('#btn-start').textContent = state.isAdmin ? 'Admin Login' : 'Create New Hunt';
});

$('#btn-start').addEventListener('click', () => {
  if (state.isAdmin) {
    if ($('#admin-pass').value === ADMIN_PASSWORD) showPanel(sections.adminCount);
    else $('#login-error').style.display = 'block';
  } else {
    state.markerCount = 1;
    state.eventName = 'Guest Hunt';
    startMarkerConfig();
  }
});

// ─── Event Details ─────────────────────────────────────────────

$('#event-name').addEventListener('input', (e) => {
  state.eventName = e.target.value;
  $('#btn-confirm-count').disabled = state.eventName.trim().length < 3;
});

$('#btn-count-plus').addEventListener('click', () => {
  if (state.markerCount < 10) $('#marker-count').value = ++state.markerCount;
});

$('#btn-count-minus').addEventListener('click', () => {
  if (state.markerCount > 1) $('#marker-count').value = --state.markerCount;
});

$('#btn-confirm-count').addEventListener('click', startMarkerConfig);

// ─── Marker Config Loop ───────────────────────────────────────

function startMarkerConfig() {
  state.currentMarkerIndex = 0;
  state.markers = Array.from({ length: state.markerCount }, () => ({
    type: 'model', scale: 0.5, color: '#a78bfa'
  }));
  updateMarkerStep();
  showPanel(sections.config);
}

function updateMarkerStep() {
  const m = state.markers[state.currentMarkerIndex];
  $('#current-marker-num').textContent = state.currentMarkerIndex + 1;
  $('#total-marker-num').textContent = state.markerCount;
  
  $('#marker-placeholder').style.display = 'none';
  $('#marker-preview-img').style.display = 'none';
  $('#camera-capture-area').style.display = 'none';
  $('#marker-input-container').classList.remove('active');

  if (m.dataUrl) {
    $('#marker-preview-img').src = m.dataUrl;
    $('#marker-preview-img').style.display = 'block';
    $('#marker-input-container').classList.add('active');
  } else {
    $('#marker-placeholder').style.display = 'flex';
  }

  $$('.toggle-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.type === m.type));
  $('#config-model-area').style.display = m.type === 'model' ? 'block' : 'none';
  $('#config-text-area').style.display = m.type === 'text' ? 'block' : 'none';
  $('#model-status').textContent = m.modelFile ? m.modelFile.name : 'Drop 3D Model here';
  $('#scale-control').style.display = m.modelFile ? 'block' : 'none';
  $('#model-scale').value = m.scale;
  $('#scale-value').textContent = m.scale.toFixed(2);
  $('#overlay-text').value = m.text || '';
  
  $$('.color-opt').forEach(opt => opt.classList.toggle('active', opt.dataset.color === m.color));
  checkMarkerComplete();
}

function checkMarkerComplete() {
  const m = state.markers[state.currentMarkerIndex];
  const isComplete = !!m.image && (m.type === 'model' ? !!m.modelFile : !!m.text);
  $('#btn-next-marker').disabled = !isComplete;
  $('#btn-next-marker').textContent = state.currentMarkerIndex === state.markerCount - 1 ? 'Review Setup' : 'Next Marker';
}

// ─── Cropping Logic ───────────────────────────────────────────

function initCrop(img) {
  state.rawImage = img;
  const canvas = $('#crop-canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = 600; canvas.height = 600;
  const scale = Math.min(600 / img.width, 600 / img.height);
  const x = (600 - img.width * scale) / 2;
  const y = (600 - img.height * scale) / 2;
  ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
  state.cropPos = { x: 150, y: 150, w: 300, h: 300 };
  updateCropUI();
  showPanel(sections.crop);
}

function updateCropUI() {
  const box = $('#crop-box');
  box.style.left = `${(state.cropPos.x / 600) * 100}%`;
  box.style.top = `${(state.cropPos.y / 600) * 100}%`;
  box.style.width = `${(state.cropPos.w / 600) * 100}%`;
  box.style.height = `${(state.cropPos.h / 600) * 100}%`;
}

let isDragging = false, isResizing = false, currentHandle = null;
let startX, startY, startPos;

$('#crop-box').addEventListener('mousedown', (e) => {
  if (e.target.classList.contains('crop-handle')) { isResizing = true; currentHandle = e.target.classList[1]; }
  else isDragging = true;
  startX = e.clientX; startY = e.clientY; startPos = { ...state.cropPos };
  e.preventDefault();
});

window.addEventListener('mousemove', (e) => {
  if (!isDragging && !isResizing) return;
  const dx = (e.clientX - startX) * (600 / $('#crop-container').clientWidth);
  const dy = (e.clientY - startY) * (600 / $('#crop-container').clientWidth);
  if (isDragging) {
    state.cropPos.x = Math.max(0, Math.min(600 - startPos.w, startPos.x + dx));
    state.cropPos.y = Math.max(0, Math.min(600 - startPos.h, startPos.y + dy));
  } else if (isResizing) {
    if (currentHandle === 'br') {
      state.cropPos.w = Math.max(50, Math.min(600 - startPos.x, startPos.w + dx));
      state.cropPos.h = Math.max(50, Math.min(600 - startPos.y, startPos.h + dy));
    } else if (currentHandle === 'tl') {
      const newX = Math.max(0, Math.min(startPos.x + startPos.w - 50, startPos.x + dx));
      state.cropPos.w = startPos.w + (startPos.x - newX); state.cropPos.x = newX;
      const newY = Math.max(0, Math.min(startPos.y + startPos.h - 50, startPos.y + dy));
      state.cropPos.h = startPos.h + (startPos.y - newY); state.cropPos.y = newY;
    }
  }
  updateCropUI();
});

window.addEventListener('mouseup', () => { isDragging = isResizing = false; });

$('#btn-confirm-crop').addEventListener('click', () => {
  const canvas = document.createElement('canvas');
  canvas.width = state.cropPos.w; canvas.height = state.cropPos.h;
  canvas.getContext('2d').drawImage($('#crop-canvas'), state.cropPos.x, state.cropPos.y, state.cropPos.w, state.cropPos.h, 0, 0, state.cropPos.w, state.cropPos.h);
  const m = state.markers[state.currentMarkerIndex];
  m.dataUrl = canvas.toDataURL('image/png');
  const img = new Image(); img.src = m.dataUrl;
  img.onload = () => { m.image = img; updateMarkerStep(); showPanel(sections.config); };
});

$('#btn-cancel-crop').addEventListener('click', () => showPanel(sections.config));

// ─── Input Handlers ──────────────────────────────────────────

$('#marker-file-input').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (ev) => { const img = new Image(); img.src = ev.target.result; img.onload = () => initCrop(img); };
    reader.readAsDataURL(file);
  }
});

$('#btn-open-camera').addEventListener('click', async () => {
  try {
    state.cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    $('#camera-feed').srcObject = state.cameraStream;
    $('#marker-placeholder').style.display = 'none';
    $('#marker-preview-img').style.display = 'none';
    $('#camera-capture-area').style.display = 'block';
    $('#marker-input-container').classList.add('active');
  } catch (e) { alert('Camera access denied'); }
});

$('#btn-capture').addEventListener('click', () => {
  const video = $('#camera-feed');
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth; canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);
  const img = new Image(); img.src = canvas.toDataURL('image/png');
  img.onload = () => {
    if (state.cameraStream) state.cameraStream.getTracks().forEach(t => t.stop());
    initCrop(img);
  };
});

$$('.toggle-btn').forEach(btn => btn.addEventListener('click', () => {
  state.markers[state.currentMarkerIndex].type = btn.dataset.type;
  updateMarkerStep();
}));

$('#model-drop-zone').addEventListener('click', () => $('#model-file-input').click());
$('#model-file-input').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    const m = state.markers[state.currentMarkerIndex];
    m.modelFile = file; m.modelUrl = URL.createObjectURL(file);
    updateMarkerStep();
  }
});

$('#model-scale').addEventListener('input', (e) => {
  const val = parseFloat(e.target.value);
  state.markers[state.currentMarkerIndex].scale = val;
  $('#scale-value').textContent = val.toFixed(2);
});

$('#overlay-text').addEventListener('input', () => {
  state.markers[state.currentMarkerIndex].text = $('#overlay-text').value;
  checkMarkerComplete();
});

$$('.color-opt').forEach(opt => opt.addEventListener('click', () => {
  state.markers[state.currentMarkerIndex].color = opt.dataset.color;
  updateMarkerStep();
}));

$('#btn-next-marker').addEventListener('click', () => {
  if (state.currentMarkerIndex < state.markerCount - 1) { state.currentMarkerIndex++; updateMarkerStep(); }
  else { renderReview(); showPanel(sections.review); }
});

$('#btn-back-marker').addEventListener('click', () => {
  if (state.currentMarkerIndex > 0) { state.currentMarkerIndex--; updateMarkerStep(); }
  else showPanel(state.isAdmin ? sections.adminCount : sections.welcome);
});

// ─── Review & AR ─────────────────────────────────────────────

function renderReview() {
  const list = $('#review-list'); list.innerHTML = '';
  state.markers.forEach((m, i) => {
    const item = document.createElement('div');
    item.className = 'review-item';
    item.innerHTML = `
      <img src="${m.dataUrl}" class="review-marker-thumb">
      <div class="review-info">
        <h4>Marker ${i + 1}</h4>
        <p>${m.type === 'model' ? `Model: ${m.modelFile.name}` : `Msg: ${m.text.substring(0, 20)}...`}</p>
      </div>
      <span class="review-type-badge">${m.type.toUpperCase()}</span>
    `;
    list.appendChild(item);
  });
}

$('#btn-back-review').addEventListener('click', () => showPanel(sections.config));
$('#btn-launch-ar').addEventListener('click', startAR);

async function startAR() {
  $('#compile-overlay').style.display = 'flex';
  $('#compile-progress').style.width = '5%';
  try {
    const compiler = new Compiler();
    await compiler.compileImageTargets(state.markers.map(m => m.image), (p) => {
      $('#compile-progress').style.width = `${p * 100}%`;
    });
    const buffer = await compiler.exportData();
    state.compiledBlobUrl = URL.createObjectURL(new Blob([buffer]));
    $('#compile-overlay').style.display = 'none';
    sections.setup.style.display = 'none';
    sections.ar.style.display = 'block';
    $('#ar-event-name').textContent = state.eventName;
    initAR();
  } catch (err) { alert('Compiling failed'); $('#compile-overlay').style.display = 'none'; }
}

async function initAR() {
  const mindarThree = new MindARThree({ container: $('#ar-container'), imageTargetSrc: state.compiledBlobUrl });
  const { renderer, scene, camera } = mindarThree;
  scene.add(new THREE.AmbientLight(0xffffff, 0.8));
  for (let i = 0; i < state.markers.length; i++) {
    const m = state.markers[i], anchor = mindarThree.addAnchor(i);
    if (m.type === 'model') {
      const { model, mixer } = await loadModel(m.modelUrl, m.modelFile.name, m.scale);
      anchor.group.add(model);
      if (mixer) state.mixers.push({ mixer, clock: new THREE.Clock() });
    } else anchor.group.add(createTextCard(m.text, m.color));
    anchor.onTargetFound = () => { $('#tracking-badge').classList.add('found'); $('#tracking-label').textContent = 'Detected'; };
    anchor.onTargetLost = () => { $('#tracking-badge').classList.remove('found'); $('#tracking-label').textContent = 'Searching...'; };
  }
  await mindarThree.start();
  renderer.setAnimationLoop(() => {
    state.mixers.forEach(m => m.mixer.update(m.clock.getDelta()));
    renderer.render(scene, camera);
  });
}

function createTextCard(text, color) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = 512; canvas.height = 256;
  ctx.fillStyle = color; roundRect(ctx, 0, 0, 512, 256, 40, true);
  ctx.fillStyle = '#ffffff'; ctx.font = 'bold 32px Inter, sans-serif'; ctx.textAlign = 'center';
  text.split('\n').forEach((l, i) => ctx.fillText(l, 256, 128 + (i - 0.5) * 40));
  const tex = new THREE.CanvasTexture(canvas);
  return new THREE.Mesh(new THREE.PlaneGeometry(1, 0.5), new THREE.MeshBasicMaterial({ map: tex, transparent: true }));
}

function roundRect(ctx, x, y, w, h, r, f) {
  ctx.beginPath(); ctx.moveTo(x+r, y); ctx.lineTo(x+w-r, y); ctx.quadraticCurveTo(x+w, y, x+w, y+r);
  ctx.lineTo(x+w, y+h-r); ctx.quadraticCurveTo(x+w, y+h, x+w-r, y+h); ctx.lineTo(x+r, y+h);
  ctx.quadraticCurveTo(x, y+h, x, y+h-r); ctx.lineTo(x, y+r); ctx.quadraticCurveTo(x, y, x+r, y);
  ctx.closePath(); if (f) ctx.fill();
}

async function loadModel(url, name, scale) {
  const ext = name.toLowerCase().split('.').pop();
  const loader = ext === 'glb' || ext === 'gltf' ? new GLTFLoader() : 
                 ext === 'fbx' ? new FBXLoader() :
                 ext === 'obj' ? new OBJLoader() :
                 ext === 'stl' ? new STLLoader() :
                 ext === 'dae' ? new ColladaLoader() : new PLYLoader();
  const data = await new Promise((res, rej) => loader.load(url, res, undefined, rej));
  let model, mixer;
  if (ext === 'glb' || ext === 'gltf' || ext === 'fbx') {
    model = data.scene || data;
    if (data.animations?.length) { mixer = new THREE.AnimationMixer(model); data.animations.forEach(c => mixer.clipAction(c).play()); }
  } else if (ext === 'stl' || ext === 'ply') {
    model = new THREE.Group(); model.add(new THREE.Mesh(data, new THREE.MeshStandardMaterial({ color: 0xa78bfa })));
  } else model = data.scene || data;
  model.scale.set(scale, scale, scale);
  const box = new THREE.Box3().setFromObject(model), center = box.getCenter(new THREE.Vector3());
  model.position.sub(center); model.position.y += (box.max.y - box.min.y) * scale * 0.5;
  return { model, mixer };
}

$('#btn-stop-ar').addEventListener('click', () => {
  if (state.mindarThree) state.mindarThree.stop();
  document.querySelectorAll('video').forEach(v => { if (v.srcObject) { v.srcObject.getTracks().forEach(t => t.stop()); v.srcObject = null; } });
  sections.ar.style.display = 'none'; sections.setup.style.display = 'block'; 
  showPanel(state.isAdmin ? sections.adminCount : sections.welcome);
});
