/* js/map/controls.js
 * ─────────────────────────────────────────────────────────────────────────
 * มาตราส่วน, attribution และปุ่มเต็มจอ (คอมพิวเตอร์ที่ใช้เมาส์ + แท็บเล็ตผ่านเบราว์เซอร์ — ไม่แสดงบนมือถือ/PWA)
 * ใช้ DOM/CSS เดิม: .custom-standalone-scale, .custom-standalone-attr, .standard-map-btn
 * ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  let map, scaleEl, attrEl;

  function updateScale() {
    const y = map.getContainer().clientHeight / 2;
    const maxPx = 100;
    const p1 = map.unproject([0, y]);
    const p2 = map.unproject([maxPx, y]);
    const meters = BPNP.geo.distance(p1, p2);
    if (!isFinite(meters) || meters <= 0) return;
    const pow10 = Math.pow(10, (Math.floor(meters) + '').length - 1);
    let d = Math.round(meters / pow10);
    d = d >= 10 ? 10 : d >= 5 ? 5 : d >= 2 ? 2 : 1;
    const round = pow10 * d;
    scaleEl.style.width = Math.round((round / meters) * maxPx) + 'px';
    scaleEl.textContent = round >= 1000 ? (round / 1000) + ' กม.' : round + ' ม.';
  }

  let attrTimer;
  function updateAttribution() {
    clearTimeout(attrTimer);
    attrTimer = setTimeout(() => {
      const set = new Set();
      const base = BPNP.map.basemaps.attribution;
      if (base) set.add(base);
      BPNP.map.registry.attributions().forEach(a => set.add(a));
      attrEl.innerHTML = Array.from(set).join(' | ');
      attrEl.style.display = set.size ? 'block' : 'none';
    }, 100);
  }

  function isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
           (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));
  }

  // แอปติดตั้ง (PWA) — ไม่นับ display-mode: fullscreen เพราะ Chrome ตอบ true ทุกครั้งที่หน้าเว็บอยู่ในโหมดเต็มจอ (F11/requestFullscreen)
  function isStandalonePwa() {
    return ['standalone', 'minimal-ui', 'window-controls-overlay'].some(m => window.matchMedia(`(display-mode: ${m})`).matches) ||
           navigator.standalone === true;
  }

  // ── เต็มจอ (v3.10.08) ──
  // API มาตรฐาน หรือแบบ webkit (iPadOS ก่อน 16.4)
  const FS = {
    supported: () => !!(document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen),
    active: () => !!(document.fullscreenElement || document.webkitFullscreenElement),
    enter: () => {
      const el = document.documentElement;
      const r = el.requestFullscreen ? el.requestFullscreen() : el.webkitRequestFullscreen();
      if (r && r.catch) r.catch(err => console.warn(err.message));
    },
    exit: () => {
      const r = document.exitFullscreen ? document.exitFullscreen() : (document.webkitExitFullscreen && document.webkitExitFullscreen());
      if (r && r.catch) r.catch(() => {});
    }
  };

  // แท็บเล็ต (Android / iPad) — ใช้ได้แม้เปิด "เว็บไซต์เดสก์ท็อป" ซึ่ง UA เป็นแบบคอมพิวเตอร์ (iPad แจ้งเป็น Mac)
  //   จอสัมผัส (หลายจุด หรือมีตัวชี้แบบนิ้ว) + ขนาดหน้าจอด้านสั้น ≥ 600 px (ค่าจากหน้าจอจริง ใช้แยกจากมือถือ)
  function isTablet() {
    const touch = navigator.maxTouchPoints > 1 || window.matchMedia('(any-pointer: coarse)').matches;
    return touch && Math.min(screen.width, screen.height) >= 600;
  }

  // แสดงปุ่มเต็มจอ: คอมพิวเตอร์ที่ใช้เมาส์ + แท็บเล็ตที่เปิดผ่านเบราว์เซอร์ · ไม่แสดงบนมือถือ และแอปที่ติดตั้ง (PWA)
  function canShowFullscreenBtn() {
    if (!FS.supported()) return false;                  // iPhone: Safari ไม่รองรับเต็มจอของหน้าเว็บ
    if (isStandalonePwa()) return false;                // แอปที่ติดตั้งเต็มจออยู่แล้ว
    if (isTablet()) return true;
    if (isMobile() || (navigator.userAgentData && navigator.userAgentData.mobile)) return false;
    return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  }

  function initFullscreenButton() {
    if (!canShowFullscreenBtn()) return;
    document.body.classList.add('has-fullscreen-btn');   // legend มุมขวาบนเลื่อนลงใต้ปุ่ม
    const btn = BPNP.ui.createStandardButton({
      id: 'fullscreenBtn',
      imageSrc: 'assets/ui/fullscreen-enter.svg',
      style: { top: 'var(--safe-top)', right: 'var(--safe-right)' },
      title: 'แสดงเต็มหน้าจอ (Full Screen)',
      onClick: () => { if (!FS.active()) FS.enter(); else FS.exit(); }
    });
    const sync = () => {
      const on = FS.active();
      btn.title = on ? 'ออกจากการแสดงเต็มหน้าจอ' : 'แสดงเต็มหน้าจอ (Full Screen)';
      btn.style.backgroundImage = `url('assets/ui/${on ? 'fullscreen-exit' : 'fullscreen-enter'}.svg')`;
    };
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('webkitfullscreenchange', sync);
  }

  function init(mapInstance) {
    map = mapInstance;
    scaleEl = document.createElement('div');
    scaleEl.className = 'custom-standalone-scale';
    document.body.appendChild(scaleEl);

    attrEl = document.createElement('div');
    attrEl.className = 'custom-standalone-attr';
    document.body.appendChild(attrEl);

    map.on('move', updateScale);
    map.on('resize', updateScale);
    BPNP.events.on('basemap:change', updateAttribution);
    BPNP.events.on('layers:change', updateAttribution);
    updateScale();
    updateAttribution();

    BPNP.ui.registerButton(initFullscreenButton);
  }

  BPNP.map.controls = { init, updateScale, updateAttribution, isMobile };
})();
