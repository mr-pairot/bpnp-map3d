/* js/layers/structure/structure_3d_layer.js
 * ─────────────────────────────────────────────────────────────────────────
 * เฟส 3D-B: วาดรูป 3 มิติ Box Culvert / Underpass ด้วย Three.js (custom layer) แทน fill-extrusion
 *
 * เหตุผล: fill-extrusion ของ MapLibre ยกแต่ละชิ้นตามความสูงภูมิประเทศ "รายชิ้น" — โครงสร้างหนึ่งแตกเป็นร้อยชิ้น
 *   (พื้น ผนัง ขอบกั้นดิน กำแพงปีกขั้นละ 0.05 ม.) ชิ้นบางจมใต้ผิวดิน/ชิ้นข้างเคียงเหลื่อมกัน
 *   วิธีนี้วางทั้งโครงสร้างเป็นก้อนเดียวที่ระดับพื้นดินค่าเดียว (เหมือนสะพานใน bridge_3d.js)
 *
 * ระดับวาง (mode ที่ underpass_box.js ส่งมา)
 *   'max'    : จุดสูงสุดของพื้นดินในกรอบโครงสร้าง (สุ่ม 7×7 จุด) + 0.2 ม. — ไม่มีส่วนใดจมดิน (Underpass)
 *   'center' : พื้นดินที่กึ่งกลางโครงสร้าง (Box Culvert)
 *   ปิดภูมิประเทศ → ระดับ 0 · ความสูงคูณค่า exaggeration เหมือนที่ MapLibre ยกภูมิประเทศ
 *
 * BPNP.layers.structure3dLayer
 *   sync(typeId, items)  items = [{ key, parts, mode }]  parts = ผลของ structure3d.build() — ส่ง [] เพื่อล้างชนิดนั้น
 *   pick({x, y})         → { typeId, key } | null  (ยิงรังสีจากจุดบนจอ ใช้เปิดการ์ดข้อมูล/เปลี่ยนเคอร์เซอร์)
 *
 * ลำดับเลเยอร์: เลเยอร์ 3D ถูกยกให้อยู่บนสุดของ slot 'structure' ทุกครั้งที่มีรูปใหม่ (raise)
 *   → เส้น/พื้นที่ 2D ของชั้นโครงสร้างอยู่ใต้รูป 3D เสมอ ไม่ทับรูป 3D (ไม่ว่าเลเยอร์ 2D จะสร้างก่อนหรือหลัง)
 * ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  const THREE_URL = 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
  const LAYER_ID = 'structure-3d';
  const GRID = 7, MAX_MARGIN = 0.2;

  let THREE = null, libPromise = null, layer = null, origin = null, hovering = false, hoverQueued = false;
  const types = {};                    // typeId → { recs: Map(key → rec), seq }
  const materials = new Map();         // color → material (ใช้ร่วมกัน)

  const map = () => BPNP.map.instance;
  const terrainOn = () => !!(BPNP.map.terrain && BPNP.map.terrain.isTerrainOn && BPNP.map.terrain.isTerrainOn());
  const exaggeration = () => (BPNP.config.map && BPNP.config.map.terrain && BPNP.config.map.terrain.exaggeration) || 1;

  function ensureLib() {
    if (!libPromise) libPromise = import(THREE_URL).then(m => { THREE = m; }).catch(err => { libPromise = null; throw err; });
    return libPromise;
  }

  const material = color => {
    if (!materials.has(color)) materials.set(color, new THREE.MeshLambertMaterial({ color, side: THREE.DoubleSide }));
    return materials.get(color);
  };

  // ── ปริซึม: วงนอก (+รู) จากพิกัดท้องถิ่น (ตะวันออก, เหนือ) ม. ฐาน→ยอด → สามเหลี่ยมใน buffer ──
  //   โลก three: x = ตะวันออก, y = ขึ้น, z = ใต้ (= −เหนือ)
  function addPrism(buf, outer, holes, base, top) {
    const V = (p, y) => buf.push(p[0], y, -p[1]);
    const tri = (a, b, c, y) => { V(a, y); V(b, y); V(c, y); };
    const all = outer.concat(...holes);
    let faces;
    if (outer.length === 4 && !holes.length) faces = [[0, 1, 2], [0, 2, 3]];
    else faces = THREE.ShapeUtils.triangulateShape(outer.map(p => new THREE.Vector2(p[0], p[1])), holes.map(h => h.map(p => new THREE.Vector2(p[0], p[1]))));
    faces.forEach(f => { tri(all[f[0]], all[f[1]], all[f[2]], top); tri(all[f[0]], all[f[1]], all[f[2]], base); });
    [outer].concat(holes).forEach(ring => {
      for (let i = 0; i < ring.length; i++) {
        const p = ring[i], q = ring[(i + 1) % ring.length];
        V(p, base); V(q, base); V(q, top);
        V(p, base); V(q, top); V(p, top);
      }
    });
  }

  const openRing = r => (r.length > 1 && r[0][0] === r[r.length - 1][0] && r[0][1] === r[r.length - 1][1]) ? r.slice(0, -1) : r;

  function buildRec(typeId, item) {
    let w = Infinity, e = -Infinity, s = Infinity, n = -Infinity;
    item.parts.forEach(f => f.geometry.coordinates.forEach(r => r.forEach(([x, y]) => {
      if (x < w) w = x; if (x > e) e = x; if (y < s) s = y; if (y > n) n = y;
    })));
    if (!isFinite(w)) return null;
    const c = [(w + e) / 2, (s + n) / 2], SX = 111320 * Math.cos(c[1] * Math.PI / 180), SY = 110574;
    const toXY = ([lng, lat]) => [(lng - c[0]) * SX, (lat - c[1]) * SY];
    const byColor = new Map();
    item.parts.forEach(f => {
      const { base, top, color } = f.properties;
      if (!(top > base)) return;
      if (!byColor.has(color)) byColor.set(color, []);
      const rings = f.geometry.coordinates.map(r => openRing(r).map(toXY));
      addPrism(byColor.get(color), rings[0], rings.slice(1), base, top);
    });
    const group = new THREE.Group();
    byColor.forEach((arr, color) => {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
      geo.computeVertexNormals();
      const mesh = new THREE.Mesh(geo, material(color));
      mesh.userData = { typeId, key: item.key };
      group.add(mesh);
    });
    return { group, center: c, bbox: [w, s, e, n], mode: item.mode, terr: terrainOn(), elev: 0 };
  }

  // ระดับพื้นดิน (ม. × exaggeration) ตามโหมดของชนิดนั้น
  async function groundElev(rec) {
    const T = BPNP.map.terrain;
    if (!rec.terr || !T || !T.elevationAt) return 0;
    const pts = [];
    if (rec.mode === 'max') {
      const [w, s, e, n] = rec.bbox;
      for (let i = 0; i < GRID; i++) for (let j = 0; j < GRID; j++) pts.push([w + (e - w) * i / (GRID - 1), s + (n - s) * j / (GRID - 1)]);
    } else pts.push(rec.center);
    const vals = (await Promise.all(pts.map(p => T.elevationAt(p[0], p[1]).catch(() => null)))).filter(v => v !== null && isFinite(v));
    if (!vals.length) return 0;
    const v = rec.mode === 'max' ? Math.max(...vals) * exaggeration() + MAX_MARGIN : vals[0] * exaggeration();
    return v;
  }

  function disposeRec(rec) {
    if (layer && layer.scene) layer.scene.remove(rec.group);
    rec.group.children.forEach(m => m.geometry.dispose());
  }

  // วางทุกโครงสร้างเทียบจุดอ้างอิง (กึ่งกลางจอ) — เหมือน bridge_3d.js
  function placeAll() {
    if (!layer || !layer.scene) return;
    const c = map().getCenter(); origin = [c.lng, c.lat];
    const m0 = maplibregl.MercatorCoordinate.fromLngLat(origin, 0), s0 = m0.meterInMercatorCoordinateUnits();
    Object.values(types).forEach(T => T.recs.forEach(rec => {
      const mi = maplibregl.MercatorCoordinate.fromLngLat(rec.center, rec.elev), si = mi.meterInMercatorCoordinateUnits();
      rec.group.position.set((mi.x - m0.x) / s0, (mi.z - m0.z) / s0, (mi.y - m0.y) / s0);
      rec.group.scale.setScalar(si / s0);
      rec.group.updateMatrixWorld(true);
    }));
  }

  function ensureLayer() {
    const m = map();
    if (layer && m.getLayer(LAYER_ID)) return;
    layer = {
      id: LAYER_ID, type: 'custom', renderingMode: '3d', rendered: false,
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
        this.camera.projectionMatrixInverse.copy(this.camera.projectionMatrix).invert();
        this.rendered = true;
        this.renderer.resetState();
        this.renderer.render(this.scene, this.camera);
      }
    };
    const before = BPNP.map.registry.beforeIdFor ? BPNP.map.registry.beforeIdFor('structure') : undefined;
    m.addLayer(layer, before && m.getLayer(before) ? before : undefined);
    // เคอร์เซอร์มือเมื่อชี้โครงสร้าง 3D (ยิงรังสีหนึ่งครั้งต่อเฟรม)
    m.on('mousemove', e => {
      if (hoverQueued) return;
      hoverQueued = true;
      requestAnimationFrame(() => {
        hoverQueued = false;
        const hit = !!pick(e.point);
        if (hit && !hovering) { hovering = true; m.getCanvas().style.cursor = 'pointer'; }
        else if (!hit && hovering) { hovering = false; m.getCanvas().style.cursor = ''; }
      });
    });
  }

  // ยกเลเยอร์ 3D ไปบนสุดของ slot 'structure' (ก่อนหมุดของ slot ถัดไป) — เลเยอร์ 2D ที่ถูกสร้างหลังเลเยอร์ 3D จะได้ไม่อยู่เหนือ
  function raise() {
    const m = map(), before = BPNP.map.registry.beforeIdFor ? BPNP.map.registry.beforeIdFor('structure') : undefined;
    if (m.getLayer(LAYER_ID) && before && m.getLayer(before)) m.moveLayer(LAYER_ID, before);
  }

  // จุดบนจอ → โครงสร้างที่ถูกชี้ (ใช้เมทริกซ์ของเฟรมล่าสุด)
  function pick(pt) {
    if (!THREE || !layer || !layer.scene || !layer.rendered || !pt) return null;
    const meshes = [];
    layer.scene.children.forEach(g => { if (g.isGroup) g.children.forEach(mm => meshes.push(mm)); });
    if (!meshes.length) return null;
    const cv = map().getCanvas(), nx = pt.x / cv.clientWidth * 2 - 1, ny = -(pt.y / cv.clientHeight) * 2 + 1, cam = layer.camera;
    const a = new THREE.Vector3(nx, ny, -1).unproject(cam), b = new THREE.Vector3(nx, ny, 1).unproject(cam);
    const rc = new THREE.Raycaster();
    rc.ray.origin.copy(a); rc.ray.direction.copy(b).sub(a).normalize();
    const hit = rc.intersectObjects(meshes, false)[0];
    return hit ? { typeId: hit.object.userData.typeId, key: hit.object.userData.key } : null;
  }

  async function sync(typeId, items) {
    const had = types[typeId] && types[typeId].recs.size > 0;
    if (!items.length && !had) return;                     // ไม่มีอะไรต้องล้าง — ไม่ต้องโหลด Three.js
    await ensureLib();
    ensureLayer();
    const T = types[typeId] || (types[typeId] = { recs: new Map(), seq: 0 });
    const seq = ++T.seq, now = terrainOn(), keep = new Set(items.map(i => i.key));
    let added = false;
    T.recs.forEach((rec, k) => { if (!keep.has(k) || rec.terr !== now) { disposeRec(rec); T.recs.delete(k); } });   // เปิด/ปิดภูมิประเทศ → วางใหม่
    for (const it of items) {
      if (T.recs.has(it.key)) continue;
      const rec = buildRec(typeId, it);
      if (!rec) continue;
      rec.elev = await groundElev(rec);
      if (seq !== T.seq) { rec.group.children.forEach(mm => mm.geometry.dispose()); return; }   // มีคำขอใหม่กว่า — ปล่อยให้รอบนั้นจัดการ
      T.recs.set(it.key, rec);
      layer.scene.add(rec.group);
      placeAll();                                          // วางทันที (กันชิ้นที่ยังไม่ได้วางไปโผล่ที่จุดอ้างอิง)
      added = true;
    }
    if (added) raise();
    placeAll();
    map().triggerRepaint();
  }

  BPNP.layers.structure3dLayer = { sync, pick };
})();
