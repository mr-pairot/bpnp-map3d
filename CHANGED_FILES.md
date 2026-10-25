# ไฟล์ที่เปลี่ยน: 3.3.04 → 3.4.00 (รวม 3.3.05 + 3.4.00)

ใช้กรณี repo ยังเป็น 3.3.04 — วางทับครั้งเดียวได้ทั้งสองเวอร์ชัน
วิธีใช้: แตกไฟล์แล้ววางทับใน repo ตาม path เดิม จากนั้น commit + push
ไม่มีไฟล์ที่ต้องลบ · **มีโฟลเดอร์ใหม่ `js/layers/progress/`** — ตรวจว่าขึ้น GitHub ครบ 4 ไฟล์
Netlify จะแปลงข้อมูลใหม่ตอน deploy (Deploy log ควรมี "ตัดเศษบาง 94498 ชิ้น · กลับทิศ ring 15337 วง")

## 3.3.05 — แก้เงาระบายสีผิด Overpass/โครงสร้าง (6 ไฟล์)

| ไฟล์ | สิ่งที่แก้ |
|---|---|
| `tools/kml2geojson.js` | จัดทิศทางการวนของรูป + ตัดเศษบาง |
| `js/layers/structure/bridge.js` | ชั้นพื้นไม่รับข้อมูลเส้น |
| `js/layers/structure/underpass_box.js` | ชั้นพื้นไม่รับข้อมูลเส้น |
| `js/layers/structure/footing.js` | ชั้นพื้นไม่รับข้อมูลเส้น |
| `js/layers/road.js` | ชั้นพื้นไม่รับข้อมูลเส้น |
| `js/layers/parcel/parcel.js` | ชั้นพื้นไม่รับข้อมูลเส้น |

## 3.4.00 — เฟส 4B: หลัก กม. ทล., Track Progress, SW-LOC

ไฟล์ใหม่ (9)

| ไฟล์ | หน้าที่ |
|---|---|
| `js/layers/doh_km.js` | หลัก กม. กรมทางหลวง + ปุ่ม "กม. ทล." |
| `js/layers/progress/track_progress.js` | Track Progress |
| `js/layers/progress/sw_loc.js` | SW-LOC หมุด/การ์ด/tooltip |
| `js/layers/progress/sw_panel.js` | SW-LOC ตาราง |
| `js/layers/progress/sw_summary.js` | SW-LOC แผงสรุป |
| `css/layers/doh_km.css` | ปุ่ม กม. ทล. |
| `css/layers/track_progress.css` | แผงกราฟ |
| `css/layers/sw_loc.css` | หมุด/การ์ด/tooltip SW-LOC |
| `css/layers/sw_panel.css` | ตาราง + แผงสรุป SW-LOC |

ไฟล์ที่แก้ (5)

| ไฟล์ | สิ่งที่แก้ |
|---|---|
| `js/layers/layer_utils.js` | กล่องป้ายกำหนดสีขอบได้ |
| `js/layers/layers_config.js` | เปิด 3 ชั้นของเฟส 4B |
| `js/ui/layer_panel.js` | ชั้นที่ไม่อยู่ในรายการ (หลัก กม. ทล.) ไม่บันทึกสถานะ |
| `js/boot/app_manifest.js` | เพิ่มสคริปต์/CSS เฟส 4B |
| `README.md` | สถานะเฟส |

## แก้ทั้งสองเวอร์ชัน (ใน zip เป็นของ 3.4.00)

| ไฟล์ | |
|---|---|
| `version.json`, `history.json` | 3.4.00 (มีประวัติ 3.3.05 อยู่ด้วย) |
| `docs/MIGRATION_GUIDE.md` | หัวข้อ 29–30 |
