/* js/core/features.js
 * ─────────────────────────────────────────────────────────────────────────
 * สวิตช์ความสามารถตาม role (v3.9.10) — ค่าใน js/config.js → features
 *   true                  = เปิดทุกคน
 *   false                 = ปิดทุกคน
 *   ['editor', ...]       = เปิดเฉพาะผู้ใช้ที่ role อยู่ในรายการ (role จากชีท Users คอลัมน์ "role")
 *
 *   BPNP.features.isOn('structure3d')  → true/false ตาม role ปัจจุบัน
 *   เมื่อ role เปลี่ยน (ล็อกอิน / ตรวจซ้ำเมื่อกลับเข้าแอป) จะส่งเหตุการณ์ 'features:change'
 *
 * ป้าย "Editor Mode": แสดงเมื่อผู้ใช้ role = editor และอยู่ในโหมด 3D (ที่ความสามารถสำหรับ editor ทำงาน)
 *   ผู้ใช้ viewer ไม่เห็นอะไรเพิ่ม
 * หมายเหตุ: เป็นการซ่อนการแสดงผลฝั่งแอป เหมาะกับความสามารถที่ยังทดสอบ ไม่ใช่การป้องกันข้อมูลลับ
 * ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  const role = () => String((window.currentUser && window.currentUser.role) || 'viewer').toLowerCase();

  function isOn(name) {
    const v = BPNP.config.features && BPNP.config.features[name];
    if (v === true) return true;
    if (Array.isArray(v)) return v.map(x => String(x).toLowerCase()).indexOf(role()) !== -1;
    return false;
  }

  // ── ป้าย Editor Mode ──
  let badge = null;
  function updateBadge() {
    const show = role() === 'editor' && !!(BPNP.map && BPNP.map.terrain && BPNP.map.terrain.isOn());
    if (show && !badge) {
      badge = document.createElement('div');
      badge.id = 'editorModeBadge';
      badge.textContent = 'Editor Mode';
      document.body.appendChild(badge);
    }
    if (badge) badge.style.display = show ? '' : 'none';
  }

  let lastRole = window.currentUser ? role() : null;    // โมดูลโหลดหลังล็อกอิน — อ่าน role ปัจจุบันไว้ก่อน
  BPNP.events.on('auth:user', () => {
    const r = role();
    if (lastRole !== null && r !== lastRole) BPNP.events.emit('features:change', r);
    lastRole = r;
    updateBadge();
  });
  BPNP.events.on('map:3d', updateBadge);

  BPNP.features = { isOn, role, updateBadge };
})();
