/* ============================================================
   AR Treasure Hunt — Main Entry Point
   ============================================================ */

import { state, ADMIN_PASSWORD } from './js/state.js';
import { $, $$, sections, showPanel } from './js/utils.js';
import { initCrop, setupCropperEvents } from './js/cropper.js';
import { startAR, stopAR } from './js/ar-engine.js';

import * as THREE from 'three';
import { saveEventToDB, getEventsFromDB, deleteEventFromDB, updateEventInDB } from './js/db.js';

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

$('#btn-admin-login').addEventListener('click', async () => {
  if ($('#admin-pass').value === ADMIN_PASSWORD) {
    // Show spinner if we wanted, but fetching should be quick
    $('#btn-admin-login').innerHTML = '<div class="spinner" style="width:18px;height:18px;border-width:2px;border-top-color:#fff;margin:0 auto;"></div>';
    state.events = await getEventsFromDB();
    $('#btn-admin-login').innerHTML = 'Admin Login';
    renderAdminDashboard();
    showPanel(sections.adminDashboard);
  } else {
    $('#login-error').style.display = 'block';
  }
});

$('#btn-create-event').addEventListener('click', () => {
  state.eventName = '';
  state.markerCount = 1;
  $('#event-name').value = '';
  $('#marker-count').value = 1;
  $('#btn-confirm-count').disabled = true;
  showPanel(sections.adminCount);
});

$('#btn-player-login').addEventListener('click', async () => {
  const name = $('#player-name').value.trim();
  const age = $('#player-age').value.trim();
  
  if (!name || !age) {
    $('#player-error').textContent = 'Please enter Name and Age.';
    $('#player-error').style.display = 'block';
    return;
  }
  
  $('#btn-player-login').innerHTML = '<div class="spinner" style="width:18px;height:18px;border-width:2px;border-top-color:#fff;margin:0 auto;"></div>';
  state.events = await getEventsFromDB();
  $('#btn-player-login').innerHTML = 'Login';
  
  
  if (!state.events || state.events.length === 0) {
    $('#player-error').textContent = 'No active games found. Admin must create one!';
    $('#player-error').style.display = 'block';
    return;
  }
  
  $('#player-error').style.display = 'none';
  state.player = { name, age };
  renderPlayerDashboard();
  showPanel(sections.playerDashboard);
});

$('#btn-player-back').addEventListener('click', () => {
  showPanel(sections.welcome);
});

// ─── Dashboards ──────────────────────────────────────────────
function renderAdminDashboard() {
  const list = $('#admin-event-list');
  list.innerHTML = '';
  
  if (state.events.length === 0) {
    list.innerHTML = '<p style="color:var(--text-secondary); text-align:center; font-size:0.85rem; padding: 20px;">No events created yet.</p>';
    return;
  }
  
  state.events.forEach((ev, index) => {
    let playersHtml = 'No players yet';
    if (ev.players && ev.players.length > 0) {
      playersHtml = ev.players.map(p => {
        const markersStr = (p.detectedMarkers && p.detectedMarkers.length > 0) 
                           ? `[${p.detectedMarkers.join(', ')}]` 
                           : 'None';
        return `&bull; ${p.name} <span style="opacity:0.75; font-size: 0.7rem;">(Found: ${markersStr})</span>`;
      }).join('<br>');
    }

    const card = document.createElement('div');
    card.className = 'review-item';
    card.innerHTML = `
      <div class="review-info" style="flex: 1;">
        <h4>${ev.name}</h4>
        <p>${ev.markers.length} markers configured</p>
        <div style="margin-top: 8px; font-size: 0.75rem; color: var(--accent-cyan); font-weight: 500; line-height: 1.4;">
          <strong>Players:</strong><br>
          ${playersHtml}
        </div>
      </div>
      <button class="btn btn-ghost btn-sm" onclick="window.deleteEvent(${index})">Delete</button>
    `;
    list.appendChild(card);
  });
}

window.deleteEvent = async (index) => {
  const ev = state.events[index];
  if (ev.id) await deleteEventFromDB(ev.id);
  state.events.splice(index, 1);
  renderAdminDashboard();
};

function renderPlayerDashboard() {
  const list = $('#player-event-list');
  list.innerHTML = '';
  $('#player-greeting').textContent = `Welcome, ${state.player.name}!`;
  
  state.events.forEach((ev, index) => {
    const card = document.createElement('div');
    card.className = 'review-item';
    card.innerHTML = `
      <div class="review-info">
        <h4>${ev.name}</h4>
        <p>Treasure Hunt</p>
      </div>
      <button class="btn btn-launch btn-sm" onclick="window.joinEvent(${index})">Join</button>
    `;
    list.appendChild(card);
  });
}

window.joinEvent = async (index) => {
  const ev = state.events[index];
  
  if (!ev.players) ev.players = [];
  let playerRecord = ev.players.find(p => p.name === state.player.name);
  if (!playerRecord) {
    playerRecord = { name: state.player.name, age: state.player.age, detectedMarkers: [] };
    ev.players.push(playerRecord);
    // Sync join to DB
    if (ev.id) await updateEventInDB(ev.id, ev);
  }
  
  state.activePlayerRecord = playerRecord;
  state.activeEventId = ev.id;
  
  state.eventName = ev.name;
  state.markers = ev.markers;
  startAR();
};

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

$('#btn-test-ar').addEventListener('click', startAR);

$('#btn-stop-ar').addEventListener('click', () => {
  stopAR();
  sections.ar.style.display = 'none'; 
  sections.setup.style.display = ''; 
  
  if (state.isAdmin) {
    // If admin is just testing and exits, go back to review so they can edit or save
    showPanel(sections.review);
  } else {
    // Players go to feedback
    showPanel(sections.feedback);
  }
});

$('#btn-ar-save').addEventListener('click', async () => {
  $('#btn-ar-save').textContent = 'Saving...';
  
  try {
    // Save the event to DB (uploads files)
    const savedData = await saveEventToDB(state.eventName, state.markers);
    if (savedData) {
      state.events.unshift({
        id: savedData.id,
        ...savedData.data
      });
    } else {
      alert("Failed to save to database. Ensure RLS is disabled on the 'events' table.");
    }
  } catch (err) {
    console.error(err);
    alert("Upload failed! Please ensure your 'ar-assets' bucket has an RLS policy allowing INSERTs.");
  }
  
  $('#btn-ar-save').textContent = 'Save Event';
  
  stopAR();
  sections.ar.style.display = 'none'; 
  sections.setup.style.display = ''; 
  
  renderAdminDashboard();
  showPanel(sections.adminDashboard);
});

$('#btn-admin-logout').addEventListener('click', () => {
  state.isAdmin = false;
  isPlayerMode = false;
  $('#btn-admin-toggle').classList.remove('active');
  $('#btn-player-toggle').classList.remove('active');
  $('#login-form').style.display = 'none';
  $('#player-login-form').style.display = 'none';
  $('#welcome-info').style.display = 'block';
  $('#welcome-title').textContent = 'AR Treasure Hunt';
  showPanel(sections.welcome);
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
