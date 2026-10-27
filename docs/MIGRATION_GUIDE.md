# BPNP Map 3D — แนวทางจัดทำ repo ใหม่และย้ายไป MapLibre

> สถานะ: **เฟส 0–1 (v3.0.00) · เฟส 2 (v3.1.xx) · เฟส 3 (v3.2.xx) · เฟส 4A (v3.3.xx) · เฟส 4B (v3.4.00) เสร็จ — ชั้นข้อมูลครบทุกชั้น** · ดูหัวข้อ 14–15 สำหรับสิ่งที่ปรับและพบระหว่างทำ
> อ้างอิงจาก: BPNP_Map v2.4.01 (Leaflet) และ `Code_demo.gs`
> เว็บเป้าหมาย: `https://bpnp-map3d.netlify.app`

---

## 0. สรุปการตัดสินใจหลัก

| หัวข้อ | แนวทางที่เสนอ | เหตุผล |
|---|---|---|
| เอนจินแผนที่ | **MapLibre อย่างเดียว** ไม่มี Leaflet ใน repo ใหม่ | repo แยกแล้ว ไม่ต้องใช้ระบบสลับ engine (`engine.js`) ตามแผนเดิม โค้ดสะอาดกว่า เว็บหลัก `bpnp-map` ยังเป็น Leaflet จนกว่า 3D จะครบฟีเจอร์ |
| โค้ด Leaflet เดิม | ไม่คัดลอกมา ใช้ repo เดิมเป็นต้นแบบอ้างอิง | กันโค้ดตายปนในระบบใหม่ |
| รูปแบบสคริปต์ | Classic script + namespace กลาง `window.BPNP` | ใกล้กับวิธีเดิม (loadScript ตามลำดับ) ไม่ต้องมี bundler แก้ผ่าน GitHub ได้ตรง ๆ |
| ค่าตั้งค่าตามสภาพแวดล้อม | รวมไว้ไฟล์เดียว `js/config.js` | เดิมกระจายอยู่ใน auth.js / main.js / index.html |
| LIFF | สร้าง LIFF ใหม่ **ใน LINE Login channel เดิม (2007032148)** | userId ของผู้ใช้คนเดิมตรงกันทุกเว็บ และใช้ channel ID เดิมตรวจ ID Token ได้ |
| GAS | โค้ดชุดเดียว ตั้งค่าผ่าน Script Properties | ใช้ไฟล์เดียวกันได้ทั้ง demo / production / 3d ต่างกันแค่ค่าตั้ง |
| การยืนยันตัวตน | เปลี่ยนจาก DeviceID เป็น **Session token** ที่ GAS ออกให้ | DeviceID ปัจจุบันทำหน้าที่เหมือนรหัสผ่าน ใครได้ค่าไปก็เข้าได้ |
| เลขเวอร์ชัน | เริ่ม `3.0.00` | แยกจากสาย 2.x ของเว็บหลักชัดเจน |

---

## 1. ภาพรวมระบบใหม่

```
ผู้ใช้ (LINE / เบราว์เซอร์ / PWA)
        │
        ▼
https://liff.line.me/<LIFF_ID_3D>  ──►  https://bpnp-map3d.netlify.app  (repo: bpnp-map3d)
                                             │  js/config.js → liffId, gasUrl
                                             ▼
                                   GAS Web App (ใหม่)  ──►  Google Sheet (ใหม่)
                                   Script Properties          Users / Sessions / UsageLog / EventLog
```

ทั้ง 3 ระบบ (เว็บหลัก, demo, 3d) แยกจากกันโดยสมบูรณ์: repo, Netlify site, LIFF, GAS, Sheet

### 1.1 ลำดับการตั้งค่าภายนอก (ทำครั้งเดียว)

1. **GitHub:** สร้าง private repo `bpnp-map3d`
2. **Netlify:** New site from Git → เลือก repo → ตั้งชื่อ site `bpnp-map3d` (Build command และ publish อ่านจาก `netlify.toml`)
3. **Google Sheet:** สร้างไฟล์ใหม่ (ว่างได้ ตารางจะถูกสร้างโดยฟังก์ชัน `setup()` ของ GAS)
4. **GAS:** สร้างโปรเจกต์ใหม่ วางโค้ดจาก `backend/gas/Code.gs` → ตั้ง Script Properties (ข้อ 6.1) → รัน `setup()` 1 ครั้ง → Deploy เป็น Web app (Execute as: Me, Who has access: Anyone) → คัดลอก URL
5. **LINE Developers:** Provider เดิม → LINE Login channel `2007032148` → แท็บ LIFF → Add
   - LIFF app name: `BPNP Map 3D`
   - Size: Full
   - Endpoint URL: `https://bpnp-map3d.netlify.app/`
   - Scopes: ติ๊ก `openid` และ `profile`
   - Add friend option: Off
   - คัดลอก LIFF ID
6. **repo:** ใส่ LIFF ID และ GAS URL ใน `js/config.js` → commit → Netlify deploy

---

## 2. โครงสร้าง repo ใหม่

```
bpnp-map3d/
├─ index.html
├─ manifest.webmanifest
├─ sw.js                         ← ต้องอยู่ราก (scope ทั้งเว็บ)
├─ version.json
├─ netlify.toml
├─ README.md
│
├─ docs/
│  ├─ MIGRATION_GUIDE.md         ← ไฟล์นี้
│  └─ CHANGELOG.md               ← แทน history.json / CHANGES_CACHE_UPDATE.md
│
├─ backend/
│  └─ gas/
│     ├─ Code.gs                 ← ต้นฉบับ GAS (ไม่ deploy ขึ้น Netlify)
│     └─ README.md               ← ขั้นตอน deploy GAS + Script Properties
│
├─ tools/
│  ├─ build.js                   ← hash เวอร์ชัน (ปรับให้อ่าน data แบบโฟลเดอร์ย่อย)
│  └─ kml2geojson.js             ← เฟส 2
│
├─ js/
│  ├─ config.js                  ← ค่าตามสภาพแวดล้อม (ไฟล์เดียวที่ต่างกันระหว่าง repo)
│  ├─ boot/                      ← โหลดก่อนเข้าแอป
│  │  ├─ loader.js               ← loadScript / loadCSS / ใส่ ?v=
│  │  ├─ auth.js                 ← LIFF + session
│  │  ├─ check_update.js
│  │  └─ app_manifest.js         ← รายการสคริปต์/CSS ที่โหลดหลังล็อกอิน (แทน app_scripts.js)
│  ├─ core/                      ← ไม่ผูกกับแผนที่
│  │  ├─ namespace.js            ← สร้าง window.BPNP
│  │  ├─ data_cache.js
│  │  ├─ toast.js
│  │  ├─ geo_utils.js            ← แปลงพิกัด/ซูม, ระยะทาง, UTM (รวม convertFunction.js)
│  │  └─ alignment.js            ← คำนวณ Sta/O/S (ส่วนคำนวณของ findStaAndOS.js)
│  ├─ map/                       ← แกน MapLibre (เฟส 1)
│  │  ├─ map_core.js
│  │  ├─ basemaps.js
│  │  ├─ layer_registry.js
│  │  ├─ controls.js             ← scale, attribution, fullscreen
│  │  ├─ popup.js
│  │  └─ terrain.js              ← เฟส 3D (เตรียมไว้)
│  ├─ layers/                    ← เลเยอร์ข้อมูล (เฟส 2–4) หนึ่งไฟล์ต่อหนึ่งกลุ่ม
│  │  ├─ layers_config.js        ← แทน LAYERS_CONFIG ใน main.js
│  │  ├─ alignment.js, row.js, station.js, road.js ...
│  │  ├─ parcel/                 ← แปลงเวนคืน + legend + ค้นหา
│  │  ├─ structure/              ← bridge, underpass, box culvert, footing
│  │  └─ progress/               ← track progress, sw_loc
│  ├─ tools/                     ← เครื่องมือ (เฟส 5)
│  │  ├─ my_location.js          ← เฟส 1
│  │  ├─ click_point.js          ← เฟส 1
│  │  ├─ measure/                ← MeasurePlus, ขุด/ถม
│  │  ├─ routing/
│  │  ├─ search/
│  │  └─ utm/
│  ├─ ui/
│  │  ├─ ui_manager.js
│  │  ├─ layer_panel.js          ← แยกจาก main.js (CustomLayerControl)
│  │  ├─ welcome_popup.js
│  │  └─ about_popup.js
│  └─ app.js                     ← จุดประกอบแอป (แทน main.js)
│
├─ css/                          ← โครงเดียวกับ js/
│  ├─ base/   (splash, style, pwa, override-ui)
│  ├─ map/    (maplibre_overrides, controls, popup)
│  ├─ ui/     (layer_panel, welcome, about, toast, legend)
│  ├─ layers/ (เฟส 2+)
│  └─ tools/  (เฟส 5)
│
├─ data/
│  ├─ kml/        ← ต้นฉบับ (แก้ใน Google Earth แล้ววางที่นี่)
│  ├─ geojson/    ← สร้างอัตโนมัติจาก kml/ ตอน build (เฟส 2)
│  └─ json/       ← ข้อมูลความคืบหน้า / ข้อมูลประกอบ
│
└─ assets/
   ├─ icons/      ← favicon, app icons, map-icon.svg
   ├─ ui/         ← ไอคอนปุ่ม
   ├─ markers/    ← ไอคอนบนแผนที่
   └─ parcels/    ← รูปแปลงที่ดิน (เดิม img_parcels/)
```

### 2.1 หลักการตั้งชื่อ

- โฟลเดอร์และไฟล์ JS/CSS/data: ตัวพิมพ์เล็ก `snake_case` เช่น `layer_registry.js`
- รูปภาพ: ตัวพิมพ์เล็ก `kebab-case` **ห้ามมีช่องว่าง วงเล็บ หรือภาษาไทย** เช่น `train (blue).png` → `train-blue.png`
- CSS ของโมดูลใดให้ชื่อตรงกับ JS ของโมดูลนั้น และอยู่ในโฟลเดอร์ชื่อเดียวกัน
- ทุกโมดูลประกาศตัวเองใต้ `BPNP.<กลุ่ม>.<ชื่อ>` เช่น `BPNP.map.registry`, `BPNP.tools.measure` ไม่สร้างตัวแปร global ใหม่
- คีย์ localStorage ใช้ prefix จาก `config.storagePrefix` (`bpnp3d_`) ทั้งหมด

---

## 3. ตารางย้ายและเปลี่ยนชื่อไฟล์

### 3.1 ไฟล์ราก / ระบบ

| เดิม | ใหม่ | หมายเหตุ |
|---|---|---|
| `index.html` | `index.html` | ตัด Leaflet/omnivore/routing-machine/maplibre-gl-leaflet ออก, ตรึงเวอร์ชัน CDN, ตัดข้อความ “v2.3” ที่ฝังในหน้า splash |
| `manifest.json` | `manifest.webmanifest` | ชื่อ “BPNP Map 3D”, theme color เดียวกับ `<meta>` (`#0d2b45`) |
| `sw.js` | `sw.js` | ชื่อแคช `bpnp3d-*`, ปรับ PRECACHE ตาม path ใหม่ |
| `version.json` | `version.json` | `3.0.00`, คีย์ `dataVersions` เป็น path เต็ม เช่น `kml/alignment/al_track.kml` |
| `netlify.toml` | `netlify.toml` | เพิ่ม header ของ `/data/geojson/*` และ `/backend/*` (บล็อก ดูข้อ 8) |
| `history.json` | `history.json` (คงไว้ที่ราก) | หน้า About อ่านไฟล์นี้ — เพิ่มรายการ 3.0.00 แล้ว |
| `CHANGES_CACHE_UPDATE.md` | `docs/CHANGELOG.md` | บันทึกฝั่งนักพัฒนา |
| `tools/build.js` | `tools/build.js` | อ่าน `data/` แบบ recursive |

### 3.2 JavaScript (เฉพาะที่ย้ายในเฟส 0–1)

| เดิม | ใหม่ | การเปลี่ยนแปลง |
|---|---|---|
| ค่าใน `auth.js`, `main.js` | `js/config.js` | รวมค่าตามสภาพแวดล้อม |
| `auth.js` | `js/boot/auth.js` + `js/boot/loader.js` | แยกตัวโหลดสคริปต์ออก, ใช้ session token, ตัด `IS_DEMO_SITE` ที่ดูจากชื่อโดเมน |
| `app_scripts.js` | `js/boot/app_manifest.js` | รายการไฟล์ตามโครงใหม่ |
| `checkUpdate.js` | `js/boot/check_update.js` | เปลี่ยนชื่อ + prefix คีย์ |
| `dataCache.js` | `js/core/data_cache.js` | คีย์แคชเป็น path เต็ม, ตัดส่วนที่ครอบ `omnivore.kml` |
| `convertFunction.js` | `js/core/geo_utils.js` | รวมกับ helper แปลงพิกัด/ซูม |
| `findStaAndOS.js` | `js/core/alignment.js` | เอาเฉพาะส่วนคำนวณ (ส่วนวาดเส้นย้ายไปเลเยอร์ในเฟส 2) |
| `ui_manager.js` | `js/ui/ui_manager.js` | ตัด `L.DomEvent`, ใช้ prefix คีย์ใหม่ในปุ่มรีเซ็ต |
| `main.js` (ส่วน map/basemap/scale) | `js/map/*.js` | เขียนใหม่ด้วย MapLibre |
| `main.js` (CustomLayerControl) | `js/ui/layer_panel.js` | ใช้ `layer_registry` แทน `map.hasLayer` |
| `main.js` (LAYERS_CONFIG) | `js/layers/layers_config.js` | โครงข้อมูลใหม่ (ข้อ 9.3) |
| `MyLocation.js` | `js/tools/my_location.js` | `geolocation.watchPosition` |
| `clickpoint.js` | `js/tools/click_point.js` | MapLibre popup/events |
| `fullscreen_control.js` | รวมใน `js/map/controls.js` | |
| `welcome_popup.js`, `about_popup.js` | `js/ui/` | ย้ายตรง แก้ข้อความ/ลิงก์ |

ไฟล์ที่ **ไม่ย้าย** (ไม่ได้ใช้แล้ว): `main-bkup 260707.js`, `BridgeLayerManager.js`, `BridgeLayerManager2.js`, `leaflet-tilelayer-wmts.js`, `map_ui.js`, `leaflet-search.js` (เฟส 3 เขียนใหม่)

ไฟล์ที่ย้ายในเฟสถัดไป: ดูข้อ 10

### 3.3 ข้อมูล (`data/`)

