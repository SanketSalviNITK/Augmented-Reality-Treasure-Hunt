/* ============================================================
   Demo Backend (?demo=1)
   ------------------------------------------------------------
   A drop-in replacement for the Supabase client that keeps all
   data in this browser's localStorage — no account, no keys, no
   network. Lets anyone dummy-test the full creator + hunter flow
   locally (including live AR with the webcam) before provisioning
   a real backend. Implements exactly the query-builder surface
   js/db.js uses: from().select/insert/update/delete/eq/order and
   storage.from().upload/getPublicUrl.
   ============================================================ */

const DB_KEY = 'arthunt_demo_db';

function loadDB() {
  try {
    return JSON.parse(localStorage.getItem(DB_KEY)) || { tables: {}, storage: {} };
  } catch (_) {
    return { tables: {}, storage: {} };
  }
}

function saveDB(db) {
  localStorage.setItem(DB_KEY, JSON.stringify(db)); // may throw QuotaExceededError — callers handle
}

function newId() {
  return (crypto.randomUUID) ? crypto.randomUUID()
    : 'demo-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10);
}

function rowsFor(db, table) {
  if (!db.tables[table]) db.tables[table] = [];
  return db.tables[table];
}

function makeQuery(table) {
  const q = {
    _op: 'select', _payload: null, _patch: null, _filters: [], _order: null,

    select() { return q; },
    insert(rows) { q._op = 'insert'; q._payload = rows; return q; },
    update(patch) { q._op = 'update'; q._patch = patch; return q; },
    delete() { q._op = 'delete'; return q; },
    eq(col, val) { q._filters.push([col, val]); return q; },
    order(col, opts) { q._order = [col, !opts || opts.ascending !== false]; return q; },

    then(resolve, reject) {
      try {
        resolve(exec(table, q));
      } catch (err) {
        // Match supabase-js: resolve with an error object, never reject.
        resolve({ data: null, error: { message: err.message } });
      }
      return Promise.resolve();
    }
  };
  return q;
}

function exec(table, q) {
  const db = loadDB();
  const rows = rowsFor(db, table);
  const matches = (r) => q._filters.every(([col, val]) => r[col] === val);

  if (q._op === 'insert') {
    const now = new Date().toISOString();
    const inserted = q._payload.map(r => ({ id: newId(), created_at: now, ts: now, ...r }));
    rows.push(...inserted);
    saveDB(db);
    return { data: inserted, error: null };
  }

  if (q._op === 'update') {
    rows.forEach((r, i) => { if (matches(r)) rows[i] = { ...r, ...q._patch }; });
    saveDB(db);
    return { data: null, error: null };
  }

  if (q._op === 'delete') {
    db.tables[table] = rows.filter(r => !matches(r));
    saveDB(db);
    return { data: null, error: null };
  }

  // select
  let out = rows.filter(matches);
  if (q._order) {
    const [col, asc] = q._order;
    out = [...out].sort((a, b) => (a[col] < b[col] ? -1 : a[col] > b[col] ? 1 : 0) * (asc ? 1 : -1));
  }
  return { data: out, error: null };
}

// ─── Storage: files become dataURLs in localStorage (small demo assets).
// Oversized uploads (e.g. big models / compiled buffers) that blow the
// quota report an error, which db.js already handles gracefully.

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

function makeStorage() {
  return {
    from() {
      return {
        async upload(path, file) {
          try {
            const dataUrl = await fileToDataUrl(file);
            const db = loadDB();
            db.storage[path] = dataUrl;
            saveDB(db); // throws on quota — caught below
            return { data: { path }, error: null };
          } catch (err) {
            return { data: null, error: { message: `Demo storage failed (likely too large for localStorage): ${err.message}` } };
          }
        },
        getPublicUrl(path) {
          const db = loadDB();
          return { data: { publicUrl: db.storage[path] || '' } };
        }
      };
    }
  };
}

export function installDemoBackend() {
  window.supabase = {
    createClient() {
      return { from: makeQuery, storage: makeStorage() };
    }
  };

  // Visible reminder that nothing is being saved to a real backend.
  const badge = document.createElement('div');
  badge.id = 'demo-badge';
  badge.textContent = 'DEMO MODE — data stays in this browser';
  badge.style.cssText = 'position:fixed; top:0; left:50%; transform:translateX(-50%); z-index:5000;'
    + 'background:#f59e0b; color:#18181b; font-size:0.7rem; font-weight:800; letter-spacing:0.5px;'
    + 'padding:4px 14px; border-radius:0 0 8px 8px; pointer-events:none; font-family:Inter,sans-serif;';
  document.body.appendChild(badge);
}
