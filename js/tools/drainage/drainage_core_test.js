/* js/tools/drainage/drainage_core_test.js — รัน: node drainage_core_test.js
 * ทดสอบ DrainageCore ด้วย DEM สังเคราะห์ (แผนหัวข้อ 10.1) และส่วนคำนวณของ DrainageDem
 * build() ทดสอบด้วย fetch/createImageBitmap/OffscreenCanvas จำลอง (ไม่ได้ดึง tile จริง)
 */
'use strict';
const assert = require('assert');
const C = require('./drainage_core.js');
const D = require('./drainage_dem.js');

let passed = 0, failed = 0;
const queue = [];
function test(name, fn) { queue.push([name, fn]); }

// กริดสังเคราะห์: f(x, y) → ความสูง · เซลล์ 10 ม. · mask(x, y) → bool
function grid(W, H, f, mask, res) {
  const elev = new Float32Array(W * H), m = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    elev[y * W + x] = f(x, y);
    m[y * W + x] = mask ? (mask(x, y) ? 1 : 0) : 1;
  }
  return { elev, width: W, height: H, res: new Float64Array(H).fill(res || 10), mask: m };
}
const inner = (W, H, b) => (x, y) => x >= b && y >= b && x < W - b && y < H - b;
const at = (g, x, y) => y * g.width + x;

test('1 ลาดเอียงสม่ำเสมอ: ทุกเซลล์ไหลไปทางเดียว (ตะวันตก) และ accumulation เพิ่มเชิงเส้น', () => {
  const g = grid(20, 10, (x, y) => 100 + x);
  const r = C.run(g, {});
  for (let y = 1; y < 9; y++) for (let x = 1; x < 20; x++) assert.strictEqual(r.raster.dir[at(g, x, y)], 4, `(${x},${y})`);
  for (let x = 0; x < 20; x++) assert.ok(Math.abs(r.raster.accAll[at(g, x, 5)] - (20 - x) * 100) < 1e-6);
});

test('2 ร่องรูปตัว V: ลำน้ำอยู่กลางร่อง ไหลลงใต้', () => {
  const W = 21, H = 30;
  const g = grid(W, H, (x, y) => 200 + Math.abs(x - 10) * 2 - y * 0.5, inner(W, H, 1));
  const r = C.run(g, { streamThresholdM2: 3000 });
  assert.ok(r.streams.length >= 1, 'ต้องมีลำน้ำ');
  r.streams.forEach(s => s.coords.forEach(([x]) => assert.ok(Math.abs(x - 10.5) < 1e-9, 'x=' + x)));
  const o = r.outlets[0];
  assert.strictEqual(o.bearing, 180);
  assert.ok(Math.abs(o.coord[0] - 10.5) < 1e-9);
});

test('3 หลุมเดี่ยว: ถูกเติม น้ำไหลออกได้ ไม่มีวงวน', () => {
  const W = 15, H = 15;
  const g = grid(W, H, (x, y) => 50 + x * 0.2 + (x === 7 && y === 7 ? -20 : 0));
  const r = C.run(g, {});
  assert.ok(r.raster.filled[at(g, 7, 7)] > g.elev[at(g, 7, 7)] + 10, 'หลุมต้องถูกยก');
  assert.notStrictEqual(r.raster.dir[at(g, 7, 7)], C._internal.EXIT);
  assert.ok(!r.warnings.some(w => w.includes('วงวน')));
  const path = C.flowPath(r, g, 7, 7);
  assert.ok(path.length > 1);
  const end = path[path.length - 1];
  assert.ok(end[0] < 1 || end[1] < 1 || end[0] > W - 1 || end[1] > H - 1, 'เส้นทางต้องถึงขอบกริด');
});