| เดิม | ใหม่ |
|---|---|
| `AL_Track_R03.kml` | `kml/alignment/al_track.kml` |
| `dataAlignment20m.kml` | `kml/alignment/alignment_20m.kml` |
| `Sta1km.kml` | `kml/alignment/sta_1km.kml` |
| `Polygon02.kml` | `kml/railway/row_boundary.kml` |
| `station.kml` | `kml/railway/station_layout.kml` |
| `Station_Name.kml` | `kml/railway/station_name.kml` |
| `sv_road_layout.kml` | `kml/road/road_service.kml` |
| `acc_road_layout.kml` | `kml/road/road_access.kml` |
| `polygon.kml` | `kml/parcel/parcel_land.kml` |
| `pay_out.kml` | `kml/parcel/parcel_payout.kml` |
| `Box_Culvert.kml` | `kml/structure/box_culvert.kml` |
| `Underpass.kml` | `kml/structure/underpass.kml` |
| `Bridges_All.kml` | `kml/structure/bridge_all.kml` |
| `Bridges_CB.kml` / `Bridges_SB.kml` | `kml/structure/bridge_cb.kml` / `bridge_sb.kml` |
| `overpass.kml` | `kml/structure/overpass.kml` |
| `VB45_Layout.kml` / `VB45_Point.kml` (และ 64, 88, 109, 110, 118) | `kml/footing/vb45_layout.kml` / `vb45_point.kml` |
| `DOH_Show_KM.json` | `json/doh_km_post.json` |
| `KMdata.json` | `json/km_data.json` |
| `progressTW.json` | `json/track_progress.json` |
| `bridge_progress.json` | `json/bridge_progress.json` |
| `box_timestamp.json` | `json/box_timestamp.json` |
| `progress_yt_link.json` | `json/video_links.json` |
| `signs.json` | `json/height_signs.json` |
| `sw_LOC.json` | `json/sw_loc.json` |

ไม่ย้าย (ไม่มีโค้ดใดอ้างถึง): `bridges.kml` (ซ้ำกับ `Bridges_All.kml` ทุกไบต์), `AL_Track_R02.kml`, `VD118_Layout.kml`, `VD118_Point.kml` (ซ้ำกับ VB118 ทุกไบต์ — **ต้องยืนยันว่าชื่อที่ถูกคือ VB118 หรือ VD118**)

ข้อสังเกต: `station.kml` ขนาด 16 MB แต่มีเพียง 16 รายการ แสดงว่าพิกัดละเอียดมาก ควรลดความละเอียด (simplify) ตอนแปลงเป็น GeoJSON ในเฟส 2

### 3.4 รูปภาพ (`img/` → `assets/`)

- ไอคอนแอป (`favicon*`, `icon-192/512`, `apple-touch-icon`, `map-icon.svg`) → `assets/icons/`
- ไอคอนปุ่ม (`layers.svg`, `locate1/2.png`, `pencil.png`, `eraser.png`, `polygon.png`, `polyline.png`, `circle.png`, `delete.png`, `search*.png`, `scale.svg`, `scale2.svg` ฯลฯ) → `assets/ui/`
- ไอคอนบนแผนที่ (`train (*).png`, `start.png`, `via.png`, `end.png`, `location.png`) → `assets/markers/` พร้อมเปลี่ยนชื่อ เช่น `train-blue.png`, `route-start.png`
- `scale.png` ไม่มีโค้ดใดใช้ → ไม่ย้าย
- `img_parcels/` → `assets/parcels/` **ชื่อไฟล์ปัจจุบันเป็นภาษาไทย** (เช่น `ท3234.4_1.jpg` ซึ่งตอน zip กลายเป็น `#U0e173234.4_1.jpg`) เสนอเปลี่ยนเป็นอักษรละตินตามกติกาเดียว เช่น `ท` → `T` (`T3234.4_1.jpg`) แล้วแปลงชื่อในโค้ดที่ประกอบ path (`setPopup.js` บรรทัดที่สร้าง `img_parcels/${code}_${i}.jpg`)

---

## 4. ไฟล์ตั้งค่ากลาง `js/config.js`

ไฟล์เดียวที่ต่างกันระหว่าง repo (ค่าในตัวอย่างเป็นตัวแทน)

```js
window.BPNP_CONFIG = {
  appName:       'BPNP Map 3D',
  siteUrl:       'https://bpnp-map3d.netlify.app',
  liffId:        '2007032148-XXXXXXXX',        // LIFF ใหม่
  gasUrl:        'https://script.google.com/macros/s/XXXX/exec',
  storagePrefix: 'bpnp3d_',

  auth: {
    strictMode:     true,                       // ต้องผ่าน GAS ก่อนเข้าแอปทุกครั้ง (แทน IS_DEMO_SITE)
    redirectHosts:  ['liff.line.me', 'bpnp-map.netlify.app'],
    devBypassHosts: ['localhost', '127.0.0.1']  // แทนบล็อก if (false) ใน auth.js เดิม
  },

  map: {
    center: [103.64, 16.1],                     // [lng, lat]
    zoom:   9,                                  // = ซูม 10 ของ Leaflet
    defaultBasemap: 'osm'
  },

  keys: {                                       // คีย์ที่ใช้ฝั่งหน้าเว็บ (เปิดเผยได้อยู่แล้ว)
    tracestrack: '…', longdo: '', tomtom: ''
  },

  maintenance: false                            // แทน IS_UNDER_MAINTENANCE ใน index.html
};
```

---

## 5. การยืนยันตัวตน (auth.js) — สิ่งที่ปรับ

### 5.1 ปัญหาในระบบเดิม

1. **DeviceID เป็นรหัสผ่านโดยปริยาย:** `check_device` เชื่อ DeviceID อย่างเดียว ใครคัดลอก cookie/localStorage ไปใช้ก็เข้าระบบในนามผู้ใช้นั้นได้ และ DeviceID สร้างด้วย `Math.random()`
2. **`IS_DEMO_SITE` ดูจากชื่อโดเมนที่มี “-demo”:** โดเมน `bpnp-map3d` ไม่มีคำนี้ โหมดเข้มงวดจะไม่ทำงาน
3. **`REDIRECT_ALLOWED_HOSTS`, LIFF ID, GAS URL ฝังในโค้ด**
4. **บล็อกทดสอบ `if (false)`** ฝังอยู่ในโค้ดจริง
5. `logUserEvent` ส่ง userId จากหน้าเว็บ GAS เชื่อค่านั้นตรง ๆ

### 5.2 ลำดับใหม่

```
เปิดแอป
  ├─ มี session token ในเครื่อง?
  │    ├─ ใช่ → strictMode?
  │    │        ├─ ใช่  → check_session (รอผล) → ผ่าน: เข้าแอป / ไม่ผ่าน: ล้าง token → LIFF
  │    │        └─ ไม่ → เข้าแอปทันที + check_session เบื้องหลัง (ไม่ผ่าน → ล้างแล้ว reload)
  │    └─ ไม่ → LIFF
  └─ LIFF: ensureLiff → ยังไม่ login → หน้า Landing
                      → login แล้ว → ส่ง idToken ไป action "login"
                                       → GAS ตรวจกับ LINE → ออก session token → เข้าแอป
                                       → ถูกปฏิเสธ → redirect (ถ้ามี) หรือหน้าแจ้งสถานะ
```

- DeviceID ยังเก็บไว้ แต่ใช้เพื่อสถิติเท่านั้น ไม่ใช้ยืนยันตัวตน และสร้างด้วย `crypto.randomUUID()`
- ทุก request ที่ส่งหลังล็อกอิน (track_event และ action ในอนาคต) แนบ `sessionToken` GAS หา userId เองจาก token
- ส่งเป็น `text/plain` (ไม่ตั้ง `Content-Type: application/json`) เหมือนเดิม เพื่อเลี่ยง CORS preflight ซึ่ง GAS ไม่รองรับ

---

## 6. GAS ใหม่ (`backend/gas/Code.gs`)

### 6.1 ค่าตั้งผ่าน Script Properties (ไม่ฝังในโค้ด)

| Property | ตัวอย่าง | ความหมาย |
|---|---|---|
| `SPREADSHEET_ID` | `1AbC…` | Sheet ใหม่ |
| `LINE_CHANNEL_ID` | `2007032148` | ใช้ตรวจ ID Token |
| `ACCESS_MODE` | `allowlist` / `approval` / `open` | ดูข้อ 6.3 |
| `ALLOWED_IDS` | `Uxxx,Uyyy` | ใช้เมื่อ `allowlist` |
| `DENY_REDIRECT_URL` | `https://liff.line.me/2007032148-uTzLx8Ed` | ปลายทางเมื่อไม่มีสิทธิ์ (ว่าง = ไม่ redirect) |
| `SESSION_DAYS` | `90` | อายุ session |
| `APP_LABEL` | `map3d` | ใส่ใน log เพื่อแยกแหล่ง |

ผลคือไฟล์ `Code.gs` ชุดเดียวใช้ได้ทั้ง 3 เว็บ ต่างกันแค่ค่าตั้ง

### 6.2 โครงโค้ด

- **Router:** `const ACTIONS = { ping, login, check_session, logout, track_event }` เพิ่ม action ใหม่ในเฟสถัดไปได้โดยไม่แตะโค้ดเดิม
- **อ่านคอลัมน์ตามชื่อหัวตาราง** ไม่ใช้เลขคอลัมน์ตายตัว (เดิม `data[i][8]` = DeviceID) แทรกคอลัมน์ใหม่ใน Sheet ได้ไม่พัง
- **LockService ทุกการเขียน** (เดิมมีแค่ track_event, ส่วน login ที่ `appendRow` ไม่มี lock อาจได้แถวซ้ำเมื่อกดพร้อมกัน)
- **ค้นหาด้วย TextFinder + CacheService** สำหรับ session (ไม่ต้องอ่านทั้งแท็บทุก request)
- **`setup()`** สร้างแท็บและหัวตารางให้อัตโนมัติ + ทดสอบสิทธิ์ UrlFetch (แทน `authorizeOnce`)
- **รหัสผลลัพธ์มาตรฐาน:** ทุกคำตอบมี `success` และ `code` เช่น `OK`, `TOKEN_MISSING`, `TOKEN_INVALID`, `SESSION_EXPIRED`, `NOT_ALLOWED`, `PENDING`, `BLOCKED`, `BAD_REQUEST`, `UNKNOWN_ACTION` หน้าเว็บตัดสินใจจาก `code` ไม่ใช่ข้อความ
- **`apiVersion`** ในทุกคำตอบ เพื่อให้หน้าเว็บตรวจได้ว่า GAS อัปเดตตรงกันหรือไม่

### 6.3 โหมดสิทธิ์ (`ACCESS_MODE`)

| โหมด | ผู้ใช้ใหม่ | เหมาะกับ |
|---|---|---|
| `allowlist` | เข้าได้เฉพาะ ID ใน `ALLOWED_IDS` ที่เหลือถูกปฏิเสธ (ไม่บันทึกลง Users) | ช่วงทดสอบ (เหมือน demo เดิม) |
| `approval` | บันทึกเป็น `pending` รอผู้ดูแลเปลี่ยนเป็น `approved` ใน Sheet หน้าเว็บแสดง “รออนุมัติ” | เปิดให้ทีมงานใช้แบบคัดกรอง |
| `open` | เข้าได้ทันที (`approved`) | เปิดใช้ทั่วไป (เหมือนเว็บหลัก) |

ทุกโหมด: `blocked` เข้าไม่ได้เสมอ

### 6.4 Action

| action | ข้อมูลเข้า | ผลลัพธ์ |
|---|---|---|
| `ping` | – | `apiVersion`, เวลา server (ไว้ตรวจว่า GAS ทำงาน) |
| `login` | `idToken`, `deviceId`, `deviceInfo` | ตรวจ token กับ LINE → ตรวจสิทธิ์ → สร้าง session → `sessionToken`, profile, `status`, `role` |
| `check_session` | `sessionToken`, `deviceInfo` | profile ล่าสุด หรือ code ที่เหมาะสม + อัปเดต `last_seen` |
| `logout` | `sessionToken` | เพิกถอน session นั้น |
| `track_event` | `sessionToken`, `eventName`, `eventDetails` | บันทึก EventLog (userId มาจาก session) |

Action ที่เตรียมช่องไว้สำหรับเฟสถัดไป (ยังไม่ทำ): `get_config` (ประกาศ/โหมดปิดปรับปรุงจาก Sheet), `get_progress` (ข้อมูลความคืบหน้าจาก Sheet แทนไฟล์ JSON), `save_feature` (บันทึกรูปที่วาด/วัด สำหรับ role `editor`)

### 6.5 Session token

- ออกให้หลัง `login` สำเร็จ: สุ่ม 32 ไบต์ → ส่ง token ให้หน้าเว็บ
- Sheet เก็บเฉพาะ **SHA-256 hash** ของ token (ถ้า Sheet รั่ว token ก็ใช้ไม่ได้)
- หนึ่งผู้ใช้มีได้หลาย session (หลายเครื่อง) เพิกถอนรายเครื่องได้โดยใส่ `revoked = TRUE` ในแท็บ Sessions
- หมดอายุตาม `SESSION_DAYS` นับจากใช้งานล่าสุด

---

## 7. Google Sheet ใหม่

### Users
| user_id | display_name | picture_url | status | role | today_count | total_count | last_date | last_login | created_at | note |
|---|---|---|---|---|---|---|---|---|---|---|

- `status`: `approved` / `pending` / `blocked` (เดิมใช้ `guest` / `blacklist`)
- `role`: `viewer` (ค่าเริ่มต้น) / `editor` / `admin` — ยังไม่ใช้ในเฟส 0–1 แต่เตรียมไว้สำหรับฟีเจอร์ที่ต้องแยกสิทธิ์
- ไม่มีคอลัมน์ DeviceID แล้ว (ย้ายไป Sessions)

### Sessions
| token_hash | user_id | device_id | device_info | created_at | last_seen | expires_at | revoked |
|---|---|---|---|---|---|---|---|

### UsageLog
| time | user_id | display_name | action | device_info | app |
|---|---|---|---|---|---|

### EventLog
| time | user_id | event_name | event_details | app |
|---|---|---|---|---|

### Config (เผื่อเฟสถัดไป)
| key | value | note |
|---|---|---|

หมายเหตุ: UsageLog/EventLog โตไม่หยุด เสนอให้มีฟังก์ชัน `archiveLogs()` ตั้ง trigger รายเดือน ย้ายแถวเก่าไปแท็บ `UsageLog_YYYY` (ทำภายหลังได้)

---

## 8. Build, Deploy และแคช

- **`netlify.toml`:** คง `command = "node tools/build.js"`, `publish = "."` และ header เดิม เพิ่ม redirect บล็อก `/backend/*` และ `/docs/*` ไม่ให้เข้าถึงจากเว็บ (`status = 404`)
- **`tools/build.js`:**
  - อ่าน `data/` แบบ recursive คีย์เป็น path สัมพัทธ์ (`kml/structure/underpass.kml`) — เดิมอ่านแค่ชั้นบนและใช้ชื่อไฟล์เป็นคีย์ ซึ่งจะชนกันเมื่อมีโฟลเดอร์ย่อย
  - hash ของโค้ดรวม `js/`, `css/`, `sw.js`, `index.html` (ยกเว้นบรรทัด APP_VERSION)
  - เฟส 2: เรียก `kml2geojson.js` แปลง `data/kml/**` → `data/geojson/**` ก่อนคำนวณ hash
- **`js/core/data_cache.js`:** ใช้คีย์ path เต็มให้ตรงกับ `dataVersions`
- **`sw.js`:** ชื่อแคช `bpnp3d-shell`, `bpnp3d-cdn`, `bpnp3d-img`, prefix ข้อมูล `bpnp3d-data` ไม่ยุ่งกับ tile แผนที่ (MapLibre มีแคช tile ในหน่วยความจำของตัวเอง)
- **ไลบรารี CDN ตรึงเลขเวอร์ชันแน่นอนทุกตัว** (ไม่ใช้ `@latest`, `@3.x`): maplibre-gl 5.24.0, @turf/turf 7.4.0, sweetalert2 11.26.25, font-awesome 5.15.4, globe.gl 2.46.2 (เฉพาะโหมดปรับปรุง)

