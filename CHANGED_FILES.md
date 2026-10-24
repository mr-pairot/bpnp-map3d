# ไฟล์ที่เปลี่ยน: 3.1.04 → 3.1.05

วิธีใช้: แตกไฟล์แล้ววางทับใน repo ตาม path เดิม จากนั้น commit + push
ไม่มีไฟล์ใหม่ / ไม่มีไฟล์ที่ต้องลบ

## ไฟล์ที่แก้ (6)

| ไฟล์ | สิ่งที่แก้ |
|---|---|
| `tools/kml2geojson.js` | คำนวณพื้นที่ระบายสีแบบ even-odd ด้วย XOR (ตรงกับ Leaflet) + ลองปัดพิกัดเมื่อรูปทรงเสื่อมสภาพ + แจ้งชื่อจุดที่มีปัญหาใน Deploy log |
| `package.json`, `package-lock.json` | เพิ่มแพ็กเกจ `polyclip-ts` 0.16.8 (ต้องอัปโหลดทั้งคู่) |
| `version.json`, `history.json` | 3.1.05 |
| `docs/MIGRATION_GUIDE.md` | หัวข้อ 20 |

หลัง deploy: Deploy log ควรมีบรรทัด
`✔ KML → GeoJSON: 28 ไฟล์ (...) · polygon even-odd: 2381 XOR (3 ต้องปัดพิกัดหยาบขึ้น)`
