/* js/tools/measure/index.js
 * ─────────────────────────────────────────────────────────────────────────
 * เฟส 5C: เริ่มเครื่องมือวัด (เดิม main.js → map.measurePlus = new MeasurePlus(map, {}))
 *   - ปุ่ม assets/ui/pencil.png แถวบน ช่องที่ 3 (สร้างโดย measure_plus.js → window.initMeasureUIBtn)
 *   - ขณะวาด/ลบ/ปรับพื้นที่: ชั้นข้อมูลและเครื่องมือดูพิกัดไม่เปิด popup (BPNP.tools.isBusy)
 * ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  let mp = null;
  BPNP.ui.registerButton(() => {
    if (typeof window.MeasurePlus !== 'function') return;
    mp = new window.MeasurePlus(BPNP.tools.lcompat.map(), {});
    BPNP.tools.measure = mp;
    if (typeof window.initMeasureUIBtn === 'function') window.initMeasureUIBtn();
  });
  BPNP.tools.registerBusy(() => !!mp && (mp._isDrawing || mp.getMode() === 'deleteOBJ' || mp._isAdjustingArea));
})();
