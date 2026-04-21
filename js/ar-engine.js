/* ============================================================
   AR Engine (MindAR + Three.js)
   ============================================================ */

import { MindARThree } from 'mindar-image-three';
import { Compiler } from 'mindar-image';
import * as THREE from 'three';
import { state } from './state.js';
import { $, sections } from './utils.js';
import { loadModel, createTextCard } from './loaders.js';

export async function startAR() {
  $('#compile-overlay').style.display = 'flex';
  $('#compile-progress').style.width = '5%';
  
  try {
    const compiler = new Compiler();
    
    // Load images dynamically from URLs for compilation
    const imageElements = await Promise.all(state.markers.map(m => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous'; 
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = m.imageUrl || m.dataUrl;
      });
    }));

    await compiler.compileImageTargets(imageElements, (p) => {
      $('#compile-progress').style.width = `${p * 100}%`;
    });
    const buffer = await compiler.exportData();
    state.compiledBlobUrl = URL.createObjectURL(new Blob([buffer]));
    
    $('#compile-overlay').style.display = 'none';
    sections.setup.style.display = 'none';
    sections.ar.style.display = 'block';
    $('#ar-event-name').textContent = state.eventName;
    $('#btn-ar-save').style.display = state.isAdmin ? 'block' : 'none';
    
    await initARSession();
  } catch (err) { 
    console.error(err);
    alert('Compiling failed'); 
    $('#compile-overlay').style.display = 'none'; 
  }
}

async function initARSession() {
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
      const { model, mixer } = await loadModel(m.modelUrl, m.modelFile.name, m.scale);
      anchor.group.add(model);
      if (mixer) state.mixers.push({ mixer, clock: new THREE.Clock() });
    } else {
      anchor.group.add(createTextCard(m.text, m.color));
    }
    
    anchor.onTargetFound = () => { 
      $('#tracking-badge').classList.add('found'); 
      $('#tracking-label').textContent = 'Detected'; 
      
      // Track the sequence of detected markers for the active player
      if (state.activePlayerRecord && !state.isAdmin) {
        if (!state.activePlayerRecord.detectedMarkers) {
          state.activePlayerRecord.detectedMarkers = [];
        }
        const markerNumber = i + 1; // 1-indexed for readability
        if (!state.activePlayerRecord.detectedMarkers.includes(markerNumber)) {
          state.activePlayerRecord.detectedMarkers.push(markerNumber);
          
          // Sync with database
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
  
  // Release all camera tracks
  document.querySelectorAll('video').forEach(v => { 
    if (v.srcObject) { 
      v.srcObject.getTracks().forEach(t => t.stop()); 
      v.srcObject = null; 
    } 
  });
  
  // Fully remove AR injected elements from the DOM
  $('#ar-container').innerHTML = '';
}
