/* js/map/layer_registry.js
 * ─────────────────────────────────────────────────────────────────────────
 * ตัวจัดการเลเยอร์กลาง — ทุกเลเยอร์ข้อมูล (เฟส 1–5) เพิ่มผ่านที่นี่เท่านั้น
 * ห้ามโมดูลเรียก map.addLayer() ตรง เพื่อให้ลำดับซ้อน / เปิดปิด / ความทึบ อยู่ที่เดียว
 *
 * ลำดับซ้อน ("slot") จากล่างขึ้นบน:
 *   raster-overlay → general → structure → progress → tools → labels
 * แต่ละ slot มีเลเยอร์ว่างเป็นหมุด (slot-<ชื่อ>) เลเยอร์ใหม่ถูกวางไว้บนสุดของ slot ตัวเอง
 *
 *   register(id, def)
 *     def.slot         ชื่อ slot (ค่าเริ่มต้น 'general')
 *     def.build()      → { sources: {id: spec}, layers: [spec] } (sync หรือ async — เรียกครั้งแรกที่เปิด)
 *     def.attribution  ข้อความแสดงที่มุมแผนที่ขณะเปิดเลเยอร์
 *     def.afterBuild(map, layerIds)  เรียกครั้งเดียวหลังเพิ่มเลเยอร์ (ผูก click / hover ที่นี่)
 *     def.onShow / def.onHide  callback เพิ่มเติม (เช่น แสดง legend)
 *   setVisible(id, bool)  → Promise
 *   setOpacity(id, 0..1)
 *   bringToFront(id)      ย้ายขึ้นบนสุดของ slot ตัวเอง
 *   order(ids)            เรียงตามลำดับ (ตัวท้าย = บนสุด)
 *   isVisible(id) / has(id) / layerIds(id) / attributions()
 *   อีเวนต์: BPNP.events 'layers:change' ({ id, visible })
 * ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  const SLOTS = ['raster-overlay', 'general', 'structure', 'progress', 'tools', 'labels'];
  const entries = new Map();
  let map = null;

  // property ความทึบตามชนิดเลเยอร์
  const OPACITY_PROPS = {
    raster:           ['raster-opacity'],
    fill:             ['fill-opacity'],
    line:             ['line-opacity'],
    circle:           ['circle-opacity', 'circle-stroke-opacity'],
    symbol:           ['icon-opacity', 'text-opacity'],
    'fill-extrusion': ['fill-extrusion-opacity'],
    heatmap:          ['heatmap-opacity']
  };

  function init(mapInstance) {
    map = mapInstance;
    SLOTS.forEach(name => {
      if (!map.getLayer('slot-' + name)) {
        map.addLayer({ id: 'slot-' + name, type: 'background', layout: { visibility: 'none' }, paint: { 'background-opacity': 0 } });
      }
    });
  }

  // หมุดของ slot ถัดไป (วางเลเยอร์ก่อนหมุดนี้ = บนสุดของ slot ตัวเอง)
  function beforeIdFor(slot) {
    const i = SLOTS.indexOf(slot);
    return (i >= 0 && i < SLOTS.length - 1) ? 'slot-' + SLOTS[i + 1] : undefined;
  }

  function register(id, def) {
    if (entries.has(id)) { console.warn('[Registry] ลงทะเบียนซ้ำ:', id); return entries.get(id); }
    const e = {
      id,
      def: Object.assign({ slot: 'general' }, def),
      built: false,
      building: null,
      visible: false,
      opacity: 1,
      sourceIds: [],
      layerIds: [],
      baseOpacity: {}   // ค่าความทึบตั้งต้นของแต่ละ property (ใช้คูณกับ slider)
    };
    if (SLOTS.indexOf(e.def.slot) === -1) e.def.slot = 'general';
    entries.set(id, e);
    return e;
  }

  async function build(e) {
    if (e.built) return;
    if (e.building) return e.building;
    e.building = (async () => {
      const out = (await e.def.build()) || {};
      const sources = out.sources || {};
      const layers  = out.layers  || [];
      Object.keys(sources).forEach(sid => {
        if (!map.getSource(sid)) map.addSource(sid, sources[sid]);
        e.sourceIds.push(sid);
      });
      const before = beforeIdFor(e.def.slot);
      layers.forEach(spec => {
        const layer = Object.assign({}, spec, { layout: Object.assign({}, spec.layout, { visibility: 'none' }) });
        map.addLayer(layer, before);
        e.layerIds.push(layer.id);
        (OPACITY_PROPS[layer.type] || []).forEach(p => {
          const v = spec.paint && spec.paint[p];
          e.baseOpacity[layer.id + '|' + p] = (typeof v === 'number') ? v : 1;
        });
      });
      e.built = true;
      // ผูก click / hover หลังเลเยอร์มีอยู่จริงแล้วเท่านั้น
      if (e.def.afterBuild) e.def.afterBuild(map, e.layerIds.slice());
    })();
    try { await e.building; } finally { e.building = null; }
  }

  async function setVisible(id, visible) {
    const e = entries.get(id);
    if (!e || !map) return false;
    if (visible) {
      try { await build(e); }
      catch (err) { console.error('[Registry] สร้างเลเยอร์ไม่สำเร็จ:', id, err); e.lastError = err; return false; }
      e.lastError = null;
    }
    if (!e.built) { e.visible = false; return !visible; }

    e.layerIds.forEach(lid => { if (map.getLayer(lid)) map.setLayoutProperty(lid, 'visibility', visible ? 'visible' : 'none'); });
    e.visible = !!visible;
    if (visible) { applyOpacity(e); if (e.def.onShow) e.def.onShow(map); }
    else if (e.def.onHide) e.def.onHide(map);
    BPNP.events.emit('layers:change', { id, visible: e.visible });
    return true;
  }

  function applyOpacity(e) {
    e.layerIds.forEach(lid => {
      const layer = map.getLayer(lid);
      if (!layer) return;
      (OPACITY_PROPS[layer.type] || []).forEach(p => {
        const base = e.baseOpacity[lid + '|' + p] ?? 1;
        map.setPaintProperty(lid, p, base * e.opacity);
      });
    });
  }

  function setOpacity(id, value) {
    const e = entries.get(id);
    if (!e) return;
    e.opacity = Math.max(0, Math.min(1, Number(value)));
    if (e.built && map) applyOpacity(e);
  }

  function bringToFront(id) {
    const e = entries.get(id);
    if (!e || !e.built || !map) return;
    const before = beforeIdFor(e.def.slot);
    e.layerIds.forEach(lid => { if (map.getLayer(lid)) map.moveLayer(lid, before); });
  }

  function order(ids) { ids.forEach(bringToFront); }

  function attributions() {
    const out = [];
    entries.forEach(e => { if (e.visible && e.def.attribution) out.push(e.def.attribution); });
    return out;
  }

  BPNP.map.registry = {
    SLOTS, init, register, setVisible, setOpacity, bringToFront, order, attributions,
    beforeIdFor,
    has:       id => entries.has(id),
    isVisible: id => !!(entries.get(id) && entries.get(id).visible),
    getOpacity: id => (entries.get(id) ? entries.get(id).opacity : 1),
    lastError: id => (entries.get(id) ? entries.get(id).lastError || null : null),
    layerIds:  id => (entries.get(id) ? entries.get(id).layerIds.slice() : []),
    list:      () => Array.from(entries.keys())
  };
})();
