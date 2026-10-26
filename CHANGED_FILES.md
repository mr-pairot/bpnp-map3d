# ไฟล์ที่เปลี่ยน: 3.6.00 → 3.7.00 (เฟส 5C)

วิธีใช้: แตกไฟล์แล้ววางทับใน repo ตาม path เดิม จากนั้น commit + push
ไม่มีไฟล์ที่ต้องลบ · **มีโฟลเดอร์ใหม่ `js/tools/measure/`** — ตรวจว่าขึ้น GitHub ครบ 5 ไฟล์

## ไฟล์ใหม่ (6)

| ไฟล์ | หน้าที่ |
|---|---|
| `js/tools/measure/lcompat.js` | Leaflet ชุดย่อยบน MapLibre สำหรับเครื่องมือวัด |
| `js/tools/measure/measure_plus.js` | วัดระยะ/พื้นที่/วงกลม (เดิม mp.js) |
| `js/tools/measure/excavate.js` | ปริมาตรบ่อขุด (เดิม mpex.js) |
| `js/tools/measure/embankment.js` | ปริมาตรดินถม (เดิม mpem.js) |
| `js/tools/measure/index.js` | สร้างเครื่องมือ + ปุ่ม |
| `css/tools/measure.css` | สไตล์เครื่องมือวัด (เดิม mp.css) |

## ไฟล์ที่แก้ (6)

| ไฟล์ | สิ่งที่แก้ |
|---|---|
| `js/boot/app_manifest.js` | เพิ่มเครื่องมือวัด |
| `version.json`, `history.json` | 3.7.00 |
| `README.md` | ตารางเฟส |
| `docs/MIGRATION_GUIDE.md`, `docs/ARCHITECTURE.md` | หัวข้อ 35 + ผัง |
