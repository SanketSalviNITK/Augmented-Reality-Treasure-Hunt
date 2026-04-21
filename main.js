/* ============================================================
   AR Treasure Hunt — Main Entry Point
   ============================================================ */

import { state, ADMIN_PASSWORD } from './js/state.js';
import { $, $$, sections, showPanel } from './js/utils.js';
import { initCrop, setupCropperEvents } from './js/cropper.js';
import { startAR, stopAR } from './js/ar-engine.js';

import * as THREE from 'three';

// ─── Initialization ──────────────────────────────────────────
setupCropperEvents();
initWelcomeAnimation();

// ─── Login Toggles ─────────────────────────────────────────────
let isPlayerMode = false;

$('#btn-admin-toggle').addEventListener('click', () => {
  state.isAdmin = !state.isAdmin;
  isPlayerMode = false;
  
  $('#btn-admin-toggle').classList.toggle('active', state.isAdmin);
  $('#btn-player-toggle').classList.remove('active');
  
  $('#login-form').style.display = state.isAdmin ? 'block' : 'none';
  $('#player-login-form').style.display = 'none';
  
  $('#welcome-info').style.display = (state.isAdmin || isPlayerMode) ? 'none' : 'block';
  $('#welcome-title').textContent = state.isAdmin ? 'Hunt Creator Studio' : 'AR Treasure Hunt';
});

$('#btn-player-toggle').addEventListener('click', () => {
  isPlayerMode = !isPlayerMode;
  state.isAdmin = false;
  
  $('#btn-player-toggle').classList.toggle('active', isPlayerMode);
  $('#btn-admin-toggle').classList.remove('active');
  
  $('#player-login-form').style.display = isPlayerMode ? 'block' : 'none';
  $('#login-form').style.display = 'none';
  
  $('#welcome-info').style.display = (state.isAdmin || isPlayerMode) ? 'none' : 'block';
  $('#welcome-title').textContent = isPlayerMode ? 'Player Login' : 'AR Treasure Hunt';
});

$('#btn-admin-login').addEventListener('click', () => {
  if ($('#admin-pass').value === ADMIN_PASSWORD) {
    showPanel(sections.adminCount);
  } else {
    $('#login-error').style.display = 'block';
  }
});

$('#btn-player-launch').addEventListener('click', () => {
  const name = $('#player-name').value.trim();
  const age = $('#player-age').value.trim();
  
  if (!name || !age) {
    $('#player-error').textContent = 'Please enter Name and Age.';
    $('#player-error').style.display = 'block';
    return;
  }
  
  // Prevent player from launching if admin hasn't fully configured at least the first marker
  const firstMarker = state.markers && state.markers.length > 0 ? state.markers[0] : null;
  const isMarkerComplete = firstMarker && firstMarker.image && 
                           ((firstMarker.type === 'model' && firstMarker.modelFile) || 
                            (firstMarker.type === 'text' && firstMarker.text));

  if (!isMarkerComplete) {
    $('#player-error').textContent = 'Admin must configure the game first!';
    $('#player-error').style.display = 'block';
    return;
  }
  
  $('#player-error').style.display = 'none';
  state.player = { name, age };
  startAR();
});

function initWelcomeAnimation() {
  const container = $('#welcome-3d-container');
  if (!container) return;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.z = 4;

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setSize(220, 220);
  renderer.setPixelRatio(window.devicePixelRatio);
  container.appendChild(renderer.domElement);

  const geometry = new THREE.IcosahedronGeometry(1.2, 0);
  const material = new THREE.MeshPhysicalMaterial({
    color: 0xa78bfa,
    metalness: 0.3,
    roughness: 0.2,
    wireframe: true,
    transparent: true,
    opacity: 0.8
  });
  
  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);
  const dirLight = new THREE.DirectionalLight(0xffffff, 1);
  dirLight.position.set(5, 5, 5);
  scene.add(dirLight);

  function animate() {
    requestAnimationFrame(animate);
    mesh.rotation.x += 0.005;
    mesh.rotation.y += 0.01;
    renderer.render(scene, camera);
  }
  animate();
}

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

// ─── Marker Setup ─────────────────────────────────────────────
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

// ─── Input Handlers ──────────────────────────────────────────
$('#marker-file-input').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.src = ev.target.result;
      img.onload = () => initCrop(img, (croppedUrl) => {
        const m = state.markers[state.currentMarkerIndex];
        m.dataUrl = croppedUrl;
        const croppedImg = new Image();
        croppedImg.src = croppedUrl;
        croppedImg.onload = () => { m.image = croppedImg; updateMarkerStep(); showPanel(sections.config); };
      });
    };
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
  canvas.width = video.videoWidth; 
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);
  
  const img = new Image();
  img.src = canvas.toDataURL('image/png');
  img.onload = () => {
    // Stop camera
    if (state.cameraStream) {
      state.cameraStream.getTracks().forEach(t => t.stop());
      state.cameraStream = null;
    }
    
    // Switch to crop view
    initCrop(img, (croppedUrl) => {
      const m = state.markers[state.currentMarkerIndex];
      m.dataUrl = croppedUrl;
      const croppedImg = new Image();
      croppedImg.src = croppedUrl;
      croppedImg.onload = () => { 
        m.image = croppedImg; 
        updateMarkerStep(); 
        showPanel(sections.config); 
      };
    });
  };
});

// Helper for recapture
$('#btn-cancel-crop').addEventListener('click', () => {
  showPanel(sections.config);
  // If we came from camera, maybe we want to reopen it
  // For now, just going back is fine as they can click "Camera" again
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
    m.modelFile = file; 
    m.modelUrl = URL.createObjectURL(file);
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

// ─── Step Navigation ──────────────────────────────────────────
$('#btn-next-marker').addEventListener('click', () => {
  if (state.currentMarkerIndex < state.markerCount - 1) { 
    state.currentMarkerIndex++; 
    updateMarkerStep(); 
  } else { 
    renderReview(); 
    showPanel(sections.review); 
  }
});

$('#btn-back-marker').addEventListener('click', () => {
  if (state.currentMarkerIndex > 0) { 
    state.currentMarkerIndex--; 
    updateMarkerStep(); 
  } else showPanel(state.isAdmin ? sections.adminCount : sections.welcome);
});

$('#btn-cancel-crop').addEventListener('click', () => showPanel(sections.config));

// ─── Review & Launch ──────────────────────────────────────────
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

$('#btn-stop-ar').addEventListener('click', () => {
  stopAR();
  sections.ar.style.display = 'none'; 
  sections.setup.style.display = ''; // Let it fall back to 'flex' defined in CSS
  showPanel(sections.feedback);
});

$('#btn-submit-feedback').addEventListener('click', () => {
  const selected = document.querySelector('input[name="experience"]:checked');
  if (selected) {
    console.log("Feedback rating:", selected.value);
    selected.checked = false; // Reset for next time
  }
  
  // Reset admin state and restore welcome UI
  state.isAdmin = false;
  isPlayerMode = false;
  $('#btn-admin-toggle').classList.remove('active');
  $('#btn-player-toggle').classList.remove('active');
  $('#login-form').style.display = 'none';
  $('#player-login-form').style.display = 'none';
  $('#welcome-info').style.display = 'block';
  $('#welcome-title').textContent = 'AR Treasure Hunt';
  
  // Always return to the welcome landing page
  showPanel(sections.welcome);
});
