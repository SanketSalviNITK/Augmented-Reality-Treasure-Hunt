/* ============================================================
   Navigation helpers — deep links, share links, and Back-button
   routing. These functions are intentionally pure (no DOM access)
   so they can be unit-tested; main.js wires them to the DOM.
   ============================================================ */

// Parse a hunter deep link from the URL. Supports both a query param
// (?event=<id> / ?e=<id>) and a hash route (#/join/<id>). Returns the
// event id string, or null when there is no deep link.
export function parseDeepLinkEventId(search = '', hash = '') {
  try {
    const params = new URLSearchParams(search || '');
    const q = params.get('event') || params.get('e');
    if (q && q.trim()) return q.trim();
  } catch (_) { /* malformed query — fall through */ }

  const m = /#\/join\/([^/?&]+)/.exec(hash || '');
  if (m && m[1]) return decodeURIComponent(m[1]).trim() || null;

  return null;
}

// Build a shareable hunter link for a given event id.
export function buildEventShareLink(origin = '', pathname = '/', eventId = '') {
  const base = `${origin}${pathname}`.replace(/[?#].*$/, '');
  return `${base}?event=${encodeURIComponent(eventId)}`;
}

// Decide what the browser Back button should do, given the currently
// visible UI. Returns a small action descriptor that main.js maps to
// concrete DOM behaviour. Overlays take priority over screens.
//
//   { type: 'close-overlay', id }  → dismiss/cancel the open overlay
//   { type: 'stop-ar' }            → leave the AR session
//   { type: 'click', id }          → click an existing back/cancel button
//   { type: 'reset-portal' }       → soft-return to the landing portal
//   { type: 'exit' }               → let the browser navigate away
export function resolveBackAction({ openOverlayId = null, arVisible = false, activePanelId = null, atPortal = false } = {}) {
  if (openOverlayId) return { type: 'close-overlay', id: openOverlayId };
  if (arVisible) return { type: 'stop-ar' };
  if (atPortal) return { type: 'exit' };

  switch (activePanelId) {
    case 'step-review':          return { type: 'click', id: 'btn-back-review' };
    case 'step-crop':            return { type: 'click', id: 'btn-cancel-crop' };
    case 'step-marker-config':   return { type: 'click', id: 'btn-back-marker' };
    case 'step-admin-count':     return { type: 'click', id: 'btn-cancel-event' };
    case 'step-live-monitor':    return { type: 'click', id: 'btn-monitor-back' };
    case 'step-admin-dashboard': return { type: 'reset-portal' };
    case 'step-player-dashboard':return { type: 'reset-portal' };
    case 'step-post-hunt-leaderboard': return { type: 'reset-portal' };
    case 'step-feedback':        return { type: 'reset-portal' };
    case 'step-0':               return { type: 'reset-portal' };
    default:                     return { type: 'reset-portal' };
  }
}
