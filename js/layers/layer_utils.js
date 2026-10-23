/* js/layers/layer_utils.js
 * ─────────────────────────────────────────────────────────────────────────
 * ตัวช่วยที่เลเยอร์ข้อมูลทุกเฟสใช้ร่วมกัน
 *
 *   U.z(leafletZoom)                    ซูม Leaflet เดิม → MapLibre (−1)
 *   U.loadGeoJSON(path | [paths])        → FeatureCollection (ผ่าน DataCache, หลายไฟล์ = รวมกัน)
 *   U.labelFont()                        ฟอนต์ที่มีใน glyph server ของแผนที่
 *   U.ensureLabelBox(map, id, fill)      รูปกล่องป้าย (ยืดตามข้อความ) สำหรับ symbol layer
 *   U.labelLayout(extra)                 layout มาตรฐานของป้ายแบบกล่อง (เหมือน tooltip เดิม)
 *
 * กติกาป้าย (จากผลทดสอบ tools/thai-label-test.html):
 *   symbol layer วางวรรณยุกต์ทับสระบนไม่ถูกต้อง (ปั้น ฟื้น กี่ ญี่) → ใช้กับตัวเลข/อักษรละตินเท่านั้น
 *   ข้อความภาษาไทยให้ใช้ HTML marker (เบราว์เซอร์วาดเอง) หรือแสดงใน popup แทน
 *   U.clickPopup(map, layerIds, html, o) คลิก feature → popup + เปลี่ยน cursor
 *   U.hoverLabel(map, layerId, text, o)  ชี้เมาส์ → ป้ายชั่วคราว (แทน tooltip แบบ hover เดิม)
 *   U.register(def)                      ลงทะเบียนโมดูลเลเยอร์ (app.js เรียก register ให้ตอนเริ่ม)
 * ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  const modules = [];

  function z(leafletZoom) { return BPNP.geo.fromLeafletZoom(leafletZoom); }

  async function loadOne(path) {
    const url = path.replace(/^\/+/, '');
    return BPNP.core.dataCache.getJSON(url);
  }

  async function loadGeoJSON(paths) {
    const list = Array.isArray(paths) ? paths : [paths];
    const parts = await Promise.all(list.map(loadOne));
    if (parts.length === 1) return parts[0];
    return { type: 'FeatureCollection', features: parts.flatMap(p => (p && p.features) || []) };
  }

  function labelFont() {
    return BPNP.map.basemaps.labelFont || ['Noto Sans Regular'];
  }

  // กล่องมุมมนแบบยืดได้ (ขยายตามความยาวข้อความ มุมไม่เสียรูป)
  function ensureLabelBox(map, id, fill, opts = {}) {
    if (map.hasImage(id)) return id;
    const pr = 2, size = 16 * pr, r = (opts.radius || 4) * pr;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    g.fillStyle = fill;
    g.beginPath();
    g.moveTo(r, 0); g.lineTo(size - r, 0); g.quadraticCurveTo(size, 0, size, r);
    g.lineTo(size, size - r); g.quadraticCurveTo(size, size, size - r, size);
    g.lineTo(r, size); g.quadraticCurveTo(0, size, 0, size - r);
    g.lineTo(0, r); g.quadraticCurveTo(0, 0, r, 0);
    g.closePath();
    g.fill();
    const data = g.getImageData(0, 0, size, size);
    map.addImage(id, { width: size, height: size, data: data.data }, {
      pixelRatio: pr,
      stretchX: [[r, size - r]],
      stretchY: [[r, size - r]]
    });
    return id;
  }

  function labelLayout(extra = {}) {
    return Object.assign({
      'text-font': labelFont(),
      'text-size': 12,
      'text-anchor': 'bottom',
      'text-offset': [0, -0.7],
      'text-max-width': 50,           // ไม่ตัดขึ้นบรรทัดใหม่ (tooltip เดิมเป็นบรรทัดเดียว)
      'text-allow-overlap': true,
      'text-ignore-placement': true,
      'icon-allow-overlap': true,
      'icon-ignore-placement': true,
      'icon-text-fit': 'both',
      'icon-text-fit-padding': [2, 5, 2, 5]
    }, extra);
  }

  // ── คลิก feature → popup ──
  function clickPopup(map, layerIds, buildHtml, opts = {}) {
    [].concat(layerIds).forEach(lid => {
      map.on('click', lid, e => {
        if (!e.features || !e.features.length) return;
        const f = e.features[0];
        const html = buildHtml(f, e);
        if (!html) return;
        const at = opts.atFeature && f.geometry.type === 'Point' ? f.geometry.coordinates : e.lngLat;
        BPNP.map.popup.open(at, html, opts);
        if (opts.onOpen) opts.onOpen(f, e);
      });
      map.on('mouseenter', lid, () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', lid, () => { map.getCanvas().style.cursor = ''; });
    });
  }

  // ── ชี้เมาส์ → ป้ายชั่วคราว (เฉพาะช่วงซูมที่ป้ายถาวรยังไม่แสดง) ──
  function hoverLabel(map, layerId, getText, opts = {}) {
    const pop = new maplibregl.Popup({
      closeButton: false, closeOnClick: false, offset: opts.offset || 8, anchor: 'bottom',
      className: 'bpnp-hover-label ' + (opts.className || '')
    });
    map.on('mousemove', layerId, e => {
      if (opts.maxZoom !== undefined && map.getZoom() >= opts.maxZoom) { pop.remove(); return; }
      const f = e.features && e.features[0];
      const text = f && getText(f);
      if (!text) { pop.remove(); return; }
      pop.setLngLat(f.geometry.type === 'Point' ? f.geometry.coordinates : e.lngLat).setText(text).addTo(map);
    });
    map.on('mouseleave', layerId, () => pop.remove());
    return pop;
  }

  function register(def) { modules.push(def); }

  function registerAll(map) {
    modules.forEach(m => {
      try { m.register(map); } catch (err) { console.error('[Layers] ลงทะเบียนไม่สำเร็จ:', m.name || '', err); }
    });
  }

  BPNP.layers.utils = { z, loadGeoJSON, labelFont, ensureLabelBox, labelLayout, clickPopup, hoverLabel, register, registerAll };
})();
