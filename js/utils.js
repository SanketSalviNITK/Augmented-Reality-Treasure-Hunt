/* ============================================================
   DOM Utilities
   ============================================================ */

export const $ = (s) => document.querySelector(s);
export const $$ = (s) => document.querySelectorAll(s);

export const sections = {
  welcome: $('#step-0'),
  adminCount: $('#step-admin-count'),
  config: $('#step-marker-config'),
  crop: $('#step-crop'),
  review: $('#step-review'),
  ar: $('#ar-screen'),
  setup: $('#setup-screen')
};

export function showPanel(panel) {
  $$('.step-panel').forEach(p => p.classList.remove('active'));
  panel.classList.add('active');
}

export function roundRect(ctx, x, y, w, h, r, f) {
  ctx.beginPath(); 
  ctx.moveTo(x+r, y); 
  ctx.lineTo(x+w-r, y); 
  ctx.quadraticCurveTo(x+w, y, x+w, y+r);
  ctx.lineTo(x+w, y+h-r); 
  ctx.quadraticCurveTo(x+w, y+h, x+w-r, y+h); 
  ctx.lineTo(x+r, y+h);
  ctx.quadraticCurveTo(x, y+h, x, y+h-r); 
  ctx.lineTo(x, y+r); 
  ctx.quadraticCurveTo(x, y, x+r, y);
  ctx.closePath(); 
  if (f) ctx.fill();
}
