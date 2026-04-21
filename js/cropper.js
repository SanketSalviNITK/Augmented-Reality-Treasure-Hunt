/* ============================================================
   Interactive Cropper Logic
   ============================================================ */

import { state } from './state.js';
import { $, showPanel, sections } from './utils.js';

let isDragging = false, isResizing = false, currentHandle = null;
let startX, startY, startPos;

export function initCrop(img, onComplete) {
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
  
  // Wire up confirmation
  const confirmBtn = $('#btn-confirm-crop');
  confirmBtn.onclick = () => {
    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = state.cropPos.w; cropCanvas.height = state.cropPos.h;
    cropCanvas.getContext('2d').drawImage(canvas, state.cropPos.x, state.cropPos.y, state.cropPos.w, state.cropPos.h, 0, 0, state.cropPos.w, state.cropPos.h);
    onComplete(cropCanvas.toDataURL('image/png'));
  };
}

export function updateCropUI() {
  const box = $('#crop-box');
  box.style.left = `${(state.cropPos.x / 600) * 100}%`;
  box.style.top = `${(state.cropPos.y / 600) * 100}%`;
  box.style.width = `${(state.cropPos.w / 600) * 100}%`;
  box.style.height = `${(state.cropPos.h / 600) * 100}%`;
}

// Global window listeners for drag/resize
window.addEventListener('mousemove', (e) => {
  if (!isDragging && !isResizing) return;
  const dx = (e.clientX - startX) * (600 / $('#crop-container').clientWidth);
  const dy = (e.clientY - startY) * (600 / $('#crop-container').clientWidth);
  
  if (isDragging) {
    state.cropPos.x = Math.max(0, Math.min(600 - state.cropPos.w, startPos.x + dx));
    state.cropPos.y = Math.max(0, Math.min(600 - state.cropPos.h, startPos.y + dy));
  } else if (isResizing) {
    if (currentHandle === 'br') {
      state.cropPos.w = Math.max(50, Math.min(600 - startPos.x, startPos.w + dx));
      state.cropPos.h = Math.max(50, Math.min(600 - startPos.y, startPos.h + dy));
    } else if (currentHandle === 'tl') {
      const newX = Math.max(0, Math.min(startPos.x + startPos.w - 50, startPos.x + dx));
      state.cropPos.w = startPos.w + (startPos.x - newX); 
      state.cropPos.x = newX;
      const newY = Math.max(0, Math.min(startPos.y + startPos.h - 50, startPos.y + dy));
      state.cropPos.h = startPos.h + (startPos.y - newY); 
      state.cropPos.y = newY;
    }
  }
  updateCropUI();
});

window.addEventListener('mouseup', () => { isDragging = isResizing = false; });

// Initialize interaction
export function setupCropperEvents() {
  $('#crop-box').addEventListener('mousedown', (e) => {
    if (e.target.classList.contains('crop-handle')) { 
      isResizing = true; 
      currentHandle = e.target.classList[1]; 
    } else { 
      isDragging = true; 
    }
    startX = e.clientX; startY = e.clientY; startPos = { ...state.cropPos };
    e.preventDefault();
  });
}
