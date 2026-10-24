# ไฟล์ที่เปลี่ยน: 3.1.03 → 3.1.04

วิธีใช้: แตกไฟล์แล้ววางทับใน repo ตาม path เดิม จากนั้น commit + push
ไม่มีไฟล์ใหม่ / ไม่มีไฟล์ที่ต้องลบ

## ไฟล์ที่แก้ (5)

| ไฟล์ | สิ่งที่แก้ |
|---|---|
| `css/layers/layers.css` | ย้าย `position: relative` จากราก `.station-marker` ไป `.station-marker-inner` (ต้นเหตุหมุดเลื่อน) |
| `js/layers/railway.js` | ห่อเนื้อหาหมุดสถานีด้วย `.station-marker-inner` |
| `version.json`, `history.json` | 3.1.04 |
| `docs/MIGRATION_GUIDE.md` | หัวข้อ 19 |
