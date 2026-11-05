/* js/config.js
 * ─────────────────────────────────────────────────────────────────────────
 * ค่าตั้งตามสภาพแวดล้อม — ไฟล์เดียวที่ต่างกันระหว่าง repo (map3d / demo / production)
 * แก้ไฟล์นี้แล้ว commit → Netlify deploy ใหม่ (ไม่ต้องแก้ไฟล์อื่น)
 * ───────────────────────────────────────────────────────────────────────── */
window.BPNP_CONFIG = {
  appName:       'BPNP Map 3D',
  appSubtitle:   'โครงการรถไฟทางคู่ สายบ้านไผ่-หนองพอก',
  siteUrl:       'https://bpnp-map3d.netlify.app',

  // ── LIFF (channel 2007032148) และ GAS Web app ของ map3d (ดู backend/gas/README.md) ──
  liffId:        '2007032148-wk1xMGrD',
  gasUrl:        'https://script.google.com/macros/s/AKfycbwVBKtdNidFt6niAteBBAw5Gyf5wCAbH4UWn5ZU-mJxZABu3blqotM44ERiLawqSRBm/exec',

  storagePrefix: 'bpnp3d_',          // prefix ของ localStorage / cookie ทุกคีย์

  auth: {
    // true  = ต้องผ่านการตรวจกับ GAS ก่อนเข้าแอปทุกครั้ง (ออฟไลน์ใช้ session เดิมได้)
    // false = เข้าแอปทันทีด้วย session ในเครื่อง แล้วตรวจกับ GAS เบื้องหลัง
    strictMode:     true,
    // ปลายทางที่ GAS สั่ง redirect ได้ (เช่น ผู้ไม่มีสิทธิ์ → เว็บหลัก)
    redirectHosts:  ['liff.line.me', 'bpnp-map.netlify.app'],
    // เปิดบนเครื่องตัวเอง (node/python http server) → ข้ามการล็อกอิน ใช้สำหรับพัฒนาเท่านั้น
    devBypassHosts: ['localhost', '127.0.0.1']
  },

  // เฟสสูงสุดที่รองรับแล้ว: เลเยอร์ที่ phase มากกว่านี้จะแสดง "ยังไม่รองรับ" ในรายการชั้นข้อมูล
  supportedPhase: 4,

  // สวิตช์เปิด/ปิดความสามารถ (js/core/features.js)
  //   true = เปิดทุกคน · false = ปิดทุกคน · ['editor'] = เปิดเฉพาะ role ในรายการ (ชีท Users คอลัมน์ role: editor / viewer)
  features: {
    // รูป 3 มิติ Box Culvert / Underpass ในโหมด 3D — เปิดเฉพาะ editor ระหว่างปรับรูปให้ถูกต้อง (v3.9.10)
    structure3d: ['editor'],
    // สะพานรถไฟ 3 มิติ CB / SB ในโหมด 3D (js/layers/structure/bridge_3d.js · ตั้งค่า data/json/bridge_3d.json) — v3.10.00
    bridge3d: ['editor'],
    // SW - Color Light (ไฟสีระบบอาณัติสัญญาณ, js/layers/progress/sw_light.js) — ทดสอบเฉพาะ editor ก่อน (v3.10.09)
    swLight: ['editor']
  },

  map: {
    center:         [103.64, 16.1],   // [lng, lat]
    zoom:           9,                // = ซูม 10 ของ Leaflet (ซูม MapLibre = Leaflet − 1)
    minZoom:        4,
    maxZoom:        21,
    defaultBasemap: 'osm',
    allowRotate:    true,            // 2D เริ่มต้น — ปุ่ม 3D เปิดการเอียง/หมุนเอง (js/map/terrain.js)
    // เฟส 3D: ภูมิประเทศจาก AWS Terrain Tiles (ฟรี ไม่ต้องใช้คีย์, Terrarium encoding)
    // โหมด 3D: หมุด/ป้าย/popup ที่หลังกล้อง เลยขอบฟ้า หรือไกลเกิน ไม่แสดง (js/map/view3d.js) — v3.10.10
    //   ระยะสูงสุด = maxDistFactor × ระยะกล้องถึงกลางจอ (ไม่ต่ำกว่า minKm) · fadeFrac = ช่วงท้ายที่ชื่อสถานีค่อย ๆ จาง
    view3d: { maxDistFactor: 4, minKm: 3, fadeFrac: 0.25 },
    terrain: {
      tiles:        'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png',
      encoding:     'terrarium',
      maxzoom:      15,
      exaggeration: 1.5,              // พื้นที่โครงการค่อนข้างราบ จึงขยายความสูง 1.5 เท่าให้เห็นชัด
      pitch:        60,               // มุมเอียงเมื่อกดปุ่ม 3D
      attribution:  'Terrain: <a href="https://registry.opendata.aws/terrain-tiles/" target="_blank" rel="noopener">AWS Terrain Tiles</a>'
    },
    vectorStyleUrl: 'https://tiles.openfreemap.org/styles/liberty',
    fallbackGlyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf'
  },

  // คีย์ฝั่งหน้าเว็บ (เปิดเผยได้โดยธรรมชาติ) — ค่าเดิมจาก v2.4.01 (longdo/tomtom ว่างเหมือนเดิม)
  keys: {
    tracestrack: '3722a54920e9a20d2d3bfc9ffc0b8d44976f35d1d22470ce',
    longdo:      '',
    tomtom:      '',
    // Longdo API (ค้นหาที่อยู่ ↔ พิกัด) — ค่าเดิมจาก routing_main.js / search_address.js
    longdoServices: '033be319382d52bd656448efcbafc8ab'
  },

  data: {
    alignment:    'data/geojson/alignment/alignment_20m.geojson',
    alignmentKml: 'data/kml/alignment/alignment_20m.kml'     // สำรอง: เปิดบนเครื่องโดยไม่ได้รัน build
  },

  ui: {
    showUserPanel: false             // แผงรูปโปรไฟล์/ออกจากระบบ (v2.4.01 ซ่อนไว้ — ออกจากระบบผ่านเมนู "รีเซ็ตระบบ")
  },

  // true = แสดงหน้า "กำลังปรับปรุงระบบ" แทนแอป
  maintenance: false,

  debug: false
};