test('4 พื้นราบสนิท: epsilon ทำให้ทุกเซลล์ภายในมีทิศ และไม่มีวงวน', () => {
  const W = 30, H = 30;
  const g = grid(W, H, () => 10);
  const r = C.run(g, {});
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) assert.notStrictEqual(r.raster.dir[at(g, x, y)], -1);
  assert.ok(!r.warnings.some(w => w.includes('วงวน')));
  assert.ok(r.warnings.some(w => w.includes('ราบ')), 'ต้องเตือนพื้นที่ราบ');
});

test('5 สมดุลพื้นที่: ผลรวมจุดออก = พื้นที่ polygon (DEM สุ่ม, ไม่นับน้ำเข้า)', () => {
  let s = 12345;
  const rnd = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648;
  const W = 60, H = 50, vals = Array.from({ length: W * H }, () => rnd() * 30);
  const g = grid(W, H, (x, y) => vals[y * W + x] + x * 0.3, (x, y) => (x - 30) ** 2 + (y - 25) ** 2 < 18 ** 2);
  const r = C.run(g, { minOutletFrac: 0 });
  assert.ok(Math.abs(r.stats.balance - 1) < 1e-9, 'balance=' + r.stats.balance);
  assert.ok(Math.abs(r.stats.outletTotalM2 - r.stats.areaM2) < 1e-6);
});

test('5b น้ำไหลออกแล้วย้อนเข้ารูป (polygon รูปตัว U): ไม่นับซ้ำ สมดุลยังเป็น 1', () => {
  const W = 30, H = 30;
  // ลาดลงใต้ · polygon รูปตัว U คว่ำ: แขนบน (แถว 5–9) กับแถบล่าง (แถว 15–19) เชื่อมด้วยเสาซ้าย
  const m = (x, y) => (y >= 5 && y < 10 && x >= 5 && x < 25) || (y >= 15 && y < 20 && x >= 5 && x < 25) || (x >= 5 && x < 8 && y >= 5 && y < 20);
  const g = grid(W, H, (x, y) => 100 - y, m);
  const r = C.run(g, { minOutletFrac: 0 });
  assert.ok(Math.abs(r.stats.balance - 1) < 1e-9, 'balance=' + r.stats.balance);
});

test('6 ผลซ้ำได้ (deterministic)', () => {
  const g = grid(40, 40, (x, y) => Math.sin(x / 5) * 10 + Math.cos(y / 7) * 8 + y * 0.2, inner(40, 40, 5));
  const a = C.run(g, { streamThresholdM2: 2000 }), b = C.run(g, { streamThresholdM2: 2000 });
  assert.deepStrictEqual(Array.from(a.raster.dir), Array.from(b.raster.dir));
  assert.deepStrictEqual(a.streams, b.streams);
  assert.deepStrictEqual(a.outlets.map(o => [o.cell, o.areaM2]), b.outlets.map(o => [o.cell, o.areaM2]));
});

test('7 จุดออกบนลาดลงใต้: ขอบใต้ของ polygon รวมเป็นจุดเดียว พื้นที่ = พื้นที่ polygon', () => {
  const W = 30, H = 30;
  const g = grid(W, H, (x, y) => 100 - y, inner(W, H, 8));
  const r = C.run(g, {});
  assert.strictEqual(r.stats.outletCount, 1);
  assert.strictEqual(r.outlets[0].bearing, 180);
  assert.ok(Math.abs(r.outlets[0].areaM2 - 14 * 14 * 100) < 1e-6);
  assert.ok(r.outlets[0].coord[1] > 21 && r.outlets[0].coord[1] < 22, 'อยู่แถวล่างสุดของ polygon');
});

test('8 จุดออกเล็กกว่าเกณฑ์ถูกรวมเป็น "อื่น ๆ" แต่สมดุลยังครบ', () => {
  const W = 40, H = 40;
  // สันกลาง: ครึ่งซ้ายไหลออกตะวันตก ครึ่งขวาไหลออกตะวันออก
  const g = grid(W, H, (x) => 100 - Math.abs(x - 20), inner(W, H, 5));
  const r = C.run(g, { minOutletFrac: 0.6 });
  assert.strictEqual(r.stats.outletCount, 2);
  assert.strictEqual(r.outlets.length, 1, 'ต้องแสดงอย่างน้อยจุดใหญ่สุด 1 จุด');
  assert.ok(r.stats.outletOtherM2 > 0);
  assert.ok(Math.abs(r.stats.balance - 1) < 1e-9);
});

