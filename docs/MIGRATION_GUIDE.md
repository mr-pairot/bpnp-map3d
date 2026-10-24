# BPNP Map 3D — แนวทางจัดทำ repo ใหม่และย้ายไป MapLibre

> สถานะ: **เฟส 0–1 เสร็จ (v3.0.00) · เฟส 2 เสร็จ (v3.1.00)** · ดูหัวข้อ 14–15 สำหรับสิ่งที่ปรับและพบระหว่างทำ
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
