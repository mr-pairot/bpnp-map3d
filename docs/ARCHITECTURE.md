# BPNP Map 3D — ผังการทำงานและความเชื่อมโยงของไฟล์

> สถานะ: v3.7.00 · ชั้นข้อมูลครบทุกชั้น (เฟส 0–4) · เครื่องมือครบ (เฟส 5) · งานที่เหลือ: เฟส 3D
> แผนภาพด้านล่างเป็น Mermaid — GitHub วาดให้อัตโนมัติเมื่อเปิดไฟล์นี้บนเว็บ

---

## 1. ลำดับการเริ่มแอป

```mermaid
flowchart TD
    A["index.html<br/>หน้าเดียว + ไลบรารี CDN"] --> B["js/config.js · core/namespace.js · boot/loader.js<br/>boot/maintenance.js · boot/check_update.js"]
    A -.-> CDN[("CDN<br/>maplibre-gl 5.24 · turf · sweetalert2")]
    B -.-> SW[("sw.js · version.json<br/>แคช + ตรวจเวอร์ชัน")]
    B --> C["boot/auth.js<br/>LINE LIFF + session token"]
    C <-.-> GAS[("GAS backend/gas/Code.gs<br/>Sheet: Users · Sessions · UsageLog · EventLog")]
    C --> D["ui/ui_manager.js · ui/welcome_popup.js · core/data_cache.js<br/>สร้างโครงหน้าแผนที่"]
    D --> E["boot/app_manifest.js<br/>APP_SCRIPTS → LAYER_SCRIPTS → APP_MAIN"]
    E --> F["app.js → BPNP.app.start()<br/>สร้างแผนที่ + ลงทะเบียนชั้นข้อมูล"]
```

- `APP_SCRIPTS` (ขาดไม่ได้): core, map, ui/layer_panel, ui/about_popup, tools/my_location, tools/click_point
- `LAYER_SCRIPTS` (ขาดได้ — ไฟล์หายแอปยังเปิด ชั้นนั้นขึ้น "ไม่พร้อมใช้งาน" + บันทึก `App Warning`)
- `auth.js` แบ่งขั้นตอนการเปิดแอป ถ้าล้มเหลวแสดงขั้น + รายละเอียด และบันทึก `App Error` ลง EventLog

---

## 2. แกนแผนที่และเส้นทางข้อมูล

```mermaid
flowchart LR
    subgraph BUILD["ตอน deploy (Netlify: npm install + node tools/build.js)"]
        K["data/kml/**"] --> T["tools/build.js<br/>tools/kml2geojson.js"] --> G["data/geojson/**<br/>+ version.json"]
    end
    G --> DC["core/data_cache.js<br/>แคชตามเวอร์ชันไฟล์"]
    J["data/json/**"] --> DC
    DC --> LU["layers/layer_utils.js<br/>โหลด · ป้าย · popup · หมุด"]
    LU --> LM["js/layers/**<br/>โมดูลชั้นข้อมูล"]
    LM -- "register()" --> REG["map/layer_registry.js<br/>slot · ลำดับทับซ้อน · ความทึบ"]
    CFG["layers/layers_config.js<br/>รายการชั้น + เฟส"] --> LP["ui/layer_panel.js<br/>ติ๊ก · ความทึบ · ลากเรียง"]
    LP <--> REG
    REG --> MC["map/map_core.js<br/>แผนที่ MapLibre"]
    BM["map/basemaps.js<br/>พื้นหลัง 7 แบบ"] --> MC
    MC --> PC["map/popup.js · map/controls.js"]
```

ตัวแปลง (`tools/kml2geojson.js`) ทำให้ข้อมูลจาก CAD แสดงเหมือน Leaflet:
พื้นแบบ even-odd ด้วย XOR · เส้นขอบเดิมเก็บแยก (`_outline`) · เส้น 2–3 จุด · ตัดเศษบาง < 5 ซม. · จัดทิศทาง ring (รายละเอียด MIGRATION_GUIDE หัวข้อ 15, 20, 27, 29)

---

## 3. โมดูลชั้นข้อมูล

```mermaid
flowchart TB
    subgraph GEN["ชั้นข้อมูลทั่วไป"]
        g1["raster_overlays.js<br/>ผังที่ดิน · ผังเมือง · Traffic"]
        g2["alignment.js<br/>แนวทาง · กม.ก่อสร้าง"]
        g3["railway.js<br/>เขตทาง · ย่านสถานี · สถานี"]
        g4["road.js<br/>ผังถนน"]
        g5["doh_km.js<br/>หลัก กม. ทล."]
        g6["video_links.js<br/>YouTube"]
    end
    subgraph PAR["แปลงเวนคืน (parcel/)"]
        p1["parcel.js"] --- p2["parcel_legend.js"]
        p1 --- p3["parcel_search.js"]
        p1 --- p4["ui/bottom_panel.js"]
    end
    subgraph STR["โครงสร้าง (structure/)"]
        s1["footing.js"]
        s2["underpass_box.js"] --- s4["height_signs.js"]
        s3["bridge.js"] --- s4
        s3 --- s5["bridge_panel.js"]
        s3 --- s6["bridge_alert.js"]
    end
    subgraph PRG["Signalling & Track (progress/)"]
        r1["track_progress.js"]
        r2["sw_loc.js"] --- r3["sw_panel.js"]
        r3 --- r4["sw_summary.js"]
    end
    SH["ใช้ร่วม: core/alignment.js (Sta/O/S) · core/geo_utils.js · tools/click_point.js · tools/my_location.js"]
    PAR -.-> SH
    PRG -.-> SH
    STR -.-> g6
```

