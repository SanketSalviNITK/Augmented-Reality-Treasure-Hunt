/* ============================================================
   Sensing (Network / Battery / Location sampling)
   ------------------------------------------------------------
   Periodically samples web-observable connectivity, battery,
   and location signals during a hunt and appends rows to the
   telemetry table (kind 'net_sample'), anchored to hunt
   progress via the number of markers found so far. This is the
   Phase-0 data channel for RSSI/navigation research — later
   phases can join these samples against marker scan events to
   study coverage and interpolate position between markers.
   ============================================================ */

import { state } from './state.js';

let intervalId = null;
let cachedBattery = null;

async function getNetSample() {
  const conn = navigator.connection;
  if (!conn) return null;
  return {
    effectiveType: conn.effectiveType,
    downlink: conn.downlink,
    rtt: conn.rtt
  };
}

async function getBatterySample() {
  try {
    if (typeof navigator.getBattery !== 'function') return null;
    if (!cachedBattery) {
      // Cache the battery object after first resolve — re-requesting it
      // every tick is unnecessary and can be slow on some devices.
      cachedBattery = await navigator.getBattery();
    }
    return {
      level: cachedBattery.level,
      charging: cachedBattery.charging
    };
  } catch (err) {
    console.debug('Battery sampling failed:', err);
    return null;
  }
}

function getCurrentPositionAsync(options) {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, options);
  });
}

async function getGeoSample() {
  try {
    if (!navigator.permissions?.query) return null;
    // Only sample location if permission is already granted — never trigger
    // a permission prompt mid-hunt.
    const status = await navigator.permissions.query({ name: 'geolocation' });
    if (status.state !== 'granted') return null;

    const pos = await getCurrentPositionAsync({
      maximumAge: 10000,
      timeout: 4000,
      enableHighAccuracy: true
    });

    return {
      lat: Math.round(pos.coords.latitude * 1e6) / 1e6,
      lng: Math.round(pos.coords.longitude * 1e6) / 1e6,
      accuracy: pos.coords.accuracy
    };
  } catch (err) {
    console.debug('Geolocation sampling failed:', err);
    return null;
  }
}

async function sampleTick() {
  try {
    if (!state.activePlayerRecord) {
      stopSensing();
      return;
    }

    const [net, battery, geo] = await Promise.all([
      getNetSample(),
      getBatterySample(),
      getGeoSample()
    ]);

    const data = {
      net,
      battery,
      geo,
      found: state.activePlayerRecord?.detectedMarkers?.length || 0
    };

    import('./db.js').then(({ logTelemetry }) => {
      // Re-check: the hunt may have ended while we were sampling.
      if (state.activePlayerRecord && state.activeEventId) {
        logTelemetry(state.activeEventId, state.activePlayerRecord.name, 'net_sample', null, data);
      }
    }).catch(err => console.debug('Telemetry import failed:', err));
  } catch (err) {
    console.debug('Sensing tick failed:', err);
  }
}

export function startSensing() {
  if (intervalId) return;

  // Only meaningful for hunters actively playing an event.
  if (!state.activePlayerRecord || !state.activeEventId) return;

  // Clamp between 5s and 60s — sub-5s sampling would spam the DB, and
  // anything slower than a minute is too coarse to anchor to progress.
  const intervalMs = Math.min(60000, Math.max(5000, state.settings?.telemetryFrequency || 5000));

  intervalId = setInterval(sampleTick, intervalMs);
}

export function stopSensing() {
  clearInterval(intervalId);
  intervalId = null;
}
