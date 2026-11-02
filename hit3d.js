/* js/map/hit3d.js
 * ─────────────────────────────────────────────────────────────────────────
 * ตัวตรวจกลาง: จุดบนจอโดนรูป 3D หรือไม่ (v3.10.04)
 *
 * รูป 3D (Box/Underpass ใน structure_3d_layer.js, สะพานใน bridge_3d.js) เป็น custom layer
 * MapLibre จึงไม่รู้ว่ารูปเหล่านี้บังชั้น 2D ที่อยู่บนพื้นด้านล่าง → คลิก/ชี้แล้วชั้นใต้รูป (เช่น แปลงเวนคืน)
 * เปิดการ์ด/ป้ายชื่อซ้อน · ไฟล์นี้รวมผลการยิงรังสีของทุกชั้น 3D ให้ชั้น 2D ตรวจก่อนทำงาน
 *
 *   BPNP.map.registerPick(name, fn)  fn(point) → { typeId, key, dist, label } | null  (ชั้น 3D ลงทะเบียน)
 *   BPNP.map.hit3d(point)            → ผลที่ใกล้กล้องที่สุด | null  (แคชผลต่อจุดเดียวกันชั่วครู่ — ชั้น 2D หลายชั้นเรียกซ้ำได้)
 *
 * ชี้เมาส์: โดนรูป 3D → เคอร์เซอร์มือ + ป้ายชื่อของรูป 3D (ป้ายของชั้น 2D ด้านล่างไม่ขึ้น — layer_utils.hoverLabel ตรวจ hit3d)
 * ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  const providers = [];
  let cache = { x: NaN, y: NaN, t: 0, hit: null };
  let hoverReady = false, hovering = false, queued = false, pop = null;

  function hit3d(point) {
    if (!point || !providers.length) return null;
    const now = performance.now();
    if (cache.x === point.x && cache.y === point.y && now - cache.t < 60) return cache.hit;
    let best = null;
    providers.forEach(p => {
      let h = null;
      try { h = p.fn(point); } catch (e) { h = null; }
      if (h && (!best || (h.dist || 0) < (best.dist || 0))) best = h;
    });
    cache = { x: point.x, y: point.y, t: now, hit: best };
    return best;
  }

  function setupHover(map) {
    if (hoverReady || !map) return;
    hoverReady = true;
    pop = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 8, anchor: 'bottom', className: 'bpnp-hover-label structure-hover' });
    map.on('mousemove', e => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        const h = hit3d(e.point);
        if (h) {
          map.getCanvas().style.cursor = 'pointer';
          if (h.label) pop.setLngLat(e.lngLat).setText(h.label).addTo(map); else pop.remove();
          hovering = true;
        } else if (hovering) {
          hovering = false;
          pop.remove();
          map.getCanvas().style.cursor = '';
        }
      });
    });
    map.on('mouseout', () => { if (hovering) { hovering = false; pop.remove(); map.getCanvas().style.cursor = ''; } });
  }

  function registerPick(name, fn) {
    if (!providers.some(p => p.name === name)) providers.push({ name, fn });
    setupHover(BPNP.map.instance);
  }

  BPNP.map.hit3d = hit3d;
  BPNP.map.registerPick = registerPick;
})();