| ไฟล์ | หน้าที่ | ข้อมูลที่ใช้ | ต้นฉบับ Leaflet |
|---|---|---|---|
| `layers/raster_overlays.js` | ผังที่ดิน กรมที่ดิน, ผังเมือง DPT, TomTom Traffic | tile/WMS ภายนอก | main.js |
| `layers/alignment.js` | Alignment Track, กม.ก่อสร้าง + แผงขนาดตัวเลข | `kml/alignment/al_track`, `sta_1km` | main.js |
| `layers/railway.js` | เขตทาง, ย่านสถานี, รายชื่อสถานี (HTML marker) | `kml/railway/*` | main.js |
| `layers/road.js` | ผังถนน Service/Access | `kml/road/*` | main.js |
| `layers/doh_km.js` | หลัก กม. กรมทางหลวง + ปุ่ม กม. ทล. | `json/doh_km_post.json` | DOH_ShowKM.js |
| `layers/video_links.js` | ลิงก์ YouTube สถานี/โครงสร้าง | `json/video_links.json`, `box_timestamp.json` | openYoutubeByKM_box.js |
| `layers/parcel/parcel.js` | แปลงเวนคืน + Pay Out, popup + รูป | `kml/parcel/*`, `assets/parcels/` | setPatternLegend*.js, setPopup.js |
| `layers/parcel/parcel_legend.js` | legend ข้อมูลพื้นที่เวนคืน | — | setPatternLegend.js |
| `layers/parcel/parcel_search.js` | ค้นหารหัสแปลง (มุมขวาบน) | — | leaflet-search.js |
| `ui/bottom_panel.js` | ตารางรายการแปลง | — | bottomPanel.js |
| `layers/structure/footing.js` | Footing VB45–VB118 + Pier | `kml/footing/*` | main.js |
| `layers/structure/underpass_box.js` | Underpass + Box Culvert + legend | `kml/structure/underpass`, `box_culvert` | main.js, setUnderpassLegend.js |
| `layers/structure/height_signs.js` | ป้ายความสูง (กลุ่ม underpass, bridge, field) + กล่องอธิบาย | `json/height_signs.json` (กลุ่ม field) | HeightSignManager.js, HeightSignAlert.js, mark_Sign.js |
| `layers/structure/bridge.js` | สะพานเหล็ก/คอนกรีต/Overpass + การ์ดความคืบหน้า | `kml/structure/bridge_sb`, `bridge_cb`, `overpass`, `json/bridge_progress.json` | BridgeLayerManager3.js |
| `layers/structure/bridge_panel.js` | ตารางความก้าวหน้างานสะพาน | — | BridgeBottomPanel.js |
| `layers/structure/bridge_alert.js` | แจ้งเตือนงานล่าช้า | — | Critical_Alert_Str.js |
| `layers/progress/track_progress.js` | กราฟความคืบหน้างานวางราง | `json/km_data.json`, `track_progress.json` | tw_ProgressManager.js, tw_progress.js |
| `layers/progress/sw_loc.js` | ตู้ LOC 216 ตู้ | `json/sw_loc.json` | sw_loc_manager.js |
| `layers/progress/sw_panel.js` · `sw_summary.js` | ตาราง + แผงสรุป SW-LOC | — | sw_LocBottomPanel.js, sw_summary_panel.js |
| `tools/tool_utils.js` | ตัวช่วยร่วมของเครื่องมือ (หมุด, บิน, ซูมพอดี, วงกระเพื่อม, popup, ดาวน์โหลด, กันคลิกทะลุ) | — | (แทนคำสั่ง Leaflet) |
| `tools/search_km.js` | ค้นหา กม. + หมุด + วงกระเพื่อม | alignment 20 ม. | search_sta.js |
| `tools/search/hub.js` | แผงค้นหา/พิกัด 5 โหมด + เส้นทาง OSRM + ที่อยู่จากพิกัด | OSRM, Longdo | routing_main.js, routing_ui.js |
| `tools/search/address.js` | ค้นหาพิกัดจากที่อยู่ | kongvut/thai-province-data, Longdo | search_address.js |
| `tools/search/utm_convert.js` | แปลง UTM ↔ Lat/Lng ทีละจุด | core/geo_utils | convertUTM.js |
| `tools/search/utm_multi.js` | แปลงหลายแถว + วางจาก Excel + หมุดเลขแถว | core/geo_utils | convertUTM_MultiRow.js |
| `tools/measure/lcompat.js` | Leaflet ชุดย่อยบน MapLibre (เฉพาะเครื่องมือวัด ไม่ประกาศ window.L) | — | (ใหม่) |
| `tools/measure/measure_plus.js` | วัดระยะ/พื้นที่/วงกลม, นำเข้า/ส่งออก, ปรับพื้นที่ | turf | mp.js (คัดลอกตรง) |
| `tools/measure/excavate.js` · `embankment.js` | ปริมาตรบ่อขุด / ดินถม หลายชั้น + รูปตัด | turf | mpex.js, mpem.js (คัดลอกตรง) |
| `tools/measure/index.js` | สร้างเครื่องมือวัด + ปุ่ม + สถานะ busy | — | main.js |

