/* js/layers/railway.js
 * ─────────────────────────────────────────────────────────────────────────
 * เฟส 2: เขตทางรถไฟ (layer_ROW), แผนผังย่านสถานี (stationLayout), รายชื่อสถานี (stationName)
 *
 * stationName ใช้ HTML marker (เบราว์เซอร์วาดตัวอักษรไทยเอง — สระ/วรรณยุกต์ถูกต้องแน่นอน)
 * มีแค่ 31 จุด จึงไม่กระทบความเร็ว
 * ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  const U = BPNP.layers.utils;
  const esc = BPNP.escapeHtml;
  const cfg = id => BPNP.layers.byId(id);

  const ICONS = {
    station: 'assets/markers/train-blue.png',
    stop:    'assets/markers/train-orange.png',
    origin:  'assets/markers/train-gray.png',
    default: 'assets/markers/train-green.png'
  };

  const YT_ICON = '<svg class="bp-yt-icon" viewBox="0 0 24 24"><path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/></svg>';

  // ── สถานี (HTML marker) ──
  let stationMarkers = null;

  function stationPopupHtml(name, km) {
    return `
      <div class="structure-popup-card station-theme">
        <div class="structure-popup-header"><span>${esc(name)}</span></div>
        <div class="structure-popup-body">
          <div class="structure-popup-row">
            <span class="structure-popup-label">กม.</span>
            <span class="structure-popup-value">${esc(km)}</span>
          </div>
          <div class="structure-popup-divider"></div>
          <div class="structure-popup-row">
            <span class="structure-popup-label">ความก้าวหน้างาน</span>
            <span class="structure-popup-value">รอตรวจสอบ</span>
          </div>
          <div class="bp-action-group">
            <button type="button" class="bp-yt-btn station-yt-btn" style="display:none; margin: 0 6px; width: 95%;">
              ${YT_ICON} ดูความคืบหน้า (YouTube)
            </button>
          </div>
        </div>
      </div>`;
  }

  async function openStationPopup(name, km, lngLat) {
    const popup = BPNP.map.popup.open(lngLat, stationPopupHtml(name, km), { className: 'station-popup', maxWidth: '220px', offset: [0, -32] });
    if (!popup) return;
    const btn = popup.getElement().querySelector('.station-yt-btn');
    if (!btn) return;
    const url = await BPNP.layers.videoLinks.stationUrl(name);
    if (url) {
      btn.style.display = 'flex';
      btn.addEventListener('click', () => BPNP.layers.videoLinks.openStation(name));
    } else {
      btn.remove();
    }
  }

  function createStationMarker(map, f) {
    const p = f.properties || {};
    const name = p.name || p.Name || '';
    if (!name || !f.geometry || f.geometry.type !== 'Point') return null;
    const kmMatch = String(p.description || '').match(/กม\.\s*([\d+.]+)/);
    const km = kmMatch ? kmMatch[1] : '-';
    const style = String(p.styleUrl || '#default').replace(/^#/, '');

    const el = document.createElement('div');
    el.className = 'station-marker';
    el.innerHTML = `<div class="station-tooltip station-marker-label">${esc(name)}</div>` +
                   `<img src="${ICONS[style] || ICONS.default}" width="32" height="32" alt="" draggable="false">`;
    el.addEventListener('click', e => { e.stopPropagation(); openStationPopup(name, km, f.geometry.coordinates); });

    return new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat(f.geometry.coordinates);
  }

  function register(map) {
    const R = BPNP.map.registry;

    // ── เขตทางรถไฟ (ข้อมูลเป็นเส้นขอบ) ──
    R.register('layer_ROW', {
      slot: 'general',
      build: async () => ({
        sources: { 'src-row': { type: 'geojson', data: await U.loadGeoJSON(cfg('layer_ROW').source) } },
        layers:  [{ id: 'row-line', type: 'line', source: 'src-row', paint: { 'line-color': 'orange', 'line-width': 2 } }]
      })
    });

    // ── แผนผังย่านสถานี (แสดงเมื่อซูมใกล้) ──
    R.register('stationLayout', {
      slot: 'general',
      build: async () => ({
        sources: { 'src-station-layout': { type: 'geojson', data: await U.loadGeoJSON(cfg('stationLayout').source), tolerance: 0.2 } },
        layers:  [{ id: 'station-layout-line', type: 'line', source: 'src-station-layout', minzoom: U.z(14),
                    paint: { 'line-color': '#57F4FF', 'line-width': 1 } }]
      })
    });

    // ── รายชื่อสถานี ──
    R.register('stationName', {
      slot: 'labels',
      build: async () => {
        const fc = await U.loadGeoJSON(cfg('stationName').source);
        stationMarkers = fc.features.map(f => createStationMarker(map, f)).filter(Boolean);
        return {};
      },
      onShow: () => (stationMarkers || []).forEach(m => m.addTo(map)),
      onHide: () => (stationMarkers || []).forEach(m => m.remove())
    });
  }

  U.register({ name: 'railway', register });
})();
