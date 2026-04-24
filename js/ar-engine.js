/* ============================================================
   AR Engine (MindAR + Three.js)
   ============================================================ */

import { MindARThree } from 'mindar-image-three';
import { Compiler } from 'mindar-image';
import * as THREE from 'three';
import { state } from './state.js';
import { $, sections } from './utils.js';
import { loadModel, createTextCard } from './loaders.js';
import { launchConfetti } from './confetti.js';

export async function startAR() {
  console.log("Starting AR Session for event:", state.eventName);
  console.log("Markers to load:", state.markers.length);
  
  $('#compile-overlay').style.display = 'flex';
  $('#compile-progress').style.width = '5%';
  
  // Clear any leftover state
  state.mixers = [];
  
  try {
    const compiler = new Compiler();
    
    // Load images dynamically from URLs for compilation
    const imageElements = await Promise.all(state.markers.map((m, i) => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous'; 
        img.onload = () => {
          console.log(`Marker image ${i+1} loaded successfully`);
          resolve(img);
        };
        img.onerror = () => {
          console.error(`Failed to load marker image ${i+1}:`, m.imageUrl || 'No URL');
          reject(new Error(`Marker image ${i+1} failed to load`));
        };
        img.src = m.imageUrl || m.dataUrl;
      });
    }));

    console.log("Starting image target compilation...");
    await compiler.compileImageTargets(imageElements, (p) => {
      $('#compile-progress').style.width = `${p * 100}%`;
    });
    
    const buffer = await compiler.exportData();
    state.compiledBlobUrl = URL.createObjectURL(new Blob([buffer]));
    console.log("Compilation complete. Compiled data ready.");
    
    $('#compile-overlay').style.display = 'none';
    sections.setup.style.display = 'none';
    sections.ar.style.display = 'block';
    $('#ar-event-name').textContent = state.eventName;
    $('#btn-ar-save').style.display = state.isAdmin ? 'block' : 'none';
    
    // Initialize HUD Counter
    if ($('#total-count')) $('#total-count').textContent = state.markers.length;
    if ($('#detected-count')) {
      const initialCount = (state.activePlayerRecord && state.activePlayerRecord.detectedMarkers) 
        ? state.activePlayerRecord.detectedMarkers.length 
        : 0;
      $('#detected-count').textContent = initialCount;
    }
    
    await initARSession();
  } catch (err) { 
    console.error("AR Start Error:", err);
    alert(`Compiling failed: ${err.message || 'Unknown error'}`); 
    $('#compile-overlay').style.display = 'none'; 
  }
}

