#!/usr/bin/env node
/* tools/kml2geojson.js
 * ─────────────────────────────────────────────────────────────────────────
 * แปลง data/kml/**\/*.kml → data/geojson/**\/*.geojson (โครงโฟลเดอร์เดียวกัน)
 * tools/build.js เรียกให้อัตโนมัติตอน Netlify deploy / รันเองได้: node tools/kml2geojson.js
 *
 * สิ่งที่ทำ
 *   - แปลงด้วย @tmcw/togeojson (ตัวแปลงมาตรฐาน) + @xmldom/xmldom
 *   - MultiGeometry ที่ได้เป็น GeometryCollection → รวมเป็น Multi* (ชนิดเดียวกัน) หรือแยกเป็นหลาย feature
 *   - ตัดค่าความสูง (z) และปัดพิกัดเหลือทศนิยม 7 ตำแหน่ง (~1 ซม.) → ไฟล์เล็กลงมาก
 *   - Polygon หลาย ring → คำนวณ even-odd แบบแม่นยำด้วย XOR (polyclip-ts) ให้ตรงกับที่ Leaflet วาด
 *     (CAD มักส่งชิ้นงานแยกเป็น inner ring นอกรูป หรือส่งเส้นขอบซ้ำหลายชุด)
 *   - ตัด property ด้านสไตล์ของ KML ออก (สไตล์กำหนดใน js/layers/ แทน) เหลือ styleUrl ไว้
 *   - ตัดช่องว่างหัว-ท้ายข้อความ (เช่น "\t12\t" → "12")
 *
 * data/geojson/ สร้างใหม่ทุกครั้ง ไม่ต้องแก้หรือ commit (อยู่ใน .gitignore)
 * ───────────────────────────────────────────────────────────────────────── */
'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT    = path.resolve(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'data', 'kml');
const OUT_DIR = path.join(ROOT, 'data', 'geojson');
const PRECISION = 1e7;

const STYLE_KEYS = /^(styleHash|styleMapHash|stroke|stroke-opacity|stroke-width|fill|fill-opacity|icon|icon-scale|icon-color|icon-opacity|icon-heading|icon-offset|icon-offset-units|label-scale|label-color|label-opacity|visibility|@geometry-type)$/;

function loadDeps() {
  try {
    return {
      DOMParser: require('@xmldom/xmldom').DOMParser,
      togeojson: require('@tmcw/togeojson')
    };
  } catch (err) {
    console.error('✖ ไม่พบไลบรารีแปลง KML — รัน "npm install" ก่อน (Netlify ติดตั้งให้อัตโนมัติจาก package.json)');
    process.exit(1);
  }
}

function listKml(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return listKml(p);
    return /\.kml$/i.test(e.name) ? [p] : [];
  });
}

// ── พิกัด: ตัด z + ปัดทศนิยม ──
const round = n => Math.round(n * PRECISION) / PRECISION;
function cleanCoords(c) {
  if (typeof c[0] === 'number') return [round(c[0]), round(c[1])];
  return c.map(cleanCoords);
}