---

## 9. กติกาที่ใช้ตลอดทุกเฟส

### 9.1 พิกัดและซูม
- ภายในโค้ดใช้ `[lng, lat]` เสมอ (ลำดับของ GeoJSON และ MapLibre)
- ข้อมูลที่ยังเป็น `{lat, lng}` (เช่น `sw_loc.json`, `track_progress.json`) แปลงที่ตัวอ่านข้อมูลเท่านั้น
- ซูม MapLibre = ซูม Leaflet − 1 ค่าที่ย้ายมาจากโค้ดเดิมให้แปลงผ่าน `BPNP.geo.fromLeafletZoom(z)` เพื่อค้นหาและแก้ทีหลังได้ง่าย

### 9.2 Layer registry (หัวใจของเฟส 2–5)
- ทุกเลเยอร์ลงทะเบียนผ่าน `BPNP.map.registry.register(id, def)` ห้ามเรียก `map.addLayer` ตรงจากโมดูล
- ลำดับซ้อนใช้ “slot” คงที่: `basemap` → `raster-overlay` → `general` → `structure` → `progress` → `tools` → `labels`
- ทุกเลเยอร์มี `setVisible`, `setOpacity`, `bringToFront` (ภายใน slot) และอีเวนต์ `loaded`
- แผนที่ฐานทุกตัวอยู่ใน style เดียว สลับด้วย visibility (ห้ามใช้ `setStyle()` เพราะเลเยอร์ทับซ้อนจะหาย)

### 9.3 โครงข้อมูลเลเยอร์ (`layers_config.js`)
ต่อยอดจาก `LAYERS_CONFIG` เดิม เพิ่มช่องที่ MapLibre ต้องใช้

```js
{
  id: 'alTrack',
  name: 'Alignment Track (red)',
  category: 'general',            // general | structure | progress
  source: 'geojson/alignment/al_track.geojson',
  module: 'layers/alignment.js',  // โหลดเมื่อเปิดครั้งแรก
  minzoom: null,
  isDefault: true,
  hasOpacityControl: false,
  isControlVisible: true,
  phase: 2                        // ยังไม่ถึงเฟส → แสดง “ยังไม่รองรับ” ใน panel
}
```

### 9.4 ข้อความภาษาไทยบนแผนที่
- ทดสอบใน `tools/thai-label-test.html` (เฟส 0) ก่อนตัดสินใจ
- ถ้า symbol layer แสดงสระ/วรรณยุกต์ไม่ถูกต้อง: ป้ายสำคัญที่จำนวนไม่มาก (ชื่อสถานี, ป้ายสะพาน) ใช้ HTML marker ส่วนป้ายจำนวนมาก (หลัก กม.) ใช้ตัวเลข/อักษรละตินผ่าน symbol layer

### 9.5 เตรียมรองรับ 3D
- `js/map/terrain.js`: เปิด/ปิดภูมิประเทศ (DEM raster-dem) + ปุ่มเอียงแผนที่
- โครงข้อมูลโครงสร้าง (สะพาน, ตอม่อ) เก็บค่าความสูงเป็น property (`height_m`, `base_m`) ตั้งแต่ตอนแปลง GeoJSON เพื่อทำ `fill-extrusion` ได้ในภายหลัง

---

## 10. แผนเฟส ผูกกับโครงโฟลเดอร์

| เฟส | ขอบเขต | โฟลเดอร์/ไฟล์หลัก |
|---|---|---|
| 0 | โครง repo, config, GAS+Sheet+LIFF ใหม่, หน้าทดสอบป้ายไทย, ย้ายไฟล์/เปลี่ยนชื่อ | ราก, `js/config.js`, `js/boot/`, `js/core/`, `backend/gas/`, `tools/`, `assets/` |
| 1 | แกน MapLibre, แผนที่ฐาน, registry, layer panel, controls, ตำแหน่งฉัน, คลิกจุด (Sta/O/S) | `js/map/`, `js/ui/layer_panel.js`, `js/tools/my_location.js`, `js/tools/click_point.js`, `js/app.js` |
| 2 | KML→GeoJSON ตอน build, เลเยอร์สไตล์ตายตัว (Alignment, ROW, ย่านสถานี, กม., ถนน, Footing/Pier) | `tools/kml2geojson.js`, `data/geojson/`, `js/layers/` |
| 3 | แปลงเวนคืน + legend + ค้นหา, Underpass, Box Culvert, popup/tooltip | `js/layers/parcel/`, `js/layers/structure/`, `js/map/popup.js` |
| 4 | Bridge, หลัก กม. กรมทางหลวง, Track Progress, SW-LOC, ป้ายความสูง | `js/layers/structure/bridge*`, `js/layers/progress/` |
| 5 | MeasurePlus + ขุด/ถม, Routing (OSRM ตรง), ค้นหาที่อยู่, แปลง UTM | `js/tools/measure/`, `routing/`, `search/`, `utm/` |
| 3D | ภูมิประเทศ, เอียง/หมุน, extrusion โครงสร้าง | `js/map/terrain.js`, `js/layers/structure/` |

---

## 11. รายการค่าที่ฝังในโค้ดเดิมและต้องเปลี่ยน

| จุด | ค่าเดิม | จัดการอย่างไร |
|---|---|---|
| `auth.js` `AUTH_CONFIG.liffId` | `2007032148-uTzLx8Ed` | `config.liffId` (LIFF ใหม่) |
| `auth.js` `AUTH_CONFIG.gasUrl` | URL GAS เดิม | `config.gasUrl` (GAS ใหม่) |
| `auth.js` `IS_DEMO_SITE` | ดูจาก “-demo” ในโดเมน | `config.auth.strictMode` |
| `auth.js` `REDIRECT_ALLOWED_HOSTS` | ฝังในโค้ด | `config.auth.redirectHosts` |
| `index.html` `IS_UNDER_MAINTENANCE` | ฝังใน HTML | `config.maintenance` |
| `index.html` ข้อความ splash | “System Initialization v2.3” | อ่านจาก `version.json` |
| `main.js` คีย์ Tracestrack | ฝังใน URL tile | `config.keys.tracestrack` |
| คีย์ localStorage/cookie | `BPNP_*`, `bpnp_*` (13 คีย์) | `config.storagePrefix` |
| `manifest.json` | ชื่อ “BPNP MAP by Mr.Pairot”, theme `#0000ce` | ชื่อใหม่, สีเดียวกับ `<meta theme-color>` |
| `sw.js` ชื่อแคช | `bpnp-*` | `bpnp3d-*` |
| GAS `SPREADSHEET_ID`, `LINE_CHANNEL_ID`, `MAIN_SITE_URL` | ฝังในโค้ด | Script Properties |

---

## 12. ข้อควรระวังด้านความปลอดภัย

- URL ของ GAS และคีย์ tile ฝั่งหน้าเว็บเปิดเผยได้โดยธรรมชาติ ความปลอดภัยต้องอยู่ที่ GAS (ตรวจ ID Token + session)
- repo ต้องเป็น private (มี LIFF ID, GAS URL, ข้อมูลโครงการ)
- `Code.gs` ใน repo ห้ามใส่ Spreadsheet ID หรือรายชื่อ ALLOWED_IDS (อยู่ใน Script Properties เท่านั้น)
- ข้อความจาก Sheet/ผู้ใช้ที่นำไปแสดงเป็น HTML (ชื่อ LINE, ประกาศจาก Config) ต้อง escape ก่อนใส่ `innerHTML`

---

## 13. ผลการยืนยัน

1. ✔ repo ใหม่เป็น MapLibre อย่างเดียว (ยกเลิกระบบสลับ engine ในแผนเดิม)
2. ✔ LIFF ใหม่อยู่ใน LINE Login channel เดิม `2007032148`
3. ✔ `ACCESS_MODE` เริ่มต้นของ map3d: `allowlist`
4. ✔ ผู้ไม่มีสิทธิ์ redirect ไปเว็บหลัก (LIFF `2007032148-uTzLx8Ed`)
5. ✔ ใช้ชื่อ **VB118** (VD118 ไม่ย้าย)
6. ✔ เปลี่ยนชื่อรูปแปลงที่ดินเป็นอักษรละติน (`ท` → `T`) — โค้ด popup แปลงที่ดิน (เฟส 3) ต้องแปลงรหัสแปลงแบบเดียวกันก่อนประกอบ path
7. ✔ รูปแบบ classic script + namespace `BPNP` (ไม่ใช้ ES modules) — ดูผลกระทบในหัวข้อ 14.1
8. ✔ เลขเวอร์ชันเริ่ม `3.0.00`

---

## 14. สิ่งที่ปรับระหว่างทำเฟส 0–1

### 14.1 MapLibre v5 แทน v6
MapLibre GL JS v6 (ล่าสุด 6.15.0) แจกเฉพาะแบบ ES module ไม่มีไฟล์ classic script แล้ว
จึงใช้ **v5.24.0** ซึ่งเป็นรุ่นสุดท้ายที่โหลดด้วย `<script>` ได้ (API ที่ใช้ทั้งหมดมีใน v5)
ถ้าต้องการ v6 ในอนาคต ต้องเปลี่ยนการโหลดสคริปต์ทั้งระบบเป็น ES modules (ทำเป็นงานแยกได้)

### 14.2 แผงผู้ใช้ (รูปโปรไฟล์ / ออกจากระบบ)
ใน v2.4.01 แผงนี้ถูกซ่อนโดยไม่ตั้งใจ (HTML ขาดเครื่องหมาย `"` ทำให้ `display:none` มีผล)
แก้ markup ให้ถูกแล้ว แต่คงการซ่อนไว้เหมือนเดิม เปิดได้ที่ `config.ui.showUserPanel = true`
ปุ่ม "รีเซ็ตระบบ / ล็อกอินใหม่" ที่มุมล่างซ้ายยังเป็นทางออกจากระบบหลัก (และแจ้ง GAS ให้เพิกถอน session)

### 14.3 ไฟล์ที่ไม่ได้ย้าย
- `css/pwa.css` — ปุ่มติดตั้ง PWA ไม่มีโค้ดใดสร้างแล้ว (เหลือแค่ใน `map_ui.js` ที่ไม่ได้ใช้)
- `img/scale.png` — ไม่มีโค้ดใดใช้
- แผงค้นหาเส้นทาง/แปลงพิกัด (`#control-panel`) ใน `buildMapDOM` — ย้ายไปพร้อมเครื่องมือในเฟส 5

### 14.4 พฤติกรรมใหม่ในเฟส 1
- เลเยอร์ raster ซ้อนทับ (ผังที่ดิน, ผังเมือง, Traffic) อยู่ใน slot `raster-overlay` ใต้เลเยอร์เวกเตอร์เสมอ
- แผนที่ OpenFreeMap: ถ้าโหลด style ไม่ได้ (ออฟไลน์ครั้งแรก) จะแสดง "ออฟไลน์" ในรายการและใช้ OSM แทน
- การตั้งค่าเลเยอร์เก็บที่คีย์ `bpnp3d_map_settings` (ค่าของเลเยอร์ที่ยังไม่รองรับถูกเก็บไว้ไม่หาย)
- เปิดบน `localhost` / `127.0.0.1` จะข้ามการล็อกอินอัตโนมัติ (สำหรับพัฒนา)

### 14.5 การทดสอบที่ทำแล้ว
- **GAS:** ทดสอบด้วย runtime จำลอง 24 กรณี ผ่านทั้งหมด (login, allowlist/redirect, token ไม่เก็บแบบเปิด, หลายเครื่อง, blocked, logout, หมดอายุ, ถอดออกจาก allowlist, approval → อนุมัติ, open, คำสั่งผิด)
- **หน้าเว็บ (Chromium headless):** เปิดแผนที่, สลับแผนที่ฐาน raster ↔ vector, เปิดผังที่ดิน + ปรับความทึบ, ลำดับ slot, attribution, คลิกขวาได้ Sta/O/S จาก alignment 9,126 จุด, จดจำการตั้งค่าหลังรีโหลด, หน้า About (ประวัติ 11 รายการ)
- **ขั้นตอนล็อกอิน (LIFF/GAS จำลอง):** login ครั้งแรก, ตรวจ session ตอนเปิดใหม่, ออฟไลน์, รออนุมัติ, redirect ไปโดเมนที่ไม่อนุญาตถูกบล็อก, session หมดอายุ → ล็อกอินใหม่, ไม่มีสิทธิ์ → ไปเว็บหลัก
- **มือถือจำลอง (390×844, หน้าจอสัมผัส):** กดค้างนิ้วเดียว 2 วินาที → popup พิกัด, สองนิ้วไม่เปิด popup, ลากแผนที่ยกเลิกการกดค้าง, แตะปุ่มชั้นข้อมูล, ไม่แสดงปุ่มเต็มจอ, แถบล่างไม่ซ้อนกัน
- **โหมดปิดปรับปรุง:** แสดงหน้าปรับปรุง ไม่สร้างแผนที่ ไม่เริ่มล็อกอิน
- **แก้จากการตรวจรอบ 2:** popup จากการกดค้างถูกปิดทันทีโดย click ที่เบราว์เซอร์สร้างตามหลังการยกนิ้ว (เพิ่ม `ignoreClicksMs` ใน popup.js และข้ามเหตุการณ์เมาส์จำลองหลังการแตะ), ป้ายปุ่มหยุดพิกัดเขียน "Tab/Esc" แต่โค้ดใช้ Space/Esc มาตั้งแต่ v2.4.01 (แก้ป้ายเป็น Space/Esc), className ว่างของ popup ทำให้เกิด error
- **ยังไม่ได้ทดสอบ (ต้องทดสอบบนเครื่องจริงหลัง deploy):** tile จริงจากผู้ให้บริการ, LIFF/GAS จริง, ป้ายภาษาไทย (`tools/thai-label-test.html`), GPS บนมือถือ, Service Worker ออฟไลน์

### 14.6 เฟส 2 เริ่มจาก
1. `tools/kml2geojson.js` + เรียกจาก `tools/build.js` (ใช้ `data/kml/**` → `data/geojson/**`)
2. ตั้ง `supportedPhase: 2` ใน `js/config.js`
3. ลงทะเบียนเลเยอร์เฟส 2 ใน `js/layers/` ผ่าน `BPNP.map.registry.register()` ตาม `layers_config.js`
4. ใช้ผลจาก `tools/thai-label-test.html` ตัดสินใจรูปแบบป้ายชื่อสถานี/ตอม่อ

---

## 15. เฟส 2 (v3.1.00)

