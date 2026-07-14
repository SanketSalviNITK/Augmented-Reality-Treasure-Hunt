/* ============================================================
   AR Treasure Hunt — Main Entry Point
   ============================================================ */

import { state, ADMIN_PASSWORD } from './js/state.js';
import { $, $$, sections, showPanel, escapeHtml } from './js/utils.js';
import { initCrop, setupCropperEvents } from './js/cropper.js';
import { startAR, stopAR, pauseAR, resumeAR, captureARImage } from './js/ar-engine.js';

import * as THREE from 'three';
import { saveEventToDB, getEventsFromDB, deleteEventFromDB, updateEventInDB, saveFeedbackToDB, getFeedbackFromDB, uploadBase64Image, logTelemetry, getTelemetryRows } from './js/db.js';
import { initLandingAnimation, stopLandingAnimation } from './js/landing.js';
import { parseDeepLinkEventId, buildEventShareLink, resolveBackAction } from './js/navigation.js';
import { ASSET_LIBRARY, LIBRARY_SCHEME, isLibraryUrl } from './js/asset-library.js';
// Removed static GEMINI_API_KEY import for global deployment security

// Deep link: a shareable ?event=<id> (or #/join/<id>) that drops a hunter
// straight into a specific quest, skipping the portal + browse steps.
const deepLinkEventId = parseDeepLinkEventId(window.location.search, window.location.hash);

// ─── Initialization ──────────────────────────────────────────
setupCropperEvents();
// Removed automatic initLandingAnimation() - handled by loading logic below

// ─── Audio Manager ──────────────────────────────────────────
const bgMusic = $('#bg-music');
const btnMusic = $('#btn-music-toggle');
const iconOn = $('#icon-sound-on');
const iconOff = $('#icon-sound-off');
let isMusicPlaying = false;

bgMusic.volume = 0.3;

function toggleMusic() {
  if (isMusicPlaying) {
    bgMusic.pause();
    iconOn.style.display = 'none';
    iconOff.style.display = 'block';
  } else {
    bgMusic.play().catch(e => console.log('Audio blocked:', e));
    iconOn.style.display = 'block';
    iconOff.style.display = 'none';
  }
  isMusicPlaying = !isMusicPlaying;
}

btnMusic.addEventListener('click', toggleMusic);

// Custom Event Theming Logic
window.applyTheme = (themeStr) => {
  const root = document.documentElement;
  if (themeStr === 'cyberpunk') {
    root.style.setProperty('--bg-base', '#09090b');
    root.style.setProperty('--bg-panel', '#18181b');
    root.style.setProperty('--accent-cyan', '#22d3ee');
    root.style.setProperty('--accent-purple', '#ec4899'); // Pink
    root.style.setProperty('--accent-emerald', '#06b6d4'); // Cyan
  } else if (themeStr === 'minimalist') {
    root.style.setProperty('--bg-base', '#ffffff');
    root.style.setProperty('--bg-panel', '#f4f4f5');
    root.style.setProperty('--text-main', '#18181b');
    root.style.setProperty('--text-muted', '#71717a');
    root.style.setProperty('--accent-cyan', '#d97706'); // Gold
    root.style.setProperty('--accent-purple', '#fbbf24'); // Light Gold
    root.style.setProperty('--accent-emerald', '#10b981');
  } else {
    // Reset to Standard
    root.style.removeProperty('--bg-base');
    root.style.removeProperty('--bg-panel');
    root.style.removeProperty('--text-main');
    root.style.removeProperty('--text-muted');
    root.style.removeProperty('--accent-cyan');
    root.style.removeProperty('--accent-purple');
    root.style.removeProperty('--accent-emerald');
  }
};

// ─── Initial Loading & System Config ──────────────────────────
const loadingOverlay = $('#loading-overlay');
const loadingProgress = $('#loading-progress');
const btnStartExp = $('#btn-start-experience');
const landingRoot = $('#landing-root');

// Initial System Check
async function initSystem() {
  console.log("Checking system configuration...");
  
  // 1. Check for dynamic config in state
  let { SUPABASE_URL, SUPABASE_ANON_KEY } = state.config;

  // 2. Try fetching from Vercel API (if deployed)
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.log("Attempting to fetch remote config from Vercel...");
    try {
      const response = await fetch('/api/get-config');
      if (response.ok) {
        const remoteConfig = await response.json();
        console.log("✅ Configuration successfully loaded from Vercel API.");
        state.config = { ...state.config, ...remoteConfig };
        SUPABASE_URL = remoteConfig.SUPABASE_URL;
      } else {
        console.warn(`⚠️ Vercel API returned status: ${response.status}. Falling back to other methods.`);
      }
    } catch (e) {
      console.log("ℹ️ Not running on Vercel or API route not found. Error:", e.message);
    }
  }

  // 3. Check localStorage (Persistence for manual setup)
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    const savedUrl = localStorage.getItem('AR_SUPABASE_URL');
    const savedKey = localStorage.getItem('AR_SUPABASE_KEY');
    const savedGemini = localStorage.getItem('AR_GEMINI_KEY');
    
    if (savedUrl && savedKey) {
      console.log("Configuration loaded from browser storage.");
      state.config.SUPABASE_URL = savedUrl;
      state.config.SUPABASE_ANON_KEY = savedKey;
      state.config.GEMINI_API_KEY = savedGemini || '';
      SUPABASE_URL = savedUrl;
    }
  }

  // 4. Fallback: Check if we can import from config.js (local dev)
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    try {
      const config = await import('./config.js');
      if (config.SUPABASE_URL && config.SUPABASE_ANON_KEY) {
        console.log("Configuration loaded from local config.js.");
        state.config.SUPABASE_URL = config.SUPABASE_URL;
        state.config.SUPABASE_ANON_KEY = config.SUPABASE_ANON_KEY;
        state.config.GEMINI_API_KEY = config.GEMINI_API_KEY || '';
        SUPABASE_URL = config.SUPABASE_URL;
      }
    } catch (e) {
      console.log("No local config.js found.");
    }
  }

  if (!state.config.SUPABASE_URL || !state.config.SUPABASE_ANON_KEY) {
    // Show Config UI
    $('#loading-status').style.display = 'none';
    $('#config-setup').style.display = 'block';
  } else {
    finishLoading();
  }
}

function finishLoading() {
  $('#loading-status').style.display = 'block';
  $('#config-setup').style.display = 'none';

  let progress = 0;
  const loadInterval = setInterval(() => {
    progress += Math.random() * 20;
    if (progress > 100) progress = 100;
    loadingProgress.style.width = `${progress}%`;

    if (progress === 100) {
      clearInterval(loadInterval);
      setTimeout(() => {
        btnStartExp.style.display = 'block';
      }, 400);
    }
  }, 150);
}

$('#btn-init-system').addEventListener('click', () => {
  const url = $('#cfg-url').value.trim();
  const key = $('#cfg-key').value.trim();
  const gemini = $('#cfg-gemini').value.trim();

  if (!url || !key) {
    alert("Please provide at least the Supabase URL and Anon Key.");
    return;
  }

  // Save to state
  state.config.SUPABASE_URL = url;
  state.config.SUPABASE_ANON_KEY = key;
  state.config.GEMINI_API_KEY = gemini;

  // Save to localStorage for persistence
  localStorage.setItem('AR_SUPABASE_URL', url);
  localStorage.setItem('AR_SUPABASE_KEY', key);
  localStorage.setItem('AR_GEMINI_KEY', gemini);

  finishLoading();
});

// Start initialization
initSystem();

// Audio Prime Helper (HCI: Satisfy Browser Autoplay Policy)
function primeAudio() {
  // Play and immediately pause to unlock the audio context.
  // bg-music is excluded: starting it is an explicit user choice via the
  // music toggle / start button, and priming it here would restart music
  // the user had paused.
  const sounds = ['sfx-scan', 'sfx-victory', 'sfx-wrong'];
  sounds.forEach(id => {
    const sfx = document.getElementById(id);
    if (sfx) {
      sfx.play().then(() => {
        sfx.pause();
        sfx.currentTime = 0;
      }).catch(e => console.log(`Audio priming for ${id} active... waiting for interaction.`));
    }
  });
}

btnStartExp.addEventListener('click', () => {
  sessionStorage.setItem('systemEntered', 'true');
  primeAudio();
  // Start music
  if (!isMusicPlaying && bgMusic.paused) {
    bgMusic.play().then(() => {
      isMusicPlaying = true;
      iconOn.style.display = 'block';
      iconOff.style.display = 'none';
    }).catch(() => { });
  }

  // Transition overlay
  loadingOverlay.style.opacity = '0';
  setTimeout(() => {
    loadingOverlay.style.display = 'none';
  }, 800);

  // If arrived via a shareable quest link, go straight into the hunt.
  if (deepLinkEventId) {
    enterHuntFromDeepLink(deepLinkEventId);
    return;
  }

  // Trigger zoom in transition
  landingRoot.classList.remove('zoomed-out');
  initLandingAnimation();
});

// ─── Landing Navigation ─────────────────────────────────────────────
function setRootColors(theme) {
  const root = document.documentElement;
  if (theme === 'creator') {
    root.style.setProperty('--primary', '#d946ef');
    root.style.setProperty('--primary-hover', '#c026d3');
    root.style.setProperty('--bg-dark', '#050508');
    root.style.setProperty('--bg-card', 'rgba(16, 16, 26, 0.65)');
  } else if (theme === 'hunter') {
    root.style.setProperty('--primary', '#10b981');
    root.style.setProperty('--primary-hover', '#059669');
    root.style.setProperty('--bg-dark', '#022c22');
    root.style.setProperty('--bg-card', 'rgba(6, 78, 59, 0.65)');
  } else {
    root.style.setProperty('--bg-dark', '#050508');
  }
}

function transitionFromLanding(role) {
  stopLandingAnimation();
  $('#landing-root').classList.add('hidden');
  armBackTrap();

  setTimeout(() => {
    $('#setup-screen').style.display = 'block';
    void $('#setup-screen').offsetWidth;
    $('#setup-screen').style.opacity = '1';

    if (role === 'creator') {
      setRootColors('creator');
      if (!state.isAdmin) $('#btn-admin-toggle').click();
    } else {
      setRootColors('hunter');
      if (state.isAdmin || !isPlayerMode) $('#btn-player-toggle').click();
    }
  }, 600);
}

