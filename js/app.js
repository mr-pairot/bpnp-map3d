/* js/app.js
 * ─────────────────────────────────────────────────────────────────────────
 * ประกอบแอป (แทน main.js เดิม) — auth.js เรียก BPNP.app.start() หลังโหลดสคริปต์ครบ
 *
 * เฟสถัดไปเพิ่มโมดูลโดย:
 *   1) เพิ่มไฟล์ใน app_manifest.js (หรือโหลดเมื่อใช้งาน)
 *   2) เลเยอร์: ในไฟล์เรียก BPNP.layers.utils.register({ register(map) { ... } })
 *      → app.js เรียกให้อัตโนมัติ ไม่ต้องแก้ไฟล์นี้
 *   3) เครื่องมือ/ส่วนอื่น: เพิ่มบรรทัดเรียก init ในฟังก์ชัน start() ด้านล่าง
 * ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  let started = null;

  async function start() {
    if (started) return started;
    started = (async () => {
      const map = await BPNP.map.create();

      BPNP.map.controls.init(map);
      BPNP.layers.rasterOverlays.register();
      BPNP.layers.utils.registerAll(map);      // เลเยอร์ข้อมูลทุกโมดูล (เฟส 2+)
      BPNP.ui.layerPanel.init();
      BPNP.tools.myLocation.init(map);
      BPNP.tools.clickPoint.init(map);

      BPNP.events.emit('app:ready', map);
      checkDeployData();
      return map;
    })();
    return started;
  }

  // ตรวจว่า deploy นี้สร้าง data/geojson/ แล้ว (tools/build.js ใส่รายชื่อไฟล์ไว้ใน version.json → dataVersions)
  // ถ้าไม่มี = Netlify ไม่ได้รัน npm install / build → ชั้นข้อมูลเฟส 2+ จะโหลดไม่ได้
  async function checkDeployData() {
    if (window.currentUser && window.currentUser.isDev) return;   // บนเครื่องตัวเองไม่ต้องเตือน
    try {
      if (BPNP.core.dataCache && BPNP.core.dataCache.versionInfo) await BPNP.core.dataCache.versionInfo;
      const keys = Object.keys((BPNP.core.dataCache && BPNP.core.dataCache.versions) || {});
      if (!keys.length) return;                                   // ยังไม่รู้ (ออฟไลน์) → ไม่สรุป
      if (!keys.some(k => k.indexOf('geojson/') === 0)) {
        console.error('[App] version.json ไม่มีไฟล์ geojson/ — Netlify ไม่ได้แปลง KML → GeoJSON (ตรวจ Deploy log)');
        if (BPNP.auth) BPNP.auth.logUserEvent('App Warning', `deploy ไม่มี data/geojson (ตรวจ Netlify build) | v${window.APP_VERSION}`);
      }
    } catch (e) { /* ไม่บล็อกการใช้งาน */ }
  }

  BPNP.app = { start };
})();