### 15.1 สิ่งที่ทำ
| ส่วน | ไฟล์ |
|---|---|
| แปลง KML → GeoJSON ตอน build | `tools/kml2geojson.js`, `package.json` (@tmcw/togeojson 7.1.2, @xmldom/xmldom 0.9.12), `tools/build.js` |
| ตัวช่วยเลเยอร์ (โหลดข้อมูล, กล่องป้าย, click popup, hover label, ลงทะเบียนโมดูล) | `js/layers/layer_utils.js` |
| Alignment Track, กม.ก่อสร้าง (+ แผงขนาดตัวเลข) | `js/layers/alignment.js` |
| เขตทางรถไฟ, แผนผังย่านสถานี, รายชื่อสถานี (+ การ์ด + YouTube) | `js/layers/railway.js`, `js/layers/video_links.js` |
| ผังถนน Service/Access | `js/layers/road.js` |
| Footing VB45–VB118 + ป้าย Pier (ปุ่ม "Pier" ในแผงชั้นข้อมูล) | `js/layers/structure/footing.js`, `js/ui/layer_panel.js` |
| CSS | `css/layers/layers.css`, `css/layers/structure_popup.css` |
| registry: hook `afterBuild` (ผูก click/hover หลังเลเยอร์มีจริง) | `js/map/layer_registry.js` |

กติกาซูมทั้งหมดคงตามเวอร์ชันเดิม (แปลงผ่าน `U.z()` = ซูม Leaflet − 1)

### 15.2 ข้อค้นพบสำคัญ: Polygon จาก CAD
KML ที่ส่งออกจาก CAD ใส่ชิ้นงานแยกกันไว้เป็น inner ring ทั้งที่อยู่นอก outer ring (พบ 10,634 จุด ใน ถนน, สะพาน, overpass, box culvert, แปลงที่ดิน)
Leaflet วาดด้วย even-odd จึงดูปกติ แต่ MapLibre ถือเป็นรู → พื้นของทั้งรูปหายและคลิกไม่ได้
**แก้ที่ตัวแปลง:** จัด ring ใหม่ตามความลึกการซ้อน (คู่ = รูปทรง, คี่ = รูของวงที่ครอบใกล้ที่สุด) หลังแก้เหลือรูผิดตำแหน่ง 0
ข้อดี: แก้ครั้งเดียวที่ build ใช้ได้กับทุกเลเยอร์ในเฟส 3–4 ไม่ต้องแก้ไฟล์ KML ต้นฉบับ

### 15.3 ผลทดสอบป้ายภาษาไทย (`tools/thai-label-test.html`)
ทดสอบด้วยไฟล์ฟอนต์จริงของ MapLibre (Noto Sans Regular ช่วงอักษรไทย):
- อ่านได้ แต่ **วรรณยุกต์บนสระบนวางทับกันไม่ถูกต้อง** (ปั้น ฟื้น กี่ ญี่) — ป๊ะ น้ำ ข้าม ถูกต้อง
- **กติกา:** symbol layer ใช้กับตัวเลข/อักษรละตินเท่านั้น (กม., P12) ข้อความไทยใช้ HTML marker หรือแสดงใน popup
- ควรเปิดหน้าทดสอบบนมือถือจริงอีกครั้ง (ฟอนต์เดียวกัน ผลควรเหมือนกัน)

### 15.4 อื่น ๆ
- `css/structure_popup.css` เดิมมีบล็อกไม่มี selector ทำให้เบราว์เซอร์ข้ามกฎ `.bp-header` ตัดออกแล้ว → ตรวจหน้าตา popup สะพาน/ช่องลอดในเฟส 3–4
- `station_layout` ยังใหญ่ (8 MB GeoJSON, เส้น 98,299 เส้น) แต่โหลดเฉพาะตอนเปิดเลเยอร์และแสดงที่ซูม ≥ 13 ถ้าช้าบนมือถือจะพิจารณาลดความละเอียดตอน build
- เปิดบนเครื่องโดยไม่รัน build: ชั้นข้อมูลเฟส 2 จะโหลดไม่ได้ (ต้อง `npm install` + `node tools/build.js`) ส่วนดูพิกัด Sta/O/S ยังใช้ KML สำรองได้

### 15.5 ผลทดสอบ (Chromium headless)
เปิดชั้นข้อมูลครบ, ลำดับ slot ถูกต้อง, ป้าย กม. (ซูม 10: เฉพาะหาร 5 ลงตัว / ซูม 12.5: ทุก กม.), ป้าย Pier (ซูม 15.5: เฉพาะหาร 5 / 17.5: ทุกต้น), คลิกถนนเปิด popup, การ์ดสถานี (กม. จาก KML + ปุ่ม YouTube), ปุ่ม Pier จำค่าหลังรีโหลด, ไม่มี error

### 15.6 เฟส 3 เริ่มจาก
แปลงเวนคืน (polygonLand + pay_out + legend + ค้นหา + แผงล่าง), Underpass, Box Culvert — ย้าย `setPatternLegend*.js`, `setUnderpassLegend.js`, `bottomPanel.js`, ส่วน box ของ `openYoutubeByKM_box.js` และ popup engine

---

## 16. v3.1.01 — ตรวจสอบปัญหาเปิดแผนที่ไม่ได้

อาการ: ล็อกอินผ่านแล้ว แต่ขึ้น "เกิดข้อผิดพลาดในการโหลดระบบแผนที่" (หน้าเดิมไม่บอกสาเหตุ)
ทดสอบกับ style จริงของ OpenFreeMap แล้วทำงานปกติ จึงน่าจะเป็นสาเหตุเฉพาะอุปกรณ์/เครือข่าย

สิ่งที่เพิ่มใน `js/boot/auth.js`:
- แบ่งขั้นตอนการเปิดแอป (ตรวจ WebGL → สคริปต์ → CSS → ไลบรารีแผนที่ → สคริปต์แอป → สร้างแผนที่ → สร้างปุ่ม) และระบุขั้นที่ล้มเหลว
- หน้าข้อผิดพลาดมี "รายละเอียดสำหรับผู้ดูแลระบบ" (ขั้น, ข้อความ error, เวอร์ชัน, User-Agent) + ปุ่มคัดลอก
- บันทึก `App Error` ลงแท็บ EventLog ของ Sheet อัตโนมัติ (ดูได้โดยไม่ต้องขอภาพหน้าจอ)
- ตรวจ WebGL 2 ก่อนสร้างแผนที่ (MapLibre v5 ต้องใช้ — Leaflet เดิมไม่ต้อง) แจ้งให้ลอง Chrome/Safari ล่าสุด
- รอ MapLibre จาก jsDelivr 20 วินาที ถ้าไม่มาโหลดจาก unpkg (เวอร์ชันเดียวกัน — `BPNP.boot.MAPLIBRE_VERSION` ใน `js/boot/loader.js` ต้องตรงกับ `index.html`)

อื่น ๆ: `js/map/basemaps.js` เลือกฟอนต์ป้ายแบบ Regular (style จริงทำให้ได้ Italic), `js/config.js` ใส่ LIFF ID และ GAS URL จริง

---

## 17. v3.1.02 — ไฟล์ชั้นข้อมูลหายไม่ทำให้แอปเปิดไม่ได้

รายงานจากเครื่องจริง: `ขั้น: โหลดสคริปต์แอป — โหลดสคริปต์ไม่สำเร็จ: js/layers/structure/footing.js` (build fbb14496)
→ เซิร์ฟเวอร์ไม่มีไฟล์นี้ (น่าจะไม่ได้ขึ้นไปบน GitHub เพราะอยู่ในโฟลเดอร์ย่อยซ้อน) และไฟล์เดียวทำให้ทั้งแอปเปิดไม่ได้

แก้:
- `js/boot/app_manifest.js` แยกเป็น `APP_SCRIPTS` (ขาดไม่ได้), `LAYER_SCRIPTS` (ขาดได้), `APP_MAIN` (app.js โหลดหลังสุด)
- `js/boot/auth.js` โหลด `LAYER_SCRIPTS` แบบไม่ล้มทั้งชุด — ไฟล์ที่ล้มบันทึก `App Warning` ลง EventLog + แจ้งเตือนสั้น ๆ
- `js/ui/layer_panel.js` ชั้นที่โมดูลโหลดไม่ได้แสดง "ไม่พร้อมใช้งาน" (กดไม่ได้) และไม่ลบค่าที่บันทึกไว้เดิม

**กติกาเพิ่ม:** เลเยอร์ใหม่ในเฟสถัดไปให้เพิ่มใน `LAYER_SCRIPTS` เสมอ (ไม่ใช่ `APP_SCRIPTS`)

---

## 18. v3.1.03 — "โหลด Alignment Track (red) ไม่สำเร็จ"

สาเหตุ: ไม่มี `data/geojson/alignment/al_track.geojson` บนเซิร์ฟเวอร์ — ไฟล์นี้ไม่อยู่ใน repo แต่ Netlify ต้องสร้างตอน build
(`npm install` → `node tools/build.js` → `tools/kml2geojson.js`) ถ้าขั้นนี้ไม่ทำงาน ชั้นข้อมูลเฟส 2 ทุกชั้นจะโหลดไม่ได้

ไฟล์ที่ต้องมีใน repo เพื่อให้แปลงได้: `package.json`, `package-lock.json`, `netlify.toml`, `tools/build.js`, `tools/kml2geojson.js`, `data/kml/**`
ตรวจใน Netlify → Deploys → Deploy log ต้องมีบรรทัด `✔ KML → GeoJSON: 28 ไฟล์`

แก้ในโค้ด:
- `js/map/layer_registry.js` เก็บ error ล่าสุดของแต่ละชั้น (`registry.lastError(id)`)
- `js/ui/layer_panel.js` ข้อความแจ้งเตือนบอกสาเหตุ (ไม่พบไฟล์ข้อมูล / ข้อความ error) + บันทึก `App Warning`
- `js/app.js` ตรวจตอนเปิดแอปว่า version.json มีไฟล์ `geojson/` ไหม ถ้าไม่มีบันทึก `App Warning` "deploy ไม่มี data/geojson"
- `tools/build.js` หยุด build พร้อมข้อความชัดเจนถ้าไม่พบไฟล์ KML ให้แปลง

---

## 19. v3.1.04 — หมุดสถานีแสดงตำแหน่งผิด

สาเหตุ: `css/layers/layers.css` กำหนด `position: relative` ให้ `.station-marker` ซึ่งเป็น element รากของ maplibregl.Marker
→ ทับ `position: absolute` ของ MapLibre หมุดจึงเรียงต่อกันลงมาเหมือนเนื้อหาหน้าเว็บ (สถานีที่ n เลื่อนลง 32 × n px)
แก้: ย้าย `position: relative` ไปที่ `.station-marker-inner` (element ด้านใน) — วัดซ้ำทั้ง 31 สถานี คลาดเคลื่อน 0 px

**กติกาเพิ่ม (เฟส 3–5):** HTML marker ห้ามกำหนด `position` / `transform` / `top` / `left` ที่ element ราก ให้ใช้ element ด้านในเสมอ

---

## 20. v3.1.05 — ผังถนนระบายสีผิดบางจุด (เช่น 16.063616, 102.899464)

สาเหตุ: CAD ส่งออกเส้นขอบซ้ำหลายชุด เช่น ผังถนน Sta. 20+625 มีเส้นขอบนอก 3 ชุด (136/173/241 จุด) และขอบใน 3 ชุด
Leaflet วาดแบบ even-odd: แถบถนนถูกครอบ 3 ครั้ง (คี่ = ระบาย) กลางวงถูกครอบ 6 ครั้ง (คู่ = ว่าง)
วิธี "ดูความลึกการซ้อน" ของ v3.1.00 ตัดสินจากขนาด ring ซึ่งผิดเมื่อ ring เกือบเหมือนกัน → ระบายกลางวงผิด

แก้ (`tools/kml2geojson.js`): คำนวณ even-odd แบบแม่นยำด้วย XOR ของทุก ring (แพ็กเกจ `polyclip-ts` 0.16.8 — ตัวเดียวกับที่ Turf ใช้)
- รูปทรงที่เสื่อมสภาพจนคำนวณไม่ได้ ลองใหม่โดยปัดพิกัดเป็น ~10 ซม. / ~20 ซม. / ~1 ม. (ข้อมูลปัจจุบันมี 3 รูปต้องปัด ทั้งหมดผ่าน)
- ถ้ายังไม่ได้ ใช้วิธีเดิมสำรอง และ Deploy log จะบอกชื่อไฟล์ + Sta. ให้ตรวจ
- ตรวจเทียบกับการวาดแบบ Leaflet: สุ่ม 34,800 จุด (service road) ต่างกัน 4 จุด (ห่างขอบระดับมิลลิเมตรจากการปัดพิกัด), access road 6,400 จุด ตรงทั้งหมด
- เวลา build บน Netlify เพิ่มเป็นราว 1.5–2 นาที (คำนวณ polygon ทั้งชุด รวมสะพาน/overpass ของเฟส 3–4)

---

## 21. เฟส 3 (v3.2.00) — แปลงเวนคืน, Underpass, Box Culvert

| ส่วน | ไฟล์ใหม่ | ย้ายมาจาก |
|---|---|---|
| แปลงเวนคืน + Pay Out (สี, popup + รูป, ชี้เมาส์, กะพริบ) | `js/layers/parcel/parcel.js` | `setPatternLegend.js`, `setPatternLegend_2.js`, `setPopup.js`, main.js |
| legend แปลงเวนคืน | `js/layers/parcel/parcel_legend.js` | `addPolygonLandLegend` |
| ค้นหารหัสแปลง | `js/layers/parcel/parcel_search.js` | เขียนใหม่แทน `leaflet-search.js` (970 บรรทัด) |
| แผงตารางด้านล่าง | `js/ui/bottom_panel.js` | `bottomPanel.js` |
| Underpass + Box Culvert + legend Underpass | `js/layers/structure/underpass_box.js` | `setupStructureLayer` (main.js), `setUnderpassLegend.js` |
| ป้ายความสูง + กล่องอธิบาย | `js/layers/structure/height_signs.js` | `HeightSignManager.js`, `HeightSignAlert.js` |
| YouTube ตาม กม. (+ เลือกเดือน) | `js/layers/video_links.js` (แก้) | `openYoutubeByKM_box.js` |
| CSS | `css/layers/legend.css`, `parcel.css`, `structure.css`, `css/ui/bottom_panel.css` | `legend.css`, `leaflet-search.css`, `box.css`, `bottomPanel.css` |

ตัวช่วยใหม่ใน `layer_utils.js`: `bboxCenter` (= getBounds().getCenter()), `legendStack` (ที่วาง legend มุมขวาบน), `htmlMarkerSet` (HTML marker แสดงเฉพาะในจอ + ตามซูม)
`namespace.js`: `BPNP.safeHtml()` — ข้อความจากข้อมูลที่มีแท็ก b/strong/i/em/u/br แสดงรูปแบบได้ ส่วนอื่น escape

### ข้อสังเกตจากโค้ดเดิม (ทำให้ผลลัพธ์เหมือนเดิม)
- การ "รวม ring" ของแปลงใน `processPolygonLayer` / `processPayOutLayer` ไม่เคยทำงานจริง (เงื่อนไขไม่ตรงกับข้อมูลที่ omnivore สร้าง) → ใช้รูปทรง even-odd จากตอน build
- สีข้อความ "สถานะหน้างาน" ใน popup เดิมกำหนดด้วยค่า object จึงไม่มีผล → คงสีปกติไว้
- `layer.openPopup()` จากการค้นหา/รายการเดิมไม่เปิด popup (ไม่ได้ bindPopup) → ตอนนี้เปิด popup ตามที่ตั้งใจ (ยืนยันในแผนเฟส 3 แล้ว)
- ข้อความ Status มีแท็ก `<b>`/`<br>` ในข้อมูล → แสดงด้วย `safeHtml`