// Deep-link entry: skip the portal and drop the hunter into a specific quest.
async function enterHuntFromDeepLink(eventId) {
  stopLandingAnimation();
  $('#landing-root').classList.add('hidden');
  setRootColors('hunter');
  $('#setup-screen').style.display = 'block';
  void $('#setup-screen').offsetWidth;
  $('#setup-screen').style.opacity = '1';
  armBackTrap();

  state.isAdmin = false;
  isPlayerMode = true;

  try {
    state.events = await getEventsFromDB();
  } catch (err) {
    console.error('Deep-link event load failed:', err);
  }

  const idx = (state.events || []).findIndex(e => String(e.id) === String(eventId));
  renderPlayerDashboard();
  showPanel(sections.playerDashboard);

  if (idx === -1) {
    alert('That quest link is no longer active. Browse the available quests instead.');
    return;
  }
  window.joinEvent(idx);
}

$('#btn-enter-creator').addEventListener('click', () => {
  primeAudio();
  transitionFromLanding('creator');
});
$('#btn-enter-hunter').addEventListener('click', () => {
  primeAudio();
  transitionFromLanding('hunter');
});

$('#btn-back-to-portal').addEventListener('click', resetToPortal);

// ─── Landing Modals ────────────────────────────────────────────────
const modal = $('#info-modal');
const modalTitle = $('#modal-title');
const modalBody = $('#modal-body');

function openModal(title, content) {
  modalTitle.textContent = title;
  modalBody.innerHTML = content;
  modal.classList.remove('hidden');
}

$('#btn-close-modal').addEventListener('click', () => modal.classList.add('hidden'));
modal.addEventListener('click', (e) => {
  if (e.target === modal) modal.classList.add('hidden');
});

$('#nav-about').addEventListener('click', (e) => {
  e.preventDefault();
  openModal('About', `
    <p><strong>AR Treasure Hunt</strong> is an immersive augmented reality experience designed to bridge the gap between digital mysteries and the physical world.</p>
    <p>Using cutting-edge WebAR technology, participants scan real-world markers with their mobile devices to reveal hidden 3D objects, secret messages, and clues.</p>
    <p>Built with Three.js and MindAR, it requires no app downloads—just open your browser and start hunting!</p>
  `);
});

$('#nav-how-to-play').addEventListener('click', (e) => {
  e.preventDefault();
  openModal('How to Play', `
    <p><strong>For Creators:</strong></p>
    <ul>
      <li>Click "Enter Studio" to access the Admin Dashboard.</li>
      <li>Upload images (markers) you plan to print or display in the real world.</li>
      <li>Attach 3D models or secret text messages to each marker.</li>
      <li>Save your event and share the event name with your Hunters!</li>
    </ul>
    <p><strong>For Hunters:</strong></p>
    <ul>
      <li>Click "Start Quest" and log in with your Player Name.</li>
      <li>Join the active event created by your Admin.</li>
      <li>Open the AR Camera and point it at the physical markers to discover the hidden treasures!</li>
    </ul>
  `);
});

$('#nav-contact').addEventListener('click', (e) => {
  e.preventDefault();
  openModal('Contact Us', `
    <p>Have questions, encountered a bug, or want to host a massive AR event for your organization?</p>
    <p>Our dev team is always ready to assist you!</p>
    <br>
    <p>📧 <strong>Email:</strong> support@artreasurehunt.com</p>
    <p>💬 <strong>Discord:</strong> discord.gg/artreasurehunt</p>
    <p>🌐 <strong>Twitter:</strong> @ARTreasureHunt</p>
  `);
});

// Hide the old welcome 3D animation from the setup screen since we have a real landing page now
$('#welcome-3d-container').style.display = 'none';

// ─── Soft navigation: return to portal without a full page reload ────
// Replaces window.location.reload() so we don't re-run system init,
// re-fetch config, or restart the landing animation from scratch.
function resetToPortal() {
  // Tear down any live AR session / timers / overlays
  try { stopAR(); } catch (_) { /* not running */ }
  if (questTimerInterval) { clearInterval(questTimerInterval); questTimerInterval = null; }
  [
    'consent-overlay', 'identity-overlay', 'quest-complete-overlay', 'times-up-overlay',
    'power-save-overlay', 'ar-photo-confirm-overlay', 'quest-finished-status'
  ].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
  const infoModal = document.getElementById('info-modal');
  if (infoModal) infoModal.classList.add('hidden');

  // Resolve any pending gates so their promises don't dangle
  if (identityResolver) { identityResolver(null); identityResolver = null; }
  if (consentResolver) { consentResolver(false); consentResolver = null; }

  // Reset transient session state (mirrors what a reload used to clear)
  state.isAdmin = false;
  isPlayerMode = false;
  state.player = null;
  state.activePlayerRecord = null;
  state.activeEventId = null;
  state.markers = [];
  state.eventName = '';
  state.compiledMindUrl = null;
  state.compiledBuffer = null;
  state.floorPlan = null;

  // Reset login UI
  $('#btn-admin-toggle').classList.remove('active');
  $('#btn-player-toggle').classList.remove('active');
  $('#login-form').style.display = 'none';
  $('#player-login-form').style.display = 'none';
  const loginErr = $('#login-error'); if (loginErr) loginErr.style.display = 'none';
  const playerErr = $('#player-error'); if (playerErr) playerErr.style.display = 'none';
  const adminPass = $('#admin-pass'); if (adminPass) adminPass.value = '';

  // Reset colours and clear any deep-link from the address bar
  setRootColors('default');
  window.applyTheme('standard');
  if (window.location.search || window.location.hash) {
    history.replaceState(null, '', window.location.pathname);
  }

  // Swap screens back to the portal
  sections.ar.style.display = 'none';
  $('#setup-screen').style.display = 'none';
  $('#setup-screen').style.opacity = '0';
  showPanel(sections.welcome);
  const landing = $('#landing-root');
  landing.classList.remove('hidden');
  landing.classList.remove('zoomed-out');
  initLandingAnimation();
  navTrapArmed = false;
}

// ─── Hunter identity gate (collected on join) ────────────────────────
let identityResolver = null;
function requireIdentity() {
  return new Promise((resolve) => {
    identityResolver = resolve;
    $('#identity-name').value = (state.player && state.player.name) || '';
    $('#identity-age').value = (state.player && state.player.age) || '';
    $('#identity-error').style.display = 'none';
    $('#identity-overlay').style.display = 'flex';
    setTimeout(() => $('#identity-name').focus(), 50);
  });
}
$('#btn-identity-start').addEventListener('click', () => {
  const name = $('#identity-name').value.trim();
  const age = $('#identity-age').value.trim();
  if (!name || !age) {
    $('#identity-error').style.display = 'block';
    return;
  }
  $('#identity-overlay').style.display = 'none';
  if (identityResolver) { const r = identityResolver; identityResolver = null; r({ name, age }); }
});
$('#btn-identity-cancel').addEventListener('click', () => {
  $('#identity-overlay').style.display = 'none';
  if (identityResolver) { const r = identityResolver; identityResolver = null; r(null); }
});

// ─── Informed-consent gate (must resolve before any DB write) ────────
let consentResolver = null;
function requireConsent() {
  return new Promise((resolve) => {
    consentResolver = resolve;
    $('#consent-overlay').style.display = 'flex';
  });
}

// ─── Browser Back-button support ─────────────────────────────────────
// The app has no router, so Back would otherwise exit the whole site.
// We arm a history "trap" when the user leaves the portal, then map each
// Back press to the equivalent in-app back/cancel action.
let navTrapArmed = false;
function armBackTrap() {
  if (!navTrapArmed) {
    history.pushState({ arthunt: true }, '');
    navTrapArmed = true;
  }
}
function getOpenOverlayId() {
  const overlays = [
    'identity-overlay', 'consent-overlay', 'ar-photo-confirm-overlay',
    'times-up-overlay', 'quest-complete-overlay', 'power-save-overlay'
  ];
  for (const id of overlays) {
    const el = document.getElementById(id);
    if (el && getComputedStyle(el).display !== 'none') return id;
  }
  const infoModal = document.getElementById('info-modal');
  if (infoModal && !infoModal.classList.contains('hidden')) return 'info-modal';
  return null;
}
function closeOverlay(id) {
  const el = document.getElementById(id);
  switch (id) {
    case 'identity-overlay':
      if (el) el.style.display = 'none';
      if (identityResolver) { const r = identityResolver; identityResolver = null; r(null); }
      break;
    case 'consent-overlay':
      if (el) el.style.display = 'none';
      if (consentResolver) { const r = consentResolver; consentResolver = null; r(false); }
      break;
    case 'power-save-overlay':
      $('#btn-resume-camera').click();
      break;
    case 'times-up-overlay':
      $('#btn-times-up-exit').click();
      break;
    case 'quest-complete-overlay':
      if (el) el.style.display = 'none';
      break;
    case 'info-modal':
      if (el) el.classList.add('hidden');
      break;
    case 'ar-photo-confirm-overlay':
      $('#btn-photo-cancel').click();
      break;
    default:
      if (el) el.style.display = 'none';
  }
}
function handleBack() {
  const arVisible = getComputedStyle(sections.ar).display !== 'none';
  const activePanel = document.querySelector('.step-panel.active');
  const landingVisible = !$('#landing-root').classList.contains('hidden')
    && $('#setup-screen').style.display === 'none';

  const action = resolveBackAction({
    openOverlayId: getOpenOverlayId(),
    arVisible,
    activePanelId: activePanel ? activePanel.id : null,
    atPortal: landingVisible
  });

  try {
    switch (action.type) {
      case 'close-overlay': closeOverlay(action.id); return true;
      case 'stop-ar':       $('#btn-stop-ar').click(); return true;
      case 'click': {
        const btn = document.getElementById(action.id);
        if (btn) btn.click();
        return true;
      }
      case 'reset-portal':  resetToPortal(); return true;
      case 'exit':          return false;
      default:              return false;
    }
  } catch (err) {
    console.error('Back navigation error:', err);
    return false;
  }
}
window.addEventListener('popstate', () => {
  const stayedInApp = handleBack();
  if (stayedInApp) armBackTrap(); // re-arm so Back keeps stepping back
});

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
    $('#btn-admin-login').innerHTML = '<div class="spinner" style="width:18px;height:18px;border-width:2px;border-top-color:#fff;margin:0 auto;"></div>';
    try {
      state.events = await getEventsFromDB();
      renderAdminDashboard();
      showPanel(sections.adminDashboard);
    } catch (err) {
      console.error('Admin login failed:', err);
      alert(`Could not load events: ${err.message}`);
    } finally {
      $('#btn-admin-login').innerHTML = 'Admin Login';
    }
  } else {
    $('#login-error').style.display = 'block';
  }
});

$('#btn-create-event').addEventListener('click', () => {
  state.eventName = '';
  state.markerCount = 1;
  state.timeLimit = 0;
  state.theme = 'standard';
  state.floorPlan = null;
  $('#event-name').value = '';
  $('#marker-count').value = 1;
  $('#time-limit').value = 0;
  $('#event-theme').value = 'standard';
  $('#btn-confirm-count').disabled = true;
  showPanel(sections.adminCount);
});

