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
    station: 'assets/markers/train-green.png',
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
    // ห้ามกำหนด position ให้ el (ราก) — MapLibre ใช้ position:absolute + transform วางหมุด
    el.innerHTML = `<div class="station-marker-inner">` +
                   `<div class="station-tooltip station-marker-label">${esc(name)}</div>` +
                   `<img src="${ICONS[style] || ICONS.default}" width="32" height="32" alt="" draggable="false"></div>`;
    el.addEventListener('click', e => { e.stopPropagation(); openStationPopup(name, km, f.geometry.coordinates); });

    return new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat(f.geometry.coordinates);
  }

  // ── โหมด 3D: หมุดสถานีตามระยะ (v3.9.01) ──────────────────────────────
  //   1) ย่อตามระยะห่างจากกล้อง เล็กสุด 50% (ย่อจากปลายหมุด ปลายหมุดยังแตะจุดเดิม)
  //   2) ป้ายชื่อที่ทับกันซ่อน — สถานีที่อยู่ใกล้ได้แสดงก่อน (ไอคอนยังแสดง แตะ/ชี้เพื่อดูชื่อ)
  //   3) จางหายเมื่อใกล้ขอบฟ้า (ไม่ลอยขึ้นไปบนท้องฟ้า)
  //   4) ลำดับการวาด: หมุดใกล้อยู่หน้าหมุดไกล (ภายในหมุดเดียวกัน ไอคอนยังอยู่บนป้ายของตัวเอง)
  //   ชี้/แตะหมุด → ขึ้นมาหน้าสุดและแสดงชื่อชั่วคราว
  //   โหมด 2D: ล้างค่าทั้งหมด หมุดเหมือนเดิมทุกอย่าง
  const MIN_SCALE = 0.5, FADE_FROM = 20, FADE_LEN = 70;
  let depthQueued = false, depthActive = false;

  const is3d = map => !!(BPNP.map.terrain && BPNP.map.terrain.isOn() && map.getPitch() > 0.5);

  function horizonY(map) {
    // แถวบนสุดที่ยังเป็นพื้นแผนที่ (เหนือขึ้นไปเป็นท้องฟ้า)
    const c = map.getContainer(), x = c.clientWidth / 2;
    const onGround = y => { try { const ll = map.unproject([x, y]); const q = map.project(ll); return Math.abs(q.y - y) < 1.5; } catch (e) { return false; } };
    if (onGround(0)) return 0;
    let lo = 0, hi = c.clientHeight;
    for (let i = 0; i < 12; i++) { const mid = (lo + hi) / 2; if (onGround(mid)) hi = mid; else lo = mid; }
    return hi;
  }

  function resetDepth() {
    (stationMarkers || []).forEach(mk => {
      const root = mk.getElement(), inner = root.querySelector('.station-marker-inner'), label = root.querySelector('.station-marker-label');
      root.style.zIndex = ''; root.style.pointerEvents = '';
      if (inner) { inner.style.transform = ''; inner.style.transformOrigin = ''; inner.style.opacity = ''; }
      if (label) label.style.visibility = '';
    });
    depthActive = false;
  }

  function updateDepth(map) {
    depthQueued = false;
    const list = (stationMarkers || []).filter(mk => mk._map);
    if (!list.length) return;
    if (!is3d(map)) { if (depthActive) resetDepth(); return; }
    depthActive = true;
    const c = map.getContainer(), H = c.clientHeight;
    const hz = horizonY(map);
    const ppm = ll => { const a = map.project(ll), b = map.project([ll.lng + 100 / (111320 * Math.cos(ll.lat * Math.PI / 180)), ll.lat]); return Math.hypot(b.x - a.x, b.y - a.y); };
    const ref = ppm(map.unproject([c.clientWidth / 2, H * 0.6]));
    // ขั้นที่ 1: ขนาด / ความจาง / ลำดับ
    const rows = list.map(mk => {
      const root = mk.getElement(), ll = mk.getLngLat(), p = map.project(ll);
      const inner = root.querySelector('.station-marker-inner'), label = root.querySelector('.station-marker-label');
      const scale = Math.max(MIN_SCALE, Math.min(1, ppm(ll) / ref));
      const fade = Math.max(0, Math.min(1, (p.y - (hz + FADE_FROM)) / FADE_LEN));
      inner.style.transformOrigin = '50% 100%';
      inner.style.transform = `scale(${scale.toFixed(3)})`;
      inner.style.opacity = fade.toFixed(2);
      root.style.pointerEvents = fade < 0.3 ? 'none' : '';
      root.style.zIndex = root.dataset.front === '1' ? '100000' : String(1000 + Math.round(p.y));
      if (label) label.style.visibility = 'visible';
      return { root, label, y: p.y, fade };
    });
    // ขั้นที่ 2: ซ่อนป้ายที่ทับกัน — ใกล้ก่อน (y มาก = ใกล้กล้อง)
    const placed = [];
    rows.filter(r => r.fade > 0.3 && r.label).sort((a, b) => b.y - a.y).forEach(r => {
      if (r.root.dataset.front === '1') { placed.push(r.label.getBoundingClientRect()); return; }
      const b = r.label.getBoundingClientRect();
      const hit = placed.some(q => !(b.right + 3 < q.left || b.left - 3 > q.right || b.bottom + 3 < q.top || b.top - 3 > q.bottom));
      if (hit) r.label.style.visibility = 'hidden'; else placed.push(b);
    });
  }

  function scheduleDepth(map) {
    if (depthQueued) return;
    depthQueued = true;
    requestAnimationFrame(() => updateDepth(map));
  }

  // ชี้/แตะหมุด → หน้าสุด + แสดงชื่อ (เฉพาะโหมด 3D)
  function bindFront(map, mk) {
    const root = mk.getElement();
    const on = () => { if (!depthActive) return; root.dataset.front = '1'; root.style.zIndex = '100000'; const l = root.querySelector('.station-marker-label'); if (l) l.style.visibility = 'visible'; };
    const off = () => { if (root.dataset.front !== '1') return; delete root.dataset.front; scheduleDepth(map); };
    root.addEventListener('mouseenter', on);
    root.addEventListener('mouseleave', off);
    root.addEventListener('touchstart', () => { on(); setTimeout(off, 2500); }, { passive: true });
  }

  function register(map) {
    const R = BPNP.map.registry;
    ['move', 'moveend', 'resize'].forEach(ev => map.on(ev, () => scheduleDepth(map)));
    if (BPNP.events) BPNP.events.on('map:3d', () => scheduleDepth(map));

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
        stationMarkers.forEach(mk => bindFront(map, mk));
        return {};
      },
      onShow: () => { (stationMarkers || []).forEach(m => m.addTo(map)); scheduleDepth(map); },
      onHide: () => (stationMarkers || []).forEach(m => m.remove())
    });
  }

  U.register({ name: 'railway', register });
})();