### ผลทดสอบ (Chromium headless)
- แปลง: สีตามสถานะ, popup (กม.ประมาณ, สถานะ, หมายเหตุ, รูป 2 รูปของ ท3234.4 → `T3234.4_*.jpg`), คลิกบนแผนที่, legend (จำนวน/พื้นที่), [รายละเอียด] → แผงล่าง → กดแถว → ขอบแดง 2 วินาที (เริ่มนับหลังแผนที่วาดเสร็จ), ค้นหา (รายการแนะนำ, Enter, "ไม่พบข้อมูล"), ปิดชั้นแล้ว legend/ปุ่มค้นหาหาย
- Underpass/Box: ซูม 11.5 ไม่แสดง / 12.5 ป้ายชื่อ / 13.5 ป้ายชื่อ+กม. / 15.5 รูป+ชี้เมาส์, ป้ายห่างจุด 30 px ตรงตามเดิม, popup ธีมสี + ปุ่ม YouTube, legend Underpass
- ป้ายความสูง: อยู่เหนือจุด 27 px ตรงตามเดิม, ซ่อนเมื่อซูมต่ำ, กล่องอธิบายแสดง, บันทึกค่า, ทำงานแยกจากการเปิดชั้น Underpass
- HTML marker ทุกชนิดตรวจแล้วว่า element รากเป็น `position: absolute` (กติกาหัวข้อ 19)

### เฟส 4 เริ่มจาก
Bridge (`BridgeLayerManager3.js` — ใช้ `height_signs.js` กลุ่ม 'bridge'), หลัก กม. กรมทางหลวง (`DOH_ShowKM.js`), Track Progress (`tw_ProgressManager.js`), SW-LOC (`sw_loc_manager.js`)

---

## 22. v3.2.01 — ลำดับการทับซ้อนของชั้นข้อมูล

เดิม (Leaflet `_updateGeneralZIndex`): ชั้นข้อมูลทั่วไปทุกชั้นเรียงตามรายการ — บนสุดของรายการ = วาดบนสุด (รวม raster ผังที่ดิน/ผังเมือง) ชั้นที่ไม่แสดงในรายการอยู่ใต้สุด
v3.2.00 ผิดจากเดิม: ชั้นที่ติ๊กล่าสุดอยู่บนสุด และ raster ถูกบังคับไว้ใต้ชั้นเวกเตอร์เสมอ

แก้:
- `js/ui/layer_panel.js` — `applyGeneralOrder()` เรียงทุกหมวดตามรายการ (ชั้นที่ไม่แสดงในรายการอยู่ใต้สุด) เรียกทุกครั้งที่เปิดชั้น / ลากเรียง / เปิดแอป แทน `bringToFront`
- `js/layers/raster_overlays.js` — raster ย้ายเข้า slot `general` เพื่อเรียงร่วมกับชั้นเวกเตอร์

ทดสอบ: เปิด 5 ชั้นสลับลำดับ → ตรงรายการ / ลาก "เขตทางรถไฟ" ขึ้นบนสุด → ตรงรายการ / รีโหลด → ลำดับเดิมคงอยู่

ข้อจำกัด:
- หมุด HTML (รายชื่อสถานี) วาดเหนือแผนที่เสมอ ไม่ร่วมการเรียง
- ~~การลากเรียงบนจอสัมผัส~~ → เพิ่มใน v3.2.02 (หัวข้อ 23)

---

## 23. v3.2.02 — เรียงชั้นข้อมูลบนมือถือ + ไม่มีเมนูระบบเมื่อกดค้าง

- `js/ui/layer_panel.js` — กดค้าง 0.45 วินาทีที่ชั้นข้อมูลทั่วไป แล้วลาก (สั่นเบา ๆ เมื่อเริ่มลาก ถ้าเครื่องรองรับ)
  - การกดค้างเพื่อลาก **ไม่** เปิด/ปิดชั้นนั้น (กัน click ที่ตามมา) / แตะสั้นยังเปิด/ปิดตามปกติ
  - ขยับนิ้วก่อนครบเวลา = เลื่อนรายการตามปกติ / กดที่แถบความทึบ หรือปุ่มป้าย/Pier ไม่เริ่มลาก
  - ลากใกล้ขอบบน/ล่างของแผง รายการเลื่อนตาม · ปล่อยแล้วเรียงการทับซ้อนและบันทึกทันที
- ไม่มีเมนูของระบบ (บันทึกรูป/คัดลอก/เลือกข้อความ) เมื่อกดค้างที่: รายการชั้นข้อมูล, ปุ่มบนแผนที่, หมุดบนแผนที่ (สถานี/ป้ายความสูง/ป้ายโครงสร้าง), legend, แผงตารางล่าง, ช่องค้นหา
  (`js/ui/ui_manager.js`, `css/ui/layer_panel.css`, `css/map/maplibre_overrides.css`) — ตัวแผนที่เอง MapLibre กันไว้อยู่แล้ว

ทดสอบ (มือถือจำลอง 390×844, touch จริงผ่าน CDP): กดค้างลาก "ผังที่ดิน" ลง 3 ตำแหน่ง → ลำดับเปลี่ยน + บันทึก + ชั้นไม่ถูกติ๊ก / แตะสั้นเปิดชั้นได้ / ปัดเร็วไม่เริ่มลาก / เมนูระบบถูกกันทุกจุด / เดสก์ท็อปลากด้วยเมาส์ได้เหมือนเดิม

---

## 24. เฟส 4A (v3.3.00) — ระบบสะพาน

| ส่วน | ไฟล์ใหม่ | ย้ายมาจาก |
|---|---|---|
| ชั้น Bridge (3 ชุด), ป้าย, การ์ดความคืบหน้า | `js/layers/structure/bridge.js` | `BridgeLayerManager3.js` (ส่วนตั้งค่า/สไตล์/`buildProgressHTML` คัดลอกตรง) |
| ตารางความก้าวหน้างานสะพาน | `js/layers/structure/bridge_panel.js` | `BridgeBottomPanel.js` |
| แจ้งเตือนงานล่าช้า | `js/layers/structure/bridge_alert.js` | `Critical_Alert_Str.js` |
| CSS | `css/layers/bridge.css`, `css/layers/bridge_alert.css` | `BridgeBottomPanel.css`, สไตล์ที่ฝังใน `Critical_Alert_Str.js` |

ไฟล์ที่แก้: `height_signs.js` (จุดยึดแนวตั้งแยกตามกลุ่ม — Bridge ป้ายอยู่ใต้วงกลม), `popup.js` (เหนือจุด + autoPan เหมือน Leaflet), `ui_manager.js` (`leftColumnAdd` เรียงส่วนควบคุมคอลัมน์ซ้าย), `parcel_search.js` (ใช้คอลัมน์ซ้าย), `layers_config.js` (`phaseLabel` สำหรับ 4B), `layer_panel.js`, `config.js` (`supportedPhase: 4`), `app_manifest.js`

### พฤติกรรม (ตามเดิม)
- ซูม 10 (L11) วงกลม · 12–15 (L13–<16) ป้ายหมุน · ≥15 (L16) รูปสะพาน · Overpass ใช้พิกัดจากช่อง `Coordinate`
- เปิดชั้น → ตารางเปิดเอง + ปุ่ม Critical Alert แสดง / ปิดชั้น → ตารางปิด, ปุ่มซ่อน, ยกเลิกแจ้งเตือน
- ป้ายความสูงสะพาน (29 สะพานมีค่า height_limit) ทำงานแยกจากการเปิดชั้น เหมือน Underpass
- `bridge_all.kml` ไม่ถูกใช้ (คงไฟล์ไว้)

### สิ่งที่ต่างจากเดิม (ตั้งใจ)
- **popup ทุกชนิดอยู่เหนือจุดและเลื่อนแผนที่ให้เห็นทั้งใบ** — ค่าเริ่มต้นของ MapLibre พลิก popup ไปด้านที่มีที่ว่าง ทำให้การ์ดสะพานไปอยู่ใต้ตารางล่าง จึงทำให้เหมือน Leaflet (anchor bottom + autoPan)
- **CSS ของแจ้งเตือนล่าช้าจำกัดขอบเขต** — ต้นฉบับประกาศ `.group`, `.btn`, `.actions`, `input[type=range]` แบบ global ทำให้แถบเลื่อนอื่นในแอปถูกเปลี่ยนรูปไปด้วย
- **คอลัมน์ซ้ายเรียงอัตโนมัติ** — ปุ่ม Critical Alert อยู่ช่องที่ 3 ตามเดิม ปุ่มค้นหาแปลงเลื่อนลงช่องที่ 4 เมื่อแสดงพร้อมกัน

### ผลทดสอบ
102 สะพาน (เหล็ก 37 / คอนกรีต 30 / Overpass 35) · ตาราง 102 แถว + วันที่อัปเดต 27/09/2569 · ซูมทุกช่วงถูกต้อง · ป้ายหมุนอยู่ตรงจุด (0 px) · การ์ด 230 px + แถบ % + ปุ่ม YouTube · แท็บ Overpass 35 แถว → กดแถวบินไปซูม L18 + การ์ด · ป้ายความสูง 6.2 m ใต้วงกลม 28 px · แจ้งเตือนแดง 7 จุดตรงกับเกณฑ์ / ปิดเคสแดง → 0 + บันทึก · popup ใกล้ขอบล่างเปิดเหนือจุดและเห็นทั้งใบ

---

## 25. v3.3.01 — ลากเรียงด้วยนิ้ว/ปากกาไม่ได้บนเครื่องจริง (รายงานจาก v3.2.02)

อาการ: เมาส์ลากเรียงได้ แต่นิ้วสัมผัสและปากกาไม่ได้
สาเหตุ:
1. แถวยังมี `draggable="true"` (ไว้ให้เมาส์) — บน Android Chrome/WebView การกดค้างที่ element ที่ลากได้จะเริ่ม drag-and-drop ของระบบ แล้วยกเลิกลำดับการสัมผัส การลากของเราจึงหยุดทันที
2. ปากกาหลายรุ่น/ระบบส่ง Pointer Events แต่ไม่ส่ง Touch Events — โค้ด v3.2.02 ฟังเฉพาะ touch
3. การทดสอบเดิมใช้การสัมผัสจำลอง ซึ่งไม่เกิดข้อ 1 จึงไม่พบปัญหา

แก้ (`js/ui/layer_panel.js`, `css/ui/layer_panel.css`):
- เลิกใช้ HTML5 drag-and-drop ทั้งหมด ใช้ Pointer Events ชุดเดียวกับทุกอุปกรณ์ และติดตาม pointer ทั้งหน้าตั้งแต่กดจนปล่อย
- **ที่จับ ⋮⋮** หน้าแต่ละแถว (`touch-action: none`) — ลากได้ทันทีด้วยเมาส์/นิ้ว/ปากกา เบราว์เซอร์ไม่แย่งไปเลื่อนหน้า (ทางที่เชื่อถือได้ที่สุดทุกอุปกรณ์)
- เมาส์: กดที่แถวแล้วลากเกิน 5 px · นิ้ว/ปากกา: กดค้างที่แถว 0.45 วินาทีแล้วลาก (ขยับก่อน = เลื่อนรายการ)
- ระหว่างลากด้วยนิ้ว: กัน `touchmove` เพื่อไม่ให้หน้าเลื่อน · ลากเสร็จไม่เปิด/ปิดชั้น

ทดสอบ: เมาส์ลากแถว / คลิกแถว · ปากกา (pointerType pen) ผ่านที่จับ · นิ้วกดค้างแถว / ผ่านที่จับ / ปัดเร็ว / แตะ — ผ่านทั้งหมด
ข้อจำกัด: การกดค้าง "ที่แถว" ด้วยปากกาบนบางระบบ เบราว์เซอร์อาจเลื่อนหน้าแทน — ให้ใช้ที่จับ ⋮⋮

---

## 26. v3.3.02 — ตำแหน่งที่จับลากชั้นข้อมูล

| ค่า | 3.3.01 | 3.3.02 |
|---|---|---|
| ที่จับห่างขอบซ้าย panel | 14 px | 6 px (`margin-left: -8px` ชิดกรอบหมวดด้านใน) |
| ความกว้างที่จับ / ระยะถึงช่องติ๊ก | 16 px / 2 px | 8 px / 4 px |
| สัญลักษณ์ | ⋮⋮ (บีบ letter-spacing −3px) | ⋮ (จุดแถวเดียว, letter-spacing 0) |
| ช่องติ๊กเริ่มที่ | 32 px | 18 px |

ระยะ 14 px เดิมมาจาก `.layer-content` padding 5 + กรอบ `.layer-section` 1 + `.layer-list` padding 8 — การปรับ width/margin-right ของที่จับไม่เปลี่ยนระยะนี้ จึงใช้ margin-left ติดลบเฉพาะที่จับ (หมวดอื่นไม่เปลี่ยน)
ทดสอบ: แตะกลางสัญลักษณ์โดนที่จับ (ไม่โดนช่องติ๊ก) · เมาส์/ปากกา/นิ้ว ลากได้ทุกแบบ · แตะ/คลิกแถวติ๊กได้ตามปกติ

---

## 27. v3.3.03 — ลายเส้นโครงสร้างขาดหาย (รายงาน: Overpass)

### สาเหตุ (2 อย่าง ทั้งคู่อยู่ที่ตัวแปลง)
1. **XOR ใช้ทั้ง "พื้น" และ "เส้น"** — Leaflet วาดเส้นขอบของ *ทุก* ring แต่พื้นใช้ even-odd การใช้รูป XOR รูปเดียว (v3.1.05) ทำให้เส้นที่ CAD วาดซ้ำเป็นจำนวนคู่หายไปพร้อมพื้น
2. **ring 2–3 จุด** (เส้นที่ CAD ส่งออกเป็น polygon เช่น A→B→A) — togeojson ทิ้งไป แต่ Leaflet วาดเป็นเส้น

ลายเส้นที่ขาดจริง (วัดทุก 1 ม. ตามเส้นเดิม ระยะคลาดเคลื่อน 0.3 ม.):

| ไฟล์ | ก่อนแก้ | หลังแก้ |
|---|---|---|
| Overpass | 33.1% | 0% |
| Underpass | 29.7% | 0% |
| สะพานเหล็ก | 14.0% | 0% |
| Box Culvert | 3.8% | 0% |
| ถนน / สะพานคอนกรีต / แปลงที่ดิน / Footing | ~0% | 0% |

### วิธีแก้
- `tools/kml2geojson.js`: รูปที่ XOR ทำให้เส้นขอบเปลี่ยน → รูปพื้นติด `_fillOnly: true` + เพิ่ม feature เส้นขอบเดิมทุก ring (`_outline: true`, MultiLineString) **ต่อท้ายไฟล์** (index ของรูปหลักไม่เปลี่ยน) · อ่าน ring 2–3 จุดจาก KML โดยตรงเก็บเป็นเส้น
- ชั้นเส้นทุกชั้นกรอง `_fillOnly` ออก (`road.js`, `footing.js`, `parcel.js`, `underpass_box.js`, `bridge.js`) · ข้อมูล/legend/ค้นหา/จำนวน ไม่นับ `_outline`