// ── Polygon แบบ even-odd (วิธีสำรอง) ──
// KML ที่ส่งออกจาก CAD มักใส่ชิ้นงานแยกกันไว้เป็น "inner ring" ทั้งที่อยู่นอก outer ring
// Leaflet (SVG fill-rule: evenodd) วาดชิ้นเหล่านั้นได้ แต่ MapLibre ถือเป็นรู → พื้นหายทั้งรูป
// จึงจัดใหม่ตามความลึกการซ้อน: ซ้อนคู่ (0, 2, ...) = รูปทรง, ซ้อนคี่ = รูของวงที่ครอบใกล้ที่สุด
function ringBox(r) {
  let a = Infinity, b = Infinity, c = -Infinity, d = -Infinity;
  for (const [x, y] of r) { if (x < a) a = x; if (y < b) b = y; if (x > c) c = x; if (y > d) d = y; }
  return [a, b, c, d];
}
function ringArea(r) {
  let s = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) s += (r[j][0] - r[i][0]) * (r[j][1] + r[i][1]);
  return Math.abs(s / 2);
}
function pointInRing(pt, r) {
  let inside = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i], [xj, yj] = r[j];
    if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function evenOddPolygons(rings) {
  rings = rings.filter(r => r.length >= 4);
  if (rings.length <= 1) return rings.length ? [rings] : [];
  const info = rings.map(r => ({ r, box: ringBox(r), area: ringArea(r), parents: [] }));
  info.forEach((a, i) => {
    info.forEach((b, j) => {
      if (i === j || b.area <= a.area) return;
      if (a.box[0] < b.box[0] || a.box[1] < b.box[1] || a.box[2] > b.box[2] || a.box[3] > b.box[3]) return;
      if (pointInRing(a.r[0], b.r) || pointInRing(a.r[Math.floor(a.r.length / 2)], b.r)) a.parents.push(b);
    });
  });
  const polys = new Map();
  info.forEach(a => { if (a.parents.length % 2 === 0) polys.set(a, [a.r]); });
  info.forEach(a => {
    if (a.parents.length % 2 === 0) return;
    const owner = a.parents.filter(p => p.parents.length === a.parents.length - 1).sort((x, y) => x.area - y.area)[0];
    if (owner && polys.has(owner)) polys.get(owner).push(a.r);
    else polys.set(a, [a.r]);
  });
  return Array.from(polys.values());
}
// even-odd แบบแม่นยำ = XOR ของทุก ring (พื้นที่ที่ถูกครอบเป็นจำนวนคี่ครั้ง) — ตรงกับที่ Leaflet/SVG วาด
// รองรับเส้นขอบที่ CAD ส่งออกซ้ำหลายชุด (เช่น outer 3 ชุด + inner 3 ชุด) ซึ่งวิธีดูความลึกการซ้อนตัดสินผิด
let polyclip = null;
const stats = { xor: 0, snapped: 0, fallback: 0 };
function xorRings(rings) {
  rings = rings.filter(r => r.length >= 4);
  if (rings.length <= 1) return rings.length ? [rings] : [];
  if (!polyclip) polyclip = require('polyclip-ts');
  // ลองที่ความละเอียด ~1 ซม. ก่อน ถ้ารูปทรงจาก CAD เสื่อมสภาพจนคำนวณไม่ได้ ลองใหม่ที่ ~10 ซม. / ~20 ซม. / ~1 ม.
  for (const snap of [null, 1e6, 5e5, 1e5]) {
    try {
      const input = snap ? rings.map(r => r.map(([x, y]) => [Math.round(x * snap) / snap, Math.round(y * snap) / snap])) : rings;
      const out = polyclip.xor(...input.map(r => [r]));
      if (snap) stats.snapped++; else stats.xor++;
      return out.map(poly => poly.map(ring => ring.map(([x, y]) => [round(x), round(y)])));
    } catch (err) { /* ลองขั้นถัดไป */ }
  }
  stats.fallback++;
  return evenOddPolygons(rings);   // สำรองสุดท้าย: วิธีดูความลึกการซ้อน
}

function fixPolygon(g) {
  const list = g.type === 'Polygon' ? xorRings(g.coordinates) : g.coordinates.flatMap(xorRings);
  if (!list.length) return null;
  return list.length === 1 ? { type: 'Polygon', coordinates: list[0] } : { type: 'MultiPolygon', coordinates: list };
}

const MULTI = { Point: 'MultiPoint', LineString: 'MultiLineString', Polygon: 'MultiPolygon' };
const BASE  = { MultiPoint: 'Point', MultiLineString: 'LineString', MultiPolygon: 'Polygon' };

// GeometryCollection → [geometry, ...] ที่ MapLibre แสดงได้ตรง ๆ
function normalizeGeometry(g) {
  const out = normalizeRaw(g);
  return out.map(x => (x.type === 'Polygon' || x.type === 'MultiPolygon') ? fixPolygon(x) : x).filter(Boolean);
}

