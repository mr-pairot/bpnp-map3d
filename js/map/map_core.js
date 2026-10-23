/* js/map/map_core.js
 * ─────────────────────────────────────────────────────────────────────────
 * สร้างแผนที่ MapLibre
 *   await BPNP.map.create()   → maplibregl.Map (รอจน style โหลดเสร็จ)
 *   BPNP.map.instance / window.map
 * ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  async function create() {
    const CFG = BPNP.config.map;
    const saved = BPNP.storage.getJSON('map_settings');
    const wantedBase = (saved && saved.baseLayer) || CFG.defaultBasemap;
    const style = await BPNP.map.basemaps.buildStyle(wantedBase);

    const map = new maplibregl.Map({
      container:          'map',
      style,
      center:             CFG.center,
      zoom:               CFG.zoom,
      minZoom:            CFG.minZoom,
      maxZoom:            CFG.maxZoom,
      attributionControl: false,
      dragRotate:         !!CFG.allowRotate,
      pitchWithRotate:    !!CFG.allowRotate,
      touchPitch:         !!CFG.allowRotate,
      maxPitch:           CFG.allowRotate ? 75 : 0,
      cooperativeGestures: false
    });

    if (!CFG.allowRotate) {
      map.touchZoomRotate.disableRotation();
      map.keyboard.disableRotation();
    }

    // tile โหลดไม่ได้ (ออฟไลน์/คีย์หมดอายุ) ไม่ต้องแจ้งผู้ใช้ทุกครั้ง
    map.on('error', e => BPNP.log('[Map] error:', e && e.error ? e.error.message : e));

    BPNP.map.instance = map;
    window.map = map;

    await new Promise(resolve => {
      if (map.loaded()) return resolve();
      map.once('load', resolve);
    });

    BPNP.map.registry.init(map);
    if (BPNP.config.debug) map.on('zoomend', () => console.log('🔍 Zoom:', map.getZoom().toFixed(2)));
    BPNP.events.emit('map:ready', map);
    return map;
  }

  BPNP.map.create = create;
})();
