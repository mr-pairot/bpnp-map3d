/* js/map/popup.js
 * ─────────────────────────────────────────────────────────────────────────
 * Popup กลาง (เปิดได้ทีละอัน เหมือน L.popup().openOn(map) เดิม)
 *   BPNP.map.popup.open(lngLat, html, { className, maxWidth, offset, onClose, ignoreClicksMs, anchor, autoPan })
 *     ค่าเริ่มต้นเหมือน Leaflet: popup อยู่เหนือจุด (anchor 'bottom') และเลื่อนแผนที่ให้เห็นทั้งใบ (autoPan)
 *     ignoreClicksMs: ไม่ปิด popup จากการคลิกแผนที่ในช่วงนี้ (กันคลิกที่เบราว์เซอร์สร้างหลังยกนิ้วจากการกดค้าง)
 *   BPNP.map.popup.close()
 * ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  let current = null;

  function open(lngLat, html, opts = {}) {
    const map = BPNP.map.instance;
    if (!map) return null;
    close();
    const guardMs = opts.ignoreClicksMs || 0;
    const p = new maplibregl.Popup({
      closeButton:  true,
      closeOnClick: guardMs ? false : opts.closeOnClick !== false,
      maxWidth:     opts.maxWidth || '300px',
      className:    ['bpnp-popup', opts.className].filter(Boolean).join(' '),
      offset:       opts.offset || 0,
      anchor:       opts.anchor || 'bottom',      // เหมือน Leaflet: popup อยู่เหนือจุดเสมอ
      focusAfterOpen: false
    })
      .setLngLat(BPNP.geo.toLngLat(lngLat))
      .setHTML(html)
      .addTo(map);
    if (opts.autoPan !== false) autoPan(map, p);
    let onMapClick = null;
    if (guardMs && opts.closeOnClick !== false) {
      const openedAt = Date.now();
      onMapClick = () => { if (Date.now() - openedAt > guardMs) p.remove(); };
      map.on('click', onMapClick);
    }
    p.on('close', () => {
      if (onMapClick) map.off('click', onMapClick);
      if (current === p) current = null;
      if (opts.onClose) opts.onClose();
    });
    current = p;
    return p;
  }

  // เลื่อนแผนที่ให้ popup อยู่ในจอทั้งหมด (เหมือน autoPan ของ Leaflet)
  // รูป/ข้อมูลที่โหลดตามหลังทำให้ popup สูงขึ้น → ตรวจซ้ำอีกครั้งสั้น ๆ
  function autoPan(map, p) {
    const PAD = 10;
    const run = () => {
      const el = p.getElement();
      if (!el || !el.isConnected || current !== p) return;
      const box = el.querySelector('.maplibregl-popup-content') || el;
      const r = box.getBoundingClientRect();
      const c = map.getContainer().getBoundingClientRect();
      const safeTop = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--safe-top')) || 0;
      let dx = 0, dy = 0;
      if (r.top < c.top + PAD + safeTop) dy = r.top - (c.top + PAD + safeTop);
      if (r.left < c.left + PAD) dx = r.left - (c.left + PAD);
      else if (r.right > c.right - PAD) dx = r.right - (c.right - PAD);
      if (dx || dy) map.panBy([dx, dy], { duration: 250 });
    };
    requestAnimationFrame(run);
    setTimeout(run, 400);
  }

  function close() {
    if (current) { const p = current; current = null; p.remove(); }
  }

  BPNP.map.popup = { open, close, get current() { return current; } };
})();