async function initARSession() {
  console.log("Initializing MindAR Session...");
  state.mindarThree = new MindARThree({ 
    container: $('#ar-container'), 
    imageTargetSrc: state.compiledBlobUrl,
    uiScanning: "no",
    uiLoading: "no"
  });
  
  const { renderer, scene, camera } = state.mindarThree;
  scene.add(new THREE.AmbientLight(0xffffff, 0.8));
  
  for (let i = 0; i < state.markers.length; i++) {
    const m = state.markers[i];
    const anchor = state.mindarThree.addAnchor(i);
    
    if (m.type === 'model') {
      if (!m.modelUrl && !m.modelFile) {
        console.warn(`Marker ${i+1} is missing a 3D model. Skipping.`);
        continue;
      }
      
      const modelName = m.modelFileName || (m.modelFile ? m.modelFile.name : 'model.glb');
      console.log(`Loading 3D model for marker ${i+1}:`, modelName);
      
      try {
        const { model, mixer } = await loadModel(m.modelUrl, modelName, m.scale);
        anchor.group.add(model);
        if (mixer) state.mixers.push({ mixer, clock: new THREE.Clock() });
        console.log(`Model ${i+1} loaded and added to anchor.`);
      } catch (loadErr) {
        console.error(`Failed to load model ${i+1}:`, loadErr);
      }
    } else {
      anchor.group.add(createTextCard(m.text, m.color));
    }
    
    anchor.onTargetFound = () => { 
      $('#tracking-badge').classList.add('found'); 
      $('#tracking-label').textContent = 'Detected'; 
      
      if (state.activePlayerRecord && !state.isAdmin) {
        if (!state.activePlayerRecord.detectedMarkers) {
          state.activePlayerRecord.detectedMarkers = [];
        }
        const markerNumber = i + 1;
        if (!state.activePlayerRecord.detectedMarkers.includes(markerNumber)) {
          state.activePlayerRecord.detectedMarkers.push(markerNumber);
          
          // Update HUD Counter
          const currentCount = state.activePlayerRecord.detectedMarkers.length;
          if ($('#detected-count')) $('#detected-count').textContent = currentCount;
          
          console.log(`Progress: ${currentCount} / ${state.markers.length}`);

          // Sync to DB immediately for EVERY marker found
          import('./db.js').then(({ updateEventInDB }) => {
            const ev = state.events.find(e => e.id === state.activeEventId);
            if (ev) {
              const pIdx = ev.players.findIndex(p => p.name === state.activePlayerRecord.name);
              if (pIdx !== -1) {
                ev.players[pIdx] = state.activePlayerRecord; // Ensure DB object has latest stats
                updateEventInDB(ev.id, ev);
              }
            }
          });

          // Play Scan Sound
          if (state.audioEnabled) {
            const sfx = document.getElementById('sfx-scan');
            if (sfx) {
              sfx.currentTime = 0;
              sfx.play();
            }
          }

          // Update Hunter Leaderboard & Clues
          if (window.renderHunterLeaderboard) window.renderHunterLeaderboard();
          if (window.updateHUDClue) window.updateHUDClue();

          // Check for Quest Completion
          if (currentCount === state.markers.length) {
            console.log("QUEST COMPLETE! Triggering celebration...");
            
            // Play Victory Sound
            if (state.audioEnabled) {
              const victorySfx = document.getElementById('sfx-victory');
              if (victorySfx) victorySfx.play();
            }

            // HCI: Track completion time for leaderboard persistence
            if (state.activePlayerRecord && !state.activePlayerRecord.endTime) {
              state.activePlayerRecord.endTime = Date.now();
              // One final sync for the end time
              import('./db.js').then(({ updateEventInDB }) => {
                const ev = state.events.find(e => e.id === state.activeEventId);
                if (ev) updateEventInDB(ev.id, ev);
              });
            }

            setTimeout(() => {
              $('#quest-complete-overlay').style.display = 'flex';
              launchConfetti();
            }, 1500); 
          }

          if (state.activeEventId) {
            import('./db.js').then(({ updateEventInDB }) => {
              const ev = state.events.find(e => e.id === state.activeEventId);
              if (ev) updateEventInDB(state.activeEventId, ev); 
            }).catch(err => console.error("DB sync failed", err));
          }
        }
      }
    };
    anchor.onTargetLost = () => { 
      $('#tracking-badge').classList.remove('found'); 
      $('#tracking-label').textContent = 'Searching for marker…'; 
    };
  }
  
  console.log("Starting MindAR Three engine...");
  await state.mindarThree.start();
  renderer.setAnimationLoop(() => {
    state.mixers.forEach(m => m.mixer.update(m.clock.getDelta()));
    renderer.render(scene, camera);
  });
}

export function stopAR() {
  if (state.mindarThree) {
    state.mindarThree.stop();
    state.mindarThree = null;
  }
  
  // Clear mixers and clocks
  state.mixers = [];
  
  // Hide overlays
  $('#quest-complete-overlay').style.display = 'none';
  $('#quest-finished-status').style.display = 'none';
  
  document.querySelectorAll('video').forEach(v => { 
    if (v.srcObject) { 
      v.srcObject.getTracks().forEach(t => t.stop()); 
      v.srcObject = null; 
    } 
  });
  
  $('#ar-container').innerHTML = '';
}

export function pauseAR() {
  if (state.mindarThree) {
    state.mindarThree.stop();
  }
}

export async function resumeAR() {
  if (state.mindarThree) {
    await state.mindarThree.start();
  }
}
