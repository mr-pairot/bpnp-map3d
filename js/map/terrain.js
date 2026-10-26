/* js/map/terrain.js
 * ─────────────────────────────────────────────────────────────────────────
 * เฟส 3D-A: มุมมอง 3D (เอียง/หมุน) + ภูมิประเทศ + เข็มทิศ   (ปรับตามที่ยืนยันใน v3.8.02)
 *
 *   ท่าทางหมุน/เอียงเปิดตลอด: สองนิ้วหมุน · สองนิ้วลากขึ้นลง (เอียง) · Ctrl+ลาก · คลิกขวาลาก
 *     → ขณะอยู่ 2D ถ้าผู้ใช้เริ่มหมุนหรือเอียงเอง เข้าโหมด 3D ทันทีที่มุมนั้น (ไม่กระโดดไป 60°)
 *     (คลิกขวาเฉย ๆ ไม่ลาก ยังเปิดดูพิกัดได้ตามเดิม)
 *   ปุ่ม 3D (เหนือปุ่มตำแหน่งฉัน): 2D → 3D + เอียง 60° · 3D → 2D (ทิศเหนือขึ้น มองตรง ปิดภูมิประเทศ)
 *   ปุ่ม ⛰ ภูมิประเทศ (กลม ซ้ายปุ่ม 3D · เฉพาะโหมด 3D): เปิด/ปิดความสูง + เงาเนินเขา
 *     ค่าเริ่มต้นปิด (พื้นเทา ไอคอนเทาเข้ม) · เปิด = พื้นน้ำเงินเข้ม ไอคอนขาว · จำค่าที่เลือกล่าสุด
 *   ปุ่มเข็มทิศ (กลม เหนือปุ่ม 3D · เฉพาะโหมด 3D): เข็มหมุนตามทิศเท่านั้น · กด = ทิศเหนือขึ้น คงมุมเอียง
 *   จำโหมด 3D และภูมิประเทศแยกกัน · ข้อมูลความสูง: config.map.terrain (AWS Terrain Tiles)
 *   elevationAt(lng, lat): ความสูงโดยประมาณ (ม.) — popup ดูพิกัดแสดงเฉพาะเมื่อโหมด 3D + เปิดภูมิประเทศ (v3.8.04)
 * ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  const KEY_3D = 'map_3d', KEY_TERRAIN = 'map_terrain';
  const SRC_TERRAIN = 'src-dem', SRC_SHADE = 'src-dem-shade', LYR_SHADE = 'dem-hillshade';
  let on = false, terrainPref = false;
  let btn3d = null, btnTerrain = null, compass = null;

  const map = () => BPNP.map.instance;
  const cfg = () => Object.assign({ tiles: '', encoding: 'terrarium', maxzoom: 15, exaggeration: 1.5, pitch: 60 },
                                   (BPNP.config.map && BPNP.config.map.terrain) || {});
  const toast = msg => { if (BPNP.core.toast) BPNP.core.toast.show(msg, false, 1500); };

  function ensureSources() {
    const m = map(), c = cfg();
    const dem = { type: 'raster-dem', tiles: [c.tiles], tileSize: 256, maxzoom: c.maxzoom, encoding: c.encoding, attribution: c.attribution };
    // ภูมิประเทศกับเงาเนินเขาใช้ source แยกกัน (MapLibre แนะนำ — คุณภาพดีกว่าใช้ร่วม)
    if (!m.getSource(SRC_TERRAIN)) m.addSource(SRC_TERRAIN, dem);
    if (!m.getSource(SRC_SHADE)) m.addSource(SRC_SHADE, Object.assign({}, dem));
    if (!m.getLayer(LYR_SHADE)) {
      const before = m.getLayer('slot-raster-overlay') ? 'slot-raster-overlay' : undefined;
      m.addLayer({ id: LYR_SHADE, type: 'hillshade', source: SRC_SHADE, layout: { visibility: 'none' },
        paint: { 'hillshade-exaggeration': 0.35, 'hillshade-shadow-color': '#473B24', 'hillshade-highlight-color': '#FFFFFF' } }, before);
    }
  }

  // ภูมิประเทศทำงานจริงเมื่ออยู่ 3D และผู้ใช้เลือกเปิด
  function applyTerrain() {
    const m = map(), c = cfg(), active = on && terrainPref;
    if (active) {
      ensureSources();
      m.setTerrain({ source: SRC_TERRAIN, exaggeration: c.exaggeration });
      m.setLayoutProperty(LYR_SHADE, 'visibility', 'visible');
      if (typeof m.setSky === 'function') {
        try { m.setSky({ 'sky-color': '#7ec8ff', 'horizon-color': '#dff1ff', 'fog-color': '#ffffff', 'sky-horizon-blend': 0.5, 'horizon-fog-blend': 0.6, 'fog-ground-blend': 0.85 }); } catch (e) { /* รุ่นที่ไม่รองรับ */ }
      }
    } else {
      if (m.getTerrain && m.getTerrain()) m.setTerrain(null);
      if (m.getLayer(LYR_SHADE)) m.setLayoutProperty(LYR_SHADE, 'visibility', 'none');
    }
    if (btnTerrain) {
      btnTerrain.classList.toggle('active', terrainPref);
      btnTerrain.title = terrainPref ? 'ภูมิประเทศ: เปิด (กดเพื่อปิด)' : 'ภูมิประเทศ: ปิด (กดเพื่อแสดงความสูงพื้นที่)';
    }
  }

  function enableGestures() {
    const m = map();
    m.dragRotate.enable(); m.touchPitch.enable();
    m.touchZoomRotate.enableRotation(); m.keyboard.enableRotation();
  }

  function updateButtons() {
    if (btn3d) {
      btn3d.classList.toggle('active', on);
      btn3d.title = on ? 'มุมมอง 3D (กดเพื่อกลับเป็น 2D)' : 'มุมมอง 2D (กดเพื่อเปิด 3D · หรือหมุน/เอียงแผนที่ด้วยสองนิ้ว / Ctrl+ลาก)';
    }
    if (compass) compass.style.display = on ? '' : 'none';
    if (btnTerrain) btnTerrain.style.display = on ? '' : 'none';
    updateNeedle();
  }

  function updateNeedle() {
    if (!compass) return;
    const n = compass.querySelector('.compass-needle');
    if (n) n.style.transform = `rotate(${-map().getBearing()}deg)`;   // หมุนตามทิศเท่านั้น ไม่เอียงตามแผนที่
  }

  // enable: เข้า/ออก 3D · opts.tilt: เอียงไปมุม 3D (ปุ่ม/โหลดหน้า) — เข้าด้วยท่าทางไม่ต้องเอียงเพิ่ม
  function setMode(enable, opts = {}) {
    const m = map();
    on = !!enable;
    applyTerrain();
    if (on) {
      if (opts.tilt) m.easeTo({ pitch: cfg().pitch, duration: opts.animate === false ? 0 : 900 });
    } else {
      m.easeTo({ pitch: 0, bearing: 0, duration: opts.animate === false ? 0 : 700 });
    }
    updateButtons();
    BPNP.storage.set(KEY_3D, on ? '1' : '0');
    if (!opts.silent) {
      toast(on ? 'มุมมอง 3D' : 'มุมมอง 2D');
      if (BPNP.auth) BPNP.auth.logUserEvent('Map 3D', on ? (opts.gesture ? 'เปิด 3D (ท่าทาง)' : 'เปิด 3D') : 'ปิด 3D');
    }
  }

  function setTerrain(enable) {
    terrainPref = !!enable;
    BPNP.storage.set(KEY_TERRAIN, terrainPref ? '1' : '0');
    applyTerrain();
    toast(terrainPref ? 'ภูมิประเทศ: เปิด' : 'ภูมิประเทศ: ปิด');
    if (BPNP.auth) BPNP.auth.logUserEvent('Map Terrain', terrainPref ? 'เปิด' : 'ปิด');
  }

  // ผู้ใช้เริ่มหมุน/เอียงเอง (มี originalEvent) ขณะอยู่ 2D → เข้า 3D ที่มุมนั้น
  function onUserTiltOrRotate(e) {
    if (on || !e || !e.originalEvent) return;
    setMode(true, { gesture: true });
  }

  BPNP.ui.registerButton(() => {
    const m = map();
    const right = n => (n ? `calc(var(--safe-right) + (var(--map-btn-size) + var(--map-gap)) * ${n})` : 'var(--safe-right)');
    const row = n => `calc(var(--safe-bottom) + 65px + (var(--map-btn-size) + var(--map-gap)) * ${n})`;

    btn3d = BPNP.ui.createStandardButton({
      id: 'map3dBtn',
      html: '<span class="map3d-label">3D</span>',
      style: { bottom: row(1), right: right(0) },
      title: '',
      onClick: () => setMode(!on, { tilt: true })
    });
    btnTerrain = BPNP.ui.createStandardButton({
      id: 'terrainBtn',
      html: `<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
               <polygon points="9,4 18,19 0,19" fill="currentColor" opacity="0.85"/>
               <polygon points="16,9 24,19 8,19" fill="currentColor"/>
             </svg>`,
      style: { bottom: row(1), right: right(1), display: 'none' },
      title: '',
      onClick: () => setTerrain(!terrainPref)
    });
    compass = BPNP.ui.createStandardButton({
      id: 'compassBtn',
      html: `<svg class="compass-needle" viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
               <polygon points="12,2 16,12 12,10.5 8,12" fill="#e53935"/>
               <polygon points="12,22 16,12 12,13.5 8,12" fill="#90a4ae"/>
             </svg>`,
      style: { bottom: row(2), right: right(0), display: 'none' },
      title: 'หันทิศเหนือขึ้น (คงมุมมอง 3D)',
      onClick: () => {
        const pitch = m.getPitch();
        m.easeTo({ bearing: 0, pitch: pitch < 5 ? cfg().pitch : pitch, duration: 600 });
      }
    });

    enableGestures();
    m.on('rotatestart', onUserTiltOrRotate);
    m.on('pitchstart', onUserTiltOrRotate);
    m.on('rotate', updateNeedle);

    terrainPref = BPNP.storage.get(KEY_TERRAIN) === '1';
    if (BPNP.storage.get(KEY_3D) === '1') setMode(true, { tilt: true, silent: true });
    else updateButtons();
    applyTerrain();
  });

  // ── ความสูงที่จุด (ม. เหนือระดับทะเลปานกลาง โดยประมาณ) ──
  // อ่านค่าจากภาพความสูงแบบ Terrarium โดยตรง (ไม่ใช่ queryTerrainElevation ซึ่งรวมการขยายความสูง 1.5 เท่า)
  // height = R·256 + G + B/256 − 32768 · ประมาณค่าแบบ bilinear 4 พิกเซล · เก็บภาพไว้ 24 แผ่นล่าสุด
  const tileCache = new Map();
  const ELEV_ZOOM = 14;   // ~9.5 ม./พิกเซล ที่ละติจูดไทย ละเอียดกว่าข้อมูลต้นทาง (~30 ม.)
  function loadTile(z, x, y) {
    const key = `${z}/${x}/${y}`;
    if (tileCache.has(key)) return tileCache.get(key);
    const url = cfg().tiles.replace('{z}', z).replace('{x}', x).replace('{y}', y);
    const p = fetch(url, { mode: 'cors' })
      .then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.blob(); })
      .then(b => createImageBitmap(b))
      .then(bmp => {
        const c = document.createElement('canvas'); c.width = bmp.width; c.height = bmp.height;
        const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(bmp, 0, 0);
        return g.getImageData(0, 0, bmp.width, bmp.height);
      })
      .catch(err => { tileCache.delete(key); throw err; });
    tileCache.set(key, p);
    if (tileCache.size > 24) tileCache.delete(tileCache.keys().next().value);
    return p;
  }
  async function elevationAt(lng, lat) {
    const z = Math.min(ELEV_ZOOM, cfg().maxzoom || ELEV_ZOOM), n = Math.pow(2, z);
    const xf = (lng + 180) / 360 * n;
    const s = Math.sin(lat * Math.PI / 180);
    const yf = (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n;
    const tx = Math.floor(xf), ty = Math.floor(yf);
    const img = await loadTile(z, tx, ty);
    const W = img.width, H = img.height;
    const px = (xf - tx) * W - 0.5, py = (yf - ty) * H - 0.5;
    const x0 = Math.max(0, Math.min(W - 1, Math.floor(px))), y0 = Math.max(0, Math.min(H - 1, Math.floor(py)));
    const x1 = Math.min(W - 1, x0 + 1), y1 = Math.min(H - 1, y0 + 1);
    const fx = Math.max(0, Math.min(1, px - x0)), fy = Math.max(0, Math.min(1, py - y0));
    const h = (x, y) => { const i = (y * W + x) * 4, d = img.data; return d[i] * 256 + d[i + 1] + d[i + 2] / 256 - 32768; };
    const v = h(x0, y0) * (1 - fx) * (1 - fy) + h(x1, y0) * fx * (1 - fy) + h(x0, y1) * (1 - fx) * fy + h(x1, y1) * fx * fy;
    return isFinite(v) && v > -500 ? v : null;
  }

  BPNP.map.terrain = { setMode, setTerrain, elevationAt, isOn: () => on, isTerrainOn: () => on && terrainPref };
})();
