/* js/map/terrain.js
 * ─────────────────────────────────────────────────────────────────────────
 * เฟส 3D-A: ภูมิประเทศ + เอียง/หมุนแผนที่ + เข็มทิศ
 *   - ปุ่ม "3D" (มุมขวาล่าง เหนือปุ่มตำแหน่งฉัน): เปิด = ภูมิประเทศ + เงาเนินเขา + เอียง 60° + ท่าทางเอียง/หมุน
 *                                               ปิด = กลับเป็นมุมมองตรง ทิศเหนือขึ้น และปิดท่าทางเอียง/หมุน (เหมือนเดิม)
 *   - ท่าทาง: เดสก์ท็อป คลิกขวาลาก / Ctrl+ลาก · จอสัมผัส สองนิ้วหมุน / สองนิ้วลากขึ้นลงเพื่อเอียง
 *   - ปุ่มเข็มทิศ (เหนือปุ่ม 3D): แสดงตลอดในโหมด 3D หัวลูกศรชี้ทิศเหนือ · กด = ทิศเหนือขึ้น (คงมุมเอียง 3D)
 *   - จำโหมด 3D ไว้ในเครื่อง · ข้อมูลความสูง: AWS Terrain Tiles (config.map.terrain)
 *   - เงาเนินเขาอยู่เหนือแผนที่พื้นหลัง ใต้ชั้นข้อมูลทั้งหมด
 * ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  const STORE_KEY = 'map_3d';
  const SRC_TERRAIN = 'src-dem', SRC_SHADE = 'src-dem-shade', LYR_SHADE = 'dem-hillshade';
  let on = false, btn3d = null, compass = null;

  const map = () => BPNP.map.instance;
  const cfg = () => Object.assign({ tiles: '', encoding: 'terrarium', maxzoom: 15, exaggeration: 1.5, pitch: 60 },
                                   (BPNP.config.map && BPNP.config.map.terrain) || {});

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

  function setGestures(enabled) {
    const m = map();
    if (enabled) {
      m.dragRotate.enable(); m.touchPitch.enable();
      m.touchZoomRotate.enableRotation(); m.keyboard.enableRotation();
    } else {
      m.dragRotate.disable(); m.touchPitch.disable();
      m.touchZoomRotate.disableRotation(); m.keyboard.disableRotation();
    }
  }

  function setMode(enable, opts = {}) {
    const m = map(), c = cfg();
    on = !!enable;
    if (on) {
      ensureSources();
      m.setTerrain({ source: SRC_TERRAIN, exaggeration: c.exaggeration });
      m.setLayoutProperty(LYR_SHADE, 'visibility', 'visible');
      if (typeof m.setSky === 'function') {
        try { m.setSky({ 'sky-color': '#7ec8ff', 'horizon-color': '#dff1ff', 'fog-color': '#ffffff', 'sky-horizon-blend': 0.5, 'horizon-fog-blend': 0.6, 'fog-ground-blend': 0.85 }); } catch (e) { /* รุ่นที่ไม่รองรับ */ }
      }
      setGestures(true);
      if (opts.animate !== false) m.easeTo({ pitch: c.pitch, duration: 900 });
    } else {
      if (m.getTerrain && m.getTerrain()) m.setTerrain(null);
      if (m.getLayer(LYR_SHADE)) m.setLayoutProperty(LYR_SHADE, 'visibility', 'none');
      setGestures(false);
      m.easeTo({ pitch: 0, bearing: 0, duration: opts.animate === false ? 0 : 700 });
    }
    if (btn3d) {
      btn3d.classList.toggle('active', on);
      btn3d.title = on ? 'มุมมอง 3D (กดเพื่อกลับเป็น 2D)' : 'มุมมอง 2D (กดเพื่อเปิด 3D: ภูมิประเทศ + เอียง/หมุนแผนที่)';
    }
    if (!opts.silent && BPNP.core.toast) BPNP.core.toast.show(on ? 'มุมมอง 3D' : 'มุมมอง 2D', false, 1500);
    BPNP.storage.set(STORE_KEY, on ? '1' : '0');
    updateCompass();
    if (!opts.silent && BPNP.auth) BPNP.auth.logUserEvent('Map 3D', on ? 'เปิด 3D' : 'ปิด 3D');
  }

  // เข็มทิศแสดงตลอดที่อยู่ในโหมด 3D (ซ่อนเฉพาะโหมด 2D) — เดิมแสดงเฉพาะตอนหมุน/เอียง
  // ทำให้กดเข็มทิศแล้วเข็มทิศหาย ทั้งที่ยังอยู่ในโหมด 3D (ปุ่ม 3D ยังเป็นสีน้ำเงินเข้ม)
  function updateCompass() {
    if (!compass) return;
    const m = map(), bearing = m.getBearing(), pitch = m.getPitch();
    compass.style.display = on ? '' : 'none';
    const arrow = compass.querySelector('.compass-needle');
    if (arrow) arrow.style.transform = `rotateX(${Math.min(pitch, 60)}deg) rotate(${-bearing}deg)`;
  }

  BPNP.ui.registerButton(() => {
    const right = 'var(--safe-right)';
    const row = n => `calc(var(--safe-bottom) + 65px + (var(--map-btn-size) + var(--map-gap)) * ${n})`;
    btn3d = BPNP.ui.createStandardButton({
      id: 'map3dBtn',
      html: '<span class="map3d-label">3D</span>',
      style: { bottom: row(1), right },
      title: 'มุมมอง 3 มิติ (ภูมิประเทศ + เอียง/หมุนแผนที่)',
      onClick: () => setMode(!on)
    });
    compass = BPNP.ui.createStandardButton({
      id: 'compassBtn',
      html: `<svg class="compass-needle" viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
               <polygon points="12,2 16,12 12,10.5 8,12" fill="#e53935"/>
               <polygon points="12,22 16,12 12,13.5 8,12" fill="#90a4ae"/>
             </svg>`,
      style: { bottom: row(2), right, display: 'none' },
      title: 'หันทิศเหนือขึ้น (คงมุมมอง 3D)',
      // หันทิศเหนือขึ้นโดยคงมุมเอียงไว้ (ถ้ามองตรงอยู่ จะกลับไปเอียงมุม 3D) — ยังอยู่ในโหมด 3D ชัดเจน
      onClick: () => {
        const m = map(), pitch = m.getPitch();
        m.easeTo({ bearing: 0, pitch: pitch < 5 ? cfg().pitch : pitch, duration: 600 });
      }
    });
    map().on('rotate', updateCompass);
    map().on('pitch', updateCompass);
    if (BPNP.storage.get(STORE_KEY) === '1') setMode(true, { silent: true });
  });

  BPNP.map.terrain = { setMode, isOn: () => on };
})();
