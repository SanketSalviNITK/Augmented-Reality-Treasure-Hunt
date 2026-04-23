/* ============================================================
   AR Treasure Hunt — Main Entry Point
   ============================================================ */

import { state, ADMIN_PASSWORD } from './js/state.js';
import { $, $$, sections, showPanel } from './js/utils.js';
import { initCrop, setupCropperEvents } from './js/cropper.js';
import { startAR, stopAR } from './js/ar-engine.js';

import * as THREE from 'three';
import { saveEventToDB, getEventsFromDB, deleteEventFromDB, updateEventInDB, saveFeedbackToDB, getFeedbackFromDB } from './js/db.js';
import { initLandingAnimation, stopLandingAnimation } from './js/landing.js';

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

// ─── Initial Loading ──────────────────────────────────────────
const loadingOverlay = $('#loading-overlay');
const loadingProgress = $('#loading-progress');
const btnStartExp = $('#btn-start-experience');
const landingRoot = $('#landing-root');

// HCI: Only show loading/intro once per session
if (sessionStorage.getItem('systemEntered') === 'true') {
  loadingOverlay.style.display = 'none';
  landingRoot.classList.remove('zoomed-out');
  initLandingAnimation();
} else {
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

btnStartExp.addEventListener('click', () => {
  sessionStorage.setItem('systemEntered', 'true');
  // Start music
  if (!isMusicPlaying && bgMusic.paused) {
    bgMusic.play().then(() => {
      isMusicPlaying = true;
      iconOn.style.display = 'block';
      iconOff.style.display = 'none';
    }).catch(() => {});
  }
  
  // Transition overlay
  loadingOverlay.style.opacity = '0';
  setTimeout(() => {
    loadingOverlay.style.display = 'none';
  }, 800);
  
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

$('#btn-enter-creator').addEventListener('click', () => transitionFromLanding('creator'));
$('#btn-enter-hunter').addEventListener('click', () => transitionFromLanding('hunter'));

$('#btn-back-to-portal').addEventListener('click', () => {
  // Use reload to ensure all state is cleared and we return to the very beginning
  window.location.reload();
});

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

$('#btn-admin-logout').addEventListener('click', () => {
  // Full reload to return to the landing portal and clear all session states
  window.location.reload();
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
  window.location.reload();
});

// ─── Dashboards ──────────────────────────────────────────────
let analyticsChartInstance = null;

async function renderAdminDashboard() {
  const activeList = $('#admin-event-list-active');
  const inactiveList = $('#admin-event-list-inactive');
  if (activeList) activeList.innerHTML = '';
  if (inactiveList) inactiveList.innerHTML = '';
  
  let totalHunters = 0;
  let activeEventCount = 0;
  
  // Render Event Lists
  if (state.events.length === 0) {
    if (activeList) activeList.innerHTML = '<p style="color:var(--text-secondary); text-align:center; font-size:0.85rem; padding: 20px;">No active events.</p>';
    if (inactiveList) inactiveList.innerHTML = '<p style="color:var(--text-secondary); text-align:center; font-size:0.85rem; padding: 20px;">No inactive events.</p>';
  } else {
    state.events.forEach((ev, index) => {
      let playersHtml = '<p style="color:var(--text-muted); font-size:0.8rem; text-align:center; padding:10px;">No participants yet.</p>';
      let isActive = ev.status !== 'inactive';
      
      if (ev.players && ev.players.length > 0) {
        isActive = true;
        totalHunters += ev.players.length;
        activeEventCount++;

        // Sort players for leaderboard: 1. Most markers, 2. Least time
        const sortedPlayers = [...ev.players].sort((a, b) => {
          if ((b.detectedMarkers?.length || 0) !== (a.detectedMarkers?.length || 0)) {
            return (b.detectedMarkers?.length || 0) - (a.detectedMarkers?.length || 0);
          }
          return (a.startTime || 0) - (b.startTime || 0); 
        });

        playersHtml = sortedPlayers.map((p, pIdx) => {
          const count = p.detectedMarkers ? p.detectedMarkers.length : 0;
          const total = ev.markers ? ev.markers.length : 0;
          const percent = total > 0 ? (count / total) * 100 : 0;
          const score = count * 100;
          
          let timeStr = '---';
          if (p.startTime) {
            const diff = Date.now() - p.startTime;
            const mins = Math.floor(diff / 60000);
            const secs = Math.floor((diff % 60000) / 1000);
            timeStr = `${mins}m ${secs}s`;
          }

          return `
            <div class="leaderboard-row" style="display: flex; align-items: center; justify-content: space-between; padding: 12px; border-bottom: 1px solid rgba(255,255,255,0.05); gap: 12px;">
              <div style="display: flex; align-items: center; gap: 12px; flex: 1;">
                <span style="font-weight: 800; color: ${pIdx < 3 ? 'var(--accent-emerald)' : 'var(--text-muted)'}; min-width: 20px;">#${pIdx + 1}</span>
                <div style="flex: 1;">
                  <div style="font-weight: 600; font-size: 0.9rem; color: white; display: flex; justify-content: space-between;">
                    <span>${p.name}</span>
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

      card.innerHTML = `
        <div class="event-card-header" onclick="window.toggleEventDetails(${index})" style="cursor: pointer; padding: 16px; display: flex; justify-content: space-between; align-items: center; transition: background 0.2s;">
          <div>
            <h3 style="margin: 0; font-size: 1.1rem; color: white;">${ev.name}</h3>
            <p style="margin: 4px 0 0 0; font-size: 0.8rem; color: var(--text-secondary);">
              ${ev.markers ? ev.markers.length : 0} Markers • ${ev.players ? ev.players.length : 0} Participants
            </p>
          </div>
          <div style="display: flex; align-items: center; gap: 12px;">
            <button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); window.deleteEvent(${index})" style="border: 1px solid rgba(255,100,100,0.3); color: #f87171;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
            <svg id="chevron-${index}" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="transition: transform 0.3s ease;"><polyline points="6 9 12 15 18 9"></polyline></svg>
          </div>
        </div>
        
        <div id="event-details-${index}" class="event-details" style="max-height: 0; overflow: hidden; transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1); background: rgba(0,0,0,0.15); opacity: 0;">
          <div style="padding: 0 16px 16px 16px;">
            <div style="margin-bottom: 12px; font-size: 0.75rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px;">
              Live Leaderboard
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
    const data = Array.from({length: 7}, () => Math.floor(Math.random() * (totalHunters * 2 + 5)));

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

window.toggleEventDetails = (index) => {
  const details = document.getElementById(`event-details-${index}`);
  const chevron = document.getElementById(`chevron-${index}`);
  if (details.style.maxHeight === '0px' || !details.style.maxHeight) {
    details.style.maxHeight = '500px';
    details.style.opacity = '1';
    chevron.style.transform = 'rotate(180deg)';
  } else {
    details.style.maxHeight = '0px';
    details.style.opacity = '0';
    chevron.style.transform = 'rotate(0deg)';
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
    
    document.querySelectorAll('.dash-tab').forEach(t => t.style.display = 'none');
    document.getElementById(e.target.dataset.tab).style.display = 'block';
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
  
  // Find or create player record
  let playerRecord = ev.players.find(p => p.name === state.player.name);
  if (!playerRecord) {
    playerRecord = { 
      name: state.player.name, 
      age: state.player.age, 
      detectedMarkers: [],
      startTime: Date.now() // Track when they started for leaderboard
    };
    ev.players.push(playerRecord);
    await updateEventInDB(ev.id, ev);
  } else if (!playerRecord.startTime) {
    // Retroactively add startTime for existing players if missing
    playerRecord.startTime = Date.now();
    await updateEventInDB(ev.id, ev);
  }
  
  state.activePlayerRecord = playerRecord;
  state.activeEventId = ev.id;
  
  state.eventName = ev.name;
  state.markers = ev.markers;
  
  // Initialize and show Hunter Leaderboard
  window.renderHunterLeaderboard();
  
  startAR();
};

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
    
    return `
      <div style="display: flex; align-items: center; justify-content: space-between; padding: 6px 12px; background: ${isMe ? 'rgba(6, 182, 212, 0.1)' : 'transparent'}; border-left: 2px solid ${isMe ? 'var(--accent-cyan)' : 'transparent'};">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-size: 0.7rem; font-weight: 800; color: ${idx < 3 ? 'var(--accent-emerald)' : 'var(--text-muted)'};">#${idx + 1}</span>
          <span style="font-size: 0.75rem; color: ${isMe ? 'white' : 'var(--text-secondary)'}; font-weight: ${isMe ? '700' : '500'};">
            ${p.name} ${isMe ? '(YOU)' : ''}
          </span>
        </div>
        <span style="font-size: 0.75rem; font-weight: 800; color: white;">${count}</span>
      </div>
    `;
  }).join('');
};

// Hunter Leaderboard Toggle
$('#btn-toggle-leaderboard').addEventListener('click', () => {
  const panel = $('#hunter-leaderboard-panel');
  const isHidden = panel.style.display === 'none' || !panel.style.display;
  panel.style.display = isHidden ? 'block' : 'none';
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
  document.querySelectorAll('.question-item').forEach(item => {
    const question = item.dataset.question;
    const activeBtn = item.querySelector('.rating-btn.active');
    ratings[question] = activeBtn ? activeBtn.dataset.value : 0;
  });

  console.log("Research Data Collected:", ratings);
  
  // Save to Supabase
  await saveFeedbackToDB(ratings);
  
  // Return to portal after feedback
  alert("Thank you for participating in our research! Your feedback has been saved to our database.");
  window.location.reload();
});

// Quest Completion Overlay Handlers
$('#btn-quest-exit').addEventListener('click', () => {
  $('#btn-stop-ar').click(); // Trigger the normal exit/feedback flow
});

$('#btn-quest-stay').addEventListener('click', () => {
  $('#quest-complete-overlay').style.display = 'none';
  $('#quest-finished-status').style.display = 'flex';
});