test('9 นับน้ำจากนอกรูป: พื้นที่จุดออกมากกว่า polygon และเตือนพื้นที่รับน้ำถูกตัดที่ขอบ', () => {
  const W = 30, H = 30;
  const g = grid(W, H, (x, y) => 100 - y, inner(W, H, 8));
  const a = C.run(g, { includeInflow: false }), b = C.run(g, { includeInflow: true });
  assert.ok(b.outlets[0].areaM2 > a.outlets[0].areaM2);
  assert.strictEqual(b.stats.balance, null);
  assert.ok(a.warnings.some(w => w.includes('ถูกตัด')), 'ต้นน้ำนอกรูปแตะขอบกริด');
});

test('10 เซลล์ไม่มีข้อมูล (NaN) ถือเป็นทางออก ไม่ทำให้พัง', () => {
  const W = 20, H = 20;
  const g = grid(W, H, (x, y) => (x === 10 && y === 10 ? NaN : 50 + Math.hypot(x - 10, y - 10)));
  const r = C.run(g, {});
  assert.ok(!r.warnings.some(w => w.includes('วงวน')));
  assert.strictEqual(r.raster.dir[at(g, 11, 10)], -1, 'เซลล์ข้าง NaN เป็นจุดเริ่ม → ทางออก');
  assert.ok(Math.abs(r.stats.balance - 1) < 1e-9);
});

test('11 เกณฑ์ลำน้ำสูงเกิน: ไม่มีลำน้ำ และมีคำเตือนให้ลดเกณฑ์', () => {
  const g = grid(20, 20, (x, y) => 100 - y, inner(20, 20, 2));
  const r = C.run(g, { streamThresholdM2: 1e9 });
  assert.strictEqual(r.streams.length, 0);
  assert.ok(r.warnings.some(w => w.includes('ลดเกณฑ์')));
});

test('12 ลำน้ำแยกเส้นที่จุดบรรจบ และเส้นต่อกันพอดี', () => {
  // สองร่องบรรจบกันเป็นรูป Y
  const W = 41, H = 40;
  const f = (x, y) => y < 20 ? 300 - y * 2 + Math.min(Math.abs(x - 10), Math.abs(x - 30)) * 3
                             : 300 - y * 2 + Math.abs(x - 20) * 3 - 5;
  const g = grid(W, H, f, inner(W, H, 1));
  const r = C.run(g, { streamThresholdM2: 5000, simplifyCells: 0 });
  const starts = r.streams.map(s => s.coords[0].join()), ends = r.streams.map(s => s.coords[s.coords.length - 1].join());
  const confl = ends.filter(e => starts.includes(e));
  assert.ok(r.streams.length >= 3, 'ต้องมีอย่างน้อย 3 เส้น (2 สาขา + ลำน้ำหลัก) ได้ ' + r.streams.length);
  assert.ok(confl.length >= 2, 'สองสาขาต้องจบที่จุดเริ่มของลำน้ำหลัก');
});

test('13 ความละเอียดต่างกันต่อแถว: พื้นที่ใช้ res(row)²', () => {
  const g = grid(4, 4, (x, y) => 100 - y);
  g.res = Float64Array.from([10, 20, 30, 40]);
  const r = C.run(g, {});
  assert.ok(Math.abs(r.stats.areaM2 - 4 * (100 + 400 + 900 + 1600)) < 1e-6);
});

test('14 Douglas–Peucker ลดจุดบนเส้นตรง', () => {
  const pts = Array.from({ length: 10 }, (_, i) => [i, 2 * i]);
  assert.deepStrictEqual(C._internal.simplify(pts, 0.5), [[0, 0], [9, 18]]);
});

