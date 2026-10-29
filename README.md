# BPNP Map 3D

แผนที่สารสนเทศ โครงการรถไฟทางคู่ สายบ้านไผ่-หนองพอก — เวอร์ชัน MapLibre GL JS
เว็บ: https://bpnp-map3d.netlify.app (เข้าผ่าน LIFF)

> เวอร์ชัน Leaflet (2.x) อยู่ใน repo เดิม ใช้เป็นต้นแบบอ้างอิงระหว่างย้ายเฟส 2–5
> แนวทางและแผนเฟสทั้งหมด: [`docs/MIGRATION_GUIDE.md`](docs/MIGRATION_GUIDE.md)
> ผังการทำงานและความเชื่อมโยงของไฟล์: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)

## เริ่มใช้งานครั้งแรก

1. ตั้ง GAS + Google Sheet + LIFF ตาม [`backend/gas/README.md`](backend/gas/README.md)
2. ใส่ `liffId` และ `gasUrl` ใน [`js/config.js`](js/config.js)
3. Netlify: New site from Git → เลือก repo นี้ → ชื่อ site `bpnp-map3d` (ค่า build อ่านจาก `netlify.toml`)

## ทดสอบบนเครื่องตัวเอง

ต้องมี [Node.js](https://nodejs.org) 20 ขึ้นไป (ใช้แปลง KML → GeoJSON)

```bash
npm install                      # ครั้งแรกครั้งเดียว
node tools/build.js              # แปลงข้อมูล (รันใหม่ทุกครั้งที่แก้ไฟล์ใน data/kml/)
python3 -m http.server 8080      # หรือ npx serve
# เปิด http://localhost:8080  → ข้ามการล็อกอินอัตโนมัติ (config.auth.devBypassHosts)
```

> `node tools/build.js` จะเขียนเลข build ลงใน `index.html` และ `version.json` ด้วย
> ก่อน commit ให้คืนบรรทัด `window.APP_VERSION = '__APP_BUILD__';` (หรือไม่ต้อง commit 2 ไฟล์นี้หลังรันบนเครื่อง)

ทดสอบป้ายภาษาไทย: `http://localhost:8080/tools/thai-label-test.html`

## งานประจำ

| ต้องการ | แก้ที่ |
|---|---|
| ออกเวอร์ชันใหม่ | `version.json` → `version` + `changelog` และเพิ่มรายการใน `history.json` |
| อัปเดตข้อมูลเลเยอร์ | วางไฟล์ KML ทับใน `data/kml/` (ชื่อเดิม) → push — Netlify แปลงเป็น GeoJSON ให้ ผู้ใช้โหลดใหม่เฉพาะไฟล์ที่เปลี่ยน |
| ปิดปรับปรุงระบบ | `js/config.js` → `maintenance: true` |
| เพิ่ม/ลดผู้ทดสอบ | GAS Script Properties → `ALLOWED_IDS` (ไม่ต้อง deploy) |
| เปิดใช้ทั่วไป | GAS Script Properties → `ACCESS_MODE` = `open` |

ไม่ต้องแก้ `APP_VERSION` ใน `index.html` เอง — `tools/build.js` สร้างให้ตอน deploy (ใน GitHub ให้คงเป็น `'__APP_BUILD__'`)

## โครงสร้าง

```
index.html          หน้าเดียวของแอป + โหลดสคริปต์เริ่มต้น
js/config.js        ค่าตามสภาพแวดล้อม (ไฟล์เดียวที่ต่างกันระหว่าง repo)
js/boot/            loader, auth (LIFF + session), maintenance, check_update, app_manifest
js/core/            namespace (BPNP), storage, toast, geo_utils, alignment (Sta/O/S), data_cache
js/map/             map_core, basemaps, layer_registry, popup, controls
js/layers/          layers_config, layer_utils, raster_overlays, alignment, railway, road, video_links,
                    parcel/ (parcel, parcel_legend, parcel_search), structure/ (footing, underpass_box, height_signs, bridge, bridge_panel, bridge_alert),
                    doh_km, progress/ (track_progress, sw_loc, sw_panel, sw_summary)
js/ui/              ui_manager, layer_panel, bottom_panel, welcome_popup, about_popup
js/tools/           my_location, click_point, tool_utils, search_km,
                    search/ (hub, address, utm_convert, utm_multi),
                    measure/ (lcompat, measure_plus, excavate, embankment, index)
js/app.js           ประกอบแอป
css/                โครงเดียวกับ js/
data/kml|json/      ข้อมูลเลเยอร์ (data/geojson/ สร้างอัตโนมัติ ไม่ต้อง commit)
assets/             ไอคอน รูปปุ่ม หมุด รูปแปลงที่ดิน
backend/gas/        ต้นฉบับ GAS (ไม่เปิดให้เข้าถึงจากเว็บ)
tools/              build.js, kml2geojson.js, หน้าทดสอบ
```

## สถานะเฟส

| เฟส | ขอบเขต | สถานะ |
|---|---|---|
| 0 | โครง repo, config, GAS/Sheet/LIFF ใหม่, ย้ายไฟล์ | ✔ 3.0.00 |
| 1 | แกน MapLibre, แผนที่ฐาน, registry, แผงชั้นข้อมูล, ตำแหน่งฉัน, ดูพิกัด Sta/O/S | ✔ 3.0.00 |
| 2 | KML→GeoJSON, เลเยอร์สไตล์ตายตัว | ✔ 3.1.00 |
| 3 | แปลงเวนคืน, Underpass, Box Culvert, popup | ✔ 3.2.00 |
| 4A | Bridge (การ์ด, ตาราง, แจ้งเตือนล่าช้า, ป้ายความสูง) | ✔ 3.3.00 |
| 4B | หลัก กม. กรมทางหลวง, Track Progress, SW-LOC | ✔ 3.4.00 |
| 5A | ค้นหา กม. | ✔ 3.5.00 |
| 5B | แผงค้นหา/พิกัด: เส้นทาง, หาตำแหน่ง, ที่อยู่, แปลง UTM | ✔ 3.6.00 |
| 5C | วัดระยะ/พื้นที่ + ปริมาตรบ่อขุด/ดินถม | ✔ 3.7.00 |
| 3D-A | ภูมิประเทศ, เอียง/หมุน, เข็มทิศ | ✔ 3.8.00 |
| 3D-B | Box Culvert + Underpass 3 มิติ | ✔ 3.9.00 |
| 3D-B | สะพานรถไฟ CB / SB + ตอม่อ | ✔ 3.10.00 (editor) |
| 3D-C | Overpass | – |