$('#btn-admin-logout').addEventListener('click', resetToPortal);

$('#btn-player-login').addEventListener('click', async () => {
  // Identity is now collected on join, so browsing quests needs no form.
  const btn = $('#btn-player-login');
  const originalLabel = btn.innerHTML;
  btn.innerHTML = '<div class="spinner" style="width:18px;height:18px;border-width:2px;border-top-color:#fff;margin:0 auto;"></div>';
  try {
    state.events = await getEventsFromDB();
  } catch (err) {
    console.error('Loading quests failed:', err);
    $('#player-error').textContent = `Could not connect: ${err.message}`;
    $('#player-error').style.display = 'block';
    return;
  } finally {
    btn.innerHTML = originalLabel;
  }

  if (!state.events || state.events.length === 0) {
    $('#player-error').textContent = 'No active games found. Admin must create one!';
    $('#player-error').style.display = 'block';
    return;
  }

  $('#player-error').style.display = 'none';
  renderPlayerDashboard();
  showPanel(sections.playerDashboard);
});

$('#btn-player-back').addEventListener('click', resetToPortal);

// ─── Dashboards ──────────────────────────────────────────────
let analyticsChartInstance = null;
const expandedEvents = new Set(); // Track expanded card IDs across refreshes

async function renderAdminDashboard() {
  const activeList = $('#admin-event-list-active');
  const inactiveList = $('#admin-event-list-inactive');
  if (activeList) activeList.innerHTML = '';
  if (inactiveList) inactiveList.innerHTML = '';

  let totalHunters = 0;

  // Render Event Lists
  if (state.events.length === 0) {
    if (activeList) activeList.innerHTML = '<p style="color:var(--text-secondary); text-align:center; font-size:0.85rem; padding: 20px;">No active events.</p>';
    if (inactiveList) inactiveList.innerHTML = '<p style="color:var(--text-secondary); text-align:center; font-size:0.85rem; padding: 20px;">No inactive events.</p>';
  } else {
    state.events.forEach((ev, index) => {
      let playersHtml = '<p style="color:var(--text-muted); font-size:0.8rem; text-align:center; padding:10px;">No participants yet.</p>';
      const isActive = ev.status !== 'inactive';

      if (ev.players && ev.players.length > 0) {
        totalHunters += ev.players.length;

        // Sort players for leaderboard: 1. Most markers, 2. Least time
        const sortedPlayers = [...ev.players].sort((a, b) => {
          if ((b.detectedMarkers?.length || 0) !== (a.detectedMarkers?.length || 0)) {
            return (b.detectedMarkers?.length || 0) - (a.detectedMarkers?.length || 0);
          }
          const timeA = (a.endTime || Date.now()) - (a.startTime || 0);
          const timeB = (b.endTime || Date.now()) - (b.startTime || 0);
          return timeA - timeB;
        });

        playersHtml = sortedPlayers.map((p, pIdx) => {
          const count = p.detectedMarkers ? p.detectedMarkers.length : 0;
          const total = ev.markers ? ev.markers.length : 0;
          const percent = total > 0 ? (count / total) * 100 : 0;
          const score = count * 100;
          const isFinished = count === total && total > 0;

          let timeStr = '---';
          if (p.startTime) {
            const finalTime = p.endTime || Date.now();
            const diff = finalTime - p.startTime;
            const mins = Math.floor(diff / 60000);
            const secs = Math.floor((diff % 60000) / 1000);
            timeStr = `${mins}m ${secs}s`;
          }

          const statusBadge = isFinished
            ? `<span style="font-size: 0.65rem; background: rgba(16,185,129,0.2); color: #10b981; padding: 2px 6px; border-radius: 4px; font-weight: 800; border: 1px solid rgba(16,185,129,0.3);">🏆 COMPLETED</span>`
            : `<span style="font-size: 0.65rem; background: rgba(6,182,212,0.2); color: var(--accent-cyan); padding: 2px 6px; border-radius: 4px; font-weight: 800; border: 1px solid rgba(6,182,212,0.3);">⚡ HUNTING</span>`;

          const avatarUrl = p.avatarId ? `assets/avatar-${p.avatarId}.svg` : 'assets/avatar-1.svg';

          return `
            <div class="leaderboard-row" style="display: flex; align-items: center; justify-content: space-between; padding: 12px; border-bottom: 1px solid rgba(255,255,255,0.05); gap: 12px;">
              <div style="display: flex; align-items: center; gap: 12px; flex: 1;">
                <span style="font-weight: 800; color: ${pIdx < 3 ? 'var(--accent-emerald)' : 'var(--text-muted)'}; min-width: 20px;">#${pIdx + 1}</span>
                <img src="${avatarUrl}" style="width: 32px; height: 32px; border-radius: 50%; background: rgba(255,255,255,0.05); padding: 2px;">
                <div style="flex: 1;">
                  <div style="font-weight: 600; font-size: 0.9rem; color: white; display: flex; justify-content: space-between; align-items: center; gap: 8px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                      <span>${escapeHtml(p.name)}</span>
                      ${statusBadge}
                    </div>
                    <span style="color: var(--accent-cyan); font-size: 0.8rem;">Score: ${score}</span>
                  </div>
                  <div class="progress-mini" style="width: 100%; height: 4px; background: rgba(255,255,255,0.05); border-radius: 2px; margin-top: 6px; overflow: hidden;">
                    <div style="width: ${percent}%; height: 100%; background: ${percent === 100 ? 'var(--accent-emerald)' : 'var(--primary)'}; transition: width 0.5s ease;"></div>
                  </div>
                </div>
              </div>
              <div style="text-align: right; min-width: 80px;">
                <div style="font-size: 0.85rem; color: white; font-weight: 700;">${count} / ${total}</div>
                <div style="font-size: 0.7rem; color: var(--text-muted);">${timeStr}</div>
              </div>
            </div>
          `;
        }).join('');
      }

      const card = document.createElement('div');
      card.className = 'event-card';
      card.id = `event-card-${index}`;
      card.style.background = 'rgba(255,255,255,0.02)';
      card.style.marginBottom = '12px';
      card.style.borderRadius = '12px';
      card.style.border = '1px solid var(--border-subtle)';
      card.style.overflow = 'hidden';

      const isExpanded = expandedEvents.has(String(ev.id || index));

      card.innerHTML = `
        <div class="event-card-header" onclick="window.toggleEventDetails(${index}, '${ev.id || index}')" style="cursor: pointer; padding: 16px; display: flex; justify-content: space-between; align-items: center; transition: background 0.2s;">
          <div>
            <h3 style="margin: 0; font-size: 1.1rem; color: white;">${escapeHtml(ev.name)}</h3>
            <p style="margin: 4px 0 0 0; font-size: 0.8rem; color: var(--text-secondary);">
              ${ev.markers ? ev.markers.length : 0} Markers • ${ev.players ? ev.players.length : 0} Participants • <span style="color: ${isActive ? 'var(--accent-emerald)' : '#f87171'};">${isActive ? 'ACTIVE' : 'INACTIVE'}</span>
            </p>
          </div>
          <div class="event-card-actions" style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: flex-end;">
            ${isActive ? `<button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); window.openLiveMonitor(${index})" style="border: 1px solid var(--accent-emerald); color: var(--accent-emerald); display: flex; align-items: center; gap: 6px; padding: 6px 10px;" title="Live Event Monitor">
               <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14v-4z"/><rect x="3" y="6" width="12" height="12" rx="2" ry="2"/></svg>
               <span class="action-text">Monitor</span>
            </button>` : ''}
            ${isActive ? `<button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); window.copyEventLink(${index})" style="border: 1px solid var(--accent-violet); color: var(--accent-violet); display: flex; align-items: center; gap: 6px; padding: 6px 10px;" title="Copy shareable hunter link">
               <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
               <span class="action-text">Share</span>
            </button>` : ''}
            <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); window.exportEventCSV(${index})" style="border: 1px solid var(--accent-cyan); color: var(--accent-cyan); display: flex; align-items: center; gap: 6px; padding: 6px 10px;" title="Export Results to CSV">
               <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
               <span class="action-text">Export</span>
            </button>
            <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); window.resetEventPlayers(${index})" style="border: 1px solid #f59e0b; color: #f59e0b; display: flex; align-items: center; gap: 6px; padding: 6px 10px;" title="Reset Player Data for New Study">
               <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
               <span class="action-text">Reset</span>
            </button>
            <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); window.toggleEventStatus(${index})" style="border: 1px solid ${isActive ? '#f87171' : 'var(--accent-emerald)'}; color: ${isActive ? '#f87171' : 'var(--accent-emerald)'}; display: flex; align-items: center; gap: 6px; padding: 6px 10px;" title="${isActive ? 'Archive' : 'Restore'}">
               <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>
               <span class="action-text">${isActive ? 'Archive' : 'Restore'}</span>
            </button>
            <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); window.deleteEvent(${index})" style="border: 1px solid rgba(255,100,100,0.3); color: #f87171; display: flex; align-items: center; justify-content: center; padding: 6px 10px;" title="Delete Event">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
            <svg id="chevron-${index}" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="transition: transform 0.3s ease; margin-left: 4px; ${isExpanded ? 'transform: rotate(180deg);' : ''}"><polyline points="6 9 12 15 18 9"></polyline></svg>
          </div>
        </div>
        
        <div id="event-details-${index}" class="event-details" style="max-height: ${isExpanded ? '500px' : '0'}; overflow: hidden; transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1); background: rgba(0,0,0,0.15); opacity: ${isExpanded ? '1' : '0'};">
          <div style="padding: 0 16px 16px 16px;">
            <div style="margin-bottom: 12px; font-size: 0.75rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
              <span>Live Leaderboard</span>
              <button id="btn-creator-sync-${index}" onclick="window.hardRefreshEvent(${index})" style="background:none; border:none; color:var(--accent-cyan); cursor:pointer; display:flex; align-items:center; opacity:0.7; transition: all 0.3s ease;" title="Hard Refresh Standings">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.3"/></svg>
              </button>
            </div>
            <div class="leaderboard-container">
              ${playersHtml}
            </div>
          </div>
        </div>
      `;

      if (isActive) {
        if (activeList) activeList.appendChild(card);
      } else {
        if (inactiveList) inactiveList.appendChild(card);
      }
    });
  }

  // Fetch and Calculate Real Research Analytics
  const feedbackData = await getFeedbackFromDB();
  let sums = { immersion: 0, usability: 0, engagement: 0, stability: 0 };
  let count = feedbackData.length;

  if (count > 0) {
    feedbackData.forEach(f => {
      sums.immersion += parseInt(f.immersion || 0);
      sums.usability += parseInt(f.usability || 0);
      sums.engagement += parseInt(f.engagement || 0);
      sums.stability += parseInt(f.stability || 0);
    });

    const avg = (s) => (s / count).toFixed(1);
    if ($('#stat-immersion')) $('#stat-immersion').textContent = avg(sums.immersion);
    if ($('#stat-usability')) $('#stat-usability').textContent = avg(sums.usability);
    if ($('#stat-engagement')) $('#stat-engagement').textContent = avg(sums.engagement);
    if ($('#stat-stability')) $('#stat-stability').textContent = avg(sums.stability);

    // Overall average for the main feedback card
    const totalAvg = ((sums.immersion + sums.usability + sums.engagement + sums.stability) / (count * 4)).toFixed(1);
    if ($('#stat-feedback')) $('#stat-feedback').textContent = `${totalAvg} / 5`;
  }

  // Populate Core Metrics
  const mockEngagementTime = totalHunters * 1.5;
  if ($('#stat-hunters')) $('#stat-hunters').textContent = totalHunters;
  if ($('#stat-time')) $('#stat-time').textContent = `${mockEngagementTime.toFixed(1)}h`;

  // Render Chart.js
  const chartCanvas = document.getElementById('analyticsChart');
  if (chartCanvas) {
    const ctx = chartCanvas.getContext('2d');
    if (analyticsChartInstance) analyticsChartInstance.destroy();

    const labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const data = Array.from({ length: 7 }, () => Math.floor(Math.random() * (totalHunters * 2 + 5)));

    analyticsChartInstance = new window.Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Daily Scans',
          data: data,
          borderColor: '#d946ef',
          backgroundColor: 'rgba(217, 70, 239, 0.2)',
          borderWidth: 2,
          tension: 0.4,
          fill: true,
          pointBackgroundColor: '#06b6d4',
          pointBorderColor: '#fff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { labels: { color: 'rgba(255,255,255,0.7)' } } },
        scales: {
          x: { ticks: { color: 'rgba(255,255,255,0.5)' }, grid: { color: 'rgba(255,255,255,0.05)' } },
          y: { ticks: { color: 'rgba(255,255,255,0.5)' }, grid: { color: 'rgba(255,255,255,0.05)' }, beginAtZero: true }
        }
      }
    });
  }
}

