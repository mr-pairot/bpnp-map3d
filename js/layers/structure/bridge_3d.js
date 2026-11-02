/* js/layers/structure/bridge_3d.js
 * ─────────────────────────────────────────────────────────────────────────
 * เฟส 3D-B: สะพานรถไฟ 3 มิติ (สะพานคอนกรีต CB / สะพานเหล็ก SB) — ใช้ตัวสร้างจาก bridge_gen.js (Three.js)
 *
 * การวาง (ตาม กม.):
 *   Sta. = กึ่งกลางสะพาน · ตอม่อริมหัว = Sta − Length/2 · ตอม่อต้นถัดไป = + ความยาวช่วงสะสม (Span "3x40", "100+75")
 *   ตอม่อแต่ละต้นวางที่ กม. ของตัวเองบนแนวราง (โค้งตามแนวรางจริง) ตั้งฉากแนวราง ณ จุดนั้น แล้วหมุนตาม Skew
 *   ช่วงสะพานแต่ละช่วงเป็นชิ้นตรงจากตอม่อต้นหนึ่งไปอีกต้น
 * ตอม่อ: ตอม่อริม = Type D ผนังทึบเสมอ (+ กำแพงปีกตามรูป 2D) · ตอม่อใน = ตั้งรายต้นได้ (data/json/bridge_3d.json) ค่าตั้งต้น A
 * พื้น: CB = คอนกรีต (box girder) · SB = โครงเหล็ก (truss) · ราง 2 ทาง ขนาด 1.000 ม.
 * ระดับพื้น: ค่ารายสะพาน > ช่องลอด (height_limit) + ความลึกคาน > 7 ม. (ยกอัตโนมัติถ้าต่ำกว่าที่ตอม่อต้องการ)
 *
 * แสดงเมื่อ: เปิดชั้น Bridge + โหมด 3D + config.features.bridge3d (เริ่มต้น ['editor']) + ซูม ≥ Leaflet 15
 *   สร้างเฉพาะสะพานในจอ (สูงสุด 14 สะพาน) และคืนหน่วยความจำเมื่อออกนอกจอ · โหลด Three.js เมื่อใช้ครั้งแรก
 *   เปิดภูมิประเทศ: ยกทั้งสะพานตามความสูงพื้นดินที่กึ่งกลางสะพาน (× ค่าขยายความสูง)
 * ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
  const CFG_URL = 'data/json/bridge_3d.json';
  const LAYER_ID = 'bridge-3d';
  const MIN_ZOOM = 14;          // = Leaflet 15
  const MAX_BUILT = 14;
  const WING_MAX = 4;           // ความยาวกำแพงปีกสูงสุด (ม.)

  let THREE = null, G = null, cfg = null, libPromise = null;
  let layer = null, origin = null, bridges = null, refreshQueued = false, refreshing = false;
  const built = new Map();      // key → { group, center, elev }
  const warnings = {};          // key → [ข้อความ] (ดูได้ที่ BPNP.layers.bridge3d.warnings)

  const map = () => BPNP.map.instance;
  const enabled = () => !!(BPNP.features && BPNP.features.isOn('bridge3d') && BPNP.map.terrain && BPNP.map.terrain.isOn()
                           && BPNP.map.registry.isVisible('layer_bridge'));

  function ensureLib() {
    if (!libPromise) libPromise = (async () => {
      THREE = await import(THREE_URL);
      G = BPNP.bridgeGen.create(THREE);
      cfg = await BPNP.core.dataCache.getJSON(CFG_URL).catch(() => ({}));
      cfg = cfg || {};
    })().catch(err => { libPromise = null; throw err; });
    return libPromise;
  }

  // "3x40" → [40,40,40] · "100+75" → [100,75] · "2x30+45" → [30,30,45]
  function parseSpans(text) {
    const out = [];
    for (const part of String(text || '').split('+')) {
      const t = part.trim(); if (!t) continue;
      const m = t.match(/^(\d+(?:\.\d+)?)\s*[x×X*]\s*(\d+(?:\.\d+)?)$/);
      if (m) { for (let i = 0; i < +m[1]; i++) out.push(+m[2]); }
      else if (/^\d+(\.\d+)?$/.test(t)) out.push(+t);
      else return null;
    }
    return out.length ? out : null;
  }
  const staM = s => { const [k, r] = String(s || '').split('+'); const v = (+k) * 1000 + parseFloat(r); return isFinite(v) ? v : null; };

  // ── รายการสะพาน (CB / SB) จากชั้น Bridge ──
  async function loadBridges() {
    if (bridges) return bridges;
    const [feats] = await Promise.all([BPNP.layers.bridge.loadAll(), BPNP.alignment.load()]);
    bridges = [];
    feats.forEach(f => {
      const p = f.properties || {}, src = String(p.Bridge_Source || '').toUpperCase();
      if (src !== 'CB' && src !== 'SB') return;                 // Overpass: เฟสถัดไป
      const spans = parseSpans(p.Span), S = staM(p['Sta.']), L = parseFloat(p.Length);
      if (!spans || S === null || !(L > 0)) return;
      const c = BPNP.alignment.pointAt(S, 0);
      if (!c) return;
      bridges.push({ key: p['Sta.'], src, sta: p['Sta.'], S, L, spans, skew: parseFloat(p.Skew) || 0, feature: f,
                     center: [c.lng, c.lat], heading: c.heading, geometry: f.geometry, heightLimit: f.heightLimit });
    });
    return bridges;
  }

  // ความกว้างและส่วนยื่นของรูป 2D (กรอบในแนวราง ณ กึ่งกลาง)
  function footprint(b) {
    const SX = 111320 * Math.cos(b.center[1] * Math.PI / 180), SY = 110574;
    const h = b.heading * Math.PI / 180, ux = Math.sin(h), uy = Math.cos(h);
    let a0 = Infinity, a1 = -Infinity, c0 = Infinity, c1 = -Infinity;
    (function walk(x) {
      if (typeof x[0] === 'number') {
        const dx = (x[0] - b.center[0]) * SX, dy = (x[1] - b.center[1]) * SY;
        const along = dx * ux + dy * uy, across = -dx * uy + dy * ux;
        a0 = Math.min(a0, along); a1 = Math.max(a1, along); c0 = Math.min(c0, across); c1 = Math.max(c1, across);
        return;
      }
      x.forEach(walk);
    })(b.geometry.coordinates);
    return { width: c1 - c0, extStart: Math.max(0, -a0 - b.L / 2), extEnd: Math.max(0, a1 - b.L / 2) };
  }

  function paramsFor(b, fp) {
    const D = cfg.defaults || {}, bc = (cfg.bridges || {})[b.sta] || {};
    const base = Object.assign({ deckLevel: 7, tracks: 2, gauge: 1.0 }, D, D[b.src] || {}, bc);
    delete base.CB; delete base.SB; delete base.piers;
    base.name = `${b.src} ${b.sta}`;
    if (!bc.deckWidth) base.deckWidth = Math.round(Math.min(20, Math.max(4, fp.width)) * 10) / 10;
    // ระดับพื้น: ค่ารายสะพาน > ช่องลอด + ความลึกโครงสร้าง > ค่าตั้งต้น
    if (!bc.deckLevel && +b.heightLimit > 0) {
      const Lmax = Math.max(...b.spans);
      const dep = base.deckType === 'truss' ? 1.6 : (base.girderDepth > 0 ? base.girderDepth : Math.min(4, Math.max(1.2, Lmax / 18)));
      base.deckLevel = Math.round((+b.heightLimit + dep) * 10) / 10;
    }
    return { base, piers: bc.piers || {}, wing: bc.wingWall };
  }

  function pierType(i, n, piers, def) {
    if (i === 0 || i === n) return 'D';                        // ตอม่อริม = ผนังทึบเสมอ
    const t = String(piers[String(i + 1)] || def || 'A').toUpperCase();
    return ['A', 'B', 'C', 'D'].includes(t) ? t : 'A';
  }

  // ── สร้างสะพาน 1 ตัว (Group หน่วยเมตร: x = ตะวันออก, y = ขึ้น, z = ใต้; origin = กึ่งกลางสะพาน) ──
  function buildBridge(b) {
    const A = BPNP.alignment, fp = footprint(b), { base, piers, wing } = paramsFor(b, fp);
    const n = b.spans.length, kms = [b.S - b.L / 2];
    b.spans.forEach(l => kms.push(kms[kms.length - 1] + l));
    const pts = kms.map(k => A.pointAt(k, 0));
    if (pts.some(p => !p)) return null;
    const SX = 111320 * Math.cos(b.center[1] * Math.PI / 180), SY = 110574;
    const P = pts.map(p => ({ x: (p.lng - b.center[0]) * SX, z: -(p.lat - b.center[1]) * SY, heading: p.heading }));
    const warn = [];

    // ── สะพานเฉียง (v3.10.05) ──
    //   สะพานคอนกรีต: ตอม่อหมุนตาม Skew · พื้นสะพานแต่ละช่วงเฉือน (shear) เป็นสี่เหลี่ยมด้านขนาน ปลายขนานแนวตอม่อ
    //                 ตอม่อยาว = ความกว้างพื้น ÷ cos(Skew) ให้รับพื้นได้เต็มความกว้าง
    //   สะพานเหล็ก: ไม่มีตอม่อเฉียง — ถ้าข้อมูลมี Skew ถือว่าผิด วาดแบบตั้งฉากและบันทึกข้อความเตือน
    let skew = b.skew;
    if (b.src === 'SB' && skew) { warn.push(`ข้อมูล Skew ${skew}° ของสะพานเหล็ก — สะพานเหล็กไม่มีตอม่อเฉียง วาดแบบตั้งฉาก (ตรวจข้อมูล)`); skew = 0; }
    const skewRad = skew * Math.PI / 180;
    const pierBase = skew ? Object.assign({}, base, { deckWidth: Math.min(20, Math.round(base.deckWidth / Math.cos(skewRad) * 100) / 100) }) : base;

    // ระดับพื้นเดียวทั้งสะพาน: ยกจนทุกตอม่อสร้างได้
    const adjL = i => Math.max(b.spans[i - 1] || 0, b.spans[i] || 0);
    let deckLevel = base.deckLevel;
    const ok = dl => P.every((_, i) => G.deriveDims(Object.assign({}, pierBase, { deckLevel: dl, pierType: pierType(i, n, piers, base.pierType), spanLength: adjL(i), spanCount: 1 })).errors.length === 0);
    let guard = 0;
    while (!ok(deckLevel) && guard++ < 140) deckLevel = Math.round((deckLevel + 0.25) * 100) / 100;
    if (deckLevel !== base.deckLevel) warn.push(`ระดับพื้น ${base.deckLevel} ม. ต่ำเกินไปสำหรับตอม่อ ใช้ ${deckLevel} ม.`);
    base.deckLevel = deckLevel; pierBase.deckLevel = deckLevel;

    const group = new THREE.Group();
    group.name = base.name;
    // ชี้/คลิกรูป 3D (v3.10.04): ข้อมูลสำหรับ pick → การ์ดสะพานเดิม (bridge.js) + ป้ายชื่อ
    group.userData = { typeId: 'layer_bridge', key: b.key, feature: b.feature, label: `${b.src === 'SB' ? 'สะพานเหล็ก' : 'สะพานคอนกรีต'}  กม. ${b.sta}` };
    // ตอม่อ
    P.forEach((pt, i) => {
      const type = pierType(i, n, piers, base.pierType);
      const d = G.deriveDims(Object.assign({}, pierBase, { pierType: type, spanLength: adjL(i), spanCount: 1 }));
      d.warnings.forEach(w => warn.push(`ตอม่อ ${i + 1}: ${w}`));
      const kit = G.makeKit(d);
      const pier = G.buildPier(d, kit);
      pier.name = `pier-${i + 1}${i === 0 || i === n ? ' (ริม)' : ''}`;
      if (i === 0 || i === n) {
        const ext = wing !== undefined ? +wing : Math.min(WING_MAX, i === 0 ? fp.extStart : fp.extEnd);
        if (ext > 0.3) pier.add(G.buildWingWalls(d, i === 0 ? -1 : 1, ext));
      }
      pier.position.set(pt.x, 0, pt.z);
      // แกน x ตอม่อ = แนวราง แล้วหมุนตาม Skew (ทิศของค่า Skew ในข้อมูล: บวก = หมุนตามเข็ม — ตรวจกับรูป 2D ของ 125+143 / 132+351)
      pier.rotation.y = (90 - pt.heading + skew) * Math.PI / 180;
      group.add(pier);
    });
    // ช่วงสะพาน: ชิ้นตรงจากตอม่อ i ไป i+1
    b.spans.forEach((L, i) => {
      const d = G.deriveDims(Object.assign({}, base, { pierType: 'A', spanLength: L, spanCount: 1 }));
      const kit = G.makeKit(d);
      const span = G.buildSpan(d, kit);
      const a = P[i], c = P[i + 1], vx = c.x - a.x, vz = c.z - a.z, chord = Math.hypot(vx, vz);
      span.position.set(a.x, 0, a.z);
      span.rotation.y = Math.atan2(-vz, vx);
      span.scale.x = chord / L;
      if (skew) {
        // เฉือนตามแนวสะพาน: x' = x + tan(Skew)·z → ปลายช่วงขนานกับแนวตอม่อ (แนวกึ่งกลาง z = 0 ไม่เปลี่ยน)
        span.updateMatrix();
        span.matrixAutoUpdate = false;
        span.matrix.multiply(new THREE.Matrix4().makeShear(0, 0, 0, 0, Math.tan(skewRad), 0));
      }
      span.name = `span-${i + 1}`;
      group.add(span);
    });
    warnings[b.key] = warn;
    return group;
  }

  function dispose(obj) {
    obj.traverse(o => {
      if (o.isMesh && o.geometry && !(o.geometry.userData && o.geometry.userData.shared)) o.geometry.dispose();
    });
  }

  // ── custom layer ──
  function ensureLayer() {
    const m = map();
    if (layer && m.getLayer(LAYER_ID)) return;
    layer = {
      id: LAYER_ID, type: 'custom', renderingMode: '3d',
      onAdd(mp, gl) {
        this.camera = new THREE.Camera();
        this.scene = new THREE.Scene();
        this.scene.add(new THREE.AmbientLight(0xffffff, 1.6));
        const sun = new THREE.DirectionalLight(0xffffff, 1.4); sun.position.set(-60, 120, 40); this.scene.add(sun);
        const fill = new THREE.DirectionalLight(0xffffff, 0.6); fill.position.set(80, 60, -50); this.scene.add(fill);
        this.renderer = new THREE.WebGLRenderer({ canvas: mp.getCanvas(), context: gl, antialias: true });
        this.renderer.autoClear = false;
      },
      render(gl, args) {
        if (!origin || !this.scene.children.some(c => c.isGroup)) return;
        const arr = args && args.defaultProjectionData ? args.defaultProjectionData.mainMatrix : args;   // MapLibre v5 / v4
        const mc = maplibregl.MercatorCoordinate.fromLngLat(origin, 0), s = mc.meterInMercatorCoordinateUnits();
        const l = new THREE.Matrix4().makeTranslation(mc.x, mc.y, mc.z)
          .scale(new THREE.Vector3(s, -s, s)).multiply(new THREE.Matrix4().makeRotationX(Math.PI / 2));
        this.camera.projectionMatrix = new THREE.Matrix4().fromArray(arr).multiply(l);
        this.camera.projectionMatrixInverse.copy(this.camera.projectionMatrix).invert();   // ใช้ยิงรังสีตอนชี้/คลิก
        this.rendered = true;
        this.renderer.resetState();
        this.renderer.render(this.scene, this.camera);
      }
    };
    const before = BPNP.map.registry.beforeIdFor ? BPNP.map.registry.beforeIdFor('structure') : undefined;
    m.addLayer(layer, before && m.getLayer(before) ? before : undefined);
    if (BPNP.map.registerPick) BPNP.map.registerPick('bridge3d', pick);   // ชี้/คลิกรูป 3D ผ่านตัวตรวจกลาง js/map/hit3d.js
    if (BPNP.map.registry.pinTop) BPNP.map.registry.pinTop('structure', LAYER_ID);   // อยู่เหนือเลเยอร์ 2D ของ slot เสมอ
  }

  // วางทุกสะพานเทียบจุดอ้างอิง (กึ่งกลางจอ) — เมตร ณ จุดอ้างอิง · สเกลตามละติจูดของแต่ละสะพาน
  function placeAll() {
    if (!layer || !layer.scene) return;
    const c = map().getCenter(); origin = [c.lng, c.lat];
    const m0 = maplibregl.MercatorCoordinate.fromLngLat(origin, 0), s0 = m0.meterInMercatorCoordinateUnits();
    built.forEach(rec => {
      const mi = maplibregl.MercatorCoordinate.fromLngLat(rec.center, rec.elev), si = mi.meterInMercatorCoordinateUnits();
      rec.group.position.set((mi.x - m0.x) / s0, (mi.z - m0.z) / s0, (mi.y - m0.y) / s0);
      rec.group.scale.setScalar(si / s0);
      rec.group.updateMatrixWorld(true);                 // ให้การยิงรังสีใช้ตำแหน่งล่าสุด
    });
  }

  async function groundElev(center) {
    const T = BPNP.map.terrain;
    if (!T || !T.isTerrainOn || !T.isTerrainOn() || !T.elevationAt) return 0;
    const ex = (BPNP.config.map && BPNP.config.map.terrain && BPNP.config.map.terrain.exaggeration) || 1;
    try { const v = await T.elevationAt(center[0], center[1]); return v === null ? 0 : v * ex; } catch (e) { return 0; }
  }

  function clearAll() {
    built.forEach(rec => { if (layer && layer.scene) layer.scene.remove(rec.group); dispose(rec.group); });
    built.clear();
    if (map()) map().triggerRepaint();
  }

  async function refresh() {
    refreshQueued = false;
    if (refreshing) { schedule(); return; }
    refreshing = true;
    try {
      const m = map();
      if (!enabled() || m.getZoom() < MIN_ZOOM) { clearAll(); return; }
      await ensureLib();
      ensureLayer();
      const list = await loadBridges();
      const b = m.getBounds(), padX = (b.getEast() - b.getWest()) * 0.25, padY = (b.getNorth() - b.getSouth()) * 0.25;
      const ctr = m.getCenter();
      const want = list.filter(x => x.center[0] > b.getWest() - padX && x.center[0] < b.getEast() + padX
                                 && x.center[1] > b.getSouth() - padY && x.center[1] < b.getNorth() + padY)
        .sort((p, q) => Math.hypot(p.center[0] - ctr.lng, p.center[1] - ctr.lat) - Math.hypot(q.center[0] - ctr.lng, q.center[1] - ctr.lat))
        .slice(0, MAX_BUILT);
      const keys = new Set(want.map(x => x.key));
      built.forEach((rec, k) => { if (!keys.has(k)) { layer.scene.remove(rec.group); dispose(rec.group); built.delete(k); } });
      for (const x of want) {
        if (built.has(x.key)) continue;
        const group = buildBridge(x);
        if (!group) continue;
        const elev = await groundElev(x.center);
        built.set(x.key, { group, center: x.center, elev });
        layer.scene.add(group);
      }
      placeAll();
      m.triggerRepaint();
    } catch (err) {
      console.error('[Bridge3D] แสดงสะพาน 3 มิติไม่สำเร็จ:', err);
    } finally { refreshing = false; }
  }

  function schedule() {
    if (refreshQueued) return;
    refreshQueued = true;
    setTimeout(refresh, 120);
  }

  // จุดบนจอ → สะพาน 3D ที่ถูกชี้ (ยิงรังสีด้วยเมทริกซ์ของเฟรมล่าสุด)
  function pick(pt) {
    if (!THREE || !layer || !layer.scene || !layer.rendered || !pt || !built.size) return null;
    const groups = [];
    built.forEach(rec => groups.push(rec.group));
    const cv = map().getCanvas(), nx = pt.x / cv.clientWidth * 2 - 1, ny = -(pt.y / cv.clientHeight) * 2 + 1, cam = layer.camera;
    const a = new THREE.Vector3(nx, ny, -1).unproject(cam), b = new THREE.Vector3(nx, ny, 1).unproject(cam);
    const rc = new THREE.Raycaster();
    rc.ray.origin.copy(a); rc.ray.direction.copy(b).sub(a).normalize();
    const hit = rc.intersectObjects(groups, true)[0];
    if (!hit) return null;
    let o = hit.object;
    while (o && !(o.userData && o.userData.typeId)) o = o.parent;
    return o ? { typeId: o.userData.typeId, key: o.userData.key, label: o.userData.label, feature: o.userData.feature, dist: hit.distance } : null;
  }

  function register(mp) {
    mp.on('moveend', schedule);
    // คลิกรูปสะพาน 3D → การ์ดสะพานเดิม (bridge.js) · ชั้น 2D ใต้รูปไม่เปิดการ์ด (ตรวจ hit3d)
    mp.on('click', e => {
      if (BPNP.tools.isBusy() || !built.size) return;
      const h = BPNP.map.hit3d && BPNP.map.hit3d(e.point);
      if (!h || h.typeId !== 'layer_bridge' || !h.feature) return;
      BPNP.layers.bridge.openPopup(h.feature, [e.lngLat.lng, e.lngLat.lat]);
    });
    BPNP.events.on('map:3d', schedule);
    BPNP.events.on('map:terrain', () => { built.forEach(rec => { rec.group.userData.stale = true; }); clearAll(); schedule(); });
    BPNP.events.on('features:change', schedule);
    BPNP.events.on('layers:change', e => { if (e && e.id === 'layer_bridge') schedule(); });
  }

  BPNP.layers.utils.register({ name: 'bridge_3d', register });
  // ตรวจสอบ: สร้างสะพานตาม Sta. แล้วคืนตำแหน่งตอม่อ (lng/lat) ชนิดตอม่อ และระดับพื้น — ใช้ตอนปรับแก้ข้อมูล
  //   opts.deck = true → คืนจุดบนพื้นสะพาน (มุมมองจากด้านบน, lng/lat) ไว้เทียบกับรูป 2D
  async function inspect(sta, opts = {}) {
    await ensureLib(); const list = await loadBridges();
    const b = list.find(x => x.key === sta); if (!b) return null;
    const g = buildBridge(b); if (!g) return null;
    const SX = 111320 * Math.cos(b.center[1] * Math.PI / 180), SY = 110574;
    let deck = null;
    if (opts.deck) {
      g.updateMatrixWorld(true);
      deck = [];
      const v = new THREE.Vector3();
      g.children.filter(c => /^span-/.test(c.name)).forEach(sp => sp.traverse(o => {
        if (!o.isMesh || !o.geometry || !o.geometry.attributes.position) return;
        const pos = o.geometry.attributes.position;
        for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld); deck.push([b.center[0] + v.x / SX, b.center[1] - v.z / SY]); }
      }));
    }
    const piers = g.children.filter(c => /^pier-/.test(c.name)).map(c => ({ name: c.name,
      lngLat: [b.center[0] + c.position.x / SX, b.center[1] - c.position.z / SY], rotDeg: Math.round(c.rotation.y * 180 / Math.PI * 10) / 10 }));
    const spans = g.children.filter(c => /^span-/.test(c.name)).length;
    dispose(g);
    return { sta, src: b.src, spans: b.spans, skew: b.skew, piers, spanCount: spans, warnings: warnings[b.key] || [], deck };
  }

  BPNP.layers.bridge3d = { refresh: schedule, parseSpans, inspect, warnings, get built() { return built; }, get bridges() { return bridges; } };
})();
