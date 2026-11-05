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

    el.dataset.view3d = 'own';   // จัดการการซ่อนในโหมด 3D เอง (updateDepth: ย่อ/จาง/ระยะ) — ผู้ดูแลกลาง js/map/view3d.js ข้าม
    return new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat(f.geometry.coordinates);
  }

  // ── โหมด 3D: หมุดสถานีตามระยะ (v3.9.01) ──────────────────────────────
  //   1) ย่อตามระยะห่างจากกล้อง เล็กสุด 50% (ย่อจากปลายหมุด ปลายหมุดยังแตะจุดเดิม)
  //   2) ป้ายชื่อที่ทับกันซ่อน — สถานีที่อยู่ใกล้ได้แสดงก่อน (ไอคอนยังแสดง แตะ/ชี้เพื่อดูชื่อ)
  //   3) ไม่ลอยบนท้องฟ้า (v3.10.03): ซ่อนหมุดที่อยู่ด้านหลังกล้อง · ทั้งหมุดและป้ายต้องอยู่ใต้เส้นขอบฟ้า
  //      (ส่วนบนเข้าใกล้ขอบฟ้า → จางหาย) · หาเส้นขอบฟ้าจาก "พื้นด้านหน้ากล้อง"
  //   4) ลำดับการวาด: หมุดใกล้อยู่หน้าหมุดไกล (ภายในหมุดเดียวกัน ไอคอนยังอยู่บนป้ายของตัวเอง)
  //   ชี้/แตะหมุด → ขึ้นมาหน้าสุดและแสดงชื่อชั่วคราว
  //   โหมด 2D: ล้างค่าทั้งหมด หมุดเหมือนเดิมทุกอย่าง
  const MIN_SCALE = 0.5;
  const FADE_BAND = 30;          // ส่วนบนของหมุดเข้าใกล้เส้นขอบฟ้า → จางหายในช่วงนี้ (px)
  let depthQueued = false, depthActive = false;

  const is3d = map => !!(BPNP.map.terrain && BPNP.map.terrain.isOn() && map.getPitch() > 0.5);

  // ── กล้อง / เส้นขอบฟ้า / ระยะ: ตัวตรวจกลาง js/map/view3d.js (v3.10.10 — เดิมอยู่ในไฟล์นี้ตั้งแต่ v3.10.03) ──
  const V = () => BPNP.map.view3d;

  // ความสูงเต็มของหมุด (ไอคอน + ป้ายชื่อที่อยู่เหนือไอคอน) ก่อนย่อ — วัดครั้งเดียวต่อหมุด
  function fullHeight(root, inner, label) {
    if (root.dataset.fullH) return +root.dataset.fullH;
    const h = inner.offsetHeight - Math.min(0, label ? label.offsetTop : 0);
    if (h > 0) root.dataset.fullH = String(h);
    return h || 60;
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
    const st = V().state(map);                // กล้อง + เส้นขอบฟ้า + ระยะสูงสุด (4 × ระยะกล้องถึงกลางจอ)
    const hz = st ? st.hz : 0;
    const ppm = ll => { const a = map.project(ll), b = map.project([ll.lng + 100 / (111320 * Math.cos(ll.lat * Math.PI / 180)), ll.lat]); return Math.hypot(b.x - a.x, b.y - a.y); };
    const ref = ppm(map.unproject([c.clientWidth / 2, H * 0.6]));
    // ขั้นที่ 1: ขนาด / ความจาง / ลำดับ
    const rows = list.map(mk => {
      const root = mk.getElement(), ll = mk.getLngLat(), p = map.project(ll);
      const inner = root.querySelector('.station-marker-inner'), label = root.querySelector('.station-marker-label');
      const scale = Math.max(MIN_SCALE, Math.min(1, ppm(ll) / ref));
      // แสดงได้เมื่ออยู่หน้ากล้อง และทั้งหมุด + ป้ายชื่อ (หลังย่อ) อยู่ใต้เส้นขอบฟ้า · ส่วนบนเข้าใกล้ขอบฟ้า → จางใน FADE_BAND px
      const top = p.y - fullHeight(root, inner, label) * scale;
      //   + ไกลเกินระยะสูงสุด → ไม่แสดง (ช่วงท้าย 25% ค่อย ๆ จาง) — v3.10.10
      const dist = V().check(st, ll);          // 0 = หลังกล้อง/ไกลเกิน · 0…1 = ช่วงจางตามระยะ
      const fade = dist <= 0 ? 0 : Math.max(0, Math.min(1, (top - hz) / FADE_BAND)) * dist;
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

  // ── ป้ายชื่อวางที่พิกเซลเต็ม (v3.9.03) ──
  // เดิมจัดกึ่งกลางด้วย translateX(-50%) → ป้ายที่กว้างเลขคี่/ทศนิยม ตกครึ่งพิกเซล ตัวอักษรเบลอ (เห็นชัดบนจอ PC)
  // วัดความกว้างจาก layout (ไม่ถูกผลของการย่อในโหมด 3D) → ปัดเป็นเลขคู่ แล้วเลื่อนเป็นจำนวนเต็ม
  // v3.9.04: แก้การวัด — 3.9.03 บวก padding ซ้ำ (CSS ใช้ border-box) กล่องจึงกว้างเกิน 16 px ตัวหนังสือชิดซ้าย
  function snapLabels() {
    (stationMarkers || []).forEach(mk => {
      const l = mk.getElement().querySelector('.station-marker-label');
      if (!l || l.dataset.snapped === '1' || !l.isConnected) return;
      l.style.width = ''; l.style.boxSizing = '';               // วัดจากขนาดธรรมชาติ
      const cs = getComputedStyle(l);
      const w = parseFloat(cs.width);
      if (!(w > 0)) return;                                   // ยังไม่ได้วาด (ซ่อนอยู่) — ลองใหม่ครั้งหน้า
      // ความกว้างทั้งกล่อง: ถ้า box-sizing เป็น border-box ค่า width รวม padding/ขอบแล้ว (CSS ทั้งแอปใช้ border-box)
      const extra = cs.boxSizing === 'border-box' ? 0
        : parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) + parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth);
      // ปัดขึ้นเป็นจำนวนเต็ม (เพิ่ม < 1 px ทางขวา) · ตัวหนังสือเริ่มที่ padding ซ้ายพอดี (พิกเซลเต็ม → คม)
      // เลื่อนเป็นจำนวนเต็ม: กึ่งกลางกล่องคลาดจากไอคอนได้ไม่เกิน 0.5 px (มองไม่เห็น)
      const total = Math.ceil(w + extra);
      l.style.boxSizing = 'border-box';
      l.style.width = total + 'px';
      l.style.transform = `translateX(${-Math.floor(total / 2)}px)`;
      l.dataset.snapped = '1';
    });
  }

  function register(map) {
    const R = BPNP.map.registry;
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => {   // ฟอนต์มาทีหลัง → วัดใหม่
      (stationMarkers || []).forEach(mk => { const l = mk.getElement().querySelector('.station-marker-label'); if (l) { delete l.dataset.snapped; l.style.width = ''; l.style.boxSizing = ''; l.style.transform = ''; } });
      requestAnimationFrame(snapLabels);
    });
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
      onShow: () => { (stationMarkers || []).forEach(m => m.addTo(map)); requestAnimationFrame(snapLabels); scheduleDepth(map); },
      onHide: () => (stationMarkers || []).forEach(m => m.remove())
    });
  }

  U.register({ name: 'railway', register });
})();