window.toggleEventDetails = (index, eventId) => {
  const details = document.getElementById(`event-details-${index}`);
  const chevron = document.getElementById(`chevron-${index}`);
  const isOpening = details.style.maxHeight === '0px' || !details.style.maxHeight;

  if (isOpening) {
    details.style.maxHeight = '500px';
    details.style.opacity = '1';
    chevron.style.transform = 'rotate(180deg)';
    expandedEvents.add(eventId);
  } else {
    details.style.maxHeight = '0px';
    details.style.opacity = '0';
    chevron.style.transform = 'rotate(0deg)';
    expandedEvents.delete(eventId);
  }
};

// ─── Admin Dashboard Tab Logic ─────────────────────────────────
document.querySelectorAll('.dash-nav-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    document.querySelectorAll('.dash-nav-btn').forEach(b => {
      b.classList.remove('active');
      b.style.background = 'transparent';
      b.style.color = 'var(--text-secondary)';
    });
    e.target.classList.add('active');
    e.target.style.background = 'rgba(255,255,255,0.05)';
    e.target.style.color = 'white';

    const activeTab = e.target.dataset.tab;
    document.querySelectorAll('.dash-tab').forEach(t => t.style.display = 'none');
    document.getElementById(activeTab).style.display = 'block';

    if (activeTab === 'tab-settings' && window.populateSettingsUI) {
      window.populateSettingsUI();
    }
  });
});

document.querySelectorAll('.sub-tab-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    document.querySelectorAll('.sub-tab-btn').forEach(b => {
      b.classList.remove('active');
      b.style.color = 'var(--text-secondary)';
      b.style.borderBottomColor = 'transparent';
    });
    e.target.classList.add('active');
    e.target.style.color = 'white';
    e.target.style.borderBottomColor = 'var(--primary)';

    document.querySelectorAll('.sub-tab-content').forEach(t => t.style.display = 'none');
    document.getElementById(e.target.dataset.subtab).style.display = 'block';
  });
});

// Copy a shareable hunter deep link for an event to the clipboard.
window.copyEventLink = async (index) => {
  const ev = state.events[index];
  if (!ev || !ev.id) {
    alert('This event has no shareable link yet. Save it to the cloud first.');
    return;
  }
  const link = buildEventShareLink(window.location.origin, window.location.pathname, ev.id);
  try {
    await navigator.clipboard.writeText(link);
    alert(`Hunter link copied to clipboard:\n\n${link}`);
  } catch (err) {
    // Clipboard API blocked (e.g. insecure context) — show the link to copy manually.
    prompt('Copy this hunter link:', link);
  }
};

