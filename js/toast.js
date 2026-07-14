/* ============================================================
   Toast Notifications
   ------------------------------------------------------------
   Non-blocking replacement for alert(): shows a transient card
   at the bottom of the screen instead of freezing the page.
   Types: info | success | warn | error. Click to dismiss early.
   ============================================================ */

let container = null;

function ensureContainer() {
  if (container && document.body.contains(container)) return container;
  container = document.createElement('div');
  container.id = 'toast-container';
  document.body.appendChild(container);
  return container;
}

export function toast(message, { type = 'info', duration = 3500 } = {}) {
  const host = ensureContainer();
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.setAttribute('role', 'status');
  el.textContent = message;

  const dismiss = () => {
    el.classList.add('toast-out');
    setTimeout(() => el.remove(), 250);
  };
  el.addEventListener('click', dismiss);
  host.appendChild(el);

  // Force a frame so the enter transition plays
  requestAnimationFrame(() => el.classList.add('toast-in'));
  setTimeout(dismiss, duration);
  return el;
}
