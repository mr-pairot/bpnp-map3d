/* js/layers/structure/structure_3d.js
 * ─────────────────────────────────────────────────────────────────────────
 * เฟส 3D-B: สร้างชิ้นส่วน 3 มิติของ Box Culvert / Underpass จากค่าในข้อมูล
 *   ผลลัพธ์เป็นปริซึมแต่ละชิ้น (Polygon + base/top) — วาดด้วย Three.js ใน structure_3d_layer.js
 *   (ไฟล์นี้สร้างเฉพาะรูปทรง ส่วนระดับวางบนภูมิประเทศกำหนดที่ structure_3d_layer.js)
 *
 *   ตัวท่อ  : ขนาด "จำนวนช่อง-กว้าง×สูง" (Box) · Underpass ใช้ช่อง H / W · "4x2-…" = 4×2 = 8 ช่องเรียงกัน
 *             ยาวตาม Length · ผนัง/พื้นบนหนา t = max(0.20, กว้างช่อง/10) · ฐานอยู่ที่ระดับพื้นดินของโครงสร้าง
 *             (Underpass = จุดสูงสุดของพื้นดินในกรอบ · Box Culvert = กึ่งกลาง — ดู structure_3d_layer.js) · ปากท่อเปิดสองด้าน
 *             ท่อเอียง (skew): ปลายท่อตัดขนานแนวราง (รูป 2D เป็นสี่เหลี่ยมด้านขนาน — ด้านข้างยาว L ตามแกนท่อ)
 *                     ใช้ shear y' = y + K·x (K = cot(มุมระหว่างแนวรางกับแกนท่อ)) กับทุกชิ้น → ผนัง พื้น ขอบกั้นดิน กำแพงปีก
 *                     ปลายพับ (Underpass) จึงขนานแนวราง · ถ้าไม่มี skew ในข้อมูล เลือก K (ตามแนวราง / 0) และมุมละเอียดจากการทับรูป 2D
 *             กึ่งกลาง: กึ่งกลางกรอบรูป 2D (ช่อง Coordinate เป็นจุดบนแนวราง ใช้ไม่ได้กับท่อด้านข้าง LT/RT)
 *             แนวท่อ: ตั้งฉากกับแนวราง ณ กม. นั้น ± skew (skew_side LT = หมุนทวนเข็ม)
 *                     หรือขนานแนวราง — เลือกทิศที่ตัวท่อทับรูป 2D มากที่สุด (ท่อใต้ถนนข้างทางรถไฟ)
 *                     ถ้ายังทับไม่ถึง 80% (รูปเฉียงแต่ไม่มีค่า skew) กวาดหาทิศทุก 2°
 *                     ถ้ายังไม่ถึง 80% (เช่น รางยาวโค้งตามถนน) ยกรูป 2D ชิ้นใหญ่สุดขึ้นสูงเท่าท่อแทน (part 'outline')
 *   รูปทรง (v3.10.01 ตามไฟล์แนบ create3D/box-builder.js — ตำแหน่ง/ทิศยังใช้วิธีเดิมของแอป):
 *     Underpass: พื้นล่าง 0.30 ม. · ผนังบนพื้น · พื้นบน · ขอบกั้นดิน 0.30×0.30 สองปลาย · กำแพงปีกบนพื้น
 *                + พื้นปากท่อระหว่างกำแพงปีก + ปลายพับ 1.0 ม. สูง 1.0 ม.
 *     Box Culvert: พื้นล่าง 0.25 ม. · ผนังบนพื้น · พื้นบน · ขอบกั้นดิน · กำแพงปีกบนพื้น
 *                  + พื้นปากท่อระหว่างกำแพงปีก (ไม่มีปลายพับ)
 *   กำแพงปีก: ทิศ/ความยาวจากรูป 2D รายตัว (ไม่พบ → 3 ม. กาง 45°) · หนา 0.30 · ขอบบนลาดจากยอดขอบกั้นดินลงถึง 1.0 ม.
 *             ขั้นละ 0.05 ม. (แต่ละชิ้นเป็นปริซึมที่มีระดับบนเดียว จึงทำความลาดด้วยขั้นเล็ก)
 *
 *   BPNP.layers.structure3d.build(feature, { kind: 'box'|'underpass', color, wingColor, outlines }) → [GeoJSON Feature]
 *     feature : รูป 2D ของโครงสร้าง (Polygon/MultiPolygon) + properties (size, Length, H, W, Sta., skew, skew_side)
 *     outlines: เส้นขอบแยก (_outline) ของ กม. เดียวกัน — ใช้หาปลายกำแพงปีก (ไม่บังคับ)
 *     properties ของแต่ละชิ้น: base, top (ม. จากระดับพื้นดินของโครงสร้าง), color,
 *       part ('bottom_slab'|'wall'|'slab'|'curb'|'wing'|'return_wing'|'headwall_floor'|'outline'), _idx (ใส่โดยผู้เรียก)
 * ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  // รูปทรงตามไฟล์แนบ create3D/box-builder.js (v3.10.01)
  const STEP_LEN = 0.05;       // ความยาวต่อขั้นของกำแพงปีกลาด (ม.) — ละเอียด (สร้างเฉพาะรายการในจอ)
  const FLOOR_T = 0.30;        // พื้นล่าง / พื้นปากท่อ ของ Underpass
  const FLOOR_BOX_T = 0.25;    // พื้นล่าง / พื้นปากท่อ ของ Box Culvert
  const CURB_T = 0.30, CURB_H = 0.30;   // ขอบกั้นดินบนหัวท่อ
  const WING_T = 0.30;         // ความหนากำแพงปีก
  const TIP_H = 1.0;           // ความสูงปลายกำแพงปีก
  const RETURN_L = 1.0;        // ปลายพับ (เฉพาะ Underpass)
  const WING_DEFAULT = 3.0;    // ไม่พบปลายในรูป 2D → ยาว 3 ม. กาง 45° (ตามไฟล์แนบ)
  const WING_MAX = 12;         // ความยาวกำแพงปีกสูงสุดที่ยอมรับ (ม.) — กันจุดจากรูป 2D ส่วนอื่น

  // "2-1.20x1.20" · "4x2-1.20x1.20" (= 8 ช่อง) · "1-2.50x4.00"
  function parseSize(text) {
    const m = String(text || '').replace(/×/g, 'x').match(/^\s*(\d+)(?:\s*x\s*(\d+))?\s*-\s*([\d.]+)\s*x\s*([\d.]+)/i);
    if (!m) return null;
    return { n: (+m[1]) * (m[2] ? +m[2] : 1), a: +m[3], b: +m[4] };
  }
  const staMeters = s => { const [k, r] = String(s || '').split('+'); const v = (+k) * 1000 + parseFloat(r); return isFinite(v) ? v : null; };

  function darker(hex, f = 0.8) {
    const h = String(hex).replace('#', '');
    if (h.length !== 6) return hex;
    const c = i => Math.round(parseInt(h.substr(i, 2), 16) * f).toString(16).padStart(2, '0');
    return '#' + c(0) + c(2) + c(4);
  }

  function ringArea(r) {
    const lat = r[0][1], SX = 111320 * Math.cos(lat * Math.PI / 180), SY = 110574;
    let a = 0; for (let i = 1; i < r.length; i++) a += (r[i - 1][0] * SX) * (r[i][1] * SY) - (r[i][0] * SX) * (r[i - 1][1] * SY);
    return Math.abs(a / 2);
  }

  const inRing = (pt, r) => { let k = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi) k = !k; } return k; };
  const inPolys = (pt, polys) => polys.some(pp => pp.reduce((m, r) => m + (inRing(pt, r) ? 1 : 0), 0) % 2 === 1);
  const IOU_N = 48;            // ความละเอียดตารางสุ่มตอนปรับมุมละเอียด
  const REFINE_MAX_VERTS = 600;   // รูป 2D ซับซ้อนเกินนี้ (หลายร้อยชิ้น) ข้ามการปรับมุมละเอียด — กันค้าง
  const K_MAX = 1.73;          // tan 60° — แกนท่อเฉียงกว่านี้ถือว่าไม่ใช่ท่อเอียงจากแนวราง (ไม่ shear)

  // สัดส่วนของตัวท่อ (กว้าง Wt × ยาว L ที่ทิศ ax, ปลายเฉียง K) ที่ตกอยู่ในรูป 2D (even-odd ต่อชิ้น) — สุ่มรวมบริเวณมุมปลาย
  function coverage(polys, c, ax, Wt, L, K) {
    if (!polys.length) return 0;
    K = K || 0;
    const SX = 111320 * Math.cos(c[1] * Math.PI / 180), SY = 110574;
    const toLL = (x, y) => { const yy = y + K * x; return [c[0] + (yy * Math.sin(ax) + x * Math.cos(ax)) / SX, c[1] + (yy * Math.cos(ax) - x * Math.sin(ax)) / SY]; };
    let hit = 0, tot = 0;
    for (let u = -0.45; u <= 0.451; u += 0.15) for (let v = -0.46; v <= 0.461; v += 0.092) {
      tot++; if (inPolys(toLL(u * Wt, v * L), polys)) hit++;
    }
    return hit / tot;
  }

  // IoU ของตัวท่อ (สี่เหลี่ยมด้านขนาน) กับรูป 2D — ใช้ปรับมุมละเอียด · รูป 2D คงที่ทุกมุม จึงสุ่มครั้งเดียวเก็บไว้ที่ bb.mask
  function iou(polys, c, ax, Wt, L, K, bb) {
    const SX = 111320 * Math.cos(c[1] * Math.PI / 180), SY = 110574;
    const toLL = (x, y) => { const yy = y + K * x; return [c[0] + (yy * Math.sin(ax) + x * Math.cos(ax)) / SX, c[1] + (yy * Math.cos(ax) - x * Math.sin(ax)) / SY]; };
    const q = [[-Wt / 2, -L / 2], [Wt / 2, -L / 2], [Wt / 2, L / 2], [-Wt / 2, L / 2]].map(([x, y]) => toLL(x, y));
    q.push(q[0]);
    const N = IOU_N, pt = [0, 0];
    if (!bb.mask) {
      bb.mask = new Uint8Array(N * N); bb.area = 0;
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if (inPolys([bb[0] + (bb[2] - bb[0]) * (i + 0.5) / N, bb[1] + (bb[3] - bb[1]) * (j + 0.5) / N], polys)) { bb.mask[i * N + j] = 1; bb.area++; }
    }
    let b = 0, both = 0;
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      pt[0] = bb[0] + (bb[2] - bb[0]) * (i + 0.5) / N; pt[1] = bb[1] + (bb[3] - bb[1]) * (j + 0.5) / N;
      if (inRing(pt, q)) { b++; if (bb.mask[i * N + j]) both++; }
    }
    return both / Math.max(1, bb.area + b - both);
  }

  function build(feature, opts) {
    const p = feature.properties || {}, A = BPNP.alignment;
    const sz = parseSize(p.size);
    if (!sz || !A.isLoaded) return [];
    let w, h;
    if (opts.kind === 'underpass' && +p.H > 0 && +p.W > 0) { h = +p.H; w = +p.W; }
    else { w = sz.a; h = sz.b; }                                      // Box: กว้าง×สูง
    const n = sz.n, L = +p.Length;
    if (!(n > 0 && w > 0 && h > 0 && L > 0)) return [];
    const isUP = opts.kind === 'underpass';
    const floor = isUP ? FLOOR_T : FLOOR_BOX_T;                        // Underpass 0.30 ม. · Box Culvert 0.25 ม.
    const t = Math.max(0.2, Math.round(w / 10 * 100) / 100), H = h + t + floor;

    // กึ่งกลาง: ชิ้นที่ใหญ่ที่สุดของรูป 2D (= ตัวท่อ)
    //   ช่อง Coordinate คือจุดบนแนวราง ณ กม. (ท่อด้านข้าง LT/RT + offset คลาดเป็นสิบเมตร)
    //   และบางรายการมีรูป 2D หลายส่วนแยกกัน (กึ่งกลางทั้งรูปจะตกที่ว่าง)
    const sm = staMeters(p['Sta.']);
    const ap = sm !== null ? A.pointAt(sm, 0) : null;
    if (!ap) return [];
    const skew = parseFloat(p.skew) || 0, sgn = String(p.skew_side).toUpperCase() === 'LT' ? -1 : 1;
    const g0 = feature.geometry, polys0 = g0.type === 'Polygon' ? [g0.coordinates] : (g0.type === 'MultiPolygon' ? g0.coordinates : []);
    const largest = polys0.slice().sort((a, b2) => ringArea(b2[0]) - ringArea(a[0]))[0];
    const centers = [BPNP.layers.utils.bboxCenter(feature.geometry)];
    if (largest) centers.push(BPNP.layers.utils.bboxCenter({ type: 'Polygon', coordinates: largest }));
    const Wt0 = n * w + (n + 1) * (Math.max(0.2, Math.round(w / 10 * 100) / 100));
    // แนวท่อ: ตั้งฉากกับแนวราง ± skew — ท่อด้านข้างอาจวางขนานแนวราง จึงเลือกทิศที่ทับรูป 2D มากที่สุด
    // K = ความเฉียงของปลายท่อ: ปลายขนานแนวราง → K = cot(heading − ax) (ex. skew 20° LT → K = −tan 20°)
    const kTrack = ax => { const d = ap.heading * Math.PI / 180 - ax, t = Math.tan(d); const k = Math.abs(t) < 1e-6 ? 0 : 1 / t; return Math.abs(k) > K_MAX || Math.abs(k) < 0.01 ? 0 : k; };
    // ประเมินทิศ ax ที่กึ่งกลาง cc: ท่อมี skew ในข้อมูล → ปลายขนานแนวราง (เว้นแต่ K=0 ทับรูป 2D ดีกว่าชัดเจน) · ไม่มี → เลือกตามที่ทับรูป 2D
    const evalAt = (cc, ax) => {
      const kt = kTrack(ax), c0 = coverage(polys0, cc, ax, Wt0, L, 0);
      if (!kt || c0 < 0.4) return { cov: c0, K: 0 };      // ทับรูป 2D น้อยมาก (ทิศผิดชัดเจน) ไม่ต้องลอง shear — ประหยัดเวลาตอนกวาดทิศ
      const c1 = coverage(polys0, cc, ax, Wt0, L, kt);
      return (skew > 0 ? c1 >= c0 - 0.03 : c1 > c0 + 0.02) ? { cov: c1, K: kt } : { cov: c0, K: 0 };
    };
    let best = { cov: -1 };
    centers.forEach(cc => [(ap.heading + 90 + sgn * skew), (ap.heading + sgn * skew)].forEach(d => {
      const ax = d * Math.PI / 180, e = evalAt(cc, ax);
      if (e.cov > best.cov + 0.05) best = { ax, cov: e.cov, K: e.K, c: cc };
    }));
    // ไม่มี skew ในข้อมูลแต่รูป 2D วางเฉียง → กวาดหาทิศทุก 2° แล้วเลือกที่ทับรูป 2D มากที่สุด
    if (best.cov < 0.8) {
      centers.forEach(cc => { for (let d = 0; d < 180; d += 2) {
        const ax = d * Math.PI / 180, e = evalAt(cc, ax);
        if (e.cov > best.cov + 0.02) best = { ax, cov: e.cov, K: e.K, c: cc };
      } });
    }
    const vertCount = polys0.reduce((m, pp) => m + pp.reduce((a, r) => a + r.length, 0), 0);
    // ปรับมุมละเอียด (±3° ทุก 0.5°) ให้ตัวท่อทับรูป 2D มากที่สุด — เฉพาะท่อที่ไม่มี skew ในข้อมูล หรือยังทับไม่ถึง 97%
    if (best.cov >= 0.8 && (skew <= 0 || best.cov < 0.97) && polys0.length && vertCount <= REFINE_MAX_VERTS) {
      let bx0 = Infinity, by0 = Infinity, bx1 = -Infinity, by1 = -Infinity;
      polys0.forEach(pp => pp.forEach(r => r.forEach(([x, y]) => { if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y; })));
      const bb = [bx0, by0, bx1, by1], cc = best.c;
      // รูป 2D ที่ใช้เทียบ: ชิ้นที่พื้นที่ใกล้ Wt×L (ตัวท่อล้วน) ถ้ามี — กำแพงปีกที่แยกเป็นชิ้นอื่นจะไม่ดึงมุม · ไม่มีก็ใช้ทุกชิ้น
      const target = Wt0 * L, barrel = polys0.filter(pp => Math.abs(ringArea(pp[0]) - target) <= 0.3 * target)
        .sort((a, b2) => Math.abs(ringArea(a[0]) - target) - Math.abs(ringArea(b2[0]) - target))[0];
      const ref = barrel ? [barrel] : polys0;
      let bi = iou(ref, cc, best.ax, Wt0, L, best.K, bb), pick = { ax: best.ax, K: best.K };
      for (let da = -3; da <= 3.001; da += 0.5) {
        const ax = best.ax + da * Math.PI / 180, kt = kTrack(ax);
        (skew > 0 ? [kt] : (kt ? [kt, 0] : [0])).forEach(K => {
          const v = iou(ref, cc, ax, Wt0, L, K, bb);
          if (v > bi + 0.02) { bi = v; pick = { ax, K }; }   // ต้องดีขึ้นชัดเจน (≥ 0.02) จึงเปลี่ยน — ไม่กระทบท่อที่ทับดีอยู่แล้ว
        });
      }
      best.ax = pick.ax; best.K = pick.K;
    }
    const c = best.c;
    // ยังไม่ตรงรูป 2D (เช่น รางระบายยาวโค้งตามถนน) → ยกรูป 2D ชิ้นใหญ่สุดขึ้นเป็นแท่งสูงเท่าท่อ ให้โค้งตามแบบ
    if (best.cov < 0.8 && largest) {
      const Hs = h + Math.max(0.2, Math.round(w / 10 * 100) / 100) + (isUP ? 0 : floor);   // Box: รวมพื้นล่าง 0.25 ม. ให้สูงเท่าตัวท่อ
      return [{ type: 'Feature', properties: { base: 0, top: Hs, part: 'outline', color: opts.color }, geometry: { type: 'Polygon', coordinates: largest } }];
    }
    const axis = best.ax, K = best.K || 0, SK = Math.sqrt(1 + K * K);   // K: ปลายท่อเฉียง (ขนานแนวราง) · SK แปลงความหนา/ความยาวให้วัดตามหน้าปลาย

    // พิกัดท้องถิ่น (ม.): x = ตามกว้าง, y = ตามยาวท่อ
    const SX = 111320 * Math.cos(c[1] * Math.PI / 180), SY = 110574;
    // (x, y) = พิกัดท่อสี่เหลี่ยม (ปลายตั้งฉากแกน) → shear y' = y + K·x ให้ปลายขนานแนวราง · toXY คือขั้นย้อนกลับ (หากำแพงปีกในพิกัดที่ถอด shear แล้ว)
    const toLL = (x, y) => { const yy = y + K * x; return [c[0] + (yy * Math.sin(axis) + x * Math.cos(axis)) / SX, c[1] + (yy * Math.cos(axis) - x * Math.sin(axis)) / SY]; };
    const toXY = ([lng, lat]) => { const dx = (lng - c[0]) * SX, dy = (lat - c[1]) * SY; const x = dx * Math.cos(axis) - dy * Math.sin(axis); return [x, dx * Math.sin(axis) + dy * Math.cos(axis) - K * x]; };
    const poly = pts => ({ type: 'Polygon', coordinates: [pts.concat([pts[0]]).map(([x, y]) => toLL(x, y))] });
    const out = [];
    const add = (pts, base, top, part, color) => out.push({ type: 'Feature', properties: { base, top, part, color }, geometry: poly(pts) });

    // ── ตัวท่อ (ตามไฟล์แนบ): พื้นล่าง · ผนัง n+1 แผงบนพื้น · พื้นบน · ขอบกั้นดินสองปลาย ──
    const Wt = n * w + (n + 1) * t;
    const col = opts.color, wingColor = opts.wingColor || darker(opts.color);
    add([[-Wt / 2, -L / 2], [Wt / 2, -L / 2], [Wt / 2, L / 2], [-Wt / 2, L / 2]], 0, floor, 'bottom_slab', col);
    for (let i = 0; i <= n; i++) {
      const x0 = -Wt / 2 + i * (w + t);
      add([[x0, -L / 2], [x0 + t, -L / 2], [x0 + t, L / 2], [x0, L / 2]], floor, H, 'wall', col);
    }
    add([[-Wt / 2, -L / 2], [Wt / 2, -L / 2], [Wt / 2, L / 2], [-Wt / 2, L / 2]], floor + h, H, 'slab', col);
    const topCurb = H + CURB_H;
    const curbY = CURB_T * SK;                                          // หนา 0.30 ม. วัดตั้งฉากหน้าปลาย (ท่อเอียงยืดตามแกน)
    add([[-Wt / 2, -L / 2], [Wt / 2, -L / 2], [Wt / 2, -L / 2 + curbY], [-Wt / 2, -L / 2 + curbY]], H, topCurb, 'curb', col);
    add([[-Wt / 2, L / 2 - curbY], [Wt / 2, L / 2 - curbY], [Wt / 2, L / 2], [-Wt / 2, L / 2]], H, topCurb, 'curb', col);

    // ── กำแพงปีก: ทิศ/ความยาวจากรูป 2D รายตัว · รูปทรงตามไฟล์แนบ ──
    //   หนา 0.30 ม. เริ่มด้านในผนังนอก · ขอบบนลาดจากยอดขอบกั้นดินลงถึง 1.0 ม. ที่ปลาย (ขั้นละ 0.05 ม.)
    //   กำแพงปีกตั้งบนพื้น (Underpass 0.30 ม. · Box 0.25 ม.) + พื้นปากท่อระหว่างกำแพงปีก
    //   Underpass เพิ่มปลายพับ 1.0 ม. (ตั้งฉากแนวท่อ สูง 1.0 ม. จากพื้นดิน) · Box Culvert ไม่มีปลายพับ
    const g = feature.geometry, polys = g.type === 'Polygon' ? [g.coordinates] : (g.type === 'MultiPolygon' ? g.coordinates : []);
    const pts = [];
    polys.forEach(pp => pp.forEach(r => r.forEach(ll => pts.push(toXY(ll)))));
    (opts.outlines || []).forEach(line => line.forEach(ll => pts.push(toXY(ll))));
    const outside = pts.filter(([, y]) => Math.abs(y) >= L / 2 + 0.3);
    const innerX = Wt / 2 - t, outerX = innerX + WING_T, TY = WING_T * SK;   // TY: ความหนาปลายพับ/ปลายกำแพงปีกตามแกน (ตั้งฉากหน้าปลาย = 0.30)
    const lerp = (p1, p2, a) => [p1[0] + (p2[0] - p1[0]) * a, p1[1] + (p2[1] - p1[1]) * a];

    [-1, 1].forEach(end => {
      const tips = {};
      [-1, 1].forEach(s => {
        // จุดปลายจากรูป 2D: ใกล้มุมหัวท่อ (≤ 12 ม.) และกางออกมากที่สุด
        const cx0 = s * Wt / 2, cy0 = end * L / 2;
        const cand = outside.filter(([x, y]) => Math.sign(y) === end && Math.sign(x) === s && Math.hypot(x - cx0, y - cy0) <= WING_MAX);
        let vx, vy;
        if (cand.length) {
          const tip = cand.reduce((a, b2) => (Math.abs(b2[0]) > Math.abs(a[0]) ? b2 : a));
          vx = tip[0] - cx0; vy = tip[1] - cy0;
        }
        if (vx === undefined || Math.hypot(vx, vy) < 0.5 || Math.abs(vy) < TY + 0.1) {
          // ไม่พบปลายในรูป 2D: ยาว 3 ม. กาง 45° จากแกนท่อ (ในพิกัดจริง) แล้วถอด shear ให้อยู่ในพิกัดสี่เหลี่ยม
          vx = s * WING_DEFAULT; vy = end * WING_DEFAULT - K * vx;
          if (Math.sign(vy) !== end || Math.abs(vy) < TY + 0.1) vy = end * (TY + 0.1);
        }
        const P1 = [s * outerX, end * L / 2], P2 = [s * innerX, end * L / 2];
        const P3 = [P1[0] + vx, P1[1] + vy];
        const k = isUP ? (Math.abs(vy) - TY) / Math.abs(vy) : 1;          // Underpass: ด้านในสั้นลงเท่าความหนา ไปชนปลายพับ
        const Pin = [P2[0] + vx * k, P2[1] + vy * k];
        const len = Math.hypot(vx, vy), steps = Math.max(1, Math.ceil(len / STEP_LEN));
        const baseZ = floor;
        for (let i = 0; i < steps; i++) {
          const a0 = i / steps, a1 = (i + 1) / steps;
          const top = topCurb - (topCurb - TIP_H) * (i / steps);
          add([lerp(P1, P3, a0), lerp(P2, Pin, a0), lerp(P2, Pin, a1), lerp(P1, P3, a1)], baseZ, top, 'wing', wingColor);
        }
        if (isUP) {
          // ปลายพับยาว 1.0 ม. ขนานแนวราง (= ตามหน้าปลาย): shear ทำให้ทิศ x ขนานหน้าปลาย จึงหารด้วย SK ให้ยาวจริง 1.0 ม.
          const P5 = [P3[0] + s * RETURN_L / SK, P3[1]], P6 = [P5[0], P3[1] - end * TY];
          add([P3, Pin, P6, P5], 0, Math.max(TIP_H, floor + 0.1), 'return_wing', wingColor);
        }
        tips[s] = P3;
      });
      // พื้นปากท่อ: ระหว่างปลายกำแพงปีกสองข้าง ไม่รวมปลายพับ
      add([[-Wt / 2, end * L / 2], [Wt / 2, end * L / 2], tips[1], tips[-1]], 0, floor, 'headwall_floor', col);
    });
    return out;
  }

  BPNP.layers.structure3d = { build, parseSize, darker };
})();
