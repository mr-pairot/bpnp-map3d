/* js/tools/my_location.js
 * ─────────────────────────────────────────────────────────────────────────
 * ปุ่มตำแหน่งปัจจุบัน 3 สถานะ (เหมือนเดิม)
 *   0 ปิด → 1 แสดงตำแหน่ง (บินไปครั้งแรก) → 2 ล็อกติดตาม + กันจอดับ → 0
 * ใช้ navigator.geolocation.watchPosition (แทน map.locate ของ Leaflet)
 * วงความแม่นยำเป็น GeoJSON (registry slot 'tools')
 * ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  const USER_ZOOM      = BPNP.geo.fromLeafletZoom(16);
  const FLY_DURATION   = 2000;
  const LAYER_ID       = 'tool-my-location';
  const SRC_ID         = 'tool-my-location-accuracy';

  let map, button;
  let state = 0;
  let watchId = null;
  let marker = null;
  let position = null;        // [lng, lat]
  let accuracy = 0;
  let shownRadius = 0;
  let zoomedOnce = false;
  let animFrame = null;
  let wakeLock = null;
  let errorTimer = null;

  // ── กันจอดับ (โหมดล็อก) ──
  async function requestWakeLock() {
    try { if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen'); }
    catch (err) { console.warn('Wake Lock Error:', err); }
  }
  function releaseWakeLock() {
    if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; }
  }

  // ── ข้อความแจ้งเตือน ──
  function hideError() {
    clearTimeout(errorTimer);
    const el = document.querySelector('.location-error-message');
    if (el) { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }
  }
  function showError(message) {
    hideError();
    const el = document.createElement('div');
    el.className = 'location-error-message';
    el.innerHTML = `<div class="error-content"><i class="error-icon">⚠️</i><span class="error-text">${BPNP.escapeHtml(message)}</span></div>`;
    (map ? map.getContainer() : document.body).appendChild(el);
    requestAnimationFrame(() => el.classList.add('show'));
    errorTimer = setTimeout(hideError, 3000);
  }

  // ── วงความแม่นยำ ──
  function registerAccuracyLayer() {
    BPNP.map.registry.register(LAYER_ID, {
      slot: 'tools',
      build: () => ({
        sources: { [SRC_ID]: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } } },
        layers: [
          { id: SRC_ID + '-fill', type: 'fill', source: SRC_ID, paint: { 'fill-color': '#3b82f6', 'fill-opacity': 0.1 } },
          { id: SRC_ID + '-line', type: 'line', source: SRC_ID, paint: { 'line-color': '#3b82f6', 'line-width': 1, 'line-opacity': 0.3 } }
        ]
      })
    });
  }

  function drawRadius(r) {
    const src = map.getSource(SRC_ID);
    if (!src || !position) return;
    src.setData(r > 0 ? BPNP.geo.circlePolygon(position, r) : { type: 'FeatureCollection', features: [] });
  }

  function animateRadius(from, to, duration) {
    cancelAnimationFrame(animFrame);
    const start = performance.now();
    const step = now => {
      if (!marker) return;
      const p = Math.min((now - start) / duration, 1);
      const eased = p < 0.5 ? 2 * p * p : -1 + (4 - 2 * p) * p;
      shownRadius = from + (to - from) * eased;
      drawRadius(shownRadius);
      if (p < 1) animFrame = requestAnimationFrame(step);
    };
    animFrame = requestAnimationFrame(step);
  }

  // ── หมุดตำแหน่ง ──
  function createMarker() {
    const el = document.createElement('div');
    el.className = 'user-marker';
    el.innerHTML = '<div class="user-marker-container"><div class="user-marker-pulse"></div><div class="user-marker-dot"></div></div>';
    return new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat(position).addTo(map);
  }

  async function updateMarker() {
    if (!marker) {
      marker = createMarker();
      setTimeout(() => marker && marker.getElement().classList.add('user-marker-active'), 50);
      await BPNP.map.registry.setVisible(LAYER_ID, true);
      setTimeout(() => animateRadius(0, accuracy, 500), 300);
    } else {
      marker.setLngLat(position);
      if (Math.abs(shownRadius - accuracy) > 1) animateRadius(shownRadius, accuracy, 400);
      else drawRadius(shownRadius);
    }
  }

  function removeMarker() {
    cancelAnimationFrame(animFrame);
    if (marker) {
      const m = marker; marker = null;
      m.getElement().classList.remove('user-marker-active');
      setTimeout(() => m.remove(), 150);
    }
    shownRadius = 0;
    drawRadius(0);
    BPNP.map.registry.setVisible(LAYER_ID, false);
    position = null;
  }

  // ── geolocation ──
  function onPosition(pos) {
    if (state === 0) return;
    hideError();
    if (button) button.classList.remove('error-state');
    position = [pos.coords.longitude, pos.coords.latitude];
    accuracy = pos.coords.accuracy || 0;

    if (!zoomedOnce) {
      zoomedOnce = true;
      map.flyTo({ center: position, zoom: Math.max(map.getZoom(), USER_ZOOM), duration: FLY_DURATION });
      map.once('moveend', () => { if (state !== 0) updateMarker(); });
    } else {
      updateMarker();
    }
    if (state === 2) map.easeTo({ center: position, duration: 500 });
  }

  function onError(err) {
    console.warn('[MyLocation]', err && err.message);
    if (button) {
      button.classList.add('error-state');
      button.classList.remove('locate-active', 'lock-active');
    }
    showError(err && err.code === 1 ? 'ไม่ได้รับอนุญาตให้เข้าถึงตำแหน่ง' : 'ไม่พบตำแหน่ง GPS');
    stopWatch();
    removeMarker();
    zoomedOnce = false;
    state = 0;
    releaseWakeLock();
    setTimeout(() => button && button.classList.remove('error-state'), 3000);
  }

  function startWatch() {
    if (!('geolocation' in navigator)) { onError({ message: 'no geolocation' }); return; }
    stopWatch();
    watchId = navigator.geolocation.watchPosition(onPosition, onError, { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 });
  }
  function stopWatch() {
    if (watchId !== null) { navigator.geolocation.clearWatch(watchId); watchId = null; }
  }

  function onButtonClick() {
    if (!map) return;
    state = (state + 1) % 3;
    if (state === 0) {
      stopWatch();
      button.classList.remove('locate-active', 'lock-active', 'error-state');
      removeMarker();
      hideError();
      zoomedOnce = false;
      releaseWakeLock();
      BPNP.auth && BPNP.auth.logUserEvent('My Location', 'off');
    } else if (state === 1) {
      button.classList.remove('error-state', 'lock-active');
      button.classList.add('locate-active');
      releaseWakeLock();
      startWatch();
      BPNP.auth && BPNP.auth.logUserEvent('My Location', 'on');
    } else {
      button.classList.remove('locate-active');
      button.classList.add('lock-active');
      requestWakeLock();
      if (position) map.easeTo({ center: position, duration: 500 });
    }
  }

  function init(mapInstance) {
    map = mapInstance;
    registerAccuracyLayer();
    BPNP.ui.registerButton(() => {
      button = BPNP.ui.createStandardButton({
        id: 'customLocateBtn',
        imageSrc: 'assets/ui/locate-1.png',
        style: { bottom: 'calc(var(--safe-bottom) + 65px)', right: 'var(--safe-right)' },
        title: 'แสดงตำแหน่งปัจจุบัน',
        onClick: onButtonClick
      });
      button.addEventListener('contextmenu', e => e.preventDefault());
    });
  }

  BPNP.tools.myLocation = { init, get position() { return position; } };
})();
