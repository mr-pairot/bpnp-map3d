#!/usr/bin/env node
/* tools/build.js
 * ─────────────────────────────────────────────────────────────────────────
 * รันอัตโนมัติทุกครั้งที่ Netlify deploy (ดู [build] ใน netlify.toml)
 *
 *   0) แปลง data/kml → data/geojson (tools/kml2geojson.js — ต้อง npm install ก่อน)
 *   1) dataVersions : hash ของแต่ละไฟล์ใน data/ (รวมโฟลเดอร์ย่อย) → version.json
 *                     คีย์ = path ใต้ data/ ตัวพิมพ์เล็ก เช่น "kml/structure/underpass.kml"
 *                     ไฟล์ไหนเปลี่ยน ผู้ใช้โหลดใหม่เฉพาะไฟล์นั้น (js/core/data_cache.js ใช้คีย์เดียวกัน)
 *   2) build        : hash รวมของ js/ + css/ + sw.js + index.html → version.json และ APP_VERSION ใน index.html
 *                     แก้โค้ดไฟล์ไหนก็ตาม ผู้ใช้ได้โค้ดใหม่ทั้งชุด / แก้แค่ข้อมูล โค้ดไม่ต้องโหลดใหม่
 *
 * ไม่ต้องแก้ APP_VERSION เองอีก — ใน GitHub ให้คงเป็น '__APP_BUILD__'
 * ส่วนเลขที่ผู้ใช้เห็น ("version" ใน version.json) ยังแก้เองตามปกติ
 *
 * วิธีใช้ (ปกติ Netlify รันให้):  node tools/build.js
 * ไม่ต้องติดตั้งแพ็กเกจเพิ่ม ใช้ Node.js อย่างเดียว
 * ───────────────────────────────────────────────────────────────────────── */
'use strict';

const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');

const ROOT         = path.resolve(__dirname, '..');
const DATA_DIR     = path.join(ROOT, 'data');
const VERSION_FILE = path.join(ROOT, 'version.json');
const INDEX_FILE   = path.join(ROOT, 'index.html');
const CODE_DIRS    = ['js', 'css'];
const CODE_FILES   = ['sw.js'];
const DATA_EXT     = /\.(kml|json|geojson|csv|txt)$/i;
const CODE_EXT     = /\.(js|css)$/i;
const APP_VERSION_LINE = /(window\.APP_VERSION\s*=\s*)(['"])[^'"]*\2(\s*;)/;

function md5(buf) {
    return crypto.createHash('md5').update(buf).digest('hex');
}

function listFiles(dir, filter) {
    if (!fs.existsSync(dir)) return [];
    const out = [];
    for (const name of fs.readdirSync(dir)) {
        const full = path.join(dir, name);
        const stat = fs.statSync(full);
        if (stat.isDirectory()) out.push(...listFiles(full, filter));
        else if (filter.test(name)) out.push(full);
    }
    return out;
}

function fail(msg) {
    console.error('✖ ' + msg);
    process.exit(1);
}

// ── 1) dataVersions ──
function buildDataVersions() {
    if (!fs.existsSync(DATA_DIR)) fail('ไม่พบโฟลเดอร์ data/');
    const versions = {};
    const seen = {};
    listFiles(DATA_DIR, DATA_EXT)
        .map(f => path.relative(DATA_DIR, f).split(path.sep).join('/'))
        .sort((a, b) => a.localeCompare(b))
        .forEach(rel => {
            const key = rel.toLowerCase();
            if (seen[key]) fail(`ชื่อไฟล์ข้อมูลซ้ำกันเมื่อไม่สนตัวพิมพ์: ${seen[key]} / ${rel}`);
            seen[key] = rel;
            versions[key] = md5(fs.readFileSync(path.join(DATA_DIR, rel))).slice(0, 10);
        });
    return versions;
}

// ── 2) build hash ของโค้ด (เรียงชื่อไฟล์ก่อน → ได้ค่าเดิมเสมอถ้าเนื้อหาไม่เปลี่ยน) ──
function buildCodeHash() {
    const files = [
        ...CODE_DIRS.flatMap(d => listFiles(path.join(ROOT, d), CODE_EXT)),
        ...CODE_FILES.map(f => path.join(ROOT, f)).filter(f => fs.existsSync(f))
    ]
        .map(f => path.relative(ROOT, f).split(path.sep).join('/'))
        .sort((a, b) => a.localeCompare(b));

    const hash = crypto.createHash('md5');
    files.forEach(rel => {
        hash.update(rel + '\n');
        hash.update(fs.readFileSync(path.join(ROOT, rel)));
        hash.update('\n');
    });
    // index.html: ตัดบรรทัด APP_VERSION ออกก่อน hash (บรรทัดนี้ถูกเขียนทับด้วยผลลัพธ์เอง)
    const html = fs.readFileSync(INDEX_FILE, 'utf8').replace(APP_VERSION_LINE, '$1$3');
    hash.update('index.html\n' + html);
    return { build: hash.digest('hex').slice(0, 8), count: files.length + 1 };
}

function main() {
    // 0) KML → GeoJSON (data/kml → data/geojson) ก่อนคำนวณเวอร์ชันข้อมูล
    const converted = require('./kml2geojson.js').run({ quiet: true });
    if (!converted) fail('ไม่พบไฟล์ KML ใน data/kml/ — ไม่มีข้อมูลให้แปลง (ตรวจว่าอัปโหลดโฟลเดอร์ data/kml ครบ)');

    let versionJson = {};
    if (fs.existsSync(VERSION_FILE)) {
        try {
            versionJson = JSON.parse(fs.readFileSync(VERSION_FILE, 'utf8'));
        } catch (err) {
            fail('version.json อ่านไม่ได้ (รูปแบบ JSON ไม่ถูกต้อง): ' + err.message);
        }
    }

    const dataVersions = buildDataVersions();
    const before       = versionJson.dataVersions || {};
    const changedData  = Object.keys(dataVersions).filter(k => before[k] !== dataVersions[k]);
    const { build, count } = buildCodeHash();

    versionJson.build        = build;
    versionJson.dataVersions = dataVersions;
    fs.writeFileSync(VERSION_FILE, JSON.stringify(versionJson, null, 2) + '\n', 'utf8');

    const html = fs.readFileSync(INDEX_FILE, 'utf8');
    if (!APP_VERSION_LINE.test(html)) fail("ไม่พบบรรทัด window.APP_VERSION = '...'; ใน index.html");
    fs.writeFileSync(INDEX_FILE, html.replace(APP_VERSION_LINE, `$1'${build}'$3`), 'utf8');

    console.log(`✔ version : ${versionJson.version || '(ไม่ได้ระบุ)'}`);
    console.log(`✔ build   : ${build} (จากโค้ด ${count} ไฟล์)`);
    console.log(`✔ dataVersions: ${Object.keys(dataVersions).length} ไฟล์`);
    console.log(changedData.length ? '  ข้อมูลที่เปลี่ยน: ' + changedData.join(', ') : '  ไม่มีไฟล์ข้อมูลเปลี่ยน');
}

main();