test('15 ตรวจอินพุต: ขนาดไม่ตรงต้องแจ้ง error', () => {
  assert.throws(() => C.run({ elev: new Float32Array(4), width: 2, height: 2, res: new Float64Array(2), mask: new Uint8Array(3) }), /mask/);
  assert.throws(() => C.run({ elev: new Float32Array(4), width: 2, height: 2, res: new Float64Array(1), mask: new Uint8Array(4) }), /res/);
});

test('16 กริด 1 ล้านเซลล์: คำนวณเสร็จและสมดุล', () => {
  const W = 1000, H = 1000;
  const g = grid(W, H, (x, y) => Math.sin(x / 37) * 20 + Math.cos(y / 53) * 15 + (x + y) * 0.05, inner(W, H, 100));
  const r = C.run(g, {});
  assert.ok(Math.abs(r.stats.balance - 1) < 1e-6);
  console.log('    เวลา (ms):', Object.fromEntries(Object.entries(r.stats.ms).map(([k, v]) => [k, Math.round(v)])));
});

// ── DrainageDem ──
const I = D._internal;

test('17 DEM: แปลงพิกัด lng/lat ↔ พิกเซลกลับไปกลับมาได้', () => {
  const [x, y] = I.lngLatToPx(100.5234, 14.1234, 13), [lng, lat] = I.pxToLngLat(x, y, 13);
  assert.ok(Math.abs(lng - 100.5234) < 1e-9 && Math.abs(lat - 14.1234) < 1e-9);
});

test('18 DEM: ความละเอียดที่ 15°N ตรงกับแผน (z12≈37, z13≈18.5 ม.) และสูตร Terrarium', () => {
  assert.ok(Math.abs(I.resAt(15, 12) - 36.92) < 0.05);
  assert.ok(Math.abs(I.resAt(15, 13) - 18.46) < 0.05);
  assert.strictEqual(I.decodeTerrarium(128, 0, 0), 0);
  assert.strictEqual(I.decodeTerrarium(128, 100, 128), 100.5);
});

test('19 DEM: เลือกซูม 13 สำหรับเป้า 30 ม. และลดซูมเมื่อเกินเพดานเซลล์', () => {
  const sq = [[[100.5, 14.5], [100.52, 14.5], [100.52, 14.52], [100.5, 14.52], [100.5, 14.5]]];
  const o = Object.assign({}, D.DEFAULTS, { maxzoom: 15, maxCells: 4e6 });
  const a = I.planGrid(sq, o);
  assert.strictEqual(a.z, 13);
  assert.ok(a.bufferM >= 500);
  const b = I.planGrid(sq, Object.assign({}, o, { maxCells: a.width * a.height - 1 }));
  assert.strictEqual(b.z, 12);
});

test('20 DEM: mask แบบ scanline เว้นรูของ polygon', () => {
  const W = 20, H = 20, z = 0, px = { x0: 0, y0: 0 };
  const ll = (x, y) => I.pxToLngLat(x, y, z);
  const outer = [[2, 2], [18, 2], [18, 18], [2, 18], [2, 2]].map(p => ll(...p));
  const hole = [[8, 8], [12, 8], [12, 12], [8, 12], [8, 8]].map(p => ll(...p));
  const m = I.rasterizeMask([outer, hole], z, px, W, H);
  const n = m.reduce((s, v) => s + v, 0);
  assert.strictEqual(n, 16 * 16 - 4 * 4);
  assert.strictEqual(m[10 * W + 10], 0, 'กลางรูต้องไม่อยู่ใน mask');
  assert.strictEqual(m[3 * W + 3], 1);
});

test('21 DEM: รับ MultiPolygon และปฏิเสธ LineString', () => {
  const mp = { type: 'MultiPolygon', coordinates: [[[[0, 0], [1, 0], [1, 1], [0, 0]]], [[[2, 2], [3, 2], [3, 3], [2, 2]]]] };
  assert.strictEqual(I.ringsOf(mp).length, 2);
  assert.throws(() => I.ringsOf({ type: 'LineString', coordinates: [] }), /Polygon/);
});

