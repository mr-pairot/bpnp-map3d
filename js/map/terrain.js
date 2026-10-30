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
    if (!m.getSource(SRC_TERRAIN)) m.addSource(SRC_TERRAIN, dem);
    if (!m.getSource(SRC_SHADE)) m.addSource(SRC_SHADE, Object.assign({}, dem));
    if (!m.getLayer(LYR_SHADE)) {
      const before = m.getLayer('slot-raster-overlay') ? 'slot-raster-overlay' : undefined;
      m.addLayer({ id: LYR_SHADE, type: 'hillshade', source: SRC_SHADE, layout: { visibility: 'none' },
        paint: { 'hillshade-exaggeration': 0.35, 'hillshade-shadow-color': '#473B24', 'hillshade-highlight-color': '#FFFFFF' } }, before);
    }
  }

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
    if (!compass || isRealCompassMode) return; 
    const heading = map().getBearing();
    const n = compass.querySelector('.compass-needle');
    if (n) n.style.transform = `rotate(${-heading}deg)`;
    updateCompassDial(heading);
  }

  function updateCompassDial(heading) {
    if (!compass) return;
    const nLetter = compass.querySelector('#compass-n-letter');
    const nDash = compass.querySelector('#compass-n-dash');
    if (!nLetter || !nDash) return;
    
    let h = (heading % 360 + 360) % 360;
    const isNorthUp = h < 2 || h > 358;
    
    nLetter.style.display = isNorthUp ? '' : 'none';
    nDash.style.display = isNorthUp ? 'none' : '';
  }

  // ─── ระบบเข็มทิศจริง (Device Orientation) ───
  let isRealCompassMode = false;
  let lastLongPressTime = 0;     
  let compassActivatedTime = 0;  
  let pressStartTime = 0;
  let orientationRAF = null;
  
  let targetHeading = null;
  let currentHeading = 0;

  function lerpAngle(start, end, factor) {
    const delta = ((((end - start) % 360) + 540) % 360) - 180;
    return start + delta * factor;
  }

  function updateCompassFrame() {
    if (!isRealCompassMode) return;
    
    if (targetHeading !== null) {
      currentHeading = lerpAngle(currentHeading, targetHeading, 0.08);
      
      map().setBearing(currentHeading);
      
      const n = compass.querySelector('.compass-needle');
      if (n) {
        n.style.transform = `rotate(${-currentHeading}deg)`;
      }
      
      updateCompassDial(currentHeading);
    }
    
    orientationRAF = requestAnimationFrame(updateCompassFrame);
  }

  function autoCancelRealCompass(e) {
    if (isRealCompassMode && e && e.originalEvent) {
      if (Date.now() - compassActivatedTime < 1500) return; 
      toggleRealCompass(false);
    }
  }

  function handleOrientation(event) {
    if (!isRealCompassMode || !compass) return;
    
    let heading = null;
    if (event.webkitCompassHeading !== undefined) {
      heading = event.webkitCompassHeading;
    } else if (event.alpha !== null) {
      heading = 360 - event.alpha;
    }
    
    if (heading !== null) {
      targetHeading = heading;
    }
  }

  function toggleRealCompass(enable) {
    const m = map();
    if (enable) {
      if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission()
          .then(permissionState => {
            if (permissionState === 'granted') startSensors();
            else toast('กรุณาอนุญาตสิทธิ์การเข้าถึงเข็มทิศ');
          })
          .catch(console.error);
      } else {
        startSensors();
      }
    } else {
      isRealCompassMode = false;
      window.removeEventListener('deviceorientationabsolute', handleOrientation);
      window.removeEventListener('deviceorientation', handleOrientation);
      if (orientationRAF) cancelAnimationFrame(orientationRAF);
      
      m.off('dragstart', autoCancelRealCompass);
      m.off('rotatestart', autoCancelRealCompass);
      
      const ripple = compass.querySelector('#compass-sensor-ripple');
      if (ripple) ripple.style.display = 'none';

      const n = compass.querySelector('.compass-needle');
      if (n) {
        n.style.transition = 'transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)';
      }
      
      updateNeedle(); 
      toast('ปิดโหมดเข็มทิศจริง');
    }
  }

  function startSensors() {
    if (!window.DeviceOrientationEvent) {
      toast('อุปกรณ์ของคุณไม่รองรับเข็มทิศ');
      return;
    }
    isRealCompassMode = true;
    compassActivatedTime = Date.now();
    
    const m = map();
    m.on('dragstart', autoCancelRealCompass);
    m.on('rotatestart', autoCancelRealCompass);

    currentHeading = m.getBearing();
    targetHeading = currentHeading;

    if ('ondeviceorientationabsolute' in window) {
      window.addEventListener('deviceorientationabsolute', handleOrientation);
    } else {
      window.addEventListener('deviceorientation', handleOrientation);
    }
    
    const ripple = compass.querySelector('#compass-sensor-ripple');
    if (ripple) ripple.style.display = '';

    const n = compass.querySelector('.compass-needle');
    if (n) n.style.transition = 'none';
    
    if (orientationRAF) cancelAnimationFrame(orientationRAF);
    updateCompassFrame(); 
    
    toast('เปิดโหมดเข็มทิศจริง (แผนที่หมุนตามโทรศัพท์)');
  }

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
    if (BPNP.events) BPNP.events.emit('map:3d', on);
    if (!opts.silent) {
      toast(on ? 'มุมมอง 3D' : 'มุมมอง 2D');
      if (BPNP.auth) BPNP.auth.logUserEvent('Map 3D', on ? (opts.gesture ? 'เปิด 3D (ท่าทาง)' : 'เปิด 3D') : 'ปิด 3D');
    }
  }

  function setTerrain(enable) {
    terrainPref = !!enable;
    BPNP.storage.set(KEY_TERRAIN, terrainPref ? '1' : '0');
    applyTerrain();
    if (BPNP.events) BPNP.events.emit('map:terrain', terrainPref);
    toast(terrainPref ? 'ภูมิประเทศ: เปิด' : 'ภูมิประเทศ: ปิด');
    if (BPNP.auth) BPNP.auth.logUserEvent('Map Terrain', terrainPref ? 'เปิด' : 'ปิด');
  }

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
      html: `<svg viewBox="0 0 48 48" width="100%" height="100%" aria-hidden="true" style="overflow: visible;">
        <style>
          @keyframes compassRipple {
            0% { r: 1.5px; opacity: 0.9; stroke-width: 2px; }
            100% { r: 8px; opacity: 0; stroke-width: 0px; }
          }
          @keyframes compassRippleDelay {
            0% { r: 1.5px; opacity: 0; stroke-width: 2px; }
            33% { r: 1.5px; opacity: 0.8; }
            100% { r: 8px; opacity: 0; stroke-width: 0px; }
          }
        </style>
        <defs>
          <linearGradient id="metalGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#ffffff"/>
            <stop offset="25%" stop-color="#94a3b8"/>
            <stop offset="50%" stop-color="#e2e8f0"/>
            <stop offset="75%" stop-color="#64748b"/>
            <stop offset="100%" stop-color="#94a3b8"/>
          </linearGradient>
          <filter id="dropShadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="1" dy="2" stdDeviation="1.5" flood-color="#000000" flood-opacity="0.35"/>
          </filter>
        </defs>
        
        <circle cx="24" cy="24" r="21" fill="none" stroke="url(#metalGrad)" stroke-width="3" filter="url(#dropShadow)"/>
        
        <g fill="#94a3b8">
          <path id="compass-n-letter" d="M 21.5 8 L 21.5 3.5 L 26.5 8 L 26.5 3.5" fill="none" stroke="#ff2a2a" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
          <rect id="compass-n-dash" x="22.5" y="3.5" width="3" height="5" rx="1.5" style="display: none;" />
          <rect x="22.5" y="3.5" width="3" height="5" rx="1.5" transform="rotate(90 24 24)" />
          <rect x="22.5" y="3.5" width="3" height="5" rx="1.5" transform="rotate(180 24 24)" />
          <rect x="22.5" y="3.5" width="3" height="5" rx="1.5" transform="rotate(270 24 24)" />
          <rect x="23" y="4" width="2" height="3" rx="1" transform="rotate(45 24 24)" />
          <rect x="23" y="4" width="2" height="3" rx="1" transform="rotate(135 24 24)" />
          <rect x="23" y="4" width="2" height="3" rx="1" transform="rotate(225 24 24)" />
          <rect x="23" y="4" width="2" height="3" rx="1" transform="rotate(315 24 24)" />
        </g>

        <!-- กลุ่มเข็มทิศ: เข็มแดงจะชี้ขึ้นทิศเหนือเสมอ และมีเอฟเฟกต์กระเพื่อมติดอยู่ที่ปลาย -->
        <g class="compass-needle" style="transform-origin: 24px 24px; transition: transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1);" filter="url(#dropShadow)">
          <!-- เอฟเฟกต์วงกระเพื่อมสีส้มแดง (Ripple) ซ่อนอยู่โดยค่าเริ่มต้น -->
          <g id="compass-sensor-ripple" style="display: none;">
            <circle cx="24" cy="5" r="1.5" fill="none" stroke="#ff5722" style="animation: compassRipple 1.2s infinite ease-out;" />
            <circle cx="24" cy="5" r="1.5" fill="none" stroke="#ff5722" style="animation: compassRippleDelay 1.2s infinite ease-out;" />
            <!-- แกนกลางสว่างจ้า -->
            <circle cx="24" cy="5" r="1.5" fill="#ff5722" filter="drop-shadow(0 0 2px #ff5722)" />
          </g>
          
          <polygon points="24,8 30,24 24,24" fill="#ff2a2a"/>
          <polygon points="24,8 18,24 24,24" fill="#cc0000"/>
          <polygon points="24,40 30,24 24,24" fill="#2962ff"/>
          <polygon points="24,40 18,24 24,24" fill="#0039cb"/>
          <circle cx="24" cy="24" r="2.5" fill="url(#metalGrad)" />
        </g>
      </svg>`,
      style: { 
        bottom: row(2), 
        right: right(0), 
        display: 'none',
        // ปรับขนาดเข็มทิศให้โต 1.2 เท่า ชดเชย margin ขวาเพื่อให้ยังคงดูจัดกึ่งกลาง
        width: 'calc(var(--map-btn-size) * 1.2)',
        height: 'calc(var(--map-btn-size) * 1.2)',
        marginRight: 'calc(var(--map-btn-size) * -0.1)'
      },
      title: 'เข็มทิศ (กดค้างเพื่อใช้เข็มทิศเซ็นเซอร์)',
      onClick: (e) => {
        if (Date.now() - lastLongPressTime < 1500) {
          return;
        }
        
        if (isRealCompassMode) {
          toggleRealCompass(false); 
          const pitch = m.getPitch();
          m.easeTo({ bearing: 0, pitch: pitch < 5 ? cfg().pitch : pitch, duration: 800 });
        } else {
          const pitch = m.getPitch();
          m.easeTo({ bearing: 0, pitch: pitch < 5 ? cfg().pitch : pitch, duration: 600 });
        }
      }
    });

    if (compass) {
      compass.style.userSelect = 'none';
      compass.style.webkitUserSelect = 'none';
      compass.style.webkitTouchCallout = 'none';

      const startPress = (e) => {
        if (e.type === 'mousedown' && pressStartTime > 0) return;
        pressStartTime = Date.now();
      };
      
      const endPress = (e) => {
        if (!pressStartTime) return;
        const duration = Date.now() - pressStartTime;
        pressStartTime = 0; 
        
        if (duration >= 500) {
          lastLongPressTime = Date.now();
          if (e.cancelable) e.preventDefault();
          if (!isRealCompassMode) toggleRealCompass(true);
        }
      };
      
      const cancelPress = () => { pressStartTime = 0; };

      compass.addEventListener('touchstart', startPress, { passive: true });
      compass.addEventListener('touchend', endPress, { passive: false });
      compass.addEventListener('touchcancel', cancelPress, { passive: true });
      compass.addEventListener('mousedown', startPress);
      compass.addEventListener('mouseup', endPress);
      compass.addEventListener('mouseleave', cancelPress);
    }

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
  const tileCache = new Map();
  const ELEV_ZOOM = 14;   
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
