import test from 'node:test';
import assert from 'node:assert/strict';

import {
  parseDeepLinkEventId,
  buildEventShareLink,
  resolveBackAction,
} from '../../js/navigation.js';

test('parseDeepLinkEventId', async (t) => {
  await t.test('reads ?event=', () => {
    assert.equal(parseDeepLinkEventId('?event=abc123', ''), 'abc123');
  });

  await t.test('reads ?e= as a shorthand', () => {
    assert.equal(parseDeepLinkEventId('?e=xyz', ''), 'xyz');
  });

  await t.test('prefers ?event over ?e when both are present', () => {
    assert.equal(parseDeepLinkEventId('?event=first&e=second', ''), 'first');
  });

  await t.test('trims whitespace and rejects a blank value', () => {
    assert.equal(parseDeepLinkEventId('?event=%20%20', ''), null);
    assert.equal(parseDeepLinkEventId('?event= abc ', ''), 'abc');
  });

  await t.test('reads a #/join/<id> hash route', () => {
    assert.equal(parseDeepLinkEventId('', '#/join/e42'), 'e42');
  });

  await t.test('URL-decodes the hash id', () => {
    assert.equal(parseDeepLinkEventId('', '#/join/hello%20world'), 'hello world');
  });

  await t.test('query takes priority over the hash route', () => {
    assert.equal(parseDeepLinkEventId('?event=fromQuery', '#/join/fromHash'), 'fromQuery');
  });

  await t.test('stops the hash id at a following slash, ?, or &', () => {
    assert.equal(parseDeepLinkEventId('', '#/join/abc/extra'), 'abc');
    assert.equal(parseDeepLinkEventId('', '#/join/abc?x=1'), 'abc');
  });

  await t.test('returns null for an empty or unrelated URL', () => {
    assert.equal(parseDeepLinkEventId('', ''), null);
    assert.equal(parseDeepLinkEventId('?foo=bar', '#/somewhere-else'), null);
  });

  await t.test('tolerates a malformed query string', () => {
    // Should fall through to checking the hash instead of throwing.
    assert.equal(parseDeepLinkEventId('%', '#/join/fallback'), 'fallback');
  });
});

test('buildEventShareLink', async (t) => {
  await t.test('builds a plain ?event= link', () => {
    assert.equal(
      buildEventShareLink('https://example.com', '/', 'e1'),
      'https://example.com/?event=e1'
    );
  });

  await t.test('strips an existing query string', () => {
    assert.equal(
      buildEventShareLink('https://example.com', '/?old=1', 'e1'),
      'https://example.com/?event=e1'
    );
  });

  await t.test('strips an existing hash', () => {
    assert.equal(
      buildEventShareLink('https://example.com', '/#/join/other', 'e1'),
      'https://example.com/?event=e1'
    );
  });

  await t.test('strips both query and hash together', () => {
    assert.equal(
      buildEventShareLink('https://example.com', '/path?old=1#frag', 'e1'),
      'https://example.com/path?event=e1'
    );
  });

  await t.test('URL-encodes the event id', () => {
    assert.equal(
      buildEventShareLink('https://example.com', '/', 'hello world/&'),
      'https://example.com/?event=hello%20world%2F%26'
    );
  });
});

test('resolveBackAction', async (t) => {
  await t.test('an open overlay always wins first', () => {
    assert.deepEqual(
      resolveBackAction({ openOverlayId: 'consent-overlay', arVisible: true, atPortal: true, activePanelId: 'step-review' }),
      { type: 'close-overlay', id: 'consent-overlay' }
    );
  });

  await t.test('AR visibility wins over portal / panel state', () => {
    assert.deepEqual(
      resolveBackAction({ arVisible: true, atPortal: true, activePanelId: 'step-review' }),
      { type: 'stop-ar' }
    );
  });

  await t.test('being at the portal (no overlay/AR) exits the app', () => {
    assert.deepEqual(resolveBackAction({ atPortal: true }), { type: 'exit' });
  });

  await t.test('maps known panels to their own cancel/back button', () => {
    assert.deepEqual(resolveBackAction({ activePanelId: 'step-review' }), { type: 'click', id: 'btn-back-review' });
    assert.deepEqual(resolveBackAction({ activePanelId: 'step-crop' }), { type: 'click', id: 'btn-cancel-crop' });
    assert.deepEqual(resolveBackAction({ activePanelId: 'step-marker-config' }), { type: 'click', id: 'btn-back-marker' });
    assert.deepEqual(resolveBackAction({ activePanelId: 'step-admin-count' }), { type: 'click', id: 'btn-cancel-event' });
    assert.deepEqual(resolveBackAction({ activePanelId: 'step-live-monitor' }), { type: 'click', id: 'btn-monitor-back' });
  });

  await t.test('dashboards and terminal panels soft-reset to the portal', () => {
    for (const id of ['step-admin-dashboard', 'step-player-dashboard', 'step-post-hunt-leaderboard', 'step-feedback', 'step-0']) {
      assert.deepEqual(resolveBackAction({ activePanelId: id }), { type: 'reset-portal' });
    }
  });

  await t.test('an unknown panel also falls back to reset-portal', () => {
    assert.deepEqual(resolveBackAction({ activePanelId: 'some-unmapped-panel' }), { type: 'reset-portal' });
  });

  await t.test('no panel/overlay/AR/portal at all still falls back to reset-portal', () => {
    assert.deepEqual(resolveBackAction({}), { type: 'reset-portal' });
  });
});