test('22 DEM build: ต่อ tile ถูกตำแหน่ง (fetch/รูปภาพจำลอง) และ tile 404 = ไม่มีข้อมูล', async () => {
  const Z = 13, truth = (gx, gy) => (gx % 1000) * 0.5 + (gy % 1000) * 0.25;   // ความสูงจริงตามพิกเซลโลก
  let missingKey = null;
  global.fetch = async url => {
    const [, z, x, y] = url.match(/(\d+)\/(\d+)\/(\d+)\.png$/).map(Number);
    if (missingKey === null) missingKey = x + '/' + y;
    if (x + '/' + y === missingKey) return { ok: false, status: 404 };
    return { ok: true, status: 200, blob: async () => ({ z, x, y }) };
  };
  global.createImageBitmap = async (b) => ({ width: 256, height: 256, src: b });
  global.OffscreenCanvas = class {
    constructor(w, h) { this.w = w; this.h = h; }
    getContext() {
      const self = this;
      return {
        drawImage(bmp) { self.src = bmp.src; },
        getImageData() {
          const d = new Uint8ClampedArray(256 * 256 * 4);
          for (let j = 0; j < 256; j++) for (let i = 0; i < 256; i++) {
            const v = truth(self.src.x * 256 + i, self.src.y * 256 + j) + 32768;
            const r = Math.floor(v / 256), g = Math.floor(v - r * 256), b = Math.round((v - Math.floor(v)) * 256);
            d.set([r, g, b, 255], (j * 256 + i) * 4);
          }
          return { data: d };
        }
      };
    }
  };
  const poly = { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[100.5, 14.5], [100.53, 14.5], [100.53, 14.53], [100.5, 14.53], [100.5, 14.5]]] } };
  const g = await D.build(poly, { tiles: 'https://t/{z}/{x}/{y}.png', maxzoom: 15, maxCells: 4e6 });
  assert.strictEqual(g.zoom, Z);
  assert.ok(g.meta.tiles > 1 && g.meta.missingTiles === 1);
  let checked = 0, nan = 0;
  for (let row = 0; row < g.height; row += 7) for (let col = 0; col < g.width; col += 7) {
    const v = g.elev[row * g.width + col];
    if (v !== v) { nan++; continue; }
    assert.ok(Math.abs(v - truth(g.originX + col, g.originY + row)) < 1e-3, `(${col},${row})`);
    checked++;
  }
  assert.ok(checked > 50 && nan > 0, 'ต้องมีทั้งค่าที่ตรวจได้และส่วนที่ไม่มีข้อมูลจาก tile 404');
  const inMask = g.mask.reduce((s, v) => s + v, 0);
  const expect = (0.03 * 111320 * Math.cos(14.515 * Math.PI / 180)) * (0.03 * 111320);
  const area = Array.from(g.mask).reduce((s, v, i) => s + (v ? g.res[Math.floor(i / g.width)] ** 2 : 0), 0);
  assert.ok(inMask > 0 && Math.abs(area / expect - 1) < 0.03, 'พื้นที่ mask ≈ พื้นที่ polygon (' + (area / expect).toFixed(4) + ')');
  const ll = D.gridToLngLat(g, 0, 0);
  assert.ok(ll[0] < 100.5 && ll[1] > 14.53, 'มุมซ้ายบนของกริดอยู่นอก polygon (มีระยะเผื่อ)');
  const r = C.run(g, {});
  assert.ok(Math.abs(r.stats.balance - 1) < 1e-6);
});

(async () => {
  for (const [name, fn] of queue) {
    try { await fn(); passed++; console.log('✓ ' + name); }
    catch (e) { failed++; console.log('✗ ' + name + '\n    ' + e.message); }
  }
  console.log('\nผ่าน ' + passed + ' / ไม่ผ่าน ' + failed);
  process.exit(failed ? 1 : 0);
})();