### กติกาเพิ่ม (เลเยอร์ polygon ในอนาคต)
- ชั้น `line` ของ source ที่มาจาก KML polygon ต้องมี filter `['!=', ['get', '_fillOnly'], true]`
- ชั้น `fill` ต้องมี filter `['!=', ['get', '_outline'], true]` (เพิ่มใน v3.3.05 — ดูหัวข้อ 29)
- โค้ดที่นับ/ค้นหา/สร้างจุดจาก feature ต้องข้าม `properties._outline`

### ผลข้างเคียง
ข้อมูล GeoJSON รวมเพิ่มจาก 35 เป็น 53 MB ส่วนใหญ่ที่ Overpass และสะพานเหล็ก (โหลดเฉพาะตอนเปิดชั้น Bridge และเก็บแคชในเครื่อง)

### ผลทดสอบ
วัดลายเส้นหลังแก้ 0% ขาดทุกไฟล์ · ภาพ Overpass ซูมใกล้ตรงกับการวาดเส้นจาก KML เดิมทุกเส้น · จำนวนสะพาน 102, แปลง 4,972 (เข้าได้ 4,310), Underpass 115, Box 138 เท่าเดิม

---

## 28. v3.3.04 — ปุ่มค้นหาแปลงที่ดินแบบเดิม

เดิม (Leaflet): `L.Control.Search` ตำแหน่ง `topright` เพิ่มก่อน legend → มุมขวาบน ลำดับ ปุ่มเต็มจอ → ช่องค้นหา → legend
ปุ่ม 26×26 รูป `search-icon2.png` (sprite 40×121 แสดง 20×60.5: ปกติ / ชี้เมาส์ / ยกเลิก) · กดแล้วมีช่องพิมพ์ 113 px ขอบน้ำเงินทางซ้าย + รายการแนะนำสีเทา
v3.2.00–3.3.03 ทำเป็นปุ่มมาตรฐานคอลัมน์ซ้ายใช้รูป `search.png` → ผิดจากเดิม

แก้:
- `js/layers/parcel/parcel_search.js` เขียนใหม่ให้หน้าตา/พฤติกรรมเหมือน leaflet-search อยู่ในที่วาง legend มุมขวาบน (บนสุด) แสดงเฉพาะตอนเปิดชั้นแปลงเวนคืน
- `css/layers/parcel.css` สไตล์ตาม `css/leaflet-search.css` เดิม (ใช้ `assets/ui/search-icon-2.png`)
- `js/layers/parcel/parcel.js` วาง legend ใต้ช่องค้นหา
- เลิกใช้ช่องคอลัมน์ซ้าย → `assets/ui/search.png` และช่องบนสุดคอลัมน์ซ้าย สงวนไว้สำหรับปุ่มค้นหา กม. (เฟส 5)

ทดสอบ: ลำดับมุมขวาบน [ช่องค้นหา, legend] · ปุ่ม 26×26 รูปโหลดได้ · พิมพ์ "ท3234" ได้รายการ · Enter → popup ท3234 · "zzz" → ไม่พบข้อมูล · ยกเลิกแล้วย่อ · ปิดชั้นแล้วช่องค้นหาหาย

---

## 29. v3.3.05 — เงาระบายสีผิดบางระดับซูม (รายงาน: Overpass กม. 35+079)

ตรวจโดยเทียบภาพแอปกับภาพอ้างอิงที่วาดจาก KML เดิมแบบ Leaflet (แต่ละ `<Polygon>` = 1 path, even-odd, ทึบ 30%) ที่ซูม 15.2 / 16 / 16.8 / 17.6
และแยกวาดชั้น fill / line / fill เดี่ยว ๆ เพื่อหาต้นเหตุ

### สาเหตุ (3 อย่าง)
1. **ชั้น fill รับ feature เส้น** (ต้นเหตุหลัก) — v3.3.03 ใส่เส้นขอบแยก (`_outline`, MultiLineString) ใน source เดียวกับพื้น แต่ชั้น fill ของ MapLibre ไม่ข้ามเส้น: ปิดเส้นเป็นวงแล้วระบายสี → ลิ่ม/เส้นเกิน
2. **ทิศทาง ring ปนกัน** — MapLibre แยกขอบนอก/รูจากทิศทางการวน ring (หลังตัด tile ไม่ได้ใช้กลุ่ม polygon ของ GeoJSON) ข้อมูล CAD + ผล XOR มีขอบนอกวนสลับทิศ (เช่น 35+079: ทวนเข็ม 5 ชิ้น ตามเข็ม 1 ชิ้น) ชิ้นที่กลับทิศจะถูกอ่านเป็นรู
3. **เศษบางจาก XOR** — เส้นขอบที่ CAD วาดซ้ำแบบเกือบทับกันเหลือแถบกว้างระดับมิลลิเมตร (Overpass 25,556 ชิ้น, สะพานเหล็ก 18,423 ชิ้น) MapLibre วาดขอบ anti-alias 1 px รอบทุกชิ้น

### วิธีแก้
- ชั้น fill ทุกชั้นกรอง `_outline` ออก (`road.js`, `footing.js`, `parcel.js`, `underpass_box.js`, `bridge.js`)
- `tools/kml2geojson.js`: จัดทิศทาง ring ทุก polygon ตาม RFC 7946 (ขอบนอกทวนเข็ม / รูตามเข็ม — กลับทิศ 15,337 วง) · ตัดเศษจาก XOR ที่กว้างเฉลี่ย < 5 ซม. (94,498 ชิ้น) โดยไม่ทำให้รายการใดหายทั้งรูป

### ผลทดสอบ
- ภาพ 35+079 ทั้ง 4 ระดับซูมตรงกับภาพอ้างอิง (ไม่มีลิ่ม/เส้นเกิน/เงาเข้มผิด)
- พื้น 35+079 เทียบ even-odd ของ Leaflet 4,000 จุด: ต่างกัน 0 · ถนน 34,800 จุด: ต่าง 3 (ชิดขอบ) · Box Culvert 55,200 จุด: ต่าง 31 จุด ทุกจุดห่างเส้นเดิม ≤ 4 มม.
- เส้นขอบยังครบ 0% ขาดทุกไฟล์ · จำนวนแปลง/โครงสร้างเท่าเดิม · ทุกชั้น fill/line แสดงผลและคลิกได้
- ข้อมูล GeoJSON รวมลดจาก 53 เป็น 41 MB

---

## 30. เฟส 4B (v3.4.00) — หลัก กม. ทล., Track Progress, SW-LOC

| ส่วน | ไฟล์ใหม่ | ย้ายมาจาก |
|---|---|---|
| หลัก กม. กรมทางหลวง + ปุ่ม "กม. ทล." | `js/layers/doh_km.js`, `css/layers/doh_km.css` | `DOH_ShowKM.js`, `DOH_ShowKM.css` |
| Track Progress (กราฟ + ปุ่มลัด + ควบคุมชั้น กม.ก่อสร้าง) | `js/layers/progress/track_progress.js`, `css/layers/track_progress.css` | `tw_ProgressManager.js` (คัดลอก), `tw_progress.js` |
| SW-LOC หมุด/การ์ด/tooltip | `js/layers/progress/sw_loc.js`, `css/layers/sw_loc.css` | `sw_loc_manager.js` |
| SW-LOC ตาราง + แผงสรุป | `js/layers/progress/sw_panel.js`, `sw_summary.js`, `css/layers/sw_panel.css` | `sw_LocBottomPanel.js`, `sw_summary_panel.js` (คัดลอก), `sw_bottomPanel.css` |

แก้: `layer_utils.js` (กล่องป้ายมีขอบ), `layers_config.js` (phase 4), `layer_panel.js` (ชั้นที่ไม่อยู่ในรายการไม่บันทึกสถานะ), `app_manifest.js`

### หมายเหตุการย้าย
- **หลัก กม.**: เดิมวาดด้วย canvas + grid และจำกัดป้าย ≤ 600 อันเพราะช้า → ใช้ circle + symbol layer ของ MapLibre แสดงครบทั้ง 52,854 จุด ป้ายเป็นตัวเลขล้วน (ใช้ symbol ได้) ฟอนต์ Noto Sans Bold
- **Track Progress**: คลาส ProgressManager คัดลอกตรง แก้เฉพาะ path ข้อมูลและการตรวจ "อยู่ในจอ" · ชั้นในรายการ ปุ่มลัด และปุ่มปิดในแผง ทำงานผ่านช่องติ๊กเดียวกัน
- **SW-LOC**: ใช้ alignment ชุดเดียวกับ Sta/O/S (เดิมโหลด KML ซ้ำ) · หมุดเป็น HTML marker ราก `.sw-loc-marker` (ไม่มี position/transform) · แผงตารางเดิมใช้ต่อได้ผ่านตัวแทนหมุด (getLatLng / getElement / openPopup / closePopup / isPopupOpen)

### ผลทดสอบ
- หลัก กม.: ปุ่มมุมขวาล่าง · ซูม 9.5 ไม่แสดง / 10.5 จุด / 12.5 จุด + ป้าย · ไม่บันทึกสถานะ · ปิดได้
- Track Progress: ปุ่มลัด → แผง + เปิด กม.ก่อสร้างให้ · ปิด → คืน กม.ก่อสร้างเป็นปิด · เปิดจากรายการได้ · รีโหลดแล้วเปิดค้างตามเดิม · กราฟแสดง กม. 49–63 ตรงกับจอ
- SW-LOC: 216/216 ตู้ ตำแหน่งคลาดเคลื่อน ≤ 1 px · ตาราง 216 แถว + แท็บ 10 ช่วง + แผงสรุป · กดแท็บซูมพอดี · กดแถว → ซูม L18 + การ์ดขั้นงาน · ชี้เมาส์ → STA/ชื่อ · ปิดชั้นแล้วหมุด/แผงหายครบ

---

## 31. v3.4.01 — ปุ่ม "ป้าย" ของ Bridge ไม่แสดงป้าย (เก็บตก 4A)

ตรวจแล้ว: ป้ายของสะพาน (`bridge_progress.json` → height_limit 29 สะพาน) แสดงถูกต้องที่ซูม ≥ 13 (Leaflet 14) ตามเดิม
แต่เวอร์ชันเดิมปุ่มเดียวกันยังเปิด **ป้ายความสูงภาคสนาม 64 ป้าย** จาก `signs.json` (`mark_Sign.js` → `SignLayerManager`) ซึ่ง v3.3.00 ไม่ได้ย้าย → ผู้ใช้จึงไม่เห็นป้ายส่วนใหญ่

แก้:
- `core/alignment.js` เพิ่ม `pointAt(sta, offset)` — สูตรเดียวกับ `mark_Sign.js` / `sw_loc_manager.js` (สัดส่วนระหว่างจุด 20 ม. + bearing + ระยะบนทรงกลม)
- `structure/height_signs.js` จุดยึดแนวตั้งรายป้าย + tooltip เมื่อป้ายมีคำอธิบาย
- `structure/bridge.js` ลงทะเบียนกลุ่ม `field` จาก `json/height_signs.json` (offset < 0 ป้ายเหนือจุด, อื่น ๆ ใต้จุด, status 0 ตัวเลขแดง)
- `ui/layer_panel.js` ปุ่ม "ป้าย" ของ Bridge เปิด/ปิดทั้งกลุ่ม `bridge` และ `field`

ทดสอบ: พิกัด 64/64 ป้ายเทียบสูตรเดิมที่รันบน KML ต้นฉบับ ต่างกัน 0.0000 ม. · ป้าย offset −49.57 อยู่เหนือจุด 27 px, offset +48.81 อยู่ใต้จุด 27 px · status 0 ตัวเลขแดง · ปุ่มเปิด/ปิดทั้งสองกลุ่ม + บันทึกค่า
หมายเหตุ: ข้อมูลปัจจุบันไม่มีป้ายที่ใส่คำอธิบาย (tooltip จะแสดงเมื่อเพิ่ม `description` ใน `data/json/height_signs.json`)
อื่น ๆ: `css/layers/track_progress.css` มี `@import` ฟอนต์ Google — ถ้าเครือข่ายบล็อก Google Fonts จะมีคำเตือน "โหลด CSS ไม่สำเร็จ" ใน console แต่สไตล์ยังทำงาน (เหมือนเวอร์ชันเดิม)

---

## 32. v3.4.02 — ปุ่มปิดกล่อง "ข้อมูลป้ายความสูงช่องลอด"

- `structure/height_signs.js`: ปุ่ม × มุมขวาบน (28×28 px) → ปิดกล่องทันทีและยกเลิกตัวนับ 20 วินาที · ป้ายบนแผนที่ยังแสดงตามเดิม · กล่องแสดงอีกครั้งเมื่อเปิดปุ่ม "ป้าย" ครั้งถัดไป
- กล่องยังเป็น `pointer-events: none` (ไม่บังการใช้แผนที่) เปิดให้กดได้เฉพาะปุ่มปิด
- ทดสอบ: เมาส์และแตะนิ้ว · กดปิดแล้วไม่เปิด popup/ดูพิกัดบนแผนที่ด้านล่าง · ส่วนอื่นของกล่องยังส่งการแตะผ่านไปที่แผนที่

---

## 33. เฟส 5A (v3.5.00) — ค้นหา กม. และการแบ่งเฟส 5 ใหม่

### แบ่งเฟส 5 ใหม่
ตรวจโค้ดเดิมพบว่าปุ่มค้นหาเส้นทาง (`routing_ui.js` / `routing_main.js`) เป็น **แผงศูนย์กลาง 5 โหมด** ที่ใช้แผงและการรีเซ็ตร่วมกัน: เส้นทาง OSRM, หาตำแหน่งจากพิกัด, ค้นหาที่อยู่ (`search_address.js`), แปลง UTM (`convertUTM.js`), แปลง UTM หลายแถว (`convertUTM_MultiRow.js`) — ต้องย้ายพร้อมกัน
| ส่วน | เนื้อหา | เวอร์ชัน |
|---|---|---|
| 5A | ค้นหา กม. | 3.5.00 |
| 5B | แผงค้นหา/พิกัด 5 โหมด | ถัดไป |
| 5C | วัดระยะ/พื้นที่ + ปริมาตรบ่อขุด/ดินถม (mp, mpex, mpem ~4,000 บรรทัด) | ถัดไป |

### 5A
- `js/tools/tool_utils.js` (ใหม่) ตัวช่วยร่วมของเครื่องมือ: หมุด, บิน, ซูมพอดี, วงกระเพื่อม, popup, ดาวน์โหลดไฟล์, กันคลิกทะลุแผนที่
- `js/tools/search_km.js` + `css/tools/search_km.css` (เดิม `search_sta.js`, `search_sta.css`)
  - ปุ่ม `assets/ui/search.png` คอลัมน์ซ้ายแถวบนสุด · แผงติดขวาปุ่ม (เดิมตำแหน่งตายตัว 5px/60px → ใช้พื้นที่ปลอดภัยของจอ)
  - รายการแนะนำจากจุด alignment 20 ม. (สูงสุด 20) · Enter ค้นหาได้ · ตรวจรูปแบบ 0+000
  - หมุดสีฟ้า (SVG เดิม) ปลายหมุดตรงจุด · บินซูม Leaflet 14 · วงกระเพื่อมหลัง 2 วินาที · ปิดแผงแล้วลบหมุด/หยุดวงกระเพื่อม
  - id ปุ่มปิดเปลี่ยน `closeBtn` → `staCloseBtn` (ชื่อเดิมกว้างเกินไป ชนได้ง่าย)
