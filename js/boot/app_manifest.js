/* js/boot/app_manifest.js
 * ─────────────────────────────────────────────────────────────────────────
 * รายการ JS/CSS ที่โหลดหลังล็อกอิน (รันตามลำดับ: APP_SCRIPTS → LAYER_SCRIPTS → APP_MAIN)
 * APP_SCRIPTS ขาดไม่ได้ (โหลดไม่ได้ = เปิดแอปไม่ได้) / LAYER_SCRIPTS ขาดได้
 * ไม่ต้องใส่ ?v=... — loader.js ต่อท้าย APP_VERSION ให้อัตโนมัติ
 *
 * โมดูลเลเยอร์โหลดพร้อมแอป (โค้ดเล็ก) แต่ "ข้อมูล" โหลดเมื่อเปิดเลเยอร์ครั้งแรกเท่านั้น
 * เครื่องมือขนาดใหญ่ในเฟส 5 (js/tools/<เครื่องมือ>/) จะโหลดเมื่อกดปุ่มครั้งแรก
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

  // ── layers (แกน) ──
  'js/layers/layers_config.js',
  'js/layers/layer_utils.js',
  'js/layers/raster_overlays.js',

  // ── ui / tools ──
  'js/ui/layer_panel.js',
  'js/ui/about_popup.js',
  'js/tools/my_location.js',
  'js/tools/click_point.js'
];

// โมดูลชั้นข้อมูล: ถ้าไฟล์ใดโหลดไม่สำเร็จ แอปยังเปิดได้ (ชั้นนั้นแสดง "ไม่พร้อมใช้งาน" + บันทึก App Warning)
BPNP.boot.LAYER_SCRIPTS = [
  'js/layers/video_links.js',
  'js/layers/alignment.js',
  'js/layers/railway.js',
  'js/layers/road.js',
  'js/layers/structure/footing.js',
  'js/ui/bottom_panel.js',
  'js/layers/parcel/parcel.js',
  'js/layers/parcel/parcel_legend.js',
  'js/layers/parcel/parcel_search.js',
  'js/layers/structure/height_signs.js',
  'js/layers/structure/underpass_box.js'
];

// ประกอบแอป — โหลดหลังสุดเสมอ
BPNP.boot.APP_MAIN = 'js/app.js';

BPNP.boot.APP_CSS = [
  'css/base/style.css',
  'css/base/override_ui.css',
  'css/map/maplibre_overrides.css',
  'css/ui/layer_panel.css',
  'css/ui/welcome_popup.css',
  'css/ui/about_popup.css',
  'css/ui/check_update.css',
  'css/tools/my_location.css',
  'css/tools/click_point.css',
  'css/layers/structure_popup.css',
  'css/layers/layers.css',
  'css/layers/legend.css',
  'css/layers/parcel.css',
  'css/layers/structure.css',
  'css/ui/bottom_panel.css'
];
