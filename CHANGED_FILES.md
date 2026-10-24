# ไฟล์ที่เปลี่ยน: 3.1.02 → 3.1.03

วิธีใช้: แตกไฟล์แล้ววางทับใน repo ตาม path เดิม จากนั้น commit + push
ไม่มีไฟล์ใหม่ / ไม่มีไฟล์ที่ต้องลบ

## ไฟล์ที่แก้ (7)

| ไฟล์ | สิ่งที่แก้ |
|---|---|
| `js/map/layer_registry.js` | เก็บ error ล่าสุดของแต่ละชั้นข้อมูล |
| `js/ui/layer_panel.js` | ข้อความแจ้งเตือนบอกสาเหตุ + บันทึก `App Warning` |
| `js/app.js` | ตรวจตอนเปิดแอปว่า deploy นี้มี data/geojson หรือไม่ |
| `tools/build.js` | หยุด build พร้อมข้อความชัดเจนถ้าไม่พบไฟล์ KML |
| `version.json`, `history.json` | 3.1.03 |
| `docs/MIGRATION_GUIDE.md` | หัวข้อ 18 |

## ใส่มาเพิ่ม (ไม่ได้แก้ แต่ต้องมีใน repo เพื่อให้ Netlify แปลงข้อมูลได้)

| ไฟล์ | หน้าที่ |
|---|---|
| `package.json`, `package-lock.json` | ให้ Netlify ติดตั้งตัวแปลง KML |
| `netlify.toml` | คำสั่ง build + Node 22 |
| `tools/kml2geojson.js` | ตัวแปลง KML → GeoJSON |

ตรวจด้วยว่าใน repo มีโฟลเดอร์ `data/kml/` ครบ 6 โฟลเดอร์ย่อย: alignment, footing, parcel, railway, road, structure