// Quote CSV fields so commas/quotes in user-entered names don't break columns
function csvField(value) {
  const str = String(value ?? '');
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

window.exportEventCSV = (index) => {
  const ev = state.events[index];
  if (!ev.players || ev.players.length === 0) {
    alert("No hunter data available to export.");
    return;
  }

  const totalMarkers = ev.markers ? ev.markers.length : 0;

  // Define Headers: include dynamic Time-To-Marker headers based on total markers
  let headers = ["Hunter Name", "Age", "Markers Found", "Total Markers", "Hints Used", "Dashcam Photos", "Selfie Photos", "Start Time", "End Time", "Total Duration (ms)", "Score"];
  for (let i = 1; i <= totalMarkers; i++) {
    headers.push(`Time to M${i} (ms)`);
  }

  let csv = headers.join(',') + "\n";

  // Add Rows
  ev.players.forEach(p => {
    const count = p.detectedMarkers ? p.detectedMarkers.length : 0;
    const hints = p.hintsUsed || 0;
    const score = (count * 100) - (hints * 50);

    let dashcams = 0;
    let selfies = 0;

    // Sort photos chronologically to calculate spatial navigation time
    let photos = [];
    if (p.capturedPhotos) {
      photos = [...p.capturedPhotos].sort((a, b) => a.timestamp - b.timestamp);
      dashcams = photos.filter(ph => ph.type === 'dashcam').length;
      selfies = photos.filter(ph => ph.type === 'selfie').length;
    }

    let durationMs = "N/A";
    if (p.startTime && p.endTime) {
      durationMs = p.endTime - p.startTime;
    }

    const row = [
      p.name,
      p.age || 'N/A',
      count,
      totalMarkers,
      hints,
      dashcams,
      selfies,
      p.startTime ? new Date(p.startTime).toISOString() : 'N/A',
      p.endTime ? new Date(p.endTime).toISOString() : 'N/A',
      durationMs,
      score
    ];

    // Calculate time to each marker
    let lastTime = p.startTime || null;
    for (let i = 1; i <= totalMarkers; i++) {
      // Find the earliest dashcam for this marker
      const markerPhoto = photos.find(ph => ph.marker === i && ph.type === 'dashcam');
      if (markerPhoto && lastTime) {
        const timeDiff = markerPhoto.timestamp - lastTime;
        row.push(timeDiff);
        lastTime = markerPhoto.timestamp; // update lastTime to current marker time
      } else {
        row.push("N/A");
      }
    }

    csv += row.map(csvField).join(',') + "\n";
  });

  // Create Download
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `ARTHunt_Results_${ev.name.replace(/\s+/g, '_')}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

window.toggleEventStatus = async (index) => {
  const ev = state.events[index];
  ev.status = (ev.status === 'inactive') ? 'active' : 'inactive';
  if (ev.id) await updateEventInDB(ev.id, ev);
  renderAdminDashboard();
};

window.resetEventPlayers = async (index) => {
  const ev = state.events[index];
  if (confirm(`Are you sure you want to RESET all player data for "${ev.name}"? This will delete all scores, times, and photos permanently so you can run a new study.`)) {
    ev.players = [];
    if (ev.id) await updateEventInDB(ev.id, ev);
    renderAdminDashboard();
  }
};

window.deleteEvent = async (index) => {
  const ev = state.events[index];
  if (confirm(`Are you sure you want to permanently delete "${ev.name}"? This action cannot be undone.`)) {
    if (ev.id) await deleteEventFromDB(ev.id);
    state.events.splice(index, 1);
    renderAdminDashboard();
  }
};

function renderPlayerDashboard() {
  const list = $('#player-event-list');
  list.innerHTML = '';
  $('#player-greeting').textContent = (state.player && state.player.name)
    ? `Welcome, ${state.player.name}!`
    : 'Choose your quest';

  // Only show Active events to hunters
  const activeEvents = state.events.filter(ev => ev.status !== 'inactive');

  if (activeEvents.length === 0) {
    list.innerHTML = '<p style="color:var(--text-secondary); text-align:center; padding: 20px;">No quests available at the moment.</p>';
    return;
  }

  activeEvents.forEach((ev) => {
    // Find index in main state for the join call
    const originalIndex = state.events.findIndex(e => e.id === ev.id);
    const card = document.createElement('div');
    card.className = 'review-item';
    card.innerHTML = `
      <div class="review-info">
        <h4>${escapeHtml(ev.name)}</h4>
        <p>Treasure Hunt</p>
      </div>
      <button class="btn btn-launch btn-sm" onclick="window.joinEvent(${originalIndex})">Join</button>
    `;
    list.appendChild(card);
  });
}

window.joinEvent = async (index) => {
  const ev = state.events[index];
  if (!ev) return;
  if (!Array.isArray(ev.players)) ev.players = [];

  // Apply the event's own research settings (snapshotted at save time) so
  // the creator's experimental conditions govern this hunt, not whatever
  // defaults live in this hunter's browser. Session-only: not persisted.
  if (ev.settings) state.settings = { ...state.settings, ...ev.settings };

  // 1. Collect hunter identity on join (not up front).
  if (!state.player || !state.player.name) {
    const identity = await requireIdentity();
    if (!identity) return; // cancelled → stay on the browse list
    state.player = identity;
  }

  // 2. Gate on informed consent BEFORE writing anything to the DB.
  if (state.settings && state.settings.mandatoryConsent !== false) {
    const consented = await requireConsent();
    if (!consented) return; // declined → stay on the browse list, no write
  }

  // Find or create player record
  let playerRecord = ev.players.find(p => p.name === state.player.name);
  if (!playerRecord) {
    // Generate sequential or randomized path (depending on setting)
    const markerCount = ev.markers.length;
    let customPath = [];

    if (state.settings && state.settings.randomizedPathing === false) {
      customPath = Array.from({ length: markerCount }, (_, i) => i);
      console.log(`Generated Linear Sequential Path for ${state.player.name}:`, customPath);
    } else {
      const targets = Array.from({ length: markerCount - 1 }, (_, i) => i + 1); // [1, 2, 3, ...]
      // Fisher-Yates Shuffle
      for (let i = targets.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [targets[i], targets[j]] = [targets[j], targets[i]];
      }
      customPath = [0, ...targets];
      console.log(`Generated Blockchain Path for ${state.player.name}:`, customPath);
    }

    playerRecord = {
      name: state.player.name,
      age: state.player.age,
      detectedMarkers: [],
      customPath: customPath,
      startTime: Date.now(),
      avatarId: Math.floor(Math.random() * 50) + 1 // Assign random avatar 1-50
    };
    ev.players.push(playerRecord);
    await updateEventInDB(ev.id, ev);
  } else if (!playerRecord.startTime) {
    playerRecord.startTime = Date.now();
    if (!playerRecord.avatarId) playerRecord.avatarId = Math.floor(Math.random() * 50) + 1;
    await updateEventInDB(ev.id, ev);
  }

  state.activePlayerRecord = playerRecord;
  state.activeEventId = ev.id;
  logTelemetry(state.activeEventId, playerRecord.name, 'join');

  state.eventName = ev.name;
  state.markers = ev.markers;
  state.compiledMindUrl = ev.compiledMindUrl || null;
  state.timeLimit = ev.timeLimit || 0;

  // Update Hunter HUD Name & Avatar
  const isAnonymized = state.settings && state.settings.anonymizeHunters;
  const displayName = isAnonymized ? `Hunter_${playerRecord.avatarId || 'X'}` : state.player.name;
  if ($('#ar-player-name')) $('#ar-player-name').textContent = displayName;
  const avatarImg = document.querySelector('#ar-hud .avatar-icon');
  if (avatarImg && playerRecord.avatarId) {
    avatarImg.src = `assets/avatar-${playerRecord.avatarId}.svg`;
  }

  // 3. Identity + consent already resolved — launch the hunt.
  window.renderHunterLeaderboard();
  window.updateHUDClue();
  window.startQuestTimer();
  window.applyTheme(ev.theme);
  startAR();
};

window.updateHUDClue = () => {
  const clueCard = $('#ar-clue-card');
  const clueText = $('#ar-clue-text');
  const clueNum = $('#ar-clue-num');

  if (!state.activePlayerRecord || !state.markers) return;

  const foundCount = state.activePlayerRecord.detectedMarkers ? state.activePlayerRecord.detectedMarkers.length : 0;
  const total = state.markers.length;

  if (foundCount >= total) {
    clueCard.style.opacity = '0';
    clueCard.style.transform = 'translateX(-50%) translateY(20px)';
    return;
  }

  // The next clue depends on the Blockchain Path
  let nextMarkerIndex = foundCount;
  if (state.activePlayerRecord.customPath) {
    nextMarkerIndex = state.activePlayerRecord.customPath[foundCount];
  }

  const nextMarker = state.markers[nextMarkerIndex];
  clueCard.style.opacity = '1';
  clueCard.style.transform = 'translateX(-50%) translateY(0)';
  clueNum.textContent = `Marker ${foundCount + 1} of ${total}`;
  clueText.textContent = nextMarker.hint ? `"${nextMarker.hint}"` : "Search for the hidden marker!";

  // Reset hint UI
  const btnHint = $('#btn-use-hint');
  const revealedHint = $('#ar-hint-revealed');
  if (btnHint && revealedHint) {
    btnHint.style.display = 'block';
    revealedHint.style.display = 'none';
  }
};

$('#btn-use-hint').addEventListener('click', async () => {
  if (!state.activePlayerRecord) return;

  const ev = state.events.find(e => e.id === state.activeEventId);
  const foundCount = state.activePlayerRecord.detectedMarkers ? state.activePlayerRecord.detectedMarkers.length : 0;

  let currentMarkerIndex = foundCount;
  if (state.activePlayerRecord.customPath) {
    currentMarkerIndex = state.activePlayerRecord.customPath[foundCount];
  }

  const currentMarker = state.markers[currentMarkerIndex];

  if (!currentMarker) return;

  $('#btn-use-hint').style.display = 'none';
  $('#ar-hint-revealed').style.display = 'flex';
  $('#ar-hint-reveal-img').src = currentMarker.imageUrl;

  // Track penalty
  if (!state.activePlayerRecord.hintsUsed) state.activePlayerRecord.hintsUsed = 0;
  state.activePlayerRecord.hintsUsed += 1;

  if (state.activeEventId && state.activePlayerRecord.name) {
    const markerNumber = currentMarkerIndex + 1;
    logTelemetry(state.activeEventId, state.activePlayerRecord.name, 'hint', markerNumber);
  }

  if (ev) await updateEventInDB(ev.id, ev);
});

let questTimerInterval = null;
window.startQuestTimer = () => {
  if (questTimerInterval) clearInterval(questTimerInterval);
  const timerEl = $('#ar-timer');
  const timeLeftEl = $('#ar-time-left');

  if (!state.timeLimit || state.timeLimit <= 0) {
    timerEl.style.display = 'none';
    return;
  }

  timerEl.style.display = 'flex';
  const limitMs = state.timeLimit * 60 * 1000;
  const startTime = state.activePlayerRecord.startTime;

  questTimerInterval = setInterval(() => {
    const elapsed = Date.now() - startTime;
    const remainingMs = limitMs - elapsed;

    if (remainingMs <= 0) {
      clearInterval(questTimerInterval);
      timeLeftEl.textContent = '00:00';
      handleTimesUp();
    } else {
      const totalSeconds = Math.floor(remainingMs / 1000);
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;
      timeLeftEl.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

      if (totalSeconds <= 60) {
        timerEl.style.borderColor = 'rgba(255,0,0,0.8)';
        timeLeftEl.style.color = '#ff4444';
      }
    }
  }, 1000);
};

function handleTimesUp() {
  stopAR();
  $('#times-up-overlay').style.display = 'flex';

  // Save end time
  if (state.activePlayerRecord && !state.activePlayerRecord.endTime) {
    state.activePlayerRecord.endTime = Date.now();
    const ev = state.events.find(e => e.id === state.activeEventId);
    if (ev) updateEventInDB(ev.id, ev);
  }

  // Auto redirect after 4 seconds
  setTimeout(() => {
    if ($('#times-up-overlay').style.display === 'flex') {
      $('#btn-times-up-exit').click();
    }
  }, 4000);
}

$('#btn-times-up-exit').addEventListener('click', () => {
  $('#times-up-overlay').style.display = 'none';
  sections.ar.style.display = 'none';
  sections.setup.style.display = '';
  window.showPostHuntLeaderboard();
});

// Audio Toggle Logic
$('#btn-toggle-audio').addEventListener('click', () => {
  state.audioEnabled = !state.audioEnabled;
  const onIcon = $('#icon-audio-on');
  const offIcon = $('#icon-audio-off');

  if (state.audioEnabled) {
    onIcon.style.display = 'block';
    offIcon.style.display = 'none';
    primeAudio(); // Re-prime on unmute
  } else {
    onIcon.style.display = 'none';
    offIcon.style.display = 'block';
  }
});

// Camera Toggle (Power Saver) Logic
let isCameraPaused = false;
const toggleCam = async () => {
  isCameraPaused = !isCameraPaused;
  const onIcon = $('#icon-cam-on');
  const offIcon = $('#icon-cam-off');
  const overlay = $('#power-save-overlay');

  if (isCameraPaused) {
    onIcon.style.display = 'none';
    offIcon.style.display = 'block';
    overlay.style.display = 'flex';
    pauseAR();
  } else {
    onIcon.style.display = 'block';
    offIcon.style.display = 'none';
    overlay.style.display = 'none';
    await resumeAR();
  }
};

$('#btn-toggle-camera').addEventListener('click', toggleCam);
$('#btn-resume-camera').addEventListener('click', toggleCam);

window.hardRefreshEvent = async (index) => {
  const btn = document.getElementById(`btn-creator-sync-${index}`);
  if (btn) btn.style.transform = 'rotate(180deg)';

  state.events = await getEventsFromDB();
  renderAdminDashboard();
};

window.openLiveMonitor = async (index) => {
  const ev = state.events[index];
  if (!ev) return;

  state.activeEventId = ev.id;
  $('#monitor-event-name').textContent = ev.name;

  showPanel(sections.liveMonitor);
  window.renderLiveMonitorLeaderboard();
};

window.renderLiveMonitorLeaderboard = async () => {
  const list = $('#monitor-leaderboard-list');
  const photoGrid = $('#monitor-photo-grid');
  if (!list) return;

  state.events = await getEventsFromDB();
  const ev = state.events.find(e => e.id === state.activeEventId);

  const emptyPhotoGridHTML = `
    <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: var(--text-muted);">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom: 16px; opacity: 0.5;"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
      <p>Waiting for the first photo check-in...</p>
    </div>
  `;

  if (!ev || !ev.players || ev.players.length === 0) {
    list.innerHTML = '<p style="color:var(--text-muted); font-size:0.9rem; text-align:center; padding:20px;">Waiting for players...</p>';
    if (photoGrid) photoGrid.innerHTML = emptyPhotoGridHTML;
    return;
  }

  // --- 1. LEADERBOARD ---
  const sortedPlayers = [...ev.players].sort((a, b) => {
    const aCount = a.detectedMarkers ? a.detectedMarkers.length : 0;
    const bCount = b.detectedMarkers ? b.detectedMarkers.length : 0;
    const aScore = (aCount * 100) - ((a.hintsUsed || 0) * 50);
    const bScore = (bCount * 100) - ((b.hintsUsed || 0) * 50);
    if (bScore !== aScore) return bScore - aScore;
    return (a.startTime || 0) - (b.startTime || 0);
  });

  list.innerHTML = sortedPlayers.map((p, idx) => {
    const count = p.detectedMarkers ? p.detectedMarkers.length : 0;
    const score = (count * 100) - ((p.hintsUsed || 0) * 50);
    const total = ev.markers ? ev.markers.length : 0;
    const isFinished = count === total && total > 0;
    const avatarUrl = p.avatarId ? `assets/avatar-${p.avatarId}.svg` : 'assets/avatar-1.svg';
    const isAnonymized = state.settings && state.settings.anonymizeHunters;
    const displayName = isAnonymized ? `Hunter_${p.avatarId || 'X'}` : p.name;

    return `
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; background: rgba(255,255,255,0.02); border-left: 2px solid ${idx < 3 ? 'var(--accent-emerald)' : 'transparent'}; border-radius: 6px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 0.8rem; font-weight: 800; color: ${idx < 3 ? 'var(--accent-emerald)' : 'var(--text-muted)'}; min-width: 16px;">#${idx + 1}</span>
          <img src="${avatarUrl}" style="width: 24px; height: 24px; border-radius: 50%; background: rgba(255,255,255,0.1);">
          <div style="display: flex; flex-direction: column;">
            <span style="font-size: 0.85rem; color: white; font-weight: 700;">${isFinished ? '🏆 ' : ''}${escapeHtml(displayName)}</span>
            <span style="font-size: 0.65rem; color: var(--text-muted);">Found: ${count}/${total}</span>
          </div>
        </div>
        <span style="font-size: 0.95rem; font-weight: 800; color: ${isFinished ? 'var(--accent-emerald)' : 'var(--accent-cyan)'};">${score}</span>
      </div>
    `;
  }).join('');

  // --- 2. PHOTO GRID ---
  if (!photoGrid) return;

  const allPhotos = [];
  ev.players.forEach(p => {
    if (p.capturedPhotos) {
      p.capturedPhotos.forEach(photo => {
        const isAnonymized = state.settings && state.settings.anonymizeHunters;
        const displayName = isAnonymized ? `Hunter_${p.avatarId || 'X'}` : p.name;
        allPhotos.push({
          playerName: displayName,
          avatarId: p.avatarId,
          ...photo
        });
      });
    }
  });

  allPhotos.sort((a, b) => b.timestamp - a.timestamp); // Newest first

  if (allPhotos.length === 0) {
    photoGrid.innerHTML = emptyPhotoGridHTML;
    return;
  }

  photoGrid.innerHTML = allPhotos.map((photo, i) => {
    const typeLabel = photo.type === 'selfie' ? 'Selfie' : 'Dashcam';
    const typeColor = photo.type === 'selfie' ? 'var(--primary)' : 'var(--text-muted)';
    const avatarUrl = photo.avatarId ? `assets/avatar-${photo.avatarId}.svg` : 'assets/avatar-1.svg';
    // Support dataUrl for backward compatibility with stage 2 tests
    const src = photo.imageUrl || photo.dataUrl;

    return `
      <div class="monitor-photo-card" data-index="${i}" style="background: rgba(255,255,255,0.02); border: 1px solid var(--border-subtle); border-radius: 12px; overflow: hidden; cursor: pointer; transition: transform 0.2s, box-shadow 0.2s;" onmouseover="this.style.transform='scale(1.02)'; this.style.boxShadow='0 10px 20px rgba(0,0,0,0.5)';" onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='none';">
        <div style="position: relative; width: 100%; aspect-ratio: 3/4; overflow: hidden; background: #000;">
          <img src="${src}" style="width: 100%; height: 100%; object-fit: cover; opacity: 0.9; transition: opacity 0.3s;" onload="this.style.opacity=1" onerror="this.src='https://placehold.co/400x600/1e1e24/444444?text=Image+Lost'">
          <div style="position: absolute; top: 12px; right: 12px; background: rgba(0,0,0,0.6); padding: 4px 8px; border-radius: 20px; font-size: 0.65rem; font-weight: 800; letter-spacing: 0.5px; color: ${typeColor}; border: 1px solid rgba(255,255,255,0.1); backdrop-filter: blur(4px); text-transform: uppercase;">
            ${typeLabel}
          </div>
        </div>
        <div style="padding: 12px; display: flex; align-items: center; justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <img src="${avatarUrl}" style="width: 24px; height: 24px; border-radius: 50%; background: rgba(255,255,255,0.1);">
            <span style="color: white; font-size: 0.85rem; font-weight: 700;">${escapeHtml(photo.playerName)}</span>
          </div>
          <span style="color: var(--accent-cyan); font-size: 0.75rem; font-weight: 800;">M${photo.marker}</span>
        </div>
      </div>
    `;
  }).join('');

  // Attach Lightbox Listeners
  document.querySelectorAll('.monitor-photo-card').forEach(card => {
    card.addEventListener('click', () => {
      const idx = card.getAttribute('data-index');
      const photo = allPhotos[idx];
      const src = photo.imageUrl || photo.dataUrl;
      const typeLabel = photo.type === 'selfie' ? 'Selfie' : 'Dashcam';

      $('#lightbox-img').src = src;
      $('#lightbox-player').textContent = photo.playerName;
      $('#lightbox-meta').textContent = `Marker ${photo.marker} • ${typeLabel}`;

      $('#monitor-lightbox-overlay').style.display = 'flex';
    });
  });
};

$('#btn-close-lightbox').addEventListener('click', () => {
  $('#monitor-lightbox-overlay').style.display = 'none';
});

$('#btn-monitor-back').addEventListener('click', () => {
  showPanel(sections.adminDashboard);
});

$('#btn-monitor-sync-leaderboard').addEventListener('click', () => {
  const btn = $('#btn-monitor-sync-leaderboard');
  btn.style.transform = btn.style.transform ? '' : 'rotate(180deg)';
  btn.style.transition = 'transform 0.3s ease';
  window.renderLiveMonitorLeaderboard();
});

window.renderHunterLeaderboard = async () => {
  const list = $('#hunter-leaderboard-list');
  if (!list) return;

  // Find the current active event
  const ev = state.events.find(e => e.id === state.activeEventId);
  if (!ev || !ev.players) {
    list.innerHTML = '<p style="color:var(--text-muted); font-size:0.7rem; text-align:center; padding:10px;">Waiting for data...</p>';
    return;
  }

  // Sort players: 1. Most markers, 2. Least time
  const sortedPlayers = [...ev.players].sort((a, b) => {
    if ((b.detectedMarkers?.length || 0) !== (a.detectedMarkers?.length || 0)) {
      return (b.detectedMarkers?.length || 0) - (a.detectedMarkers?.length || 0);
    }
    return (a.startTime || 0) - (b.startTime || 0);
  });

  list.innerHTML = sortedPlayers.map((p, idx) => {
    const isMe = p.name === state.player.name;
    const count = p.detectedMarkers ? p.detectedMarkers.length : 0;
    const total = ev.markers ? ev.markers.length : 0;
    const isFinished = count === total && total > 0;
    const avatarUrl = p.avatarId ? `assets/avatar-${p.avatarId}.svg` : 'assets/avatar-1.svg';
    const isAnonymized = state.settings && state.settings.anonymizeHunters;
    const displayName = isAnonymized ? `Hunter_${p.avatarId || 'X'}` : p.name;

    return `
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 6px 12px; background: ${isMe ? 'rgba(6, 182, 212, 0.1)' : 'transparent'}; border-left: 2px solid ${isMe ? 'var(--accent-cyan)' : 'transparent'};">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 0.7rem; font-weight: 800; color: ${idx < 3 ? 'var(--accent-emerald)' : 'var(--text-muted)'};">#${idx + 1}</span>
          <img src="${avatarUrl}" style="width: 18px; height: 18px; border-radius: 50%; background: rgba(255,255,255,0.1);">
          <span style="font-size: 0.75rem; color: ${isMe ? 'white' : 'var(--text-secondary)'}; font-weight: ${isMe ? '700' : '500'};">
            ${isFinished ? '🏆 ' : ''}${escapeHtml(displayName)} ${isMe ? '(YOU)' : ''}
          </span>
        </div>
        <span style="font-size: 0.75rem; font-weight: 800; color: ${isFinished ? 'var(--accent-emerald)' : 'white'};">${count}</span>
      </div>
    `;
  }).join('');
};

window.showPostHuntLeaderboard = () => {
  showPanel(sections.postHuntLeaderboard);
  window.renderPostHuntLeaderboard();
};

window.renderPostHuntLeaderboard = async () => {
  const list = $('#post-hunt-leaderboard-list');
  if (!list) return;

  // Re-fetch events to get latest scores from other players
  state.events = await getEventsFromDB();

  const ev = state.events.find(e => e.id === state.activeEventId);
  if (!ev || !ev.players) {
    list.innerHTML = '<p style="color:var(--text-muted); font-size:0.9rem; text-align:center; padding:20px;">No data available.</p>';
    return;
  }

  // Same sorting logic, but let's factor in the score (with hints)
  const sortedPlayers = [...ev.players].sort((a, b) => {
    const aCount = a.detectedMarkers ? a.detectedMarkers.length : 0;
    const bCount = b.detectedMarkers ? b.detectedMarkers.length : 0;
    const aScore = (aCount * 100) - ((a.hintsUsed || 0) * 50);
    const bScore = (bCount * 100) - ((b.hintsUsed || 0) * 50);

    if (bScore !== aScore) return bScore - aScore;

    return (a.startTime || 0) - (b.startTime || 0);
  });

  list.innerHTML = sortedPlayers.map((p, idx) => {
    const isMe = p.name === state.player.name;
    const count = p.detectedMarkers ? p.detectedMarkers.length : 0;
    const score = (count * 100) - ((p.hintsUsed || 0) * 50);
    const total = ev.markers ? ev.markers.length : 0;
    const isFinished = count === total && total > 0;
    const avatarUrl = p.avatarId ? `assets/avatar-${p.avatarId}.svg` : 'assets/avatar-1.svg';
    const isAnonymized = state.settings && state.settings.anonymizeHunters;
    const displayName = isAnonymized ? `Hunter_${p.avatarId || 'X'}` : p.name;

    return `
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; background: ${isMe ? 'rgba(6, 182, 212, 0.15)' : (idx % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent')}; border-left: 3px solid ${isMe ? 'var(--accent-cyan)' : 'transparent'}; border-bottom: 1px solid rgba(255,255,255,0.05);">
        <div style="display: flex; align-items: center; gap: 12px;">
          <span style="font-size: 1rem; font-weight: 800; color: ${idx < 3 ? 'var(--accent-emerald)' : 'var(--text-muted)'}; min-width: 24px;">#${idx + 1}</span>
          <img src="${avatarUrl}" style="width: 28px; height: 28px; border-radius: 50%; background: rgba(255,255,255,0.1);">
          <div style="display: flex; flex-direction: column;">
            <span style="font-size: 0.95rem; color: ${isMe ? 'white' : 'var(--text-secondary)'}; font-weight: ${isMe ? '800' : '600'};">
              ${isFinished ? '🏆 ' : ''}${escapeHtml(displayName)} ${isMe ? '(YOU)' : ''}
            </span>
            <span style="font-size: 0.7rem; color: var(--text-muted);">Found: ${count}/${total} | Hints: ${p.hintsUsed || 0}</span>
          </div>
        </div>
        <span style="font-size: 1.1rem; font-weight: 800; color: ${isFinished ? 'var(--accent-emerald)' : 'var(--accent-cyan)'};">${score}</span>
      </div>
    `;
  }).join('');
};

$('#btn-sync-post-leaderboard').addEventListener('click', () => {
  const btn = $('#btn-sync-post-leaderboard');
  btn.style.transform = btn.style.transform ? '' : 'rotate(180deg)';
  btn.style.transition = 'transform 0.3s ease';
  window.renderPostHuntLeaderboard();
});

$('#btn-post-hunt-exit').addEventListener('click', () => {
  showPanel(sections.feedback);
});

// Hunter Leaderboard Toggle & Sync
$('#btn-toggle-leaderboard').addEventListener('click', () => {
  const panel = $('#hunter-leaderboard-panel');
  const isHidden = panel.style.display === 'none' || !panel.style.display;
  panel.style.display = isHidden ? 'block' : 'none';
  if (isHidden) window.renderHunterLeaderboard(); // Refresh on open
});

$('#btn-sync-leaderboard').addEventListener('click', async () => {
  const btn = $('#btn-sync-leaderboard');
  btn.style.transform = 'rotate(180deg)';
  btn.style.opacity = '1';

  // Refresh events from DB
  state.events = await getEventsFromDB();
  await window.renderHunterLeaderboard();

  setTimeout(() => {
    btn.style.transform = 'rotate(0deg)';
    btn.style.opacity = '0.7';
  }, 500);
});

// Continuous Auto-sync leaderboard every 5 seconds during AR
setInterval(() => {
  const isARActive = $('#ar-screen').style.display === 'block';
  const isAdminActive = $('#setup-screen').style.display === 'block' && state.isAdmin;

  if (isARActive && state.activeEventId) {
    getEventsFromDB().then(evs => {
      state.events = evs;
      window.renderHunterLeaderboard();
    });
  } else if (isAdminActive) {
    // Only refresh if the 'Active Events' sub-tab is visible
    const activeEventsTab = document.getElementById('tab-active-events');
    if (activeEventsTab && activeEventsTab.style.display !== 'none') {
      getEventsFromDB().then(evs => {
        state.events = evs;
        renderAdminDashboard();
      });
    }
  }
}, 5000);

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
  state.timeLimit = parseInt($('#time-limit').value) || 0;
  state.theme = $('#event-theme').value || 'standard';
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
  const hasModel = !!(m.modelFile || isLibraryUrl(m.modelUrl));
  $('#model-status').textContent = m.modelFile ? m.modelFile.name : 'Drop 3D Model here';
  $('#scale-control').style.display = hasModel ? 'block' : 'none';
  $$('.asset-tile').forEach(tile =>
    tile.classList.toggle('active', m.modelUrl === LIBRARY_SCHEME + tile.dataset.assetId));
  $('#model-scale').value = m.scale;
  $('#scale-value').textContent = m.scale.toFixed(2);
  $('#overlay-text').value = m.text || '';
  $('#overlay-hint').value = m.hint || '';

  $$('.color-opt').forEach(opt => opt.classList.toggle('active', opt.dataset.color === m.color));
  checkMarkerComplete();
}

function checkMarkerComplete() {
  const m = state.markers[state.currentMarkerIndex];
  const hasModel = !!(m.modelFile || isLibraryUrl(m.modelUrl));
  const isComplete = !!m.image && (m.type === 'model' ? hasModel : !!m.text);
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

$$('.toggle-btn').forEach(btn => btn.addEventListener('click', () => {
  state.markers[state.currentMarkerIndex].type = btn.dataset.type;
  updateMarkerStep();
}));

// ─── Built-in Asset Library ───────────────────────────────────
(function renderAssetLibrary() {
  const grid = $('#asset-library-grid');
  if (!grid) return;
  grid.innerHTML = '';
  ASSET_LIBRARY.forEach(asset => {
    const tile = document.createElement('div');
    tile.className = 'asset-tile';
    tile.dataset.assetId = asset.id;
    tile.title = asset.name;
    tile.innerHTML = `<span class="asset-icon">${asset.icon}</span><span class="asset-name">${asset.name}</span>`;
    tile.addEventListener('click', () => {
      const m = state.markers[state.currentMarkerIndex];
      if (!m) return;
      m.modelFile = null; // library pick replaces any uploaded file
      m.modelUrl = LIBRARY_SCHEME + asset.id;
      m.modelFileName = `${asset.name} (built-in)`;
      updateMarkerStep();
    });
    grid.appendChild(tile);
  });
})();

$('#model-drop-zone').addEventListener('click', () => $('#model-file-input').click());
$('#model-file-input').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    const m = state.markers[state.currentMarkerIndex];
    m.modelFile = file;
    m.modelUrl = URL.createObjectURL(file);
    m.modelFileName = file.name;
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

$('#overlay-hint').addEventListener('input', () => {
  state.markers[state.currentMarkerIndex].hint = $('#overlay-hint').value;
});

// ─── AI Riddle Generation ──────────────────────────────────────
async function generateAIHint() {
  const btn = $('#btn-generate-ai-hint');
  const textarea = $('#overlay-hint');
  const marker = state.markers[state.currentMarkerIndex];

  if (!marker || !marker.dataUrl) {
    alert("Please upload or capture a marker image first!");
    return;
  }

  const apiKey = state.config.GEMINI_API_KEY;
  if (!apiKey) {
    alert("Gemini API Key missing! Please configure it in the system setup.");
    return;
  }

  btn.disabled = true;
  const originalText = btn.innerHTML;
  btn.innerHTML = 'Generating...';

  try {
    // Extract base64 from dataUrl
    const base64Data = marker.dataUrl.split(',')[1];

    const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: "You are an AR Treasure Hunt master. Look at this image and generate a 2-sentence poetic, cryptic riddle that leads a player to this location without naming it directly. Output ONLY the riddle text." },
            { inlineData: { mimeType: "image/png", data: base64Data } }
          ]
        }]
      })
    });

    const data = await response.json();
    console.log("Gemini API Response:", data);

    if (data.error) {
      throw new Error(data.error.message);
    }

    const riddle = data.candidates[0].content.parts[0].text.trim();

    textarea.value = riddle;
    marker.hint = riddle;
    console.log("AI Riddle Generated:", riddle);

  } catch (error) {
    console.error("AI Generation Error:", error);
    alert("Failed to generate riddle. Check console for details.");
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalText;
  }
}

$('#btn-generate-ai-hint').addEventListener('click', generateAIHint);

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
        <p>${m.type === 'model' ? `Model: ${escapeHtml(m.modelFileName || (m.modelFile ? m.modelFile.name : 'N/A'))}` : `Msg: ${escapeHtml((m.text || '').substring(0, 20))}...`}</p>
        <p style="font-size: 0.7rem; color: var(--accent-cyan); margin-top: 4px;">Hint: ${escapeHtml(m.hint || 'No hint provided')}</p>
      </div>
      <span class="review-type-badge">${m.type.toUpperCase()}</span>
    `;
    list.appendChild(item);
  });
  renderFloorplanUI(); // restore plan + pins when re-entering review
}

// ─── Floor-Plan Marker Pinning (optional, for spatial research data) ──
// Creator uploads a venue plan and clicks to place each marker; positions
// are stored normalized (0–1) so they're resolution-independent.

function renderFloorplanUI() {
  const wrap = $('#floorplan-wrap');
  const status = $('#floorplan-status');
  if (!state.floorPlan) {
    wrap.style.display = 'none';
    status.style.display = 'none';
    $('#btn-upload-floorplan').textContent = 'Upload Floor Plan';
    return;
  }
  $('#floorplan-img').src = state.floorPlan.dataUrl;
  wrap.style.display = 'block';
  status.style.display = 'block';
  $('#btn-upload-floorplan').textContent = 'Replace Floor Plan';
  renderFloorplanPins();
}

function renderFloorplanPins() {
  const wrap = $('#floorplan-wrap');
  wrap.querySelectorAll('.floorplan-pin').forEach(p => p.remove());
  state.markers.forEach((m, i) => {
    if (!m.pos) return;
    const pin = document.createElement('div');
    pin.className = 'floorplan-pin';
    pin.textContent = i + 1;
    pin.style.cssText = `position:absolute; left:${m.pos.x * 100}%; top:${m.pos.y * 100}%; transform:translate(-50%,-50%); width:24px; height:24px; border-radius:50%; background:var(--accent-violet); color:#fff; font-size:0.7rem; font-weight:800; display:flex; align-items:center; justify-content:center; border:2px solid #fff; box-shadow:0 2px 6px rgba(0,0,0,0.5); pointer-events:none;`;
    wrap.appendChild(pin);
  });
  const unplaced = state.markers.findIndex(m => !m.pos);
  $('#floorplan-status').textContent = unplaced === -1
    ? `All ${state.markers.length} markers placed — click near a pin to adjust it.`
    : `Click the plan to place Marker ${unplaced + 1} of ${state.markers.length}.`;
}

$('#btn-upload-floorplan').addEventListener('click', () => $('#floorplan-input').click());
$('#floorplan-input').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    state.floorPlan = { dataUrl: ev.target.result, file };
    state.markers.forEach(m => { m.pos = null; }); // new plan → old pins invalid
    renderFloorplanUI();
  };
  reader.readAsDataURL(file);
});

