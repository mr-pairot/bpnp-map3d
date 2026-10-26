/* js/tools/click_point.js
 * ─────────────────────────────────────────────────────────────────────────
 * ดูพิกัด + Sta / O/S ของจุดบนแผนที่
 *   คลิกขวา                    → popup ทันที
 *   กดค้าง 0.5 วินาที          → แสดงวงกระเพื่อม
 *   กดค้าง 2 วินาที            → popup
 *   Space / Esc / ปุ่มหยุด     → หยุดวงกระเพื่อม
 * ไม่ทำงานขณะเครื่องมืออื่นกำลังใช้งาน (BPNP.tools.isBusy())
 * ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  const SHORT_HOLD_MS = 500;
  const LONG_HOLD_MS  = 2000;
  const MOVE_TOLERANCE_PX = 8;

  let map;
  let rippleTimer = null, centerDot = null, current = null;   // current = [lng, lat]
  let shortHold = null, longHold = null, holdStart = null;

  // ── วงกระเพื่อม ──
  function place(el, lngLat) {
    const p = map.project(lngLat);
    el.style.left = p.x + 'px';
    el.style.top  = p.y + 'px';
  }

  function singleRipple() {
    if (!current) return;
    const r = document.createElement('div');
    r.className = 'ripple-effect';
    place(r, current);
    map.getContainer().appendChild(r);
    setTimeout(() => r.remove(), 1500);
  }

  function start(lngLat, interval = 1000) {
    clearInterval(rippleTimer);
    current = BPNP.geo.toLngLat(lngLat);
    if (centerDot) centerDot.remove();
    centerDot = document.createElement('div');
    centerDot.className = 'ripple-center-dot';
    place(centerDot, current);
    map.getContainer().appendChild(centerDot);
    rippleTimer = setInterval(singleRipple, interval);
    singleRipple();
    fadeShrink('stopRippleBtn', true);
  }

  function stop() {
    clearInterval(rippleTimer);
    rippleTimer = null;
    if (centerDot) { centerDot.remove(); centerDot = null; }
    current = null;
    fadeShrink('stopRippleBtn', false);
  }

  function fadeShrink(id, show) {
    const el = document.getElementById(id);
    if (!el) return;
    if (show) {
      el.style.display = 'block';
      requestAnimationFrame(() => { el.classList.remove('fade-out'); el.classList.add('fade-in'); });
    } else {
      el.classList.remove('fade-in');
      el.classList.add('fade-out');
      setTimeout(() => { el.style.display = 'none'; }, 600);
    }
  }

  // ── popup พิกัด ──
  // กดค้างแล้วยกนิ้ว: บางเบราว์เซอร์ส่ง click ตามมา → อย่าให้ปิด popup ทันที
  const POPUP_OPTS = { ignoreClicksMs: 800 };

  // บรรทัดความสูง: แสดงเฉพาะโหมด 3D + เปิดภูมิประเทศ (v3.8.04) · ต่อท้ายคำเตือน (ถ้ามี) ก่อนปุ่ม
  function elevationLine() {
    const T = BPNP.map.terrain;
    if (!T || !T.isTerrainOn || !T.isTerrainOn()) return '';
    return `<div class="cp-elev" style="margin-top:4px"><span style="color:#888780">ความสูง: กำลังอ่านค่า…</span></div>`;
  }
  function fillElevation(popup, lng, lat) {
    const T = BPNP.map.terrain;
    if (!popup || !T || !T.isTerrainOn || !T.isTerrainOn()) return;
    const set = html => { const el = popup.getElement && popup.getElement(); const box = el && el.querySelector('.cp-elev'); if (box) box.innerHTML = html; };
    T.elevationAt(lng, lat)
      .then(v => set(v === null
        ? '<span style="color:#888780">ความสูง: ไม่มีข้อมูล</span>'
        : `<span style="color:#0f6e56;font-weight:600">ความสูง: ≈ ${Math.round(v).toLocaleString('en-US')} ม. รทก.</span><br><span style="font-size:11px;color:#5f5e5a">โดยประมาณจาก DEM (±หลายเมตร)</span>`))
      .catch(() => set('<span style="color:#888780">ความสูง: ไม่มีข้อมูล</span>'));
  }

  function showPopup(lngLat) {
    const [lng, lat] = BPNP.geo.toLngLat(lngLat);
    const latS = lat.toFixed(6), lngS = lng.toFixed(6);
    const gmap = `https://www.google.com/maps/search/?api=1&query=${latS},${lngS}`;
    const btns = `
      <button class="point-popup-btn" onclick="navigator.clipboard.writeText('${latS},${lngS}')">📋 คัดลอกพิกัด</button><br>
      <button class="point-popup-btn" onclick="window.open('${gmap}', '_blank')">🗺️ เปิดใน Google Maps</button>`;

    const A = BPNP.alignment;
    if (!A.isLoaded || !A.points.length) {
      const p0 = BPNP.map.popup.open([lng, lat], `
        <div class="point-popup-content">
          <strong>พิกัด:</strong> ${latS}, ${lngS}<br><br>
          <div style="color:orange;">กำลังโหลด alignment...</div>${elevationLine()}<br>${btns}
        </div>`, POPUP_OPTS);
      fillElevation(p0, lng, lat);
      A.load().catch(() => {});
      return;
    }

    const res = A.findStationOffset([lng, lat]);
    let sta = '-', os = '-', warn = '';
    if (!res) warn = '<div style="color:red;font-weight:bold">ไม่พบ alignment ที่ใกล้พอ</div>';
    else if (Math.abs(res.offset) > A.LIMIT_OFFSET) warn = '<div style="color:red;font-weight:bold">ตำแหน่งค้นหาอยู่ห่างเกินไป</div>';
    else { sta = A.formatStation(res.station); os = res.offset.toFixed(2); }

    const p1 = BPNP.map.popup.open([lng, lat], `
      <div class="point-popup-content">
        <strong>พิกัด:</strong> ${latS}, ${lngS}<br>
        <span style="color:#000080"><strong>Sta:</strong> ${sta}</span><br>
        <span style="color:#000080"><strong>O/S:</strong> ${os} m.</span><br>
        ${warn}${elevationLine()}<br>${btns}
      </div>`, POPUP_OPTS);
    fillElevation(p1, lng, lat);
  }

  // ── เงื่อนไขไม่ทำงาน ──
  function shouldBlock(e) {
    const t = e && e.originalEvent && e.originalEvent.target;
    if (t && t.closest && t.closest('.maplibregl-popup, .maplibregl-marker, .standard-map-btn, .layer-panel, button, input, a')) return true;
    return BPNP.tools.isBusy();
  }

  function clearHold() {
    clearTimeout(shortHold); clearTimeout(longHold);
    shortHold = longHold = null; holdStart = null;
  }

  function beginHold(e) {
    if (shouldBlock(e)) return;
    clearHold();
    const lngLat = [e.lngLat.lng, e.lngLat.lat];
    holdStart = e.point;
    shortHold = setTimeout(() => start(lngLat, 1000), SHORT_HOLD_MS);
    longHold  = setTimeout(() => { start(lngLat, 500); showPopup(lngLat); }, LONG_HOLD_MS);
  }

  function moveHold(e) {
    if (!holdStart || !e.point) return;
    const dx = e.point.x - holdStart.x, dy = e.point.y - holdStart.y;
    if (dx * dx + dy * dy > MOVE_TOLERANCE_PX * MOVE_TOLERANCE_PX) clearHold();
  }

  function updatePositions() {
    if (current && centerDot) place(centerDot, current);
  }

  function init(mapInstance) {
    map = mapInstance;
    map.on('move', updatePositions);

    map.on('contextmenu', e => {
      if (shouldBlock(e)) return;
      clearHold();
      start([e.lngLat.lng, e.lngLat.lat], 500);
      showPopup([e.lngLat.lng, e.lngLat.lat]);
    });

    // เมาส์ (ปุ่มซ้าย) — ข้ามเหตุการณ์เมาส์จำลองที่เบราว์เซอร์สร้างตามหลังการแตะ
    let lastTouchAt = 0;
    const fromTouch = () => Date.now() - lastTouchAt < 800;
    map.on('mousedown', e => { if (e.originalEvent.button === 0 && !fromTouch()) beginHold(e); });
    map.on('mousemove', moveHold);
    map.on('mouseup', clearHold);

    // หน้าจอสัมผัส (นิ้วเดียวเท่านั้น — สองนิ้ว = ซูม)
    map.on('touchstart', e => {
      lastTouchAt = Date.now();
      if (e.originalEvent.touches && e.originalEvent.touches.length === 1) beginHold(e);
      else clearHold();
    });
    map.on('touchmove', moveHold);
    map.on('touchend', () => { lastTouchAt = Date.now(); clearHold(); });
    map.on('touchcancel', clearHold);

    map.on('movestart', e => { if (e.originalEvent) clearHold(); });
    map.on('zoomstart', clearHold);

    document.addEventListener('keydown', e => { if (e.code === 'Space' || e.code === 'Escape') stop(); });

    // โหลด alignment ล่วงหน้าเมื่อเครื่องว่าง
    const preload = () => BPNP.alignment.load().then(() => BPNP.log('Alignment loaded')).catch(() => {});
    setTimeout(() => {
      if ('requestIdleCallback' in window) requestIdleCallback(preload, { timeout: 3000 });
      else preload();
    }, 2000);
  }

  BPNP.tools.clickPoint = { init, start, stop, showPopup };
  // ชื่อเดิม (เครื่องมือค้นหาในเฟส 5 เรียกใช้)
  window.startRippleEffect = (latlng, opts = {}) => start(latlng, opts.interval || 1000);
  window.stopRipples = stop;
})();
