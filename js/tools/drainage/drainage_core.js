/* js/tools/drainage/drainage_core.js
 * ─────────────────────────────────────────────────────────────────────────
 * เฟส P1: อัลกอริทึมเส้นทางน้ำจากผิวดิน — ฟังก์ชันล้วน ไม่แตะ DOM/แผนที่ (พร้อมย้ายไปรันใน Web Worker)
 *   fill (Priority-Flood + ε) → ทิศการไหล D8 → พื้นที่รับน้ำสะสม → ลำน้ำ → จุดน้ำออกจาก polygon
 *
 * อินพุต grid:
 *   elev   Float32Array (ม.) แถวต่อแถว จากเหนือลงใต้ · NaN = ไม่มีข้อมูล
 *   width, height
 *   res    Float64Array(height) ความยาวด้านเซลล์ภาคพื้นดินของแต่ละแถว (ม.) — กริด Web Mercator เซลล์จึงเป็นจัตุรัส
 *   mask   Uint8Array 1 = อยู่ใน polygon
 *
 * ผลลัพธ์อยู่ในพิกัดกริด [x, y] (x = คอลัมน์ + 0.5 = กลางเซลล์) — ผู้เรียกแปลงเป็น lng/lat เอง
 * ไม่ใช่แบบจำลองน้ำท่วม: ไม่มีฝน การซึม ระดับน้ำ หรือเวลา
 * ─────────────────────────────────────────────────────────────────────────
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DrainageCore = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // เพื่อนบ้าน D8: 0=E 1=SE 2=S 3=SW 4=W 5=NW 6=N 7=NE (แถวเพิ่ม = ลงใต้)
  const DX = [1, 1, 0, -1, -1, -1, 0, 1];
  const DY = [0, 1, 1, 1, 0, -1, -1, -1];
  const DIST = [1, Math.SQRT2, 1, Math.SQRT2, 1, Math.SQRT2, 1, Math.SQRT2];
  const BEARING = [90, 135, 180, 225, 270, 315, 0, 45];
  const EXIT = -1;

  const DEFAULTS = {
    epsilon: 1e-5,            // ม. ที่ยกต่อขั้นตอนตอนเติมหลุม (กันพื้นราบที่น้ำไหลไม่ได้)
    streamThresholdM2: 5e5,   // เกณฑ์ลำน้ำ = พื้นที่รับน้ำ (ม²) ไม่ขึ้นกับความละเอียด — 0.5 กม²
    streamScope: 'mask',      // 'mask' = แสดงลำน้ำเฉพาะใน polygon · 'all' = ทั้งกริด (รวมระยะเผื่อ)
    includeInflow: false,     // true = จุดออกนับน้ำที่ไหลเข้ามาจากนอก polygon ด้วย
    minOutletFrac: 0.01,      // จุดออกที่รับน้ำน้อยกว่าสัดส่วนนี้ของพื้นที่ polygon ไม่แสดงแยก (รวมเป็น "อื่น ๆ")
    simplifyCells: 0.5,       // Douglas–Peucker (หน่วยเซลล์)
    flatSlope: 0.005          // ความลาดเฉลี่ยต่ำกว่านี้ (0.5%) → เตือนพื้นที่ราบ
  };

  // ── ฮีปน้อยสุดของดัชนีเซลล์ เรียงตามค่า key แล้วตามดัชนี (ผลซ้ำได้ทุกครั้ง) ──
  function MinHeap(cap, key) {
    const h = new Int32Array(cap);
    let n = 0;
    const less = (a, b) => key[a] < key[b] || (key[a] === key[b] && a < b);
    this.size = () => n;
    this.push = function (v) {
      let i = n++;
      h[i] = v;
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (!less(h[i], h[p])) break;
        const t = h[i]; h[i] = h[p]; h[p] = t; i = p;
      }
    };
    this.pop = function () {
      const top = h[0];
      h[0] = h[--n];
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < n && less(h[l], h[m])) m = l;
        if (r < n && less(h[r], h[m])) m = r;
        if (m === i) break;
        const t = h[i]; h[i] = h[m]; h[m] = t; i = m;
      }
      return top;
    };
  }

  const isValid = v => v === v && v > -1e4;   // ไม่ใช่ NaN และไม่ใช่ค่าว่างผิดปกติ

  // ── 1) เติมหลุม: Priority-Flood + ε (Barnes et al., 2014) ──
  // จุดเริ่ม = เซลล์ขอบกริด และเซลล์ที่ติดกับเซลล์ไม่มีข้อมูล (ถือเป็นทางออกของน้ำ)
  function fill(elev, W, H, eps) {
    const N = W * H;
    const z = new Float64Array(N);
    const seen = new Uint8Array(N);
    const seed = new Uint8Array(N);
    const heap = new MinHeap(N, z);
    for (let i = 0; i < N; i++) z[i] = isValid(elev[i]) ? elev[i] : NaN;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (z[i] !== z[i]) { seen[i] = 1; continue; }
        let edge = x === 0 || y === 0 || x === W - 1 || y === H - 1;
        if (!edge) for (let k = 0; k < 8; k++) { const j = (y + DY[k]) * W + x + DX[k]; if (z[j] !== z[j]) { edge = true; break; } }
        if (edge) { seen[i] = 1; seed[i] = 1; heap.push(i); }
      }
    }
    let raised = 0;
    while (heap.size()) {
      const c = heap.pop(), cx = c % W, cy = (c - cx) / W;
      for (let k = 0; k < 8; k++) {
        const nx = cx + DX[k], ny = cy + DY[k];
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const j = ny * W + nx;
        if (seen[j]) continue;
        seen[j] = 1;
        const floor = z[c] + eps;
        if (z[j] < floor) { if (floor - z[j] > 1e-3) raised++; z[j] = floor; }
        heap.push(j);
      }
    }
    return { z, seed, raised };
  }

  // ── 2) ทิศการไหล D8 (ลาดลงชันสุด ระยะแนวทแยง √2 เท่า) ──
  // เซลล์จุดเริ่มที่ไม่มีเพื่อนบ้านต่ำกว่า = ทางออก (EXIT)
  function flowDirections(z, W, H) {
    const N = W * H;
    const dir = new Int8Array(N).fill(EXIT);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (z[i] !== z[i]) continue;
        let best = 0, bk = EXIT;
        for (let k = 0; k < 8; k++) {
          const nx = x + DX[k], ny = y + DY[k];
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const zn = z[ny * W + nx];
          if (!(zn < z[i])) continue;            // NaN ตกเงื่อนไขนี้ด้วย
          const s = (z[i] - zn) / DIST[k];
          if (s > best) { best = s; bk = k; }
        }
        dir[i] = bk;
      }
    }
    return dir;
  }

  const downstream = (i, d, W, H) => {
    if (d === EXIT) return -1;
    const x = i % W, y = (i - x) / W, nx = x + DX[d], ny = y + DY[d];
    return (nx < 0 || ny < 0 || nx >= W || ny >= H) ? -1 : ny * W + nx;
  };

  // ── 3) พื้นที่รับน้ำสะสม: เรียงแบบ topological (นับ in-degree + คิว) ไม่ใช้ recursion ──
  //   accAll = ทุกเซลล์มีน้ำหนักเต็ม · accIn = เฉพาะเซลล์ใน mask และส่งต่อเฉพาะในรูป · cut = ต้นน้ำแตะขอบกริด (พื้นที่รับน้ำถูกตัด)
  function accumulate(grid, dir) {
    const { width: W, height: H, res, mask } = grid;
    const N = W * H;
    const down = new Int32Array(N);
    const indeg = new Int32Array(N);
    for (let i = 0; i < N; i++) { const d = downstream(i, dir[i], W, H); down[i] = d; if (d >= 0) indeg[d]++; }
    const accAll = new Float64Array(N), accIn = new Float64Array(N);
    const cut = new Uint8Array(N);
    for (let y = 0; y < H; y++) {
      const a = res[y] * res[y];
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (grid.elev[i] !== grid.elev[i]) continue;
        accAll[i] = a;
        if (mask[i]) accIn[i] = a;
        if (x === 0 || y === 0 || x === W - 1 || y === H - 1) cut[i] = 1;
      }
    }
    const order = new Int32Array(N);
    let head = 0, tail = 0;
    for (let i = 0; i < N; i++) if (indeg[i] === 0) order[tail++] = i;
    while (head < tail) {
      const i = order[head++], d = down[i];
      if (d < 0) continue;
      accAll[d] += accAll[i];
      if (mask[i] && mask[d]) accIn[d] += accIn[i];   // น้ำในรูปนับที่จุดออกแรกเท่านั้น (ไหลออกแล้วย้อนเข้ารูปไม่นับซ้ำ)
      if (cut[i]) cut[d] = 1;
      if (--indeg[d] === 0) order[tail++] = d;
    }
    return { down, accAll, accIn, cut, order, ordered: tail };
  }

  // ── Douglas–Peucker สำหรับเส้นในพิกัดกริด ──
  function simplify(pts, tol) {
    if (pts.length < 3 || !(tol > 0)) return pts;
    const keep = new Uint8Array(pts.length);
    keep[0] = keep[pts.length - 1] = 1;
    const stack = [[0, pts.length - 1]], t2 = tol * tol;
    while (stack.length) {
      const [a, b] = stack.pop();
      const [ax, ay] = pts[a], [bx, by] = pts[b];
      const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
      let md = -1, mi = -1;
      for (let i = a + 1; i < b; i++) {
        const [px, py] = pts[i];
        let t = L2 ? ((px - ax) * dx + (py - ay) * dy) / L2 : 0;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const ex = ax + t * dx - px, ey = ay + t * dy - py, d2 = ex * ex + ey * ey;
        if (d2 > md) { md = d2; mi = i; }
      }
      if (md > t2) { keep[mi] = 1; stack.push([a, mi], [mi, b]); }
    }
    return pts.filter((_, i) => keep[i]);
  }

  const center = (i, W) => { const x = i % W; return [x + 0.5, (i - x) / W + 0.5]; };
  const widthFor = (acc, thr) => Math.max(1, Math.min(6, 1 + 1.6 * Math.log10(acc / thr)));

  // ── 4) ลำน้ำ: เซลล์ที่ accAll ≥ เกณฑ์ เดินตามทิศ D8 จากต้นน้ำ/จุดบรรจบ ──
  function extractStreams(grid, dir, acc, p) {
    const { width: W, height: H, mask } = grid;
    const N = W * H, thr = p.streamThresholdM2;
    const isS = new Uint8Array(N);
    for (let i = 0; i < N; i++) if (acc.accAll[i] >= thr && (p.streamScope === 'all' || mask[i])) isS[i] = 1;
    const donors = new Uint8Array(N);
    for (let i = 0; i < N; i++) if (isS[i]) { const d = acc.down[i]; if (d >= 0 && isS[d]) donors[d]++; }
    const lines = [];
    for (let i = 0; i < N; i++) {
      if (!isS[i] || donors[i] === 1) continue;           // จุดเริ่มเส้น = ต้นน้ำ (0) หรือจุดบรรจบ (≥2)
      const pts = [center(i, W)];
      let c = i, last = i;
      for (;;) {
        const d = acc.down[c];
        if (d < 0) break;
        pts.push(center(d, W));                            // ต่อถึงเซลล์ถัดไปเสมอ เส้นจึงต่อกันที่จุดบรรจบ/ขอบ polygon
        last = d;
        if (!isS[d] || donors[d] !== 1) break;
        c = d;
      }
      if (pts.length < 2) continue;
      const a = acc.accAll[isS[last] ? last : c];
      lines.push({ coords: simplify(pts, p.simplifyCells), accM2: a, widthPx: +widthFor(a, thr).toFixed(2) });
    }
    return lines;
  }

  // ── 5) จุดน้ำออก: เซลล์ใน mask ที่น้ำไหลออกนอก mask/นอกกริด · รวมเซลล์ที่ติดกัน (8 ทิศ) เป็นจุดเดียว ──
  function extractOutlets(grid, dir, acc, p, maskArea) {
    const { width: W, height: H, mask } = grid;
    const N = W * H;
    const val = p.includeInflow ? acc.accAll : acc.accIn;
    const isO = new Uint8Array(N);
    for (let i = 0; i < N; i++) {
      if (!mask[i] || grid.elev[i] !== grid.elev[i]) continue;
      const d = acc.down[i];
      if (d < 0 || !mask[d]) isO[i] = 1;
    }
    const seen = new Uint8Array(N), groups = [];
    for (let i = 0; i < N; i++) {
      if (!isO[i] || seen[i]) continue;
      const stack = [i]; seen[i] = 1;
      let area = 0, best = i, cells = 0, cut = 0;
      while (stack.length) {
        const c = stack.pop(), cx = c % W, cy = (c - cx) / W;
        area += val[c]; cells++;
        if (acc.cut[c]) cut = 1;
        if (val[c] > val[best]) best = c;
        for (let k = 0; k < 8; k++) {
          const nx = cx + DX[k], ny = cy + DY[k];
          if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
          const j = ny * W + nx;
          if (isO[j] && !seen[j]) { seen[j] = 1; stack.push(j); }
        }
      }
      groups.push({ cell: best, coord: center(best, W), areaM2: area, cells, cut: !!cut,
                    bearing: dir[best] === EXIT ? null : BEARING[dir[best]], elev: grid.elev[best] });
    }
    groups.sort((a, b) => b.areaM2 - a.areaM2 || a.cell - b.cell);
    const min = p.minOutletFrac * maskArea;
    const shown = groups.filter((g, k) => k === 0 || g.areaM2 >= min);
    const otherM2 = groups.reduce((s, g) => s + g.areaM2, 0) - shown.reduce((s, g) => s + g.areaM2, 0);
    shown.forEach((g, k) => { g.id = k + 1; });
    return { outlets: shown, allCount: groups.length, totalM2: groups.reduce((s, g) => s + g.areaM2, 0), otherM2 };
  }

  // ── สถิติภายใน polygon (จากความสูงจริง ก่อนเติมหลุม) ──
  function maskStats(grid, dir, acc) {
    const { width: W, height: H, res, mask, elev } = grid;
    let n = 0, area = 0, minE = Infinity, maxE = -Infinity, slopeSum = 0, slopeN = 0, inflowCut = false;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        if (!mask[i] || elev[i] !== elev[i]) continue;
        n++; area += res[y] * res[y];
        if (elev[i] < minE) minE = elev[i];
        if (elev[i] > maxE) maxE = elev[i];
        const d = acc.down[i];
        if (d >= 0 && elev[d] === elev[d]) {
          const s = (elev[i] - elev[d]) / (res[y] * DIST[dir[i]]);
          if (s > 0) slopeSum += s;
          slopeN++;
        }
        if (acc.cut[i] && acc.accAll[i] > acc.accIn[i]) inflowCut = true;   // มีน้ำจากนอกรูปที่ต้นทางแตะขอบกริด
      }
    }
    return { cells: n, areaM2: area, minElev: n ? minE : null, maxElev: n ? maxE : null,
             meanSlope: slopeN ? slopeSum / slopeN : 0, inflowCut };
  }

  function touchesGridEdge(grid) {
    const { width: W, height: H, mask } = grid;
    for (let x = 0; x < W; x++) if (mask[x] || mask[(H - 1) * W + x]) return true;
    for (let y = 0; y < H; y++) if (mask[y * W] || mask[y * W + W - 1]) return true;
    return false;
  }

  function validate(grid) {
    const { width: W, height: H } = grid || {};
    if (!(W > 0 && H > 0)) throw new Error('กริดว่าง');
    const N = W * H;
    if (!grid.elev || grid.elev.length !== N) throw new Error('ขนาด elev ไม่ตรงกับกริด');
    if (!grid.mask || grid.mask.length !== N) throw new Error('ขนาด mask ไม่ตรงกับกริด');
    if (!grid.res || grid.res.length !== H) throw new Error('ขนาด res ต้องเท่ากับจำนวนแถว');
  }

  // ── รวมทุกขั้น ──
  function run(grid, params) {
    validate(grid);
    const p = Object.assign({}, DEFAULTS, params || {});
    const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const t = { start: now() };
    const W = grid.width, H = grid.height;
    const f = fill(grid.elev, W, H, p.epsilon); t.fill = now();
    const dir = flowDirections(f.z, W, H); t.d8 = now();
    const acc = accumulate(grid, dir); t.acc = now();
    const st = maskStats(grid, dir, acc);
    const streams = extractStreams(grid, dir, acc, p); t.streams = now();
    const out = extractOutlets(grid, dir, acc, p, st.areaM2); t.outlets = now();

    const warnings = [];
    if (acc.ordered < W * H) warnings.push('ทิศการไหลมีวงวน (ไม่ควรเกิด) — ผลอาจผิด');
    if (!st.cells) warnings.push('ไม่มีเซลล์ DEM ใน polygon');
    if (st.cells && st.meanSlope < p.flatSlope) warnings.push('พื้นที่ค่อนข้างราบ (ความลาดเฉลี่ย ' + (st.meanSlope * 100).toFixed(2) + '%) — ทิศน้ำจาก DEM ความละเอียดต่ำอาจไม่น่าเชื่อถือ');
    if (touchesGridEdge(grid)) warnings.push('polygon แตะขอบ DEM — เพิ่มระยะเผื่อ');
    if (st.inflowCut) warnings.push('พื้นที่รับน้ำจากนอก polygon ถูกตัดที่ขอบ DEM — ลำน้ำที่ไหลเข้ามาอาจประเมินต่ำ (เพิ่มระยะเผื่อ)');
    if (st.cells && !streams.length) warnings.push('ไม่พบลำน้ำที่เกณฑ์ ' + (p.streamThresholdM2 / 1e6) + ' กม² — ลองลดเกณฑ์');

    const balance = p.includeInflow ? null : (st.areaM2 ? out.totalM2 / st.areaM2 : null);
    return {
      params: p,
      streams,
      outlets: out.outlets,
      stats: Object.assign(st, {
        width: W, height: H, gridCells: W * H, filledCells: f.raised,
        outletCount: out.allCount, outletOtherM2: out.otherM2, outletTotalM2: out.totalM2,
        balance,                                 // ผลรวมพื้นที่จุดออก / พื้นที่ polygon (ควร = 1 เมื่อไม่นับน้ำเข้า)
        ms: { fill: t.fill - t.start, d8: t.d8 - t.fill, acc: t.acc - t.d8, streams: t.streams - t.acc,
              outlets: t.outlets - t.streams, total: t.outlets - t.start }
      }),
      warnings,
      // เก็บไว้ใช้กับโหมดคลิก (P4)
      raster: { dir, down: acc.down, accAll: acc.accAll, accIn: acc.accIn, filled: f.z }
    };
  }

  // ── เส้นทางน้ำจากเซลล์หนึ่ง (ใช้ใน P4 และทดสอบ) ──
  function flowPath(result, grid, x, y, maxSteps) {
    const W = grid.width, H = grid.height;
    let i = Math.floor(y) * W + Math.floor(x);
    if (i < 0 || i >= W * H) return [];
    const pts = [center(i, W)], lim = maxSteps || W * H;
    for (let s = 0; s < lim; s++) {
      const d = result.raster.down[i];
      if (d < 0) break;
      pts.push(center(d, W)); i = d;
    }
    return pts;
  }

  return { run, flowPath, DEFAULTS, _internal: { fill, flowDirections, accumulate, simplify, MinHeap, DX, DY, BEARING, EXIT } };
});
