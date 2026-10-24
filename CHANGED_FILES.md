# ไฟล์ที่เปลี่ยน: 3.1.00 → 3.1.01

วิธีใช้: แตกไฟล์แล้ววางทับใน repo ตาม path เดิม จากนั้น commit + push

ไม่มีไฟล์ใหม่ / ไม่มีไฟล์ที่ต้องลบ

## ไฟล์ที่แก้ (7)

| ไฟล์ | สิ่งที่แก้ |
|---|---|
| `js/config.js` | ใส่ `liffId` = `2007032148-wk1xMGrD` และ `gasUrl` ของ GAS map3d |
| `js/boot/auth.js` | แบ่งขั้นตอนเปิดแอปและบอกขั้นที่ล้มเหลว, หน้าข้อผิดพลาดมีรายละเอียด + ปุ่มคัดลอก, บันทึก `App Error` ลง EventLog, ตรวจ WebGL 2, โหลด MapLibre จาก CDN สำรอง |
| `js/boot/loader.js` | เพิ่ม `BPNP.boot.MAPLIBRE_VERSION` (ต้องตรงกับ `index.html`) |
| `js/map/basemaps.js` | เลือกฟอนต์ป้ายแบบ Regular แทน Italic |
| `version.json` | 3.1.01 + changelog |
| `history.json` | เพิ่มรายการ 3.1.01 |
| `docs/MIGRATION_GUIDE.md` | เพิ่มหัวข้อ 16 |
