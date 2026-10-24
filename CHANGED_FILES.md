# ไฟล์ที่เปลี่ยน: 3.2.02 → 3.3.00 (เฟส 4A ระบบสะพาน)

วิธีใช้: แตกไฟล์แล้ววางทับใน repo ตาม path เดิม จากนั้น commit + push
ไม่มีไฟล์ที่ต้องลบ · ไฟล์ใหม่ 3 ไฟล์อยู่ในโฟลเดอร์ `js/layers/structure/` — ตรวจว่าขึ้น GitHub ครบ

## ไฟล์ใหม่ (5)

| ไฟล์ | หน้าที่ |
|---|---|
| `js/layers/structure/bridge.js` | ชั้น Bridge (เหล็ก/คอนกรีต/Overpass), ป้าย, การ์ดความคืบหน้า |
| `js/layers/structure/bridge_panel.js` | ตารางความก้าวหน้างานสะพาน |
| `js/layers/structure/bridge_alert.js` | แจ้งเตือนงานสะพานล่าช้า + แผงตั้งเกณฑ์ |
| `css/layers/bridge.css` | ตารางสะพาน + ความกว้างการ์ด |
| `css/layers/bridge_alert.css` | ปุ่ม/แผง/จุดกระเพื่อมแจ้งเตือน (จำกัดขอบเขต CSS แล้ว) |

## ไฟล์ที่แก้ (12)

| ไฟล์ | สิ่งที่แก้ |
|---|---|
| `js/map/popup.js` | popup อยู่เหนือจุด + เลื่อนแผนที่ให้เห็นทั้งใบ (เหมือน Leaflet) |
| `js/layers/structure/height_signs.js` | ตำแหน่งป้ายแยกตามกลุ่ม (สะพาน: ใต้วงกลม) |
| `js/ui/ui_manager.js` | เรียงส่วนควบคุมคอลัมน์ซ้ายอัตโนมัติ |
| `js/layers/parcel/parcel_search.js` | ใช้การเรียงคอลัมน์ซ้าย |
| `js/layers/layers_config.js` | ป้าย "เฟส 4B" ของชั้นที่ยังไม่ทำ |
| `js/ui/layer_panel.js` | แสดงป้ายเฟสย่อย |
| `js/config.js` | `supportedPhase: 4` |
| `js/boot/app_manifest.js` | เพิ่มสคริปต์/CSS สะพาน |
| `version.json`, `history.json` | 3.3.00 |
| `README.md`, `docs/MIGRATION_GUIDE.md` | สถานะเฟส / หัวข้อ 24 |
