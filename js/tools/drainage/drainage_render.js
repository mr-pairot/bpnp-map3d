/* js/tools/drainage/drainage_render.js
 * ─────────────────────────────────────────────────────────────────────────
 * เฟส P2: แสดงผล drainage บน MapLibre ตรง ๆ (BPNP.map.instance) — ไม่ใช้ lcompat (lcompat ใช้เฉพาะเครื่องมือวัด)
 *   source เดียว src-drainage (GeoJSON) แยกชนิดด้วย property kind: stream | outlet | basin | path | pour
 *   ชั้น: dr-basin-fill · dr-basin-line · dr-streams-casing · dr-streams · dr-flowpath · dr-outlets · dr-pour
 *   ป้ายพื้นที่ของจุดออกเป็น maplibregl.Marker (ไม่พึ่ง glyph/ฟอนต์ของ style) — element รากไม่มี class/position
 *
 *   ลำดับชั้น: ใต้เส้นขอบ polygon ของเครื่องมือวัด (วางก่อน mp-line) แต่เหนือพื้นสี polygon (mp-fill)
 *     ถ้ายังไม่มี mp-line → วางก่อน BPNP.map.registry.beforeIdFor('tools') และจัดลำดับใหม่ทุกครั้งที่อัปเดตข้อมูล
 *   ลูกศรทิศของป้ายจุดออกหักมุม bearing ของแผนที่ และอัปเดตเมื่อหมุนแผนที่ (โหมด 3D)
 *   เติม source/ชั้นกลับอัตโนมัติเมื่อ style โหลดใหม่ (แอปไม่ใช้ setStyle — เป็นเพียงกันไว้)
 * ─────────────────────────────────────────────────────────────────────────
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DrainageRender = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const SRC = 'src-drainage';
  const MEASURE_OUTLINE = 'mp-line';      // เส้นขอบ polygon ของเครื่องมือวัด ต้องอยู่เหนือชั้น drainage
  const NOT_READY = /not done loading/i;   // ข้อความ error ของ MapLibre เมื่อ style ยังโหลดไม่เสร็จ
  const kindIs = k => ['==', ['get', 'kind'], k];
  const W = ['coalesce', ['get', 'widthPx'], 1];   // ไม่มี widthPx → 1 px (กัน expression คืน null)
  const zoomWidth = (mul, add) => ['interpolate', ['linear'], ['zoom'],
    8, ['+', ['*', W, 0.5 * mul], add], 14, ['+', ['*', W, mul], add],
    18, ['+', ['*', W, 2 * mul], add]];

  const LAYERS = [
    { id: 'dr-basin-fill', type: 'fill', filter: kindIs('basin'), paint: { 'fill-color': '#14b8a6', 'fill-opacity': 0.18 } },
    { id: 'dr-basin-line', type: 'line', filter: kindIs('basin'), layout: { 'line-join': 'round' },
      paint: { 'line-color': '#0f766e', 'line-width': 2.5 } },
    { id: 'dr-streams-casing', type: 'line', filter: kindIs('stream'), layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#ffffff', 'line-opacity': 0.75, 'line-width': zoomWidth(1, 1.5) } },
    { id: 'dr-streams', type: 'line', filter: kindIs('stream'), layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#1d4ed8', 'line-width': zoomWidth(1, 0) } },
    { id: 'dr-flowpath', type: 'line', filter: kindIs('path'), layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#f97316', 'line-width': 4, 'line-opacity': 0.95 } },
    { id: 'dr-outlets', type: 'circle', filter: kindIs('outlet'),
      paint: { 'circle-radius': 6, 'circle-color': '#dc2626', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2 } },
    { id: 'dr-pour', type: 'circle', filter: kindIs('pour'),
      paint: { 'circle-radius': 7, 'circle-color': '#7c3aed', 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 2 } }
  ];

  function defaultFormatArea(a) {
    return a >= 1e5 ? (a / 1e6).toLocaleString('th-TH', { maximumFractionDigits: 2 }) + ' กม²'
                    : Math.round(a).toLocaleString('th-TH') + ' ม²';
  }

  // map = MapLibre map; options: formatArea(m2) → ข้อความสั้น, beforeId (string | () => string), maplibregl
  function create(map, options) {
    const o = Object.assign({ formatArea: null, beforeId: null, maplibregl: null }, options || {});
    const data = { streams: [], outlets: [], basin: null, path: null, pour: null };
    let markers = [], arrows = [], destroyed = false, waiting = false;

    const lib = () => o.maplibregl || (typeof maplibregl !== 'undefined' ? maplibregl : null);
    const tag = (f, kind) => ({ type: 'Feature', properties: Object.assign({}, f.properties, { kind }), geometry: f.geometry });
    function collection() {
      const feats = [];
      data.streams.forEach(f => feats.push(tag(f, 'stream')));
      if (data.basin) feats.push(tag(data.basin, 'basin'));
      if (data.path) feats.push(tag(data.path, 'path'));
      data.outlets.forEach(f => feats.push(tag(f, 'outlet')));
      if (data.pour) feats.push(tag(data.pour, 'pour'));
      return { type: 'FeatureCollection', features: feats };
    }
    function resolveBefore() {
      let id = typeof o.beforeId === 'function' ? o.beforeId() : o.beforeId;
      if (!id && map.getLayer(MEASURE_OUTLINE)) id = MEASURE_OUTLINE;
      if (!id && typeof BPNP !== 'undefined' && BPNP.map && BPNP.map.registry && BPNP.map.registry.beforeIdFor) {
        try { id = BPNP.map.registry.beforeIdFor('tools'); } catch (e) { id = null; }
      }
      return id && map.getLayer(id) ? id : undefined;
    }
    // เพิ่ม source/ชั้นถ้ายังไม่มี (เรียกซ้ำได้โดยไม่ซ้อน); คืน false ถ้า style ยังไม่พร้อม
    // source ที่เพิ่งสร้างได้ข้อมูลล่าสุดแล้ว → คืน 'created' เพื่อไม่ต้อง setData ซ้ำ
    function ensure() {
      if (destroyed) return false;
      try {
        let created = false;
        if (!map.getSource(SRC)) { map.addSource(SRC, { type: 'geojson', data: collection() }); created = true; }
        const before = resolveBefore();
        LAYERS.forEach(l => {
          if (!map.getLayer(l.id)) map.addLayer(Object.assign({ source: SRC }, l), before);
          else if (before && map.moveLayer) map.moveLayer(l.id, before);   // เครื่องมือวัดอาจสร้างชั้นทีหลัง → จัดลำดับใหม่
        });
        return created ? 'created' : true;
      } catch (e) {
        if (NOT_READY.test(String(e && e.message))) {
          if (!waiting) { waiting = true; map.once('style.load', () => { waiting = false; if (!destroyed) refresh(); }); }
        } else if (typeof console !== 'undefined') {
          console.warn('[drainage_render] เพิ่มชั้นไม่สำเร็จ:', e);
        }
        return false;
      }
    }
    const mapBearing = () => (typeof map.getBearing === 'function' ? map.getBearing() : 0) || 0;
    // ➤ ชี้ไปทางขวา (ตะวันออก) เมื่อหมุน 0° → ทิศ b บนจอ = b − 90 − bearing ของแผนที่
    const arrowDeg = b => ((b == null ? 180 : b) - 90 - mapBearing());
    function updateArrows() { arrows.forEach(a => { a.el.style.transform = 'rotate(' + arrowDeg(a.bearing) + 'deg)'; }); }
    function rebuildMarkers() {
      markers.forEach(m => m.remove());
      markers = []; arrows = [];
      const G = lib();
      if (!G || typeof document === 'undefined') return;
      const fmt = o.formatArea || defaultFormatArea;
      data.outlets.forEach(f => {
        const p = f.properties || {};
        const root = document.createElement('div');           // ราก: ไม่มี class/position
        root.style.pointerEvents = 'none';
        const label = document.createElement('div');
        label.style.cssText = 'background:rgba(255,255,255,.95);border:1px solid #dc2626;border-radius:4px;padding:2px 6px;' +
          'font:600 11px Sarabun,Segoe UI,Tahoma,sans-serif;color:#7f1d1d;white-space:nowrap;box-shadow:0 1px 3px rgba(0,0,0,.35)';
        const arrow = document.createElement('span');
        arrow.style.display = 'inline-block';
        arrow.style.marginRight = '4px';
        arrow.textContent = '➤';
        const text = document.createElement('span');
        text.textContent = fmt(p.areaM2);
        label.appendChild(arrow);
        label.appendChild(text);
        root.appendChild(label);
        arrows.push({ el: arrow, bearing: p.bearing });
        markers.push(new G.Marker({ element: root, anchor: 'left', offset: [10, 0] }).setLngLat(f.geometry.coordinates).addTo(map));
      });
      updateArrows();
    }
    function push() {
      const r = ensure();
      if (r === true) map.getSource(SRC).setData(collection());
    }
    function refresh() { push(); rebuildMarkers(); }
    const onStyleLoad = () => { if (!destroyed && !waiting) push(); };   // ถ้ารออยู่ ตัวรอจะ refresh เอง
    const onRotate = () => { if (arrows.length) updateArrows(); };
    map.on('style.load', onStyleLoad);
    map.on('rotate', onRotate);

    const fcFeatures = fc => (fc && fc.features) ? fc.features : [];
    return {
      layerIds: LAYERS.map(l => l.id),
      sourceId: SRC,
      setStreams(fc) { data.streams = fcFeatures(fc); push(); },
      setOutlets(fc) { data.outlets = fcFeatures(fc); push(); rebuildMarkers(); },
      setBasin(f) { data.basin = f || null; push(); },
      setFlowPath(f) { data.path = f || null; push(); },
      setPour(f) { data.pour = f || null; push(); },
      clearClickResults() { data.basin = null; data.path = null; data.pour = null; push(); },
      clear() { data.streams = []; data.outlets = []; data.basin = null; data.path = null; data.pour = null; push(); rebuildMarkers(); },
      refresh,
      destroy() {
        destroyed = true;
        map.off('style.load', onStyleLoad);
        map.off('rotate', onRotate);
        markers.forEach(m => m.remove()); markers = []; arrows = [];
        try {
          LAYERS.forEach(l => { if (map.getLayer(l.id)) map.removeLayer(l.id); });
          if (map.getSource(SRC)) map.removeSource(SRC);
        } catch (e) { /* style อาจถูกถอดแล้ว */ }
      }
    };
  }

  return { create, SRC, LAYERS };
});
