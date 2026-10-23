# GAS backend — ขั้นตอนตั้งค่า

ไฟล์ `Code.gs` ชุดเดียวใช้ได้ทั้ง map3d / demo / production ต่างกันแค่ **Script Properties**
(ไฟล์นี้อยู่ใน repo เพื่อเก็บประวัติเท่านั้น Netlify ไม่เปิดให้เข้าถึง `/backend/*`)

## 1. Google Sheet

สร้าง Google Sheet ใหม่ (ว่างได้) แล้วคัดลอก ID จาก URL
`https://docs.google.com/spreadsheets/d/<SPREADSHEET_ID>/edit`

## 2. Apps Script

1. https://script.google.com → New project → ตั้งชื่อ `BPNP Map 3D API`
2. ลบโค้ดเดิมใน `Code.gs` แล้ววางโค้ดจาก `backend/gas/Code.gs`
3. Project Settings (รูปเฟือง) → **Script Properties** → เพิ่ม

| Property | ค่า (map3d) |
|---|---|
| `SPREADSHEET_ID` | ID จากข้อ 1 |
| `LINE_CHANNEL_ID` | `2007032148` |
| `ACCESS_MODE` | `allowlist` |
| `ALLOWED_IDS` | LINE userId ของผู้ทดสอบ คั่นด้วยจุลภาค เช่น `Uxxxx,Uyyyy` |
| `DENY_REDIRECT_URL` | `https://liff.line.me/2007032148-uTzLx8Ed` |
| `SESSION_DAYS` | `90` |
| `APP_LABEL` | `map3d` |

4. เลือกฟังก์ชัน `setup` → Run → อนุญาตสิทธิ์ (Sheets + เชื่อมต่อภายนอก)
   ตรวจใน Execution log ว่าขึ้น `✔ setup เสร็จ` และ Sheet มีแท็บ Users, Sessions, UsageLog, EventLog, Config
5. Deploy → **New deployment** → ประเภท **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
6. คัดลอก Web app URL (ลงท้าย `/exec`) → ใส่ใน `js/config.js` → `gasUrl`
7. เปิด URL นั้นในเบราว์เซอร์ ต้องเห็น JSON `"success":true,"code":"OK","configured":true`

**แก้โค้ดภายหลัง:** Deploy → Manage deployments → ดินสอ → Version: **New version** → Deploy (URL เดิม ไม่ต้องแก้ config.js)

## 3. LINE LIFF

LINE Developers → Provider เดิม → LINE Login channel `2007032148` → แท็บ LIFF → **Add**

| ช่อง | ค่า |
|---|---|
| LIFF app name | BPNP Map 3D |
| Size | Full |
| Endpoint URL | `https://bpnp-map3d.netlify.app/` |
| Scopes | ✔ openid ✔ profile |
| Add friend option | Off |

คัดลอก LIFF ID → `js/config.js` → `liffId`
ลิงก์สำหรับแชร์ผู้ใช้: `https://liff.line.me/<LIFF ID>`

## 4. หา LINE userId ของผู้ทดสอบ

ให้ผู้ทดสอบเข้าเว็บ 1 ครั้ง (จะถูกปฏิเสธ) → ดูแท็บ **UsageLog** คอลัมน์ `user_id` แถวที่ action = `Denied (LINE Login)` → คัดลอกไปเพิ่มใน `ALLOWED_IDS`
(Script Properties มีผลทันที ไม่ต้อง deploy ใหม่)

## 5. การดูแลผู้ใช้ใน Sheet

| ต้องการ | ทำที่ |
|---|---|
| ระงับผู้ใช้ | Users → `status` = `blocked` |
| อนุมัติ (โหมด approval) | Users → `status` = `approved` |
| ออกจากระบบเครื่องใดเครื่องหนึ่ง | Sessions → `revoked` = `TRUE` (มีผลภายใน 10 นาที) |
| เปิดใช้ทั่วไป | Script Properties → `ACCESS_MODE` = `open` |

แท็บ Sessions เก็บเฉพาะ hash ของ token (ถ้า Sheet รั่ว token ก็ใช้ไม่ได้)

แนะนำ: Triggers → เพิ่ม `cleanupSessions` แบบ Time-driven รายสัปดาห์ เพื่อลบ session เก่า

## 6. รหัสผลลัพธ์ (`code`)

| code | ความหมาย | หน้าเว็บทำอะไร |
|---|---|---|
| `OK` | ผ่าน | เข้าแอป |
| `PENDING` | รออนุมัติ | หน้า "รอการอนุมัติ" |
| `NOT_ALLOWED` | ไม่อยู่ใน allowlist | redirect ไป `DENY_REDIRECT_URL` (ถ้ามี) |
| `BLOCKED` | ถูกระงับ | หน้าแจ้งข้อผิดพลาด |
| `SESSION_INVALID` / `SESSION_EXPIRED` | session ใช้ไม่ได้ | ล็อกอิน LINE ใหม่ |
| `TOKEN_MISSING` / `TOKEN_INVALID` | ID Token มีปัญหา | ล็อกอิน LINE ใหม่ 1 ครั้ง |
| `BAD_REQUEST` / `UNKNOWN_ACTION` / `SERVER_ERROR` / `SERVER_CONFIG` | ข้อผิดพลาดระบบ | หน้าแจ้งข้อผิดพลาด + ปุ่มลองใหม่ |

ทุกคำตอบมี `apiVersion` (ตอนนี้ = 1) หน้าเว็บจะเตือนใน console ถ้าไม่ตรงกัน
