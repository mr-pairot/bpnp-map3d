/* js/map/popup.js
 * ─────────────────────────────────────────────────────────────────────────
 * Popup กลาง (เปิดได้ทีละอัน เหมือน L.popup().openOn(map) เดิม)
 *   BPNP.map.popup.open(lngLat, html, { className, maxWidth, offset, onClose })
 *   BPNP.map.popup.close()
 * ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  let current = null;

  function open(lngLat, html, opts = {}) {
    const map = BPNP.map.instance;
    if (!map) return null;
    close();
    const p = new maplibregl.Popup({
      closeButton:  true,
      closeOnClick: opts.closeOnClick !== false,
      maxWidth:     opts.maxWidth || '300px',
      className:    ['bpnp-popup', opts.className].filter(Boolean).join(' '),
      offset:       opts.offset || 0,
      focusAfterOpen: false
    })
      .setLngLat(BPNP.geo.toLngLat(lngLat))
      .setHTML(html)
      .addTo(map);
    p.on('close', () => { if (current === p) current = null; if (opts.onClose) opts.onClose(); });
    current = p;
    return p;
  }

  function close() {
    if (current) { const p = current; current = null; p.remove(); }
  }

  BPNP.map.popup = { open, close, get current() { return current; } };
})();
