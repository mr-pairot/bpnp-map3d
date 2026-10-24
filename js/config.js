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
  supportedPhase: 3,

  map: {
    center:         [103.64, 16.1],   // [lng, lat]
    zoom:           9,                // = ซูม 10 ของ Leaflet (ซูม MapLibre = Leaflet − 1)
    minZoom:        4,
    maxZoom:        21,
    defaultBasemap: 'osm',
    allowRotate:    false,            // เปิดในเฟส 3D
    vectorStyleUrl: 'https://tiles.openfreemap.org/styles/liberty',
    fallbackGlyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf'
  },

  // คีย์ฝั่งหน้าเว็บ (เปิดเผยได้โดยธรรมชาติ) — ค่าเดิมจาก v2.4.01 (longdo/tomtom ว่างเหมือนเดิม)
  keys: {
    tracestrack: 'd576a80f46520757074dce91f3ee2130',
    longdo:      '',
    tomtom:      ''
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
