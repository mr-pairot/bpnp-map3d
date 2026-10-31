/* tools/build-address-data.js
 * ─────────────────────────────────────────────────────────────────────────
 * สร้าง data/json/thai_address.json สำหรับ "ค้นหาพิกัดจากที่อยู่" (js/tools/search/address.js)
 * ต้นทาง: kongvut/thai-province-data — api/latest/province_with_district_and_sub_district.json (schema v3)
 * ย่อเหลือเฉพาะที่ใช้: ชื่อไทย, คำนำหน้า (อำเภอ/เขต, ตำบล/แขวง), รหัสไปรษณีย์, lat/lng กลางตำบล
 *
 * ไม่ได้รันตอน build บน Netlify — รันเองเมื่อต้องการอัปเดตข้อมูล แล้ว commit ไฟล์ผลลัพธ์
 *   node tools/build-address-data.js                  ใช้ commit ที่ตรึงไว้ (REF ด้านล่าง)
 *   node tools/build-address-data.js --ref master     ใช้ข้อมูลล่าสุด
 *   node tools/build-address-data.js --src <ไฟล์>     อ่านจากไฟล์ในเครื่องแทนการดาวน์โหลด
 * ต้องใช้ Node 18 ขึ้นไป (มี fetch ในตัว)
 * ───────────────────────────────────────────────────────────────────────── */
'use strict';
const fs = require('fs');
const path = require('path');

const REPO = 'kongvut/thai-province-data';
const REF = '07319ed';   // commit 2026-10-28 (schema v3.1)
const FILE = 'api/latest/province_with_district_and_sub_district.json';
const OUT = path.join(__dirname, '..', 'data', 'json', 'thai_address.json');

function arg(name) {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : null;
}

const alive = (x) => !x.deleted_at;
const prefixTh = (x) => (x.prefix && x.prefix.th) || '';
const num = (v) => (v === null || v === undefined || v === '' || isNaN(Number(v)) ? null : Number(v));

function transform(src, ref) {
  if (!Array.isArray(src) || !src.length || !src[0].name || !Array.isArray(src[0].districts)) {
    throw new Error('รูปแบบข้อมูลไม่ตรงกับ schema v3 (name.th / districts / sub_districts) — ตรวจ CHANGELOG ของ repo ต้นทาง');
  }
  let nd = 0, ns = 0, nll = 0;
  const provinces = src.filter(alive).map((p) => [
    p.name.th,
    p.districts.filter(alive).map((d) => {
      nd++;
      return [
        prefixTh(d),
        d.name.th,
        d.sub_districts.filter(alive).map((s) => {
          ns++;
          const lat = num(s.lat), lng = num(s.long);
          if (lat !== null && lng !== null) nll++;
          return [prefixTh(s), s.name.th, num(s.zip_code), lat, lng];
        })
      ];
    })
  ]);
  return {
    data: {
      meta: {
        source: `https://github.com/${REPO}/blob/${ref}/${FILE}`,
        license: 'MIT © Kongvut Sangkla',
        generated: new Date().toISOString().slice(0, 10),
        format: 'provinces: [ชื่อจังหวัด, [[คำนำหน้าอำเภอ, ชื่ออำเภอ, [[คำนำหน้าตำบล, ชื่อตำบล, รหัสไปรษณีย์, lat, lng], ...]], ...]]',
        counts: { provinces: provinces.length, districts: nd, subDistricts: ns, withLatLng: nll }
      },
      provinces
    },
    nd, ns, nll
  };
}

async function main() {
  const ref = arg('--ref') || REF;
  const srcPath = arg('--src');
  let src;
  if (srcPath) {
    src = JSON.parse(fs.readFileSync(srcPath, 'utf8'));
  } else {
    const url = `https://raw.githubusercontent.com/${REPO}/${ref}/${FILE}`;
    console.log('ดาวน์โหลด', url);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`ดาวน์โหลดไม่สำเร็จ HTTP ${res.status}`);
    src = await res.json();
  }
  const { data, nd, ns, nll } = transform(src, ref);
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const text = JSON.stringify(data);
  fs.writeFileSync(OUT, text);
  console.log(`เขียน ${path.relative(process.cwd(), OUT)} (${(Buffer.byteLength(text) / 1024).toFixed(0)} KB)`);
  console.log(`จังหวัด ${data.provinces.length} อำเภอ/เขต ${nd} ตำบล/แขวง ${ns} มีพิกัด ${nll}`);
}

main().catch((err) => { console.error('❌', err.message); process.exit(1); });