- เครื่องมือเฟส 5 อยู่ใน `LAYER_SCRIPTS` (ไฟล์หายแอปยังเปิดได้)
- `js/config.js` เพิ่ม `keys.longdoServices` (ค่าเดิมจาก `search_address.js` / `routing_main.js`) สำหรับเฟส 5B

ทดสอบ: ปุ่มที่ (10,10) เหนือปุ่มชั้นข้อมูล · พิมพ์ "10+5" ได้ 20 รายการ (10+500 …) · เลือกแล้วปลายหมุดตรงจุด 0 px, ซูม 13 (= L14), วงกระเพื่อมทำงาน · "10500" → แจ้งรูปแบบ · ปิดแล้วหมุด/วงกระเพื่อมหาย

---

## 34. เฟส 5B (v3.6.00) — แผงค้นหา/พิกัด

| ส่วน | ไฟล์ใหม่ | ย้ายมาจาก |
|---|---|---|
| แผง 5 โหมด + เส้นทาง + ที่อยู่จากพิกัด | `js/tools/search/hub.js`, `css/tools/search_hub.css` | `routing_ui.js`, `routing_main.js`, `routing_style.css`, markup ใน `ui_manager.js` |
| ค้นหาพิกัดจากที่อยู่ | `js/tools/search/address.js`, `css/tools/search_address.css` | `search_address.js` |
| แปลง UTM ทีละจุด | `js/tools/search/utm_convert.js`, `css/tools/utm_convert.css` | `convertUTM.js` |
| แปลง UTM หลายแถว | `js/tools/search/utm_multi.js`, `css/tools/utm_multi.css` | `convertUTM_MultiRow.js` (คัดลอก แก้เฉพาะคำสั่งแผนที่) |

### หมายเหตุการย้าย
- **เส้นทาง**: เดิมใช้ Leaflet Routing Machine → เรียก OSRM (`router.project-osrm.org`) โดยตรง ได้เส้นทางหลัก + สำรองสูงสุด 2 เส้นเหมือนเดิม · สี/ความหนาเดิม (หลัก: ขาว 10 + น้ำเงิน 5, สำรอง: ขาว 8 + แดง/ส้ม 4) · popup สรุปกลางเส้น · ลากหมุดแล้วคำนวณใหม่ · Export KML เส้นทางหลัก
- ขณะอยู่ในโหมดเส้นทาง การคลิกแผนที่ใช้วางจุด — ลงทะเบียน `BPNP.tools.registerBusy()` ชั้นข้อมูล/ดูพิกัดจึงไม่เปิด popup ทับ
- คีย์ Longdo อ่านจาก `config.keys.longdoServices`
- **แก้จากเดิม**
  - `convertUTM_MultiRow.js` เรียก `createTxtMarker()` ซึ่งไม่มีในโค้ด → กรอกข้อมูลแล้วเกิด error ไม่มีหมุด และปุ่มซูมแท็บ UTM ไม่ทำงาน → เพิ่มหมุดเลขแถว (วงกลมน้ำเงิน)
  - `search_address.js` เพิ่มตัวฟังเหตุการณ์ซ้อนทุกครั้งที่เลือกจังหวัด/อำเภอ และแสดงข้อความค้นหาโดยไม่ escape → แก้ทั้งสองจุด
  - CSS เดิมมีกฎ `.leaflet-popup-content` แบบ global ใน routing_style.css → ตัดออก (ไม่มีผลกับ MapLibre)

### ผลทดสอบ (บริการภายนอกจำลองด้วยข้อมูลรูปแบบเดียวกับของจริง)
ปุ่มแถวบนช่อง 2 · เส้นทาง 3 คลิก = เริ่ม/ทางผ่าน/จุดหมาย, เส้นหลัก + สำรอง 2, popup 3, Export KML, ลบทางผ่าน, รีเซ็ต · ที่อยู่จากพิกัด + หมุด · ค้นหาที่อยู่ 2 ผลลัพธ์ + หมุด, ซูมไม่ใกล้กว่า L10 · UTM ไป-กลับได้พิกัดเดิม (16.078196, 102.811826 ↔ 48N E 265,926.593 N 1,778,823.335) · วางจาก Excel 4 แถว → หมุด 1–4 · ปุ่มซูมแท็บ UTM ทำงาน · ปุ่ม ✖ ล้างทุกอย่าง

---

## 35. เฟส 5C (v3.7.00) — เครื่องมือวัด + ปริมาตรบ่อขุด/ดินถม

### แนวทาง: Leaflet ชุดย่อยบน MapLibre (`js/tools/measure/lcompat.js`)
`mp.js` / `mpex.js` / `mpem.js` รวม ~4,000 บรรทัด ส่วนใหญ่เป็นตรรกะเรขาคณิต, UI, นำเข้า/ส่งออก และคำนวณปริมาตร แต่ใช้ Leaflet เพียง ~25 คำสั่ง
→ เขียน Leaflet ชุดย่อยเฉพาะคำสั่งที่ใช้จริง แล้วใส่ไฟล์เดิมทั้งไฟล์ไว้ใน `(function (L) { … })(BPNP.tools.lcompat.L)`
- ไม่ประกาศ `window.L` · ทั้งสามไฟล์คุยกันผ่าน `window.*` อยู่แล้ว (ตรวจแล้วไม่มีการเรียกชื่อฟังก์ชันข้ามไฟล์โดยตรง)
- ระยะทาง/การฉายแผนที่ใช้สูตรเดียวกับ Leaflet (`distanceTo` R = 6,371,000 · EPSG:3857 R = 6,378,137) → ผลวัดเท่าเดิม
- เส้น/รูปทั้งหมดอยู่ใน source `src-measure` ใน slot `tools` · class ที่เดิมใส่ให้ SVG path (drop-shadow) → เงาเรืองใต้เส้น (`mp-glow`)
- หมุดใช้ maplibregl.Marker ราก element ไม่มี class/position (กติกาหัวข้อ 19)
- พิกัด polygon เก็บเป็นวง `[[…]]` แบบ Leaflet (โค้ดเดิมใช้ `getLatLngs()[0]`)
- ดับเบิลคลิกที่หมุดที่ไม่ได้ใช้ดับเบิลคลิกเอง → ส่งต่อให้แผนที่เป็น `dblclick-marker` (คลิกที่สองตกที่หมุดจึงไม่มีจุดซ้ำ → ไม่ตัดจุดสุดท้าย) ผลลัพธ์ตรงเจตนาเดิม: จุดที่ดับเบิลคลิกนับเป็นจุดสุดท้าย 1 ครั้ง

### ไฟล์
| ไฟล์ใหม่ | ย้ายมาจาก | แก้จากต้นฉบับ |
|---|---|---|
| `js/tools/measure/lcompat.js` | (ใหม่) | — |
| `js/tools/measure/measure_plus.js` | `mp.js` | path ไอคอน `img/` → `assets/ui/` · `ensureVolumeTools` เรียก init ครั้งเดียว (เดิมโหลดไฟล์ทีหลัง) |
| `js/tools/measure/excavate.js` | `mpex.js` | ไม่แก้ |
| `js/tools/measure/embankment.js` | `mpem.js` | ไม่แก้ |
| `js/tools/measure/index.js` | `main.js` (new MeasurePlus) | ลงทะเบียน busy ขณะวาด/ลบ/ปรับพื้นที่ |
| `css/tools/measure.css` | `mp.css` | `.leaflet-container` → `.maplibregl-map … .maplibregl-canvas-container` |

### ผลทดสอบ (เมาส์จริงใน Chromium)
ปุ่มแถวบนช่อง 3 · เส้น 3 จุด: ระยะ 913.697 ม. ตรงกับสูตร Leaflet (ต่าง 0.000000 ม.) · หมุดจุดตรงตำแหน่ง 0 px · ป้ายระยะรายช่วง + ป้ายรวม · เส้นชั่วคราวตามเมาส์ · ดับเบิลคลิกจบทั้งบนหมุดและจุดใหม่ (3 จุดทั้งสองกรณี) · polygon ระบายพื้น + พื้นที่ไร่-งาน-ตร.วา · ลากจุดแก้รูป · วงกลม · บ่อขุด: แผงแสดง + เส้น offset 7 ชิ้น + ปริมาตร 1,238,575.28 ลบ.ม. · ดินถม: ปริมาตร 323,208.52 ลบ.ม. · โหมดลบ: คลิกเส้นแล้วหาย · ปิดแผงแล้วล้างทั้งหมด · ขณะวาดชั้นข้อมูลไม่เปิด popup · ไม่มี error

---

## 36. v3.7.01 — รายการแนะนำค้นหา กม.

อาการ: พิมพ์ "121+" แล้วมี "12+1xx" ปนมา · สาเหตุ (ตรรกะเดิมจาก search_sta.js): ตัด '+' ทิ้งแล้วเทียบเลขล้วน "121" จึงตรงกับระยะ 12,100–12,199 ม. ด้วย
แก้ `js/tools/search_km.js` (`matchStations`):
| พิมพ์ | ผล |
|---|---|
| `121+` | 121+000 … (กม. ต้องตรงทั้งตัว) |
| `121+5` | 121+500 … 121+580 (เมตรขึ้นต้นด้วยค่าที่พิมพ์) |
| `12+1` | 12+100 … 12+180 |
| `12` | กม. ที่ขึ้นต้นด้วย 12 เรียงตาม กม. (12+000 …) |
| `10+500` | 10+500 |
ยังแสดงสูงสุด 20 รายการ · การค้นหาด้วย Enter / ตรวจรูปแบบ 0+000 เหมือนเดิม

---

## 37. v3.7.02 — เครื่องมือวัด: กดค้างที่จุดแล้วมีเมนูระบบเด้งแทนการลาก (แท็บเล็ต)

สาเหตุ: หมุดจุดใน `lcompat.js` หยุดการส่งต่อเหตุการณ์ `contextmenu` (stopPropagation) โดยไม่ `preventDefault` → ตัวกันเมนูระดับหน้า (ui_manager) ไม่เห็นเหตุการณ์ และไม่มีใครยกเลิก → เบราว์เซอร์แสดงเมนูของตัวเองแทนเริ่มลาก (ปัญหาเดียวกับปุ่มแผนที่ใน v3.2.02)

แก้:
- `js/tools/measure/lcompat.js` หมุด: `preventDefault` ของ contextmenu / selectstart / dragstart · ราก `touch-action: none`, `user-select: none`, `-webkit-touch-callout: none`, `-webkit-user-drag: none`
- `disableClickPropagation` (แผงเครื่องมือวัด/บ่อขุด/ดินถม): กันเมนูเมื่อกดค้าง ยกเว้นช่องกรอกข้อความ (ยังคัดลอก/วางได้)
- `css/tools/measure.css` สไตล์เดียวกันที่ `.mp-vertex`, `.mp-marker-shape`

ทดสอบ (แท็บเล็ตจำลอง 1024×768 สัมผัสจริงผ่าน CDP): วาด polygon ด้วยการแตะ 4 จุด + กดค้างจบ → 4 จุด · เมนูระบบถูกกันที่จุดและแผง · ช่องกรอกยังใช้เมนูได้ · กดค้างที่จุด 0.8 วินาทีแล้วลาก → จุดย้ายตามนิ้วพอดี แผนที่ไม่เลื่อน

---

## 38. เฟส 3D-A (v3.8.00) — ภูมิประเทศ เอียง/หมุนแผนที่ เข็มทิศ

แบ่งเฟส 3D: **3D-A** ภูมิประเทศ + เอียง/หมุน + เข็มทิศ (ไม่ต้องใช้ข้อมูลเพิ่ม) · **3D-B** ยกความสูงโครงสร้าง (ข้อมูล KML ไม่มีค่าความสูง ต้องได้ค่าจากผู้ใช้ก่อน)

ไฟล์: `js/map/terrain.js`, `css/map/terrain.css` (ใหม่) · แก้ `js/config.js` (`map.terrain`), `js/map/map_core.js` (`maxPitch` 75 เสมอ), `app_manifest.js`
- ข้อมูลความสูง: **AWS Terrain Tiles** (Terrarium, ฟรี ไม่ใช้คีย์, maxzoom 15) · ขยายความสูง 1.5 เท่า (พื้นที่ค่อนข้างราบ) — ปรับได้ใน `config.map.terrain`
- ปุ่ม **3D** มุมขวาล่าง เหนือปุ่มตำแหน่งฉัน: เปิด = ภูมิประเทศ + เงาเนินเขา + ท้องฟ้า + เอียง 60° + เปิดท่าทางเอียง/หมุน · ปิด = มองตรง ทิศเหนือขึ้น ปิดท่าทาง (เหมือน 2D เดิม)
- ท่าทาง: เดสก์ท็อป คลิกขวาลาก / Ctrl+ลาก · จอสัมผัส สองนิ้วหมุน / สองนิ้วลากขึ้นลงเพื่อเอียง
- ปุ่ม **เข็มทิศ** แสดงเมื่อหมุนหรือเอียง (เข็มหมุน/เอียงตามแผนที่) กด = ทิศเหนือขึ้น + มองตรง (ยังอยู่ในโหมด 3D) — *แก้ใน v3.8.01 (หัวข้อ 39)*
- เงาเนินเขาอยู่เหนือแผนที่พื้นหลัง ใต้ชั้นข้อมูลทั้งหมด (`before: slot-raster-overlay`) · ภูมิประเทศกับเงาใช้ source แยก (คุณภาพดีกว่า)
- จำโหมด 3D ในเครื่อง (`bpnp3d_map_3d`)
- หมุด HTML (สถานี ป้าย ฯลฯ) วางบนพื้นผิวภูมิประเทศอัตโนมัติ · หมุดที่ถูกเนินบังจะจางลง (ค่าเริ่มต้นของ MapLibre)

ทดสอบ (ภาพความสูงจำลองรูปแบบ Terrarium): เปิด 3D → เอียง 60°, ภูมิประเทศทำงาน (ความสูงกลางจอ 312 ม.), เงาเนินเขาอยู่ระหว่างพื้นหลังกับชั้นข้อมูล, ท่าทางเปิด · หมุน 45° → เข็มทิศแสดงและหมุนตาม · หมุดสถานีตรงจุดบนพื้นผิว 0 px · กดเข็มทิศ → มองตรงทิศเหนือ · รีโหลด → กลับมาเป็น 3D · ปิด 3D → กลับเป็น 2D ครบ · ไม่มี error

---

## 39. v3.8.01 — กดเข็มทิศแล้วเข็มทิศหาย ไม่แน่ใจว่าอยู่โหมดใด

สาเหตุ (ออกแบบใน v3.8.00): เข็มทิศแสดงเฉพาะเมื่อแผนที่หมุนหรือเอียง และกดแล้วกลับเป็นทิศเหนือ + มองตรง → เข็มทิศซ่อน แต่โหมด 3D (ภูมิประเทศ, ท่าทาง, ปุ่มสีน้ำเงินเข้ม) ยังเปิดอยู่ · เอียงกลับเป็นมองตรงเองก็เกิดแบบเดียวกัน

