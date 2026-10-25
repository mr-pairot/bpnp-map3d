# ไฟล์ที่เปลี่ยน: 3.4.00 → 3.4.01

วิธีใช้: แตกไฟล์แล้ววางทับใน repo ตาม path เดิม จากนั้น commit + push
ไม่มีไฟล์ใหม่ / ไม่มีไฟล์ที่ต้องลบ
(ถ้ายังไม่ได้วาง changed_files_3.4.00_docs.zip — ไฟล์ docs/ARCHITECTURE.md ในชุดนี้เป็นฉบับล่าสุดแล้ว)

| ไฟล์ | สิ่งที่แก้ |
|---|---|
| `js/core/alignment.js` | เพิ่ม `pointAt(sta, offset)` หาตำแหน่งจาก STA + ระยะตั้งฉาก |
| `js/layers/structure/height_signs.js` | จุดยึดรายป้าย + tooltip |
| `js/layers/structure/bridge.js` | ป้ายความสูงภาคสนาม 64 ป้าย (กลุ่ม field) |
| `js/ui/layer_panel.js` | ปุ่ม "ป้าย" ของ Bridge เปิดทั้งป้ายสะพานและป้ายภาคสนาม |
| `version.json`, `history.json` | 3.4.01 |
| `docs/MIGRATION_GUIDE.md` | หัวข้อ 31 |
| `docs/ARCHITECTURE.md` | ปิดงานเก็บตก 4A |
