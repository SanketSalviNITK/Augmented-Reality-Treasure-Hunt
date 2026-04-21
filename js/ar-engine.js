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
    await compiler.compileImageTargets(state.markers.map(m => m.image), (p) => {
      $('#compile-progress').style.width = `${p * 100}%`;
    });
    const buffer = await compiler.exportData();
    state.compiledBlobUrl = URL.createObjectURL(new Blob([buffer]));
    
    $('#compile-overlay').style.display = 'none';
    sections.setup.style.display = 'none';
    sections.ar.style.display = 'block';
    $('#ar-event-name').textContent = state.eventName;
    
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
    imageTargetSrc: state.compiledBlobUrl 
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
  if (state.mindarThree) state.mindarThree.stop();
  
  // Release all camera tracks
  document.querySelectorAll('video').forEach(v => { 
    if (v.srcObject) { 
      v.srcObject.getTracks().forEach(t => t.stop()); 
      v.srcObject = null; 
    } 
  });
}