function normalizeRaw(g) {
  if (!g) return [];
  if (g.type !== 'GeometryCollection') return [{ type: g.type, coordinates: cleanCoords(g.coordinates) }];

  const parts = g.geometries.flatMap(normalizeRaw);
  const groups = {};
  parts.forEach(p => {
    const base = BASE[p.type] || p.type;
    (groups[base] = groups[base] || []).push(p);
  });
  return Object.keys(groups).map(base => {
    const list = groups[base];
    if (list.length === 1) return list[0];
    const coords = list.flatMap(p => (BASE[p.type] ? p.coordinates : [p.coordinates]));
    return { type: MULTI[base], coordinates: coords };
  });
}

function cleanProps(props) {
  const out = {};
  Object.keys(props || {}).forEach(k => {
    if (STYLE_KEYS.test(k)) return;
    let v = props[k];
    // description แบบ HTML → togeojson ให้เป็น { '@type': 'html', value } → เก็บเป็นข้อความ
    if (v && typeof v === 'object' && typeof v.value === 'string') v = v.value;
    out[k] = (typeof v === 'string') ? v.trim() : v;
  });
  return out;
}

function convertFile(file, deps) {
  const xml = fs.readFileSync(file, 'utf8');
  const doc = new deps.DOMParser().parseFromString(xml, 'text/xml');
  const fc  = deps.togeojson.kml(doc);

  const features = [];
  let skipped = 0;
  fc.features.forEach(f => {
    const props = cleanProps(f.properties);
    const fb0 = stats.fallback;
    let geoms = normalizeGeometry(f.geometry);
    if (stats.fallback > fb0) {
      console.warn(`  ⚠ ${path.basename(file)} รายการที่ ${fc.features.indexOf(f)} (${props.name || props['Sta.'] || '-'}): คำนวณ even-odd แบบแม่นยำไม่ได้ ใช้วิธีสำรอง — ตรวจการแสดงผลจุดนี้`);
    }
    // Placemark ที่ไม่มีรูปทรงแต่มีพิกัดในข้อมูล (เช่น alignment_20m) → สร้าง Point ให้
    if (!geoms.length) {
      const lat = parseFloat(props.Latitude ?? props.latitude ?? props.lat);
      const lng = parseFloat(props.Longitude ?? props.longitude ?? props.lng ?? props.lon);
      if (isFinite(lat) && isFinite(lng)) geoms = [{ type: 'Point', coordinates: [round(lng), round(lat)] }];
    }
    if (!geoms.length) { skipped++; return; }
    geoms.forEach(geometry => features.push({ type: 'Feature', properties: props, geometry }));
  });
  if (skipped) console.warn(`  ⚠ ${path.basename(file)}: ข้าม ${skipped} รายการที่ไม่มีพิกัด`);
  return { type: 'FeatureCollection', features };
}

function run({ quiet = false } = {}) {
  const deps = loadDeps();
  const files = listKml(SRC_DIR);
  fs.rmSync(OUT_DIR, { recursive: true, force: true });

  let inTotal = 0, outTotal = 0;
  files.forEach(file => {
    const rel = path.relative(SRC_DIR, file);
    const out = path.join(OUT_DIR, rel.replace(/\.kml$/i, '.geojson'));
    const fc  = convertFile(file, deps);
    const json = JSON.stringify(fc);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, json, 'utf8');

    const inSize = fs.statSync(file).size, outSize = Buffer.byteLength(json);
    inTotal += inSize; outTotal += outSize;
    if (!quiet) console.log(`  ${rel.padEnd(34)} ${String(fc.features.length).padStart(5)} features  ${kb(inSize)} → ${kb(outSize)}`);
  });
  console.log(`✔ KML → GeoJSON: ${files.length} ไฟล์ (${kb(inTotal)} → ${kb(outTotal)}) · polygon even-odd: ${stats.xor + stats.snapped} XOR${stats.snapped ? ` (${stats.snapped} ต้องปัดพิกัดหยาบขึ้น)` : ''}${stats.fallback ? `, ⚠ ${stats.fallback} ใช้วิธีสำรอง` : ''}`);
  return files.length;
}

function kb(n) { return (n / 1024 >= 1024 ? (n / 1048576).toFixed(1) + ' MB' : Math.round(n / 1024) + ' KB').padStart(8); }

module.exports = { run, convertFile, normalizeGeometry };

if (require.main === module) run({ quiet: process.argv.includes('--quiet') });
