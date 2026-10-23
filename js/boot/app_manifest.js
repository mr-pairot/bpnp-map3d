/* js/boot/app_manifest.js
 * ─────────────────────────────────────────────────────────────────────────
 * รายการ JS/CSS ที่โหลดหลังล็อกอิน (รันตามลำดับในรายการ)
 * ไม่ต้องใส่ ?v=... — loader.js ต่อท้าย APP_VERSION ให้อัตโนมัติ
 *
 * โมดูลของเฟสถัดไปที่โหลดเมื่อใช้งาน (ไม่อยู่ในรายการนี้):
 *   js/layers/<กลุ่ม>/*.js   → โหลดเมื่อเปิดเลเยอร์ครั้งแรก (ระบุใน layers_config.js → module)
 *   js/tools/<เครื่องมือ>/*.js → โหลดเมื่อกดปุ่มเครื่องมือ
 * ───────────────────────────────────────────────────────────────────────── */
BPNP.boot.APP_SCRIPTS = [
  // ── core ──
  'js/core/toast.js',
  'js/core/geo_utils.js',
  'js/core/alignment.js',

  // ── map ──
  'js/map/basemaps.js',
  'js/map/layer_registry.js',
  'js/map/popup.js',
  'js/map/map_core.js',
  'js/map/controls.js',

  // ── layers ──
  'js/layers/layers_config.js',
  'js/layers/raster_overlays.js',

  // ── ui / tools ──
  'js/ui/layer_panel.js',
  'js/ui/about_popup.js',
  'js/tools/my_location.js',
  'js/tools/click_point.js',

  // ── ประกอบแอป (ต้องอยู่ท้ายสุด) ──
  'js/app.js'
];

BPNP.boot.APP_CSS = [
  'css/base/style.css',
  'css/base/override_ui.css',
  'css/map/maplibre_overrides.css',
  'css/ui/layer_panel.css',
  'css/ui/welcome_popup.css',
  'css/ui/about_popup.css',
  'css/ui/check_update.css',
  'css/tools/my_location.css',
  'css/tools/click_point.css'
];
