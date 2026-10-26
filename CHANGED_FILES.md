# ไฟล์ที่เปลี่ยน: 3.4.02 → 3.6.00 (รวมเฟส 5A + 5B)

ใช้กรณี repo ยังเป็น 3.4.02 — วางทับครั้งเดียวได้ทั้ง 5A และ 5B
วิธีใช้: แตกไฟล์แล้ววางทับใน repo ตาม path เดิม จากนั้น commit + push
ไม่มีไฟล์ที่ต้องลบ · **มีโฟลเดอร์ใหม่ `js/tools/search/`** — ตรวจว่าขึ้น GitHub ครบ 4 ไฟล์

## 5A — ค้นหา กม. (3.5.00) · ไฟล์ใหม่ 3

| ไฟล์ | หน้าที่ |
|---|---|
| `js/tools/tool_utils.js` | ตัวช่วยร่วมของเครื่องมือเฟส 5 |
| `js/tools/search_km.js` | ค้นหา กม. (ปุ่มซ้ายบนสุด) |
| `css/tools/search_km.css` | แผงค้นหา กม. |

## 5B — แผงค้นหา/พิกัด (3.6.00) · ไฟล์ใหม่ 8

| ไฟล์ | หน้าที่ |
|---|---|
| `js/tools/search/hub.js` | แผง 5 โหมด + เส้นทาง + ที่อยู่จากพิกัด |
| `js/tools/search/address.js` | ค้นหาพิกัดจากที่อยู่ |
| `js/tools/search/utm_convert.js` | แปลง UTM ทีละจุด |
| `js/tools/search/utm_multi.js` | แปลง UTM หลายแถว |
| `css/tools/search_hub.css`, `search_address.css`, `utm_convert.css`, `utm_multi.css` | สไตล์ |

## ไฟล์ที่แก้ (7)

| ไฟล์ | สิ่งที่แก้ |
|---|---|
| `js/boot/app_manifest.js` | เพิ่มเครื่องมือ 5A + 5B |
| `js/config.js` | เพิ่มคีย์ Longdo (`keys.longdoServices`) ค่าเดิมจากโค้ดเก่า |
| `version.json`, `history.json` | 3.6.00 (มีประวัติ 3.5.00 อยู่ด้วย) |
| `README.md` | ตารางเฟส 5A/5B/5C |
| `docs/MIGRATION_GUIDE.md`, `docs/ARCHITECTURE.md` | หัวข้อ 33–34 + ผัง |
