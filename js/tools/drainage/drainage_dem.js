/* js/tools/drainage/drainage_dem.js
 * ─────────────────────────────────────────────────────────────────────────
 * เฟส P1/P2: ดึง DEM ของ polygon ที่เลือก แล้วประกอบเป็นกริดสำหรับ DrainageCore
 *   แหล่งข้อมูล: BPNP.config.map.terrain (AWS Terrain Tiles แบบ Terrarium — ตัวเดียวกับโหมด 3D ใน js/map/terrain.js)
 *   มีตัวโหลด tile ของตัวเอง (ไม่ใช้ loadTile ของ terrain.js: cache 24 tile และไม่ปิด premultiply/colorspace)
 *
 *   ขอบเขต = กรอบของ polygon + ระยะเผื่อ (ค่าเริ่ม 10% ของด้านยาว อย่างน้อย 500 ม.) — ไม่ตัดเฉพาะในรูป
 *     เพราะเซลล์ที่ขอบต้องมีเพื่อนบ้านถึงจะได้ทิศน้ำถูก และต้องรู้ว่าน้ำจากนอกรูปไหลเข้ามาทางไหน
 *   กริดอยู่ในพิกัดพิกเซล Web Mercator ที่ซูม z (tile 256 px) — ไม่ reproject · res(row) = ความยาวด้านเซลล์จริง (ม.)
 *   ซูมทั้งหมดในไฟล์นี้เป็นซูม tile จริง (ไม่ใช่ซูมแบบ Leaflet ของ lcompat ที่ +1)
 * ─────────────────────────────────────────────────────────────────────────
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DrainageDem = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const TILE = 256;
  const R = 6378137;
  const EQUATOR_RES = 2 * Math.PI * R / TILE;   // ≈ 156543.03 ม./px ที่ z0 บนเส้นศูนย์สูตร

  const DEFAULTS = {
    targetResM: 30,          // ความละเอียดข้อมูลต้นทางในไทยโดยประมาณ — ซูมที่ละเอียดกว่านี้เป็นการขยายเฉย ๆ
    bufferFrac: 0.10,
    bufferMinM: 500,
    maxCells: null,          // null = เลือกเอง (มือถือ 1 ล้าน · เดสก์ท็อป 4 ล้าน)
    minZoom: 8,
    concurrency: 6,
    tiles: null,             // ปกติอ่านจาก BPNP.config.map.terrain
    maxzoom: null
  };

  // ── พิกัด ──
  const worldPx = z => TILE * Math.pow(2, z);
  function lngLatToPx(lng, lat, z) {
    const n = worldPx(z), s = Math.sin(lat * Math.PI / 180);
    return [(lng + 180) / 360 * n, (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n];
  }
  function pxToLngLat(x, y, z) {
    const n = worldPx(z);
    return [x / n * 360 - 180, Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n))) * 180 / Math.PI];
  }
  const resAt = (lat, z) => EQUATOR_RES * Math.cos(lat * Math.PI / 180) / Math.pow(2, z);
  const decodeTerrarium = (r, g, b) => r * 256 + g + b / 256 - 32768;

  // ── รูปทรง: รับ Feature/Geometry แบบ Polygon หรือ MultiPolygon → รายการวง (รวมรู) ──
  function ringsOf(geo) {
    const g = geo && geo.type === 'Feature' ? geo.geometry : geo;
    if (!g) throw new Error('ไม่มีรูปทรง');
    if (g.type === 'Polygon') return g.coordinates.slice();
    if (g.type === 'MultiPolygon') return [].concat(...g.coordinates);
    throw new Error('รองรับเฉพาะ Polygon/MultiPolygon (ได้ ' + g.type + ')');
  }
  function bboxOf(rings) {
    let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity;
    rings.forEach(r => r.forEach(([x, y]) => { if (x < w) w = x; if (x > e) e = x; if (y < s) s = y; if (y > n) n = y; }));
    return [w, s, e, n];
  }

  // ── เลือกซูม: ซูมต่ำสุดที่ความละเอียด ≤ เป้า แล้วลดลงจนจำนวนเซลล์ไม่เกินเพดาน ──
  function planGrid(rings, o) {
    const [w, s, e, n] = bboxOf(rings);
    const latC = (s + n) / 2, mPerDegLat = 111320, mPerDegLng = 111320 * Math.cos(latC * Math.PI / 180);
    const longSide = Math.max((e - w) * mPerDegLng, (n - s) * mPerDegLat);
    const bufM = Math.max(o.bufferMinM, o.bufferFrac * longSide);
    const bb = [w - bufM / mPerDegLng, s - bufM / mPerDegLat, e + bufM / mPerDegLng, n + bufM / mPerDegLat];
    let z = o.minZoom;
    while (z < o.maxzoom && resAt(latC, z) > o.targetResM) z++;
    let px;
    for (;;) {
      const a = lngLatToPx(bb[0], bb[3], z), b = lngLatToPx(bb[2], bb[1], z);
      px = { x0: Math.floor(a[0]), y0: Math.floor(a[1]), x1: Math.ceil(b[0]), y1: Math.ceil(b[1]) };
      const cells = (px.x1 - px.x0) * (px.y1 - px.y0);
      if (cells <= o.maxCells || z <= o.minZoom) break;
      z--;
    }
    return { z, bbox: bb, bufferM: bufM, px, width: px.x1 - px.x0, height: px.y1 - px.y0,
             resM: resAt(latC, z), downsampled: resAt(latC, z) > o.targetResM * 1.5 };
  }

  // ── mask ด้วย scanline (even-odd ทุกวง → รูถูกเว้นอัตโนมัติ) ทดสอบที่กลางเซลล์ ──
  function rasterizeMask(rings, z, px, W, H) {
    const mask = new Uint8Array(W * H);
    const prings = rings.map(r => r.map(([lng, lat]) => { const p = lngLatToPx(lng, lat, z); return [p[0] - px.x0, p[1] - px.y0]; }));
    const xs = [];
    for (let row = 0; row < H; row++) {
      const yc = row + 0.5;
      xs.length = 0;
      prings.forEach(r => {
        for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
          const [xi, yi] = r[i], [xj, yj] = r[j];
          if ((yi > yc) !== (yj > yc)) xs.push(xi + (yc - yi) / (yj - yi) * (xj - xi));
        }
      });
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const c0 = Math.max(0, Math.ceil(xs[k] - 0.5)), c1 = Math.min(W - 1, Math.floor(xs[k + 1] - 0.5));
        for (let c = c0; c <= c1; c++) mask[row * W + c] = 1;
      }
    }
    return mask;
  }

  // ── โหลด tile ──
  async function decodeBlob(blob) {
    let bmp;
    try { bmp = await createImageBitmap(blob, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' }); }
    catch (e) { bmp = await createImageBitmap(blob); }   // เบราว์เซอร์ที่ไม่รองรับตัวเลือก
    const W = bmp.width, H = bmp.height;
    const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(W, H)
      : Object.assign(document.createElement('canvas'), { width: W, height: H });
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(bmp, 0, 0);
    if (bmp.close) bmp.close();
    const d = g.getImageData(0, 0, W, H).data;
    const out = new Float32Array(W * H);
    for (let i = 0, p = 0; i < out.length; i++, p += 4) out[i] = d[p + 3] === 0 ? NaN : decodeTerrarium(d[p], d[p + 1], d[p + 2]);
    return { w: W, h: H, elev: out };
  }
  async function fetchTile(url, signal) {
    const r = await fetch(url, { mode: 'cors', signal });
    if (r.status === 404) return null;                     // ไม่มี tile → ไม่มีข้อมูล
    if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + url);
    return decodeBlob(await r.blob());
  }
  async function pool(items, n, fn) {
    let k = 0;
    const workers = Array.from({ length: Math.min(n, items.length) }, async () => { while (k < items.length) { const i = k++; await fn(items[i], i); } });
    await Promise.all(workers);
  }

  function config(o) {
    const c = (typeof BPNP !== 'undefined' && BPNP.config && BPNP.config.map && BPNP.config.map.terrain) || {};
    const isMobile = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
    const r = Object.assign({}, DEFAULTS, o || {});
    r.tiles = r.tiles || c.tiles;
    r.maxzoom = r.maxzoom || c.maxzoom || 15;
    r.maxCells = r.maxCells || (isMobile ? 1e6 : 4e6);
    if (!r.tiles) throw new Error('ไม่พบ URL ของ DEM (BPNP.config.map.terrain.tiles)');
    return r;
  }

  // ── สร้างกริดจาก polygon ──
  async function build(polygon, options) {
    const o = config(options);
    const progress = typeof o.onProgress === 'function' ? o.onProgress : () => {};
    const rings = ringsOf(polygon);
    const plan = planGrid(rings, o);
    const { z, px, width: W, height: H } = plan;

    const tx0 = Math.floor(px.x0 / TILE), tx1 = Math.floor((px.x1 - 1) / TILE);
    const ty0 = Math.floor(px.y0 / TILE), ty1 = Math.floor((px.y1 - 1) / TILE);
    const list = [];
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) list.push([tx, ty]);

    const elev = new Float32Array(W * H).fill(NaN);
    let done = 0, missing = 0;
    progress({ stage: 'dem', done, total: list.length });
    await pool(list, o.concurrency, async ([tx, ty]) => {
      const url = o.tiles.replace('{z}', z).replace('{x}', tx).replace('{y}', ty);
      const t = await fetchTile(url, o.signal);
      if (!t) missing++;
      else {
        const sc = t.w / TILE;   // รองรับ tile 512 px (สุ่มตามพิกเซล 256)
        const gx0 = tx * TILE, gy0 = ty * TILE;
        const cx0 = Math.max(px.x0, gx0), cx1 = Math.min(px.x1, gx0 + TILE);
        const cy0 = Math.max(px.y0, gy0), cy1 = Math.min(px.y1, gy0 + TILE);
        for (let gy = cy0; gy < cy1; gy++) {
          const srow = Math.floor((gy - gy0 + 0.5) * sc) * t.w, drow = (gy - px.y0) * W - px.x0;
          for (let gx = cx0; gx < cx1; gx++) elev[drow + gx] = t.elev[srow + Math.floor((gx - gx0 + 0.5) * sc)];
        }
      }
      progress({ stage: 'dem', done: ++done, total: list.length });
    });

    const res = new Float64Array(H);
    for (let row = 0; row < H; row++) res[row] = resAt(pxToLngLat(0, px.y0 + row + 0.5, z)[1], z);
    const mask = rasterizeMask(rings, z, px, W, H);

    return {
      elev, width: W, height: H, res, mask,
      zoom: z, originX: px.x0, originY: px.y0,
      meta: { tiles: list.length, missingTiles: missing, resM: plan.resM, bufferM: plan.bufferM,
              downsampled: plan.downsampled, maxCells: o.maxCells, bbox: plan.bbox }
    };
  }

  // พิกัดกริด [x, y] (x = คอลัมน์ + 0.5 = กลางเซลล์) → [lng, lat]
  const gridToLngLat = (grid, x, y) => pxToLngLat(grid.originX + x, grid.originY + y, grid.zoom);

  return { build, gridToLngLat, DEFAULTS,
           _internal: { lngLatToPx, pxToLngLat, resAt, decodeTerrarium, ringsOf, bboxOf, planGrid, rasterizeMask, config } };
});