$('#floorplan-wrap').addEventListener('click', (e) => {
  if (!state.floorPlan || state.markers.length === 0) return;
  const rect = $('#floorplan-wrap').getBoundingClientRect();
  const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
  const y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));

  let target = state.markers.findIndex(m => !m.pos);
  if (target === -1) {
    // All placed: adjust whichever pin is closest to the click.
    let best = 0, bestDist = Infinity;
    state.markers.forEach((m, i) => {
      const d = (m.pos.x - x) ** 2 + (m.pos.y - y) ** 2;
      if (d < bestDist) { bestDist = d; best = i; }
    });
    target = best;
  }
  state.markers[target].pos = { x: +x.toFixed(4), y: +y.toFixed(4) };
  renderFloorplanPins();
});

$('#btn-back-review').addEventListener('click', () => showPanel(sections.config));

$('#btn-test-ar').addEventListener('click', () => {
  // Admin may have edited markers since the last test — force a fresh compile.
  state.compiledMindUrl = null;
  state.compiledBuffer = null;
  startAR();
});

$('#btn-stop-ar').addEventListener('click', () => {
  stopAR();
  sections.ar.style.display = 'none';
  sections.setup.style.display = '';

  if (state.isAdmin) {
    // If admin is just testing and exits, go back to review so they can edit or save
    showPanel(sections.review);
  } else {
    // End player timer and update endTime if they hadn't finished
    if (questTimerInterval) clearInterval(questTimerInterval);
    if (state.activePlayerRecord && !state.activePlayerRecord.endTime) {
      state.activePlayerRecord.endTime = Date.now();
      const ev = state.events.find(e => e.id === state.activeEventId);
      if (ev) updateEventInDB(ev.id, ev);
    }

    // Check if #quest-complete-overlay is visible and hide it if so
    $('#quest-complete-overlay').style.display = 'none';

    // Players go to Post-Hunt Leaderboard
    window.showPostHuntLeaderboard();
  }
});

