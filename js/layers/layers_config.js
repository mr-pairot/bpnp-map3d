/* js/layers/layers_config.js
 * ─────────────────────────────────────────────────────────────────────────
 * รายการชั้นข้อมูลทั้งหมด (แทน LAYERS_CONFIG ใน main.js เดิม)
 *
 *   id / name / nameLoaded / isDefault / hasOpacityControl / isControlVisible
 *     → ความหมายเดิมทุกประการ
 *   category  general | structure | progress   (เดิม sw_tw → progress)
 *   kind      raster (tile/WMS) | vector (GeoJSON จาก data/)
 *   slot      ลำดับซ้อนใน layer_registry (ค่าเริ่มต้นตาม category)
 *   source    ไฟล์ข้อมูล (path ใหม่) — เฟส 2 จะอ่านจาก data/geojson/ ที่ build สร้างให้
 *   module    สคริปต์ที่โหลดเมื่อเปิดเลเยอร์ครั้งแรก
 *   phase     เฟสที่ย้ายเลเยอร์นี้ — มากกว่า BPNP_CONFIG.supportedPhase → แสดง "ยังไม่รองรับ"
 *
 * แก้ชื่อที่แสดง / ค่าเริ่มต้นได้ที่ไฟล์นี้ที่เดียว
 * ───────────────────────────────────────────────────────────────────────── */
