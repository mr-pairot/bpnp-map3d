/* js/layers/alignment.js
 * ─────────────────────────────────────────────────────────────────────────
 * เฟส 2: แนวทางรถไฟ (alTrack) และ กม.ก่อสร้าง (showSTA)
 *
 * showSTA — กติกาป้ายเหมือนเวอร์ชันเดิม (ซูม Leaflet ในวงเล็บ)
 *   ซูม < 9  (10)  : ไม่แสดง
 *   ซูม 9–12 (10–13): จุดทุก กม. + ป้ายถาวรเฉพาะ กม. ที่หาร 5 ลงตัว / กม.อื่นชี้เมาส์ดู
 *   ซูม ≥ 12 (13)  : ป้ายทุก กม.
 *   แผงปรับขนาดตัวเลข กม. (8–26 px) แสดงขณะเปิดเลเยอร์ จำค่าไว้ในเครื่อง
 * ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  const U = BPNP.layers.utils;
  const cfg = id => BPNP.layers.byId(id);

  const STA_FONT_KEY = 'sta_font_size';
  const STA_LABEL_IDS = ['sta-label-major', 'sta-label-all'];
  const STA_ALL_LABEL_ZOOM = U.z(13);
  let fontPanel = null;

  function staFontSize() {
    const v = parseInt(BPNP.storage.get(STA_FONT_KEY, '12'), 10);
    return (v >= 8 && v <= 26) ? v : 12;
  }

  // ชื่อ กม. เป็นตัวเลข (เช่น "45") → หาร 5 ลงตัว = ป้ายหลัก
  const MAJOR = ['==', ['%', ['to-number', ['get', 'name'], -1], 5], 0];

  function showFontPanel(map) {
    if (!fontPanel) {
      const size = staFontSize();
      document.documentElement.style.setProperty('--sta-font-size', size + 'px');
      fontPanel = document.createElement('div');
      fontPanel.className = 'sta-font-control-panel';
      fontPanel.innerHTML = `
        <label><span>ขนาดตัวเลข กม.</span>
          <span id="staFontValDisplay" style="color:blue;font-weight:bold;">${size} px</span></label>
        <input type="range" min="8" max="26" step="1" value="${size}" id="staFontInputRange">`;
      ['mousedown', 'touchstart', 'wheel', 'dblclick', 'contextmenu'].forEach(ev =>
        fontPanel.addEventListener(ev, e => e.stopPropagation(), { passive: true }));
      const input = fontPanel.querySelector('input');
      const label = fontPanel.querySelector('#staFontValDisplay');
      input.addEventListener('input', e => {
        const v = Number(e.target.value);
        label.textContent = v + ' px';
        document.documentElement.style.setProperty('--sta-font-size', v + 'px');
        STA_LABEL_IDS.forEach(id => map.getLayer(id) && map.setLayoutProperty(id, 'text-size', v));
      });
      input.addEventListener('change', e => BPNP.storage.set(STA_FONT_KEY, e.target.value));
      document.body.appendChild(fontPanel);
    }
    fontPanel.style.display = '';
  }

  function register(map) {
    const R = BPNP.map.registry;

    // ── แนวทางรถไฟ ──
    R.register('alTrack', {
      slot: 'general',
      build: async () => ({
        sources: { 'src-altrack': { type: 'geojson', data: await U.loadGeoJSON(cfg('alTrack').source) } },
        layers:  [{ id: 'altrack-line', type: 'line', source: 'src-altrack', paint: { 'line-color': 'red', 'line-width': 1 } }]
      })
    });

    // ── กม.ก่อสร้าง ──
    R.register('showSTA', {
      slot: 'general',
      build: async () => {
        U.ensureLabelBox(map, 'label-box-blue', 'rgba(33, 150, 243, 0.9)', { radius: 5 });
        const size = staFontSize();
        const label = (id, filter, minzoom) => ({
          id, type: 'symbol', source: 'src-sta', minzoom, filter,
          layout: U.labelLayout({ 'text-field': ['get', 'name'], 'text-size': size, 'icon-image': 'label-box-blue' }),
          paint: { 'text-color': '#ffffff' }
        });
        return {
          sources: { 'src-sta': { type: 'geojson', data: await U.loadGeoJSON(cfg('showSTA').source) } },
          layers: [
            { id: 'sta-point', type: 'circle', source: 'src-sta', minzoom: U.z(10),
              paint: { 'circle-radius': 3, 'circle-color': '#2196f3', 'circle-opacity': 0.8,
                       'circle-stroke-color': '#2196f3', 'circle-stroke-width': 2, 'circle-stroke-opacity': 1 } },
            label('sta-label-major', MAJOR, U.z(10)),
            label('sta-label-all', ['!', MAJOR], STA_ALL_LABEL_ZOOM)
          ]
        };
      },
      afterBuild: () => U.hoverLabel(map, 'sta-point', f => f.properties.name, { maxZoom: STA_ALL_LABEL_ZOOM, className: 'sta-hover' }),
      onShow: () => showFontPanel(map),
      onHide: () => { if (fontPanel) fontPanel.style.display = 'none'; }
    });
  }

  U.register({ name: 'alignment', register });
})();