แก้ `js/map/terrain.js`:
| | เดิม | ใหม่ |
|---|---|---|
| เข็มทิศแสดงเมื่อ | หมุนหรือเอียงอยู่ | อยู่ในโหมด 3D (ซ่อนเฉพาะ 2D) |
| กดเข็มทิศ | ทิศเหนือขึ้น + มองตรง | ทิศเหนือขึ้น คงมุมเอียง (ถ้ามองตรงอยู่ กลับไปเอียงมุม 3D) |
| สลับโหมด | — | ข้อความ "มุมมอง 3D" / "มุมมอง 2D" + ข้อความปุ่มบอกโหมดปัจจุบัน |

ปุ่ม 3D สีน้ำเงินเข้ม = โหมด 3D เสมอ · กลับเป็น 2D ด้วยปุ่ม 3D เท่านั้น
ทดสอบ: 2D → 3D → หมุน 70° → กดเข็มทิศ (ทิศเหนือ, ยังเอียง 60°, เข็มทิศยังแสดง) → เอียงเป็นมองตรง (เข็มทิศยังแสดง) → กดเข็มทิศ (กลับเอียง 60°) → ปิด 3D (เข็มทิศซ่อน, ปุ่มสีปกติ) · ไม่มี error

---

## 40. v3.8.02 — ปรับการใช้งาน 3D (ตามที่ยืนยัน)

| เรื่อง | การทำงาน |
|---|---|
| ท่าทางหมุน/เอียง | เปิดตลอดทั้ง 2D/3D: สองนิ้วหมุน · สองนิ้วลากขึ้นลง · Ctrl+ลาก · คลิกขวาลาก (คลิกขวาเฉย ๆ ยังดูพิกัดได้) |
| เข้า 3D อัตโนมัติ | ผู้ใช้เริ่มหมุน/เอียงเอง (`rotatestart` / `pitchstart` ที่มี `originalEvent`) ขณะอยู่ 2D → เข้า 3D ที่มุมนั้น ไม่กระโดดไป 60° · ถ่างนิ้วซูมอย่างเดียวยังเป็น 2D (เกณฑ์การหมุนของ MapLibre) |
| ปุ่ม 3D | 2D → 3D + เอียง 60° · 3D → 2D (ทิศเหนือขึ้น มองตรง ปิดภูมิประเทศ) |
| ปุ่มภูมิประเทศ ⛰ | กลม ซ้ายปุ่ม 3D · เฉพาะโหมด 3D · ไอคอนสามเหลี่ยมซ้อนสองอัน · ปิด (ค่าเริ่มต้น) = พื้นเทา `#e5e7eb` ไอคอนเทาเข้ม `#4b5563` · เปิด = พื้นน้ำเงินเข้ม `#1e3a8a` ไอคอนขาว · จำค่าที่เลือกล่าสุด (`bpnp3d_map_terrain`) |
| เข็มทิศ | กลม เหนือปุ่ม 3D · เฉพาะโหมด 3D · เข็มหมุนตามทิศอย่างเดียว (ไม่เอียง) · กด = ทิศเหนือขึ้น คงมุมเอียง |
| ข้อความแจ้ง | "มุมมอง 3D/2D" · "ภูมิประเทศ: เปิด/ปิด" |

หมายเหตุ CSS: ปุ่มมาตรฐานมี `border-radius: 8px !important` จึงต้องใช้ `50% !important` ที่ปุ่มกลม

ทดสอบ: เดสก์ท็อป — คลิกขวาไม่ลากเปิดพิกัดและยัง 2D · Ctrl+ลากเข้า 3D (มุมเอียง 0, หมุน −115°) · ปุ่มภูมิประเทศ สี/ตำแหน่ง/เปิด-ปิดถูกต้อง · ปุ่ม 3D กลับ 2D แล้วเข้าใหม่ จำภูมิประเทศที่เลือก · มือถือ — ถ่างนิ้วซูมยัง 2D · สองนิ้วบิดเข้า 3D (หมุน −34°) · ไม่มี error

---

## 41. v3.8.03 — ป้ายชื่อสถานีซีดบน PC · ไอคอนอยู่บนกล่องป้ายชื่อ

### ป้ายซีด
สาเหตุ: เมื่อเปิดภูมิประเทศ MapLibre ตั้ง `opacity` ของหมุด HTML ที่ "คิดว่าถูกเนินบัง" เป็น 0.2 (`opacityWhenCovered`) การตรวจผิดพลาดได้แม้พื้นที่ราบ โดยเฉพาะหมุดไกลขณะเอียงแผนที่ · v3.8.00–3.8.01 เปิดภูมิประเทศทุกครั้งที่อยู่ 3D และแอปจำโหมดไว้ → PC ที่ค้างโหมด 3D เห็นป้ายซีด มือถือที่ใช้ 2D ไม่เห็น
วัด: 2D = 1 · 3D ปิดภูมิประเทศ = 1 · 3D เปิดภูมิประเทศ = บางหมุด 0.2
แก้: `css/map/maplibre_overrides.css` → `.maplibregl-marker { opacity: 1 !important; }` (หมุดทุกชนิดทึบเสมอ) · หลังแก้ 3D + ภูมิประเทศ = 1 ทุกหมุด
หมายเหตุ: ถ้าต้องการให้หมุดที่ถูกเนินบังจริงจางลงในอนาคต ให้ลบกฎนี้

### ลำดับไอคอน/ป้ายชื่อ
เดิมกล่องป้ายชื่อ (position absolute) วาดทับขอบบนไอคอน 5 px → `css/layers/layers.css`: ไอคอน `position: relative; z-index: 1` · ป้าย `z-index: 0`
ตำแหน่งก่อน/หลังเท่ากันทุกพิกเซล (ไอคอน 32×32 ที่ 534,343 · ป้าย 84×28 ที่ 508,320) · สีบริเวณที่ทับกันเปลี่ยนจากสีกล่อง (แดงเข้ม) เป็นสีไอคอน (น้ำเงิน)
พื้นกล่องป้ายชื่อคงเป็นแดงโปร่ง 70% ตามเวอร์ชันเดิม

---

## 42. v3.8.04 — ความสูงเหนือระดับทะเลปานกลางในป้ายดูพิกัด

เงื่อนไข: แสดงเฉพาะ **โหมด 3D + เปิดภูมิประเทศ** (ตามที่ยืนยัน) · โหมดอื่น popup เหมือนเดิมทุกอย่าง
แหล่งข้อมูล: AWS Terrain Tiles (ชุดเดียวกับภูมิประเทศ, ~30 ม. ในไทย) · ทางเลือกที่พิจารณา: Open-Meteo Elevation API (Copernicus GLO-90, 90 ม., ฟรีเฉพาะใช้ไม่เชิงพาณิชย์), ข้อมูลสำรวจโครงการ

### การทำงาน
- `js/map/terrain.js` → `BPNP.map.terrain.elevationAt(lng, lat)` อ่านค่าจากภาพ Terrarium ซูม 14 โดยตรง (`R·256 + G + B/256 − 32768`, bilinear 4 พิกเซล, เก็บภาพ 24 แผ่นล่าสุด) — **ค่าจริง ไม่รวมการขยายความสูง 1.5 เท่า**
  (ไม่ใช้ `map.queryTerrainElevation` — ทดสอบแล้วคืนค่า 0 ไม่สม่ำเสมอ)
- `js/tools/click_point.js` บรรทัด "ความสูง: กำลังอ่านค่า…" → "≈ 182 ม. รทก." (จำนวนเต็ม) + หมายเหตุ "โดยประมาณจาก DEM (±หลายเมตร)" · โหลดไม่ได้ → "ความสูง: ไม่มีข้อมูล"
- ตำแหน่ง: ต่อจาก O/S · ถ้ามีคำเตือน ("ตำแหน่งค้นหาอยู่ห่างเกินไป" / "ไม่พบ alignment ที่ใกล้พอ") ต่อจากคำเตือน ก่อนปุ่ม
- ข้อจำกัดข้อมูล: แบบจำลองผิวพื้น (อาจรวมต้นไม้/อาคาร), คลาดเคลื่อนได้หลายเมตร, อ้างอิงระดับทะเลปานกลางสากล ใกล้เคียงแต่ไม่ใช่ รทก. ไทยโดยตรง — ใช้ดูภาพรวม ไม่ใช่งานออกแบบ

### ผลทดสอบ (ภาพความสูงจำลองรูปแบบ Terrarium)
2D / 3D ปิดภูมิประเทศ: ไม่มีบรรทัดความสูง · 3D เปิดภูมิประเทศ: ≈158 ม. ตรงกับการถอดค่าอิสระ 158.45 ม. · กรณีคำเตือน: ≈591 ม. (อิสระ 590.89) อยู่หลังคำเตือน · ภาพโหลดไม่ได้: "ไม่มีข้อมูล" · คลิกขวา 1 ครั้ง = อ่านค่า 1 ครั้ง · ไม่มี error

---

## 43. เฟส 3D-B ส่วนที่ 1 (v3.9.00) — Box Culvert + Underpass แบบ 3 มิติ

ไฟล์ใหม่ `js/layers/structure/structure_3d.js` (ตัวสร้างรูป) · แก้ `underpass_box.js` (ชั้น fill-extrusion), `terrain.js` (เหตุการณ์ `map:3d`), `app_manifest.js`

### ข้อกำหนดที่ยืนยัน
| เรื่อง | ค่า |
|---|---|
| ขนาด Box | "จำนวนช่อง-กว้าง×สูง" · "4x2-…" = 4×2 = 8 ช่องเรียงกัน |
| ขนาด Underpass | ช่อง `H` / `W` ในข้อมูล ("1-2.50x4.00" = สูง 2.50 กว้าง 4.00) |
| ระดับ | ขอบล่างเสมอดินเดิม (ไม่อยู่ใต้ดิน) |
| ผนัง/พื้นบน | หนา max(0.20, กว้างช่อง/10) · ปากท่อเปิดสองด้าน |
| กำแพงปีก | จากรูป 2D · ขอบบนลาด (แบบ B) จากความสูงหัวท่อลงถึง max(0.5 ม., 1/3) · ขั้นละ ~0.25 ม. (อย่างน้อย 12 ขั้น) |
| ปลายพับ | จากรูป 2D (Underpass) สูงเท่าปลายกำแพงปีก |

### ตำแหน่งและทิศ (ตรวจกับรูป 2D ทุกรายการ)
- ช่อง `Coordinate` ของ Box เป็นจุดบนแนวราง ณ กม. — ท่อด้านข้าง (LT/RT + offset 11–67 ม.) คลาดเป็นสิบเมตร → ใช้กึ่งกลางรูป 2D (ทั้งรูป หรือชิ้นใหญ่สุด)
- ทิศ: ตั้งฉากแนวราง ± `skew` หรือขนานแนวราง (ท่อใต้ถนนข้างทาง) · เลือกกึ่งกลาง×ทิศที่ตัวท่อทับรูป 2D มากที่สุด · ไม่ถึง 80% → กวาดทุก 2°
- ยังไม่ถึง 80% (รางระบายยาว 210 ม. โค้งตามถนน, 70+105) → ยกรูป 2D ชิ้นใหญ่สุดขึ้นสูงเท่าท่อ
- กำแพงปีกรับจุดปลายที่ห่างมุมหัวท่อ ≤ 12 ม. (บางรายการมีรูป 2D ส่วนอื่นอยู่ห่างออกไป เช่น 46+060)

ผลตรวจ: Box 138/138 (ตัวท่อทับรูป 2D ต่ำสุด 84%, มัธยฐาน 100%) · Underpass 115/115 (100% ทุกรายการ) · มีปลายพับ 70 รายการ

### การแสดงผล
- เฉพาะโหมด 3D (ซ่อนในโหมด 2D) · ซูมเดียวกับรูป 2D · รูป 2D ยังอยู่ด้านล่าง
- สร้างครั้งแรกที่เข้าโหมด 3D (Box ~7,600 ชิ้น, Underpass ~15,000 ชิ้น) · สี Box เหลือง / Underpass ตามสีขนาดใน legend · กำแพงปีกสีเข้มกว่า 20%
- คลิกรูป 3D → การ์ดข้อมูลเดิม

### ข้อสังเกต
- 46+060: รูป 2D มี 2 ส่วนแยกกัน ส่วนที่ไม่มีข้อมูลขนาดของตัวเองแสดงเฉพาะ 2D · ไม่พบกำแพงปีกของรายการนี้
- ส่วนที่เหลือของ 3D-B: สะพาน, ตอม่อ (รอค่าความสูง)

---

## 44. v3.9.01 — หมุดรายชื่อสถานีในมุมมอง 3D

ปัญหา (ภาพจากผู้ใช้): เอียงแผนที่แล้วหมุดไกลขนาดเท่าหมุดใกล้ ซ้อนกันที่ขอบฟ้า ป้ายทับกันอ่านไม่ได้ บางหมุดลอยบนท้องฟ้า และหมุดที่สร้างทีหลังบังป้ายทุกอัน (ลำดับการวาด = ลำดับในไฟล์ข้อมูล)
หมายเหตุ: ตรวจแล้วปลายหมุดอยู่ตรงจุดบนพื้น (≤ 1 px) — ที่ "ลอย" เพราะหมุด HTML ตั้งตรงหันเข้าจอและขนาดคงที่ (billboard)

แก้ `js/layers/railway.js` (เฉพาะโหมด 3D ที่แผนที่เอียง · โหมด 2D ไม่เปลี่ยน — ล้างค่า inline ทั้งหมด):
| ข้อ | การทำงาน |
|---|---|
| ย่อตามระยะ | เทียบพิกเซลต่อ 100 ม. ที่หมุดกับที่ 60% ความสูงจอ · เล็กสุด **50%** · ย่อจากปลายหมุด (`transform-origin: 50% 100%` ที่ `.station-marker-inner` ไม่ใช่ราก) |
| ซ่อนป้ายทับกัน | ไล่จากหมุดใกล้ (y มาก) ก่อน · ป้ายที่ทับป้ายที่วางแล้ว (ระยะเผื่อ 3 px) ซ่อนเฉพาะป้าย |
| จางใกล้ขอบฟ้า | หาแถวขอบฟ้าด้วย unproject/project · จางจาก 20 ถึง 90 px ใต้ขอบฟ้า · ต่ำกว่า 0.3 ไม่รับการแตะ |
| ลำดับการวาด | `z-index` ของรากหมุด = 1000 + y ของปลายหมุด → หมุดใกล้อยู่หน้า · ภายในหมุด ไอคอนยังอยู่บนป้ายของตัวเอง |
| ชี้/แตะหมุด | ขึ้นหน้าสุด (z-index 100000) + แสดงชื่อ · แตะบนจอสัมผัสค้าง 2.5 วินาที |
คำนวณใหม่เมื่อ move/moveend/resize/สลับ 3D (รวมเป็น 1 ครั้งต่อเฟรม)

ทดสอบ (31 หมุด, เอียง 75°): 2D ไม่มีค่า inline เลย · 3D เล็กสุด 0.50, ซ่อนป้ายทับกัน 14, จางที่ขอบฟ้า 1, หมุดใกล้อยู่หน้าทุกคู่ · ชี้หมุดที่ซ่อนป้าย → หน้าสุด + แสดงชื่อ · กลับ 2D → ล้างค่าครบ · ไม่มี error
