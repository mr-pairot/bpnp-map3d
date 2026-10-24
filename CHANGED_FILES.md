# ไฟล์ที่เปลี่ยน: 3.1.05 → 3.2.00 (เฟส 3)

วิธีใช้: แตกไฟล์แล้ววางทับใน repo ตาม path เดิม จากนั้น commit + push
ไม่มีไฟล์ที่ต้องลบ · **มีโฟลเดอร์ใหม่ `js/layers/parcel/`** — ตรวจให้แน่ใจว่าขึ้น GitHub ครบ

## ไฟล์ใหม่ (10)

| ไฟล์ | หน้าที่ |
|---|---|
| `js/layers/parcel/parcel.js` | แปลงเวนคืน + Pay Out (สีตามสถานะ, popup + รูป, ชี้เมาส์ดูรหัส, กะพริบ) |
| `js/layers/parcel/parcel_legend.js` | legend ข้อมูลพื้นที่เวนคืน |
| `js/layers/parcel/parcel_search.js` | ค้นหารหัสแปลง (แทน leaflet-search) |
| `js/layers/structure/underpass_box.js` | Underpass + Box Culvert + legend Underpass |
| `js/layers/structure/height_signs.js` | ป้ายความสูงช่องลอด + กล่องอธิบาย |
| `js/ui/bottom_panel.js` | แผงตารางรายการแปลงด้านล่าง |
| `css/layers/legend.css` | legend, รายการแปลง, รูปแปลง, ป้ายรหัสแปลง |
| `css/layers/parcel.css` | ช่องค้นหารหัสแปลง |
| `css/layers/structure.css` | popup/ป้าย Underpass, Box Culvert, Pay Out |
| `css/ui/bottom_panel.css` | แผงตารางด้านล่าง |

## ไฟล์ที่แก้ (11)

| ไฟล์ | สิ่งที่แก้ |
|---|---|
| `js/config.js` | `supportedPhase: 3` |
| `js/boot/app_manifest.js` | เพิ่มสคริปต์/CSS เฟส 3 |
| `js/core/namespace.js` | เพิ่ม `BPNP.safeHtml()` (แสดงตัวหนา/ขึ้นบรรทัดจากข้อมูลได้อย่างปลอดภัย) |
| `js/layers/layer_utils.js` | เพิ่ม `bboxCenter`, `legendStack`, `htmlMarkerSet` |
| `js/layers/video_links.js` | เพิ่ม YouTube ตาม กม. ของ Underpass/Box Culvert (+ หน้าต่างเลือกเดือน) |
| `js/map/controls.js` | บอกว่ามีปุ่มเต็มจอ (legend เลื่อนลงใต้ปุ่ม) |
| `js/ui/layer_panel.js` | ปุ่ม "ป้าย" (ป้ายความสูง) + เรียงลำดับ แถบความทึบ → ป้าย → Pier ตามเดิม |
| `version.json`, `history.json` | 3.2.00 |
| `README.md`, `docs/MIGRATION_GUIDE.md` | สถานะเฟส / หัวข้อ 21 |
