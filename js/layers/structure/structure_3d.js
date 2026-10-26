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
 *   กำแพงปีก: จากรูป 2D — ปลายที่กางออกมากที่สุดของแต่ละด้าน · ขอบบนลาดจากความสูงหัวท่อลงถึง max(0.5, 1/3) ที่ปลาย
 *             (fill-extrusion มีขอบบนเรียบเท่านั้น จึงแบ่งเป็นขั้นละ ~0.25 ม. ให้ดูลาด)
 *   ปลายพับ : ขาสั้นที่ปลายกำแพงปีกในรูป 2D (Underpass) สูงเท่าปลายกำแพงปีก (ระดับต่ำสุด)
 *
 *   BPNP.layers.structure3d.build(feature, { kind: 'box'|'underpass', color, wingColor }) → [GeoJSON Feature]
 *     properties: base, top (ม.), color, part ('wall'|'slab'|'wing'|'return'), _idx (ใส่โดยผู้เรียก)
 * ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  const STEP_LEN = 0.25;       // ความยาวต่อขั้นของกำแพงปีกลาด (ม.)
  const MIN_STEPS = 12;
  const TIP_RATIO = 1 / 3, TIP_MIN = 0.5;
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
    const t = Math.max(0.2, Math.round(w / 10 * 100) / 100), H = h + t;

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

    // ── ตัวท่อ: ผนัง n+1 แผง + พื้นบน ──
    const Wt = n * w + (n + 1) * t;
    for (let i = 0; i <= n; i++) {
      const x0 = -Wt / 2 + i * (w + t);
      add([[x0, -L / 2], [x0 + t, -L / 2], [x0 + t, L / 2], [x0, L / 2]], 0, H, 'wall', opts.color);
    }
    add([[-Wt / 2, -L / 2], [Wt / 2, -L / 2], [Wt / 2, L / 2], [-Wt / 2, L / 2]], h, H, 'slab', opts.color);

    // ── กำแพงปีก + ปลายพับ จากรูป 2D ──
    const g = feature.geometry, polys = g.type === 'Polygon' ? [g.coordinates] : (g.type === 'MultiPolygon' ? g.coordinates : []);
    const pts = [];
    polys.forEach(pp => pp.forEach(r => r.forEach(ll => pts.push(toXY(ll)))));
    (opts.outlines || []).forEach(line => line.forEach(ll => pts.push(toXY(ll))));
    const outside = pts.filter(([, y]) => Math.abs(y) >= L / 2 + 0.3);
    const tipH = Math.max(TIP_MIN, H * TIP_RATIO);
    const wingColor = opts.wingColor || darker(opts.color);

    [-1, 1].forEach(end => [-1, 1].forEach(s => {
      // จุดปลายต้องอยู่ใกล้มุมหัวท่อ (≤ 12 ม.) — บางรายการมีรูป 2D ส่วนอื่นอยู่ห่างออกไป
      const cx0 = s * Wt / 2, cy0 = end * L / 2;
      const cand = outside.filter(([x, y]) => Math.sign(y) === end && Math.sign(x) === s && Math.hypot(x - cx0, y - cy0) <= WING_MAX);
      if (!cand.length) return;
      const tip = cand.reduce((a, b) => (Math.abs(b[0]) > Math.abs(a[0]) ? b : a));
      const c0 = [s * Wt / 2, end * L / 2];
      const vx = tip[0] - c0[0], vy = tip[1] - c0[1], len = Math.hypot(vx, vy);
      if (len < 0.3) return;
      let nx = -vy / len, ny = vx / len;
      if (nx * s < 0) { nx = -nx; ny = -ny; }                         // หนาออกด้านนอกท่อ
      const steps = Math.max(MIN_STEPS, Math.ceil(len / STEP_LEN));
      for (let k = 0; k < steps; k++) {
        const a0 = k / steps, a1 = (k + 1) / steps;
        const q0 = [c0[0] + vx * a0, c0[1] + vy * a0], q1 = [c0[0] + vx * a1, c0[1] + vy * a1];
        const top = H + (tipH - H) * (k + 0.5) / steps;
        add([q0, q1, [q1[0] + nx * t, q1[1] + ny * t], [q0[0] + nx * t, q0[1] + ny * t]], 0, top, 'wing', wingColor);
      }
      // ปลายพับ: จุดในรูป 2D ที่อยู่ใกล้ปลายกำแพงปีก (≤ 3 ม.) และออกไปไกลกว่าตามแนวท่อ
      const ret = cand.filter(([x, y]) => Math.abs(y) > Math.abs(tip[1]) + 0.2 && Math.hypot(x - tip[0], y - tip[1]) <= 3)
                      .reduce((a, b) => (!a || Math.hypot(b[0] - tip[0], b[1] - tip[1]) > Math.hypot(a[0] - tip[0], a[1] - tip[1]) ? b : a), null);
      if (ret) {
        const rx = ret[0] - tip[0], ry = ret[1] - tip[1], rl = Math.hypot(rx, ry);
        if (rl >= 0.3) {
          let mx = -ry / rl, my = rx / rl;
          if (mx * s < 0) { mx = -mx; my = -my; }
          add([tip, ret, [ret[0] + mx * t, ret[1] + my * t], [tip[0] + mx * t, tip[1] + my * t]], 0, tipH, 'return', wingColor);
        }
      }
    }));
    return out;
  }

  BPNP.layers.structure3d = { build, parseSize, darker };
})();
