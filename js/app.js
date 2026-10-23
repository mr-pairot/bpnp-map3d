/* js/app.js
 * ─────────────────────────────────────────────────────────────────────────
 * ประกอบแอป (แทน main.js เดิม) — auth.js เรียก BPNP.app.start() หลังโหลดสคริปต์ครบ
 *
 * เฟสถัดไปเพิ่มโมดูลโดย:
 *   1) เพิ่มไฟล์ใน app_manifest.js (หรือโหลดเมื่อใช้งาน)
 *   2) ลงทะเบียนเลเยอร์ผ่าน BPNP.map.registry.register()
 *   3) เพิ่มบรรทัดเรียก init ในฟังก์ชัน start() ด้านล่าง
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
      BPNP.ui.layerPanel.init();
      BPNP.tools.myLocation.init(map);
      BPNP.tools.clickPoint.init(map);

      BPNP.events.emit('app:ready', map);
      return map;
    })();
    return started;
  }

  BPNP.app = { start };
})();