$('#btn-ar-save').addEventListener('click', async () => {
  $('#btn-ar-save').textContent = 'Saving...';

  try {
    // Save the event to DB (uploads files)
    const savedData = await saveEventToDB(state.eventName, state.markers, state.timeLimit, state.theme);
    if (savedData) {
      alert(`Success! "${state.eventName}" has been saved to the cloud and is now live for hunters.`);
      state.events.unshift({
        id: savedData.id,
        ...savedData.data
      });

      // Clean up and return to dashboard
      $('#btn-ar-save').textContent = 'Save Event';
      renderAdminDashboard();
      showPanel(sections.adminDashboard);
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

$('#btn-cancel-event').addEventListener('click', () => {
  showPanel(sections.adminDashboard);
});

$('#btn-cancel-config').addEventListener('click', () => {
  if (confirm("Are you sure you want to exit? Unsaved progress for this event will be lost.")) {
    showPanel(sections.adminDashboard);
  }
});

// Research Questionnaire Rating Buttons
document.querySelectorAll('.rating-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const parent = e.target.closest('.question-item');
    parent.querySelectorAll('.rating-btn').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');
  });
});

$('#btn-submit-feedback').addEventListener('click', async () => {
  const ratings = {};
  let allFilled = true;
  document.querySelectorAll('.question-item').forEach(item => {
    const question = item.dataset.question;
    const activeBtn = item.querySelector('.rating-btn.active');
    if (!activeBtn) {
      allFilled = false;
    } else {
      ratings[question] = parseInt(activeBtn.dataset.value || 0);
    }
  });

  if (!allFilled) {
    alert("Please rate all categories to submit your research data!");
    return;
  }

  console.log("Research Data Collected:", ratings);

  // Save to Supabase
  await saveFeedbackToDB(ratings);

  // Return to portal after feedback
  alert("Thank you for participating in our research! Your feedback has been saved to our database.");
  resetToPortal();
});

// Quest Completion Overlay Handlers
$('#btn-quest-exit').addEventListener('click', () => {
  $('#btn-stop-ar').click(); // Trigger the normal exit/feedback flow
});

$('#btn-quest-stay').addEventListener('click', () => {
  $('#quest-complete-overlay').style.display = 'none';
  $('#quest-finished-status').style.display = 'flex';
});

// ─── Photo Check-In Logic ────────────────────────────────────
let currentPhotoMarkerNumber = null;
let currentPhotoDataUrl = null;

// Automated Dashcam Capture (Silent)
window.handleDashcamPhoto = async (dataUrl, markerNumber) => {
  if (!dataUrl) return;

  // Upload to Supabase Storage
  const publicUrl = await uploadBase64Image(dataUrl, 'live-photos');
  if (!publicUrl) return;

  if (!state.activePlayerRecord.capturedPhotos) {
    state.activePlayerRecord.capturedPhotos = [];
  }

  state.activePlayerRecord.capturedPhotos.push({
    marker: markerNumber,
    imageUrl: publicUrl,
    timestamp: Date.now(),
    type: 'dashcam'
  });

  const ev = state.events.find(e => e.id === state.activeEventId);
  if (ev) {
    const pIdx = ev.players.findIndex(p => p.name === state.activePlayerRecord.name);
    if (pIdx !== -1) {
      ev.players[pIdx] = state.activePlayerRecord;
      updateEventInDB(ev.id, ev); // Background sync
    }
  }
};

// Selfie Mode Trigger
$('#btn-hud-take-photo').addEventListener('click', async () => {
  $('#btn-hud-take-photo').style.display = 'none';

  setTimeout(async () => {
    const dataUrl = await captureARImage();
    if (dataUrl) {
      currentPhotoDataUrl = dataUrl;
      // We don't have the explicit marker number here, so we derive it from the progress
      currentPhotoMarkerNumber = Math.max(1, state.activePlayerRecord.detectedMarkers ? state.activePlayerRecord.detectedMarkers.length : 1);

      $('#ar-photo-preview').src = dataUrl;
      $('#ar-photo-title').textContent = "Selfie Captured!";
      $('#ar-photo-confirm-overlay').style.display = 'flex';
    } else {
      $('#btn-hud-take-photo').style.display = 'flex';
    }
  }, 100);
});

// Cancel Selfie
$('#btn-photo-cancel').addEventListener('click', () => {
  $('#ar-photo-confirm-overlay').style.display = 'none';
  $('#btn-hud-take-photo').style.display = 'flex';
  currentPhotoDataUrl = null;
});

// Post Selfie to Live Feed
$('#btn-photo-post').addEventListener('click', async () => {
  if (!currentPhotoDataUrl) return;

  const btn = $('#btn-photo-post');
  const originalText = btn.textContent;
  btn.textContent = "Uploading...";
  btn.disabled = true;

  // Upload to Supabase Storage
  const publicUrl = await uploadBase64Image(currentPhotoDataUrl, 'live-photos');

  if (publicUrl) {
    if (!state.activePlayerRecord.capturedPhotos) {
      state.activePlayerRecord.capturedPhotos = [];
    }

    state.activePlayerRecord.capturedPhotos.push({
      marker: currentPhotoMarkerNumber,
      imageUrl: publicUrl,
      timestamp: Date.now(),
      type: 'selfie'
    });

    const ev = state.events.find(e => e.id === state.activeEventId);
    if (ev) {
      const pIdx = ev.players.findIndex(p => p.name === state.activePlayerRecord.name);
      if (pIdx !== -1) {
        ev.players[pIdx] = state.activePlayerRecord;
        await updateEventInDB(ev.id, ev);
      }
    }
  }

  btn.textContent = originalText;
  btn.disabled = false;
  $('#ar-photo-confirm-overlay').style.display = 'none';
  $('#btn-hud-take-photo').style.display = 'flex';
});

// ─── Settings Panel Logic ────────────────────────────────────
window.populateSettingsUI = () => {
  if (!state.settings) return;
  const silentDashcam = document.getElementById('setting-silent-dashcam');
  const telemetryFreq = document.getElementById('setting-telemetry-freq');
  const telemetryVal = document.getElementById('setting-telemetry-val');
  const consent = document.getElementById('setting-consent');
  const anonymize = document.getElementById('setting-anonymize');
  const timer = document.getElementById('setting-timer');
  const randomPath = document.getElementById('setting-random-path');

  if (silentDashcam) silentDashcam.checked = state.settings.silentDashcam;
  if (telemetryFreq) {
    telemetryFreq.value = state.settings.telemetryFrequency || 1000;
    if (telemetryVal) telemetryVal.textContent = `${telemetryFreq.value}ms`;
  }
  if (consent) consent.checked = state.settings.mandatoryConsent;
  if (anonymize) anonymize.checked = state.settings.anonymizeHunters;
  if (timer) timer.value = state.settings.globalQuestTimer || 15;
  if (randomPath) randomPath.checked = state.settings.randomizedPathing;
};

// Telemetry Slider Real-Time Label Update
const freqSlider = document.getElementById('setting-telemetry-freq');
if (freqSlider) {
  freqSlider.addEventListener('input', (e) => {
    const valSpan = document.getElementById('setting-telemetry-val');
    if (valSpan) valSpan.textContent = `${e.target.value}ms`;
  });
}

// Save Settings Event Handler
const btnSaveSettings = document.getElementById('btn-save-settings');
if (btnSaveSettings) {
  btnSaveSettings.addEventListener('click', () => {
    const silentDashcam = document.getElementById('setting-silent-dashcam');
    const telemetryFreq = document.getElementById('setting-telemetry-freq');
    const consent = document.getElementById('setting-consent');
    const anonymize = document.getElementById('setting-anonymize');
    const timer = document.getElementById('setting-timer');
    const randomPath = document.getElementById('setting-random-path');

    state.settings = {
      silentDashcam: silentDashcam ? silentDashcam.checked : true,
      telemetryFrequency: telemetryFreq ? parseInt(telemetryFreq.value) : 1000,
      mandatoryConsent: consent ? consent.checked : true,
      anonymizeHunters: anonymize ? anonymize.checked : false,
      globalQuestTimer: timer ? parseInt(timer.value) : 15,
      randomizedPathing: randomPath ? randomPath.checked : true
    };

    // Persist Settings
    localStorage.setItem('arthunt_settings', JSON.stringify(state.settings));

    alert("Configurations saved and persisted successfully!");
  });
}

// Consent Overlay Button Event Handlers — resolve the requireConsent() gate.
const btnConsentAgree = document.getElementById('btn-consent-agree');
if (btnConsentAgree) {
  btnConsentAgree.addEventListener('click', () => {
    $('#consent-overlay').style.display = 'none';
    if (consentResolver) { const r = consentResolver; consentResolver = null; r(true); }
  });
}

const btnConsentDecline = document.getElementById('btn-consent-decline');
if (btnConsentDecline) {
  btnConsentDecline.addEventListener('click', () => {
    $('#consent-overlay').style.display = 'none';
    if (consentResolver) { const r = consentResolver; consentResolver = null; r(false); }
  });
}

// Export All Telemetry (CSV) Handler
const btnExportTelemetry = document.getElementById('btn-export-telemetry');
if (btnExportTelemetry) {
  btnExportTelemetry.addEventListener('click', async () => {
    const rows = await getTelemetryRows();

    if (rows.length > 0) {
      // Prefer the raw append-only telemetry table (clean per-event rows,
      // no lost updates from the read-modify-write players JSONB blob).
      let csvContent = "Event ID,Participant,Kind,Marker,Timestamp,Data\n";
      rows.forEach(row => {
        const csvRow = [row.event_id, row.participant, row.kind, row.marker, row.ts, JSON.stringify(row.data)];
        csvContent += csvRow.map(csvField).join(',') + "\n";
      });

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement("a");
      link.setAttribute("href", URL.createObjectURL(blob));
      link.setAttribute("download", `arthunt_telemetry_raw_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      return;
    }

    if (!state.events || state.events.length === 0) {
      alert("No research event data found to export.");
      return;
    }

    let csvContent = "Event,Participant,Age,MarkersFound,StartTime,EndTime,TotalTimeSec,HintsUsed,ConsentStatus\n";

    state.events.forEach(ev => {
      if (ev.players) {
        ev.players.forEach(p => {
          const count = p.detectedMarkers ? p.detectedMarkers.length : 0;
          const timeSec = (p.endTime && p.startTime) ? Math.floor((p.endTime - p.startTime) / 1000) : "Incomplete";
          const startIso = p.startTime ? new Date(p.startTime).toISOString() : 'N/A';
          const endIso = p.endTime ? new Date(p.endTime).toISOString() : 'N/A';
          const row = [ev.name, p.name, p.age || 'N/A', count, startIso, endIso, timeSec, p.hintsUsed || 0, 'Consented'];
          csvContent += row.map(csvField).join(',') + "\n";
        });
      }
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.setAttribute("href", URL.createObjectURL(blob));
    link.setAttribute("download", `arthunt_telemetry_export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });
}
