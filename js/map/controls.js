/* js/map/controls.js
 * ─────────────────────────────────────────────────────────────────────────
 * มาตราส่วน, attribution และปุ่มเต็มจอ (เฉพาะเดสก์ท็อป)
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

  function initFullscreenButton() {
    if (isMobile() || !document.documentElement.requestFullscreen) return;
    document.body.classList.add('has-fullscreen-btn');   // legend มุมขวาบนเลื่อนลงใต้ปุ่ม
    const btn = BPNP.ui.createStandardButton({
      id: 'fullscreenBtn',
      imageSrc: 'assets/ui/fullscreen-enter.svg',
      style: { top: 'var(--safe-top)', right: 'var(--safe-right)' },
      title: 'แสดงเต็มหน้าจอ (Full Screen)',
      onClick: () => {
        if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(err => console.warn(err.message));
        else if (document.exitFullscreen) document.exitFullscreen();
      }
    });
    document.addEventListener('fullscreenchange', () => {
      const on = !!document.fullscreenElement;
      btn.title = on ? 'ออกจากการแสดงเต็มหน้าจอ' : 'แสดงเต็มหน้าจอ (Full Screen)';
      btn.style.backgroundImage = `url('assets/ui/${on ? 'fullscreen-exit' : 'fullscreen-enter'}.svg')`;
    });
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
