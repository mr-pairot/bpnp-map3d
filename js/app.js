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
      return map;
    })();
    return started;
  }

  BPNP.app = { start };
})();
