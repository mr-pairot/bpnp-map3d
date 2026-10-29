/* js/layers/structure/structure_3d.js
 * ─────────────────────────────────────────────────────────────────────────
 * เฟส 3D-B: สร้างรูป 3 มิติของ Box Culvert / Underpass (fill-extrusion) จากค่าในข้อมูล
 *
 *   ตัวท่อ  : ขนาด "จำนวนช่อง-กว้าง×สูง" (Box) · Underpass ใช้ช่อง H / W · "4x2-…" = 4×2 = 8 ช่องเรียงกัน
 *             ยาวตาม Length · ผนัง/พื้นบนหนา t = max(0.20, กว้างช่อง/10) · ขอบล่างเสมอดินเดิม · ปากท่อเปิดสองด้าน
 *             กึ่งกลาง: กึ่งกลางกรอบรูป 2D (ช่อง Coordinate เป็นจุดบนแนวราง ใช้ไม่ได้กับท่อด้านข้าง LT/RT)
 *             แนวท่อ: ตั้งฉากกับแนวราง ณ กม. นั้น ± skew (skew_side LT = หมุนทวนเข็ม)
 *                     หรือขนานแนวราง — เลือกทิศที่ตัวท่อทับรูป 2D มากที่สุด (ท่อใต้ถนนข้างทางรถไฟ)
 *                     ถ้ายังทับไม่ถึง 80% (รูปเฉียงแต่ไม่มีค่า skew) กวาดหาทิศทุก 2°
 *                     ถ้ายังไม่ถึง 80% (เช่น รางยาวโค้งตามถนน) ยกรูป 2D ชิ้นใหญ่สุดขึ้นสูงเท่าท่อแทน (part 'outline')
 *   รูปทรง (v3.10.01 ตามไฟล์แนบ create3D/box-builder.js — ตำแหน่ง/ทิศยังใช้วิธีเดิมของแอป):
 *     Underpass: พื้นล่าง 0.30 ม. · ผนังบนพื้น · พื้นบน · ขอบกั้นดิน 0.30×0.30 สองปลาย · กำแพงปีกบนพื้น
 *                + พื้นปากท่อระหว่างกำแพงปีก + ปลายพับ 1.0 ม. สูง 1.0 ม.
 *     Box Culvert: ไม่มีพื้น · ผนังบนดิน · พื้นบน · ขอบกั้นดิน · กำแพงปีกบนดิน (ไม่มีปลายพับ)
 *   กำแพงปีก: ทิศ/ความยาวจากรูป 2D รายตัว (ไม่พบ → 3 ม. กาง 45°) · หนา 0.30 · ขอบบนลาดจากยอดขอบกั้นดินลงถึง 1.0 ม.
 *             ขั้นละ 0.05 ม. (fill-extrusion ขอบบนเรียบ จึงทำความลาดด้วยขั้นเล็ก)
 *
 *   BPNP.layers.structure3d.build(feature, { kind: 'box'|'underpass', color, wingColor }) → [GeoJSON Feature]
 *     properties: base, top (ม.), color, part ('wall'|'slab'|'wing'|'return'), _idx (ใส่โดยผู้เรียก)
 * ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  // รูปทรงตามไฟล์แนบ create3D/box-builder.js (v3.10.01)
  const STEP_LEN = 0.05;       // ความยาวต่อขั้นของกำแพงปีกลาด (ม.) — ละเอียด (สร้างเฉพาะรายการในจอ)
  const FLOOR_T = 0.30;        // พื้นล่าง / พื้นปากท่อ (เฉพาะ Underpass)
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

  // สัดส่วนของตัวท่อ (กว้าง Wt × ยาว L ที่ทิศ ax) ที่ตกอยู่ในรูป 2D (even-odd ต่อชิ้น)
  function coverage(polys, c, ax, Wt, L) {
    if (!polys.length) return 0;
    const SX = 111320 * Math.cos(c[1] * Math.PI / 180), SY = 110574;
    const toLL = (x, y) => [c[0] + (y * Math.sin(ax) + x * Math.cos(ax)) / SX, c[1] + (y * Math.cos(ax) - x * Math.sin(ax)) / SY];
    const inRing = (pt, r) => { let k = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < (xj - xi) * (pt[1] - yi) / (yj - yi) + xi) k = !k; } return k; };
    let hit = 0, tot = 0;
    for (let u = -0.4; u <= 0.41; u += 0.2) for (let v = -0.45; v <= 0.46; v += 0.1) {
      const pt = toLL(u * Wt, v * L); tot++;
      if (polys.some(pp => pp.reduce((m, r) => m + (inRing(pt, r) ? 1 : 0), 0) % 2 === 1)) hit++;
    }
    return hit / tot;
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
    const floor = isUP ? FLOOR_T : 0;                                  // Box Culvert ไม่มีพื้น
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
    // เลือกกึ่งกลาง × ทิศ ที่ตัวท่อทับรูป 2D มากที่สุด (ทิศตามแนวรางมาก่อน)
    let best = { cov: -1 };
    centers.forEach(cc => [(ap.heading + 90 + sgn * skew), (ap.heading + sgn * skew)].forEach(d => {
      const ax = d * Math.PI / 180, cov = coverage(polys0, cc, ax, Wt0, L);
      if (cov > best.cov + 0.05) best = { ax, cov, c: cc };
    }));
    // ไม่มี skew ในข้อมูลแต่รูป 2D วางเฉียง → กวาดหาทิศทุก 2° แล้วเลือกที่ทับรูป 2D มากที่สุด
    if (best.cov < 0.8) {
      centers.forEach(cc => { for (let d = 0; d < 180; d += 2) {
        const ax = d * Math.PI / 180, cov = coverage(polys0, cc, ax, Wt0, L);
        if (cov > best.cov + 0.02) best = { ax, cov, c: cc };
      } });
    }
    const c = best.c;
    // ยังไม่ตรงรูป 2D (เช่น รางระบายยาวโค้งตามถนน) → ยกรูป 2D ชิ้นใหญ่สุดขึ้นเป็นแท่งสูงเท่าท่อ ให้โค้งตามแบบ
    if (best.cov < 0.8 && largest) {
      const Hs = h + Math.max(0.2, Math.round(w / 10 * 100) / 100);
      return [{ type: 'Feature', properties: { base: 0, top: Hs, part: 'outline', color: opts.color }, geometry: { type: 'Polygon', coordinates: largest } }];
    }
    const axis = best.ax;

    // พิกัดท้องถิ่น (ม.): x = ตามกว้าง, y = ตามยาวท่อ
    const SX = 111320 * Math.cos(c[1] * Math.PI / 180), SY = 110574;
    const toLL = (x, y) => [c[0] + (y * Math.sin(axis) + x * Math.cos(axis)) / SX, c[1] + (y * Math.cos(axis) - x * Math.sin(axis)) / SY];
    const toXY = ([lng, lat]) => { const dx = (lng - c[0]) * SX, dy = (lat - c[1]) * SY; return [dx * Math.cos(axis) - dy * Math.sin(axis), dx * Math.sin(axis) + dy * Math.cos(axis)]; };
    const poly = pts => ({ type: 'Polygon', coordinates: [pts.concat([pts[0]]).map(([x, y]) => toLL(x, y))] });
    const out = [];
    const add = (pts, base, top, part, color) => out.push({ type: 'Feature', properties: { base, top, part, color }, geometry: poly(pts) });

    // ── ตัวท่อ (ตามไฟล์แนบ): พื้นล่าง (Underpass) · ผนัง n+1 แผงบนพื้น · พื้นบน · ขอบกั้นดินสองปลาย ──
    const Wt = n * w + (n + 1) * t;
    const col = opts.color, wingColor = opts.wingColor || darker(opts.color);
    if (isUP) add([[-Wt / 2, -L / 2], [Wt / 2, -L / 2], [Wt / 2, L / 2], [-Wt / 2, L / 2]], 0, floor, 'bottom_slab', col);
    for (let i = 0; i <= n; i++) {
      const x0 = -Wt / 2 + i * (w + t);
      add([[x0, -L / 2], [x0 + t, -L / 2], [x0 + t, L / 2], [x0, L / 2]], floor, H, 'wall', col);
    }
    add([[-Wt / 2, -L / 2], [Wt / 2, -L / 2], [Wt / 2, L / 2], [-Wt / 2, L / 2]], floor + h, H, 'slab', col);
    const topCurb = H + CURB_H;
    add([[-Wt / 2, -L / 2], [Wt / 2, -L / 2], [Wt / 2, -L / 2 + CURB_T], [-Wt / 2, -L / 2 + CURB_T]], H, topCurb, 'curb', col);
    add([[-Wt / 2, L / 2 - CURB_T], [Wt / 2, L / 2 - CURB_T], [Wt / 2, L / 2], [-Wt / 2, L / 2]], H, topCurb, 'curb', col);

    // ── กำแพงปีก: ทิศ/ความยาวจากรูป 2D รายตัว · รูปทรงตามไฟล์แนบ ──
    //   หนา 0.30 ม. เริ่มด้านในผนังนอก · ขอบบนลาดจากยอดขอบกั้นดินลงถึง 1.0 ม. ที่ปลาย (ขั้นละ 0.05 ม.)
    //   Underpass: ตั้งบนพื้น 0.30 ม. + พื้นปากท่อระหว่างกำแพงปีก + ปลายพับ 1.0 ม. (ตั้งฉากแนวท่อ สูง 1.0 ม. จากพื้นดิน)
    const g = feature.geometry, polys = g.type === 'Polygon' ? [g.coordinates] : (g.type === 'MultiPolygon' ? g.coordinates : []);
    const pts = [];
    polys.forEach(pp => pp.forEach(r => r.forEach(ll => pts.push(toXY(ll)))));
    (opts.outlines || []).forEach(line => line.forEach(ll => pts.push(toXY(ll))));
    const outside = pts.filter(([, y]) => Math.abs(y) >= L / 2 + 0.3);
    const innerX = Wt / 2 - t, outerX = innerX + WING_T;
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
        if (vx === undefined || Math.hypot(vx, vy) < 0.5 || Math.abs(vy) < WING_T + 0.1) { vx = s * WING_DEFAULT; vy = end * WING_DEFAULT; }
        const P1 = [s * outerX, end * L / 2], P2 = [s * innerX, end * L / 2];
        const P3 = [P1[0] + vx, P1[1] + vy];
        const k = isUP ? (Math.abs(vy) - WING_T) / Math.abs(vy) : 1;          // Underpass: ด้านในสั้นลงเท่าความหนา ไปชนปลายพับ
        const Pin = [P2[0] + vx * k, P2[1] + vy * k];
        const len = Math.hypot(vx, vy), steps = Math.max(1, Math.ceil(len / STEP_LEN));
        const baseZ = isUP ? floor : 0;
        for (let i = 0; i < steps; i++) {
          const a0 = i / steps, a1 = (i + 1) / steps;
          const top = topCurb - (topCurb - TIP_H) * (i / steps);
          add([lerp(P1, P3, a0), lerp(P2, Pin, a0), lerp(P2, Pin, a1), lerp(P1, P3, a1)], baseZ, top, 'wing', wingColor);
        }
        if (isUP) {
          const P5 = [P3[0] + s * RETURN_L, P3[1]], P6 = [P5[0], P3[1] - end * WING_T];
          add([P3, Pin, P6, P5], 0, Math.max(TIP_H, floor + 0.1), 'return_wing', wingColor);
        }
        tips[s] = P3;
      });
      // พื้นปากท่อ (Underpass): ระหว่างปลายกำแพงปีกสองข้าง ไม่รวมปลายพับ
      if (isUP) add([[-Wt / 2, end * L / 2], [Wt / 2, end * L / 2], tips[1], tips[-1]], 0, floor, 'headwall_floor', col);
    });
    return out;
  }

  BPNP.layers.structure3d = { build, parseSize, darker };
})();