---

## 4. งานที่เหลือ

```mermaid
flowchart TB
    subgraph P5["เฟส 5 เครื่องมือ (js/tools/)"]
        t1["✔ 5A search_km.js + tool_utils.js<br/>เดิม search_sta.js · ปุ่ม search.png คอลัมน์ซ้ายแถวบนสุด"]
        t3["✔ 5B search/ (hub, address, utm_convert, utm_multi)<br/>เส้นทาง OSRM · หาตำแหน่งจากพิกัด · ที่อยู่ · UTM · UTM หลายแถว<br/>เดิม routing_main · routing_ui · search_address · convertUTM × 2"]
        t2["✔ 5C measure/ (lcompat + measure_plus, excavate, embankment)<br/>เดิม mp.js · mpex.js · mpem.js (วัด + บ่อขุด/ดินถม)"]
    end
    subgraph D3["เฟส 3D"]
        d1["map/terrain.js<br/>ภูมิประเทศ · เอียง/หมุน · เข็มทิศ"]
        d2["ยกความสูงโครงสร้าง<br/>สะพาน · ตอม่อ · Underpass (fill-extrusion)"]
    end
    U["ใช้โมดูลที่มี: core/geo_utils · core/alignment · map/layer_registry (slot tools) · ui/ui_manager (ปุ่ม/คอลัมน์ซ้าย)"]
    P5 -.-> U
    D3 -.-> U
```

**เก็บตก 4A — เสร็จใน v3.4.01:** ป้ายความสูงภาคสนามจาก `mark_Sign.js` (`SignLayerManager`) ย้ายเป็นกลุ่ม `field` ใน `height_signs.js` ลงทะเบียนใน `bridge.js` · ตำแหน่งจาก `core/alignment.js → pointAt(sta, offset)` · ปุ่ม "ป้าย" ของ Bridge เปิดทั้งกลุ่ม `bridge` และ `field`

---

## 5. กติกาที่ต้องยึดเมื่อเพิ่ม/แก้ไฟล์

| เรื่อง | กติกา | อ้างอิง |
|---|---|---|
| ลงทะเบียนชั้น | ผ่าน `BPNP.layers.utils.register({ register(map) })` และ `BPNP.map.registry.register()` เท่านั้น | MIGRATION_GUIDE 9.2 |
| โหลดสคริปต์ | ชั้นข้อมูลใหม่ใส่ใน `LAYER_SCRIPTS` (ขาดได้) | 17 |
| ซูม | ค่าจากโค้ดเดิมแปลงด้วย `U.z()` / `BPNP.geo.fromLeafletZoom()` (= Leaflet − 1) | 9.1 |
| พิกัด | ภายในใช้ `[lng, lat]` | 9.1 |
| ป้ายภาษาไทย | symbol layer ใช้กับตัวเลข/อักษรละตินเท่านั้น ข้อความไทยใช้ HTML marker / popup | 15.3 |
| HTML marker | ห้ามกำหนด `position` / `transform` ที่ element ราก | 19 |
| ชั้น polygon | `line` กรอง `_fillOnly` · `fill` กรอง `_outline` · ข้อมูล/นับ/ค้นหา ข้าม `_outline` | 27, 29 |
| popup | `BPNP.map.popup.open()` (เหนือจุด + autoPan เหมือน Leaflet) | 24 |
| เครื่องมือที่รับคลิกแผนที่ | ลงทะเบียน `BPNP.tools.registerBusy()` ขณะใช้งาน (ชั้นข้อมูลไม่เปิด popup ทับ) | 34, 35 |
| ข้อความจากข้อมูล | `BPNP.escapeHtml()` หรือ `BPNP.safeHtml()` ก่อนใส่ HTML | 21 |
| ส่งงาน | `bpnp-map3d.zip` + `changed_files_<เวอร์ชัน>.zip` + สรุปไฟล์ที่เปลี่ยน | — |
