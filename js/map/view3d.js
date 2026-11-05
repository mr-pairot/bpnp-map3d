/* js/map/view3d.js
 * ─────────────────────────────────────────────────────────────────────────
 * ตัวตรวจมุมมอง 3D กลาง (v3.10.10) — ใช้ร่วมกันทั้งชื่อสถานี (railway.js) หมุด/ป้ายทุกชนิด และ popup
 *
 * กฎ (เฉพาะโหมด 3D ที่เอียงแผนที่ · โหมด 2D ไม่ตรวจ):
 *   1) อยู่ด้านหลังกล้อง → ไม่แสดง
 *   2) เลยเส้นขอบฟ้า → ไม่แสดง (หมุด/ป้าย: ส่วนบนสุดของหมุดต้องอยู่ใต้เส้น · popup: จุดที่ชี้ต้องอยู่ใต้เส้น)
 *   3) ไกลเกินไป → ไม่แสดง: ระยะสูงสุด = maxDistFactor × ระยะกล้องถึงกลางจอ (ไม่ต่ำกว่า minKm)
 *      ช่วงท้าย fadeFrac ของระยะ = ค่อย ๆ จาง (ชื่อสถานี) · หมุด/popup อื่นตัดที่ระยะสูงสุด
 *   ค่าตั้ง: config.map.view3d { maxDistFactor: 4, minKm: 3, fadeFrac: 0.25 }
 *
 * ผู้ดูแลหมุด/popup: ติดตาม maplibregl.Marker / Popup ทุกตัวที่ถูกเพิ่มบนแผนที่ (ไม่ต้องแก้แต่ละชั้น)
 *   - หมุดที่จัดการเอง (ชื่อสถานี: data-view3d="own") ข้าม
 *   - popup ป้ายชื่อตอนชี้ (class bpnp-hover-label) ข้าม — หมุดที่แสดงอยู่ชี้แล้วขึ้นปกติ
 *   - ไม่แสดง = class v3d-hidden (มองไม่เห็น + กดไม่ได้) · popup ซ่อนชั่วคราว ไม่ปิดทิ้ง กลับมาเมื่อเห็นจุดนั้นอีก
 *
 *   BPNP.map.view3d.state(map)          → สถานะมุมมองของเฟรมนี้ (null = ไม่ใช่โหมด 3D)
 *   BPNP.map.view3d.check(st, ll, topY) → 0…1 (0 = ไม่แสดง, 1 = แสดงเต็ม, ระหว่าง = ช่วงจางตามระยะ)
 *   ชั้น symbol ของแอป (source 'src-…') ใช้ตัวกรอง "อยู่ในพื้นที่ที่มองเห็น" แทน (ดู updateSymbols)
 * ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  const cfg = () => Object.assign({ maxDistFactor: 4, minKm: 3, fadeFrac: 0.25 }, (BPNP.config.map && BPNP.config.map.view3d) || {});
  const active = map => !!(map && BPNP.map.terrain && BPNP.map.terrain.isOn() && map.getPitch() > 0.5);

  // ── กล้อง ──
  // unproject ของแถวท้องฟ้าคืนจุดบนพื้น "ด้านหลังกล้อง" และ project กลับได้ตรง → ต้องตรวจหน้า/หลังกล้องด้วย
  // ตำแหน่งกล้อง: map.transform.getCameraLngLat() (MapLibre 5.24 — แอปตรึงรุ่นไว้) · ไม่มี → ไม่ตรวจหน้า/หลัง/ระยะ
  function cameraFrame(map) {
    try {
      const t = map.transform, ll = t && t.getCameraLngLat ? t.getCameraLngLat() : null;
      if (!ll) return null;
      const b = map.getBearing() * Math.PI / 180;
      return { ll, cp: maplibregl.MercatorCoordinate.fromLngLat(ll), fx: Math.sin(b), fy: -Math.cos(b) };   // เมอร์เคเตอร์: y ชี้ใต้
    } catch (e) { return null; }
  }
  function inFront(cf, ll) {
    if (!cf) return true;
    const m = maplibregl.MercatorCoordinate.fromLngLat(ll);
    return (m.x - cf.cp.x) * cf.fx + (m.y - cf.cp.y) * cf.fy > 0;
  }
  // แถวบนสุดที่ยังเห็น "พื้นด้านหน้ากล้อง" (เหนือขึ้นไปเป็นท้องฟ้า)
  function horizonY(map, cf) {
    const c = map.getContainer(), x = c.clientWidth / 2;
    const ground = y => {
      try { const ll = map.unproject([x, y]); if (!ll || !inFront(cf, ll)) return false; return Math.abs(map.project(ll).y - y) < 1.5; }
      catch (e) { return false; }
    };
    if (ground(0)) return 0;
    let lo = 0, hi = c.clientHeight;
    for (let i = 0; i < 14; i++) { const mid = (lo + hi) / 2; if (ground(mid)) hi = mid; else lo = mid; }
    return hi;
  }
  function distKm(a, b) {
    const R = 6371, r = x => x * Math.PI / 180;
    const s = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(s));
  }

  // สถานะมุมมองของเฟรม (คำนวณครั้งเดียวแล้วใช้กับทุกหมุด)
  function state(map) {
    if (!active(map)) return null;
    const cf = cameraFrame(map), c = cfg();
    const maxKm = cf ? Math.max(c.minKm, c.maxDistFactor * distKm(cf.ll, map.getCenter())) : Infinity;
    return { map, cf, hz: horizonY(map, cf), maxKm, fadeKm: maxKm * (1 - c.fadeFrac) };
  }

  // 0 = ไม่แสดง · 1 = แสดง · ระหว่าง = อยู่ในช่วงจางท้ายระยะ
  function check(st, ll, topY) {
    if (!st) return 1;
    if (!inFront(st.cf, ll)) return 0;
    if (topY !== undefined && topY < st.hz) return 0;
    if (!st.cf || st.maxKm === Infinity) return 1;
    const d = distKm(st.cf.ll, ll);
    if (d >= st.maxKm) return 0;
    return d <= st.fadeKm ? 1 : (st.maxKm - d) / (st.maxKm - st.fadeKm);
  }

  // ── ผู้ดูแลหมุด/popup ทุกตัว ──
  const markers = new Set(), popups = new Set();
  const heights = new WeakMap();
  let queued = false, wasActive = false, bound = null;

  const anchorFrac = a => (!a || a === 'center' || a === 'left' || a === 'right') ? 0.5 : (/bottom/.test(a) ? 1 : 0);
  function markerTop(m, p) {
    const el = m.getElement();
    let h = heights.get(el);
    if (!h) { h = el.offsetHeight || 0; if (h) heights.set(el, h); }
    return p.y - h * anchorFrac(m._anchor);
  }

  function update() {
    queued = false;
    const map = BPNP.map.instance;
    if (!map) return;
    const st = state(map);
    if (!st) {
      if (wasActive) { markers.forEach(m => m.getElement().classList.remove('v3d-hidden')); popups.forEach(p => { const el = p.getElement && p.getElement(); if (el) el.classList.remove('v3d-hidden'); }); }
      if (symOn) scheduleSymbols(true);          // ออกจาก 3D → คืนตัวกรองชั้น symbol ทันที
      wasActive = false;
      return;
    }
    wasActive = true;
    markers.forEach(m => {
      if (!m._map) { markers.delete(m); return; }
      const el = m.getElement();
      if (el.dataset.view3d === 'own') return;
      const ll = m.getLngLat(), p = map.project(ll);
      el.classList.toggle('v3d-hidden', check(st, ll, markerTop(m, p)) <= 0);
    });
    popups.forEach(pp => {
      const el = pp.getElement && pp.getElement();
      if (!el || !pp.isOpen()) { popups.delete(pp); return; }
      if (el.classList.contains('bpnp-hover-label')) return;   // ป้ายตอนชี้: แสดงปกติ
      const ll = pp.getLngLat(), p = map.project(ll);
      el.classList.toggle('v3d-hidden', check(st, ll, p.y) <= 0);
    });
  }

  // ── ชั้น symbol ของแอป (source 'src-…': ตัวเลข กม., หลัก กม. ทล., ไอคอน Underpass/Box, ป้ายตอม่อ) ──
  //   วาดโดย MapLibre ไม่ใช่ HTML จึงซ่อนด้วยตัวกรอง: โหมด 3D = ตัวกรองเดิมของชั้น + "อยู่ในพื้นที่ที่มองเห็น"
  //   พื้นที่ที่มองเห็น = ครึ่งวงกลมด้านหน้ากล้อง รัศมี = ระยะสูงสุด หรือระยะถึงแถวใต้เส้นขอบฟ้า (ป้ายไม่ยื่นขึ้นฟ้า) แล้วแต่ค่าใดน้อยกว่า
  //   โหมด 2D = คืนตัวกรองเดิม · ชั้นเปลี่ยนตัวกรองเอง → ใช้ตัวกรองใหม่เป็นฐาน · ป้ายแผนที่พื้นหลัง (ชื่อเมือง ฯลฯ) ไม่ยุ่ง
  const SYM_HORIZON_PAD = 16;          // px ใต้เส้นขอบฟ้า (ครึ่งความสูงป้าย)
  const baseFilter = new Map(), applied = new Map();
  let symTimer = null, symOn = false;
  const appSymbols = map => (map.getStyle().layers || []).filter(l => l.type === 'symbol' && typeof l.source === 'string' && l.source.indexOf('src-') === 0).map(l => l.id);
  function dest(ll, brgDeg, km) {
    const b = brgDeg * Math.PI / 180;
    return [ll.lng + (km * Math.sin(b)) / (111.32 * Math.cos(ll.lat * Math.PI / 180)), ll.lat + (km * Math.cos(b)) / 110.574];
  }
  function visibleFan(st) {
    const map = st.map, c = map.getContainer();
    let R = st.maxKm;
    if (st.hz > 0) {
      const ll = map.unproject([c.clientWidth / 2, st.hz + SYM_HORIZON_PAD]);
      if (ll && inFront(st.cf, ll)) R = Math.min(R, distKm(st.cf.ll, ll));
    }
    const cam = st.cf.ll, brg = map.getBearing(), ring = [[cam.lng, cam.lat]];
    for (let a = -90; a <= 90; a += 6) ring.push(dest(cam, brg + a, R));
    ring.push([cam.lng, cam.lat]);
    return { type: 'Polygon', coordinates: [ring] };
  }
  function updateSymbols() {
    symTimer = null;
    const map = BPNP.map.instance;
    if (!map || !map.isStyleLoaded()) return;
    const st = state(map);
    const ids = appSymbols(map);
    if (!st || !st.cf) {
      if (symOn) ids.forEach(id => { if (baseFilter.has(id)) map.setFilter(id, baseFilter.get(id) || null); });
      baseFilter.clear(); applied.clear(); symOn = false;
      return;
    }
    symOn = true;
    const within = ['within', visibleFan(st)];
    ids.forEach(id => {
      const cur = map.getFilter(id);
      if (!applied.has(id) || JSON.stringify(cur) !== applied.get(id)) baseFilter.set(id, cur);   // ครั้งแรก หรือชั้นเปลี่ยนตัวกรองเอง
      const base = baseFilter.get(id);
      const f = base ? ['all', base, within] : within;
      if (JSON.stringify(f) === JSON.stringify(cur)) return;      // ไม่เปลี่ยน → ไม่ตั้งซ้ำ
      map.setFilter(id, f);
      applied.set(id, JSON.stringify(map.getFilter(id)));
    });
  }
  function scheduleSymbols(now) {
    if (now) { if (symTimer) clearTimeout(symTimer); updateSymbols(); return; }
    if (!symTimer) symTimer = setTimeout(updateSymbols, 200);     // ระหว่างเลื่อน: ทุก 0.2 วินาที
  }

  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(update);
  }

  function bind(map) {
    if (bound === map || !map) return;
    bound = map;
    ['move', 'resize', 'idle'].forEach(ev => map.on(ev, schedule));
    map.on('move', () => scheduleSymbols(false));
    map.on('moveend', () => scheduleSymbols(true));
    if (BPNP.events) {
      BPNP.events.on('map:3d', () => { schedule(); scheduleSymbols(true); });
      BPNP.events.on('layers:change', () => setTimeout(() => scheduleSymbols(true), 0));   // ชั้นใหม่ถูกเปิด → ใส่ตัวกรอง
    }
  }

  // ติดตามหมุด/popup ที่เพิ่มบนแผนที่ (ครั้งเดียว ก่อนชั้นใดสร้างหมุด)
  const MP = maplibregl.Marker.prototype, PP = maplibregl.Popup.prototype;
  const mAdd = MP.addTo, mRemove = MP.remove, pAdd = PP.addTo;
  MP.addTo = function (map) { const r = mAdd.call(this, map); markers.add(this); bind(map); schedule(); return r; };
  MP.remove = function () { markers.delete(this); this.getElement().classList.remove('v3d-hidden'); return mRemove.call(this); };
  PP.addTo = function (map) { const r = pAdd.call(this, map); popups.add(this); bind(map); schedule(); return r; };

  BPNP.map.view3d = { active, state, check, cameraFrame, inFront, horizonY, distKm, refresh: schedule };
})();