BPNP.layers.CONFIG = [
  // ── ทั่วไป ──
  { id: 'dol',            name: 'ผังที่ดิน กรมที่ดิน (red)',  nameLoaded: 'ผังที่ดิน กรมที่ดิน',     category: 'general', kind: 'raster', phase: 1, isDefault: false, hasOpacityControl: true,  isControlVisible: true  },
  { id: 'dpt',            name: 'ผังเมือง (DPT)',            nameLoaded: 'Longdo ผังเมืองรวม',    category: 'general', kind: 'raster', phase: 1, isDefault: false, hasOpacityControl: true,  isControlVisible: false },
  { id: 'tomtomTraffic',  name: 'Traffic Flow',             nameLoaded: 'TomTom Traffic',        category: 'general', kind: 'raster', phase: 1, isDefault: false, hasOpacityControl: true,  isControlVisible: false },
  { id: 'dohKmPost',      name: 'หลักกม.',                   nameLoaded: 'หลัก กม. กรมทางหลวง',   category: 'general', kind: 'vector', phase: 4, source: 'data/json/doh_km_post.json',             isDefault: false, hasOpacityControl: true,  isControlVisible: false },
  { id: 'stationName',    name: 'รายชื่อสถานี (train icon)',   nameLoaded: 'Station Icon',          category: 'general', kind: 'vector', phase: 2, source: 'data/kml/railway/station_name.kml',      isDefault: false,                           isControlVisible: true  },
  { id: 'alTrack',        name: 'Alignment Track (red)',    nameLoaded: 'Alignment Track',       category: 'general', kind: 'vector', phase: 2, source: 'data/kml/alignment/al_track.kml',        isDefault: true,  hasOpacityControl: false, isControlVisible: true  },
  { id: 'layer_ROW',      name: 'เขตทางรถไฟ (orange)',       nameLoaded: 'ROW Boundary',          category: 'general', kind: 'vector', phase: 2, source: 'data/kml/railway/row_boundary.kml',      isDefault: true,  hasOpacityControl: false, isControlVisible: true  },
  { id: 'stationLayout',  name: 'แผนผังย่านสถานี (lightblue)', nameLoaded: 'Station Layout',       category: 'general', kind: 'vector', phase: 2, source: 'data/kml/railway/station_layout.kml',    isDefault: false, hasOpacityControl: false, isControlVisible: true  },
  { id: 'showSTA',        name: 'กม.ก่อสร้าง (blue dots)',    nameLoaded: 'STA Points',            category: 'general', kind: 'vector', phase: 2, source: 'data/kml/alignment/sta_1km.kml',         isDefault: false,                           isControlVisible: true  },
  { id: 'roadLayout',     name: 'ผังถนน Service/Access Rd.', nameLoaded: 'Road Layout',           category: 'general', kind: 'vector', phase: 2, source: 'data/kml/road/road_service.kml', source2: 'data/kml/road/road_access.kml', isDefault: false, hasOpacityControl: true, isControlVisible: true },
  { id: 'polygonLand',    name: 'พื้นที่เวนคืน (Legend)',       nameLoaded: 'แปลงที่ดินเวนคืน',         category: 'general', kind: 'vector', phase: 3, source: 'data/kml/parcel/parcel_land.kml', source2: 'data/kml/parcel/parcel_payout.kml', isDefault: false, hasOpacityControl: true, isControlVisible: true },

  // ── งานโครงสร้าง ──
  { id: 'layer_boxculvert', name: 'Box Culvert', nameLoaded: 'Box Culvert',  category: 'structure', kind: 'vector', phase: 3, source: 'data/kml/structure/box_culvert.kml', isDefault: false, hasOpacityControl: true, isControlVisible: true },
  { id: 'layer_underpass',  name: 'Underpass',   nameLoaded: 'Underpass',    category: 'structure', kind: 'vector', phase: 3, source: 'data/kml/structure/underpass.kml',   isDefault: false, hasOpacityControl: true, isControlVisible: true, hasHeightSignToggle: true },
  { id: 'layer_bridge',     name: 'Bridge',      nameLoaded: 'Bridge (All)', category: 'structure', kind: 'vector', phase: 4, source: 'data/kml/structure/bridge_all.kml',  isDefault: false, hasOpacityControl: true, isControlVisible: true, hasHeightSignToggle: true },

  { id: 'layoutFootingVB45',  name: 'Footing_VB45',  nameLoaded: 'Layout Footing VB45',  category: 'structure', kind: 'vector', phase: 2, source: 'data/kml/footing/vb45_layout.kml',  isDefault: false, hasOpacityControl: true,  isControlVisible: true, hasPierToggle: true, hasSeparatorAbove: true },
  { id: 'pierNameVB45',       name: 'Pier_Name_VB45', nameLoaded: 'Pier Name VB45',      category: 'structure', kind: 'vector', phase: 2, source: 'data/kml/footing/vb45_point.kml',   isDefault: false, hasOpacityControl: false, isControlVisible: false },
  { id: 'layoutFootingVB64',  name: 'Footing_VB64',  nameLoaded: 'Layout Footing VB64',  category: 'structure', kind: 'vector', phase: 2, source: 'data/kml/footing/vb64_layout.kml',  isDefault: false, hasOpacityControl: true,  isControlVisible: true, hasPierToggle: true },
  { id: 'pierNameVB64',       name: 'Pier_Name_VB64', nameLoaded: 'Pier Name VB64',      category: 'structure', kind: 'vector', phase: 2, source: 'data/kml/footing/vb64_point.kml',   isDefault: false, hasOpacityControl: false, isControlVisible: false },
  { id: 'layoutFootingVB88',  name: 'Footing_VB88',  nameLoaded: 'Layout Footing VB88',  category: 'structure', kind: 'vector', phase: 2, source: 'data/kml/footing/vb88_layout.kml',  isDefault: false, hasOpacityControl: true,  isControlVisible: true, hasPierToggle: true },
  { id: 'pierNameVB88',       name: 'Pier_Name_VB88', nameLoaded: 'Pier Name VB88',      category: 'structure', kind: 'vector', phase: 2, source: 'data/kml/footing/vb88_point.kml',   isDefault: false, hasOpacityControl: false, isControlVisible: false },
  { id: 'layoutFootingVB109', name: 'Footing_VB109', nameLoaded: 'Layout Footing VB109', category: 'structure', kind: 'vector', phase: 2, source: 'data/kml/footing/vb109_layout.kml', isDefault: false, hasOpacityControl: true,  isControlVisible: true, hasPierToggle: true },
  { id: 'pierNameVB109',      name: 'Pier_Name_VB109', nameLoaded: 'Pier Name VB109',    category: 'structure', kind: 'vector', phase: 2, source: 'data/kml/footing/vb109_point.kml',  isDefault: false, hasOpacityControl: false, isControlVisible: false },
  { id: 'layoutFootingVB110', name: 'Footing_VB110', nameLoaded: 'Layout Footing VB110', category: 'structure', kind: 'vector', phase: 2, source: 'data/kml/footing/vb110_layout.kml', isDefault: false, hasOpacityControl: true,  isControlVisible: true, hasPierToggle: true },
  { id: 'pierNameVB110',      name: 'Pier_Name_VB110', nameLoaded: 'Pier Name VB110',    category: 'structure', kind: 'vector', phase: 2, source: 'data/kml/footing/vb110_point.kml',  isDefault: false, hasOpacityControl: false, isControlVisible: false },
  { id: 'layoutFootingVB118', name: 'Footing_VB118', nameLoaded: 'Layout Footing VB118', category: 'structure', kind: 'vector', phase: 2, source: 'data/kml/footing/vb118_layout.kml', isDefault: false, hasOpacityControl: true,  isControlVisible: true, hasPierToggle: true },
  { id: 'pierNameVB118',      name: 'Pier_Name_VB118', nameLoaded: 'Pier Name VB118',    category: 'structure', kind: 'vector', phase: 2, source: 'data/kml/footing/vb118_point.kml',  isDefault: false, hasOpacityControl: false, isControlVisible: false },

  // ── Signalling and Track ──
  { id: 'layer_track_progress', name: 'Track Progress', nameLoaded: 'ความคืบหน้างานวางราง', category: 'progress', kind: 'vector', phase: 4, source: 'data/json/track_progress.json', isDefault: false, hasOpacityControl: false, isControlVisible: true },
  { id: 'layer_sw_loc',         name: 'SW - LOC',       nameLoaded: 'งานตู้ LOC',          category: 'progress', kind: 'vector', phase: 4, source: 'data/json/sw_loc.json',         isDefault: false, hasOpacityControl: false, isControlVisible: true }
];

BPNP.layers.byId = id => BPNP.layers.CONFIG.find(c => c.id === id) || null;
BPNP.layers.isSupported = c => (c.phase || 99) <= (BPNP.config.supportedPhase || 1);
