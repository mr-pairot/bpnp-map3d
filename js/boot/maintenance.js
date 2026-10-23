/* js/boot/maintenance.js
 * ─────────────────────────────────────────────────────────────────────────
 * โหมดปิดปรับปรุงระบบ: เปิด/ปิดที่ BPNP_CONFIG.maintenance (js/config.js)
 * เมื่อเปิด: ซ่อน splash, แสดงหน้าแจ้งปรับปรุง + ลูกโลก 3 มิติ และไม่เริ่มขั้นตอนล็อกอิน
 * ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  BPNP.boot.isMaintenance = !!BPNP.config.maintenance;
  if (!BPNP.boot.isMaintenance) return;

  document.documentElement.classList.add('is-maintenance-mode');

  // globe.gl (~1 MB) โหลดเฉพาะตอนปิดปรับปรุงเท่านั้น
  const s = document.createElement('script');
  s.src = 'https://cdn.jsdelivr.net/npm/globe.gl@2.46.2/dist/globe.gl.min.js';
  s.onload = () => {
    if (typeof Globe === 'undefined') return;
    const world = new Globe(document.getElementById('globeViz'), { animateIn: false })
      .globeImageUrl('https://cdn.jsdelivr.net/npm/three-globe@2.45.2/example/img/earth-blue-marble.jpg')
      .bumpImageUrl('https://cdn.jsdelivr.net/npm/three-globe@2.45.2/example/img/earth-topology.png');
    world.controls().autoRotate = true;
    world.controls().autoRotateSpeed = 0.45;
    world.controls().enableZoom = false;
    window.addEventListener('resize', () => { world.width(window.innerWidth); world.height(window.innerHeight); });
  };
  document.head.appendChild(s);

  // เปิดหน้าค้างไว้ → ตรวจทุก 60 วินาที เมื่อปิดโหมดปรับปรุงแล้วจะโหลดใหม่เอง
  setInterval(async () => {
    try {
      const res = await fetch('js/config.js?t=' + Date.now(), { cache: 'no-store' });
      const txt = await res.text();
      if (/maintenance:\s*false/.test(txt)) location.reload();
    } catch (e) { /* ออฟไลน์ */ }
  }, 60000);
})();
