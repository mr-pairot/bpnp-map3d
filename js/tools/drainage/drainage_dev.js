/* js/tools/drainage/drainage_dev.js
 * ─────────────────────────────────────────────────────────────────────────
 * ตัวทดสอบชั่วคราว (P1) — รันจาก console ยังไม่มีปุ่ม/แผง (P3) และยังไม่แก้ measure_plus.js
 *
 *   โหลด (วางใน console ของแอปหลังล็อกอิน):
 *     for (const f of ['drainage_core','drainage_dem','drainage_render','drainage_dev'])
 *       await BPNP.loader.script('js/tools/drainage/' + f + '.js');
 *
 *   ใช้:
 *     await BPNP.tools.drainage.runOnLastPolygon()                       // polygon ล่าสุดที่วาดด้วยเครื่องมือวัด
 *     await BPNP.tools.drainage.runOnLastPolygon({ streamThresholdM2: 1e5, includeInflow: true })
 *     BPNP.tools.drainage.clear()
 *
 *   ตัวเลือก: พารามิเตอร์ของ DrainageCore.DEFAULTS + DrainageDem.DEFAULTS (เช่น targetResM, bufferMinM, maxCells)
 *   คำนวณบน main thread (ย้ายไป Web Worker ใน P3) — หน้าจออาจค้างระหว่างคำนวณ
 * ─────────────────────────────────────────────────────────────────────────
 */
(function () {
  'use strict';
  if (typeof BPNP === 'undefined') return;
  BPNP.tools = BPNP.tools || {};

  let renderer = null, last = null, busy = false;

  const map = () => BPNP.map && BPNP.map.instance;
  const toast = (msg, ms) => { try { if (BPNP.core && BPNP.core.toast) BPNP.core.toast.show(msg, false, ms || 2500); } catch (e) { /* ไม่มี toast */ } };
  function formatArea(a) {
    const units = (BPNP.tools.measure && BPNP.tools.measure.options && BPNP.tools.measure.options.units) || 'thai';
    return window.MeasurePlusCalc ? window.MeasurePlusCalc.defaultFormatArea(a, units) : Math.round(a).toLocaleString('th-TH') + ' m²';
  }
  function getRenderer() {
    if (!renderer) renderer = window.DrainageRender.create(map(), { formatArea });
    return renderer;
  }
  function lastPolygon() {
    const l = window.lastDrawnLayer;
    const f = l && typeof l.toGeoJSON === 'function' ? l.toGeoJSON() : null;
    const t = f && f.geometry && f.geometry.type;
    if (t !== 'Polygon' && t !== 'MultiPolygon') throw new Error('ไม่พบ polygon ล่าสุด — วาด polygon ด้วยเครื่องมือวัดก่อน');
    return f;
  }

  // แปลงผลในพิกัดกริด → GeoJSON lng/lat
  function toGeoJSON(grid, r) {
    const ll = p => window.DrainageDem.gridToLngLat(grid, p[0], p[1]);
    const r6 = v => Math.round(v * 1e6) / 1e6;
    const pt = p => ll(p).map(r6);
    return {
      streams: { type: 'FeatureCollection', features: r.streams.map(s => ({
        type: 'Feature', properties: { accM2: s.accM2, widthPx: s.widthPx },
        geometry: { type: 'LineString', coordinates: s.coords.map(pt) } })) },
      outlets: { type: 'FeatureCollection', features: r.outlets.map(o => ({
        type: 'Feature', properties: { id: o.id, areaM2: o.areaM2, bearing: o.bearing, elev: o.elev, cells: o.cells },
        geometry: { type: 'Point', coordinates: pt(o.coord) } })) }
    };
  }

  async function runOnPolygon(polygon, opts) {
    if (busy) throw new Error('กำลังคำนวณอยู่');
    if (!window.DrainageCore || !window.DrainageDem || !window.DrainageRender) throw new Error('ยังโหลดไฟล์ drainage ไม่ครบ');
    busy = true;
    const o = opts || {};
    try {
      const t0 = performance.now();
      toast('กำลังโหลด DEM…');
      const grid = await window.DrainageDem.build(polygon, Object.assign({}, o, {
        onProgress: p => { if (p.done === p.total || p.done % 4 === 0) console.log('[drainage] DEM ' + p.done + '/' + p.total + ' tile'); }
      }));
      const t1 = performance.now();
      toast('กำลังคำนวณ ' + (grid.width * grid.height).toLocaleString('th-TH') + ' เซลล์…');
      await new Promise(r => setTimeout(r, 30));          // ให้ toast แสดงก่อนเริ่มคำนวณ
      const res = window.DrainageCore.run(grid, o);
      const gj = toGeoJSON(grid, res);
      const rd = getRenderer();
      rd.clearClickResults();
      rd.setStreams(gj.streams);
      rd.setOutlets(gj.outlets);
      const t2 = performance.now();

      const s = res.stats;
      last = { grid, result: res, geojson: gj };
      console.groupCollapsed('[drainage] ผลลัพธ์');
      console.table({
        'ซูม DEM': grid.zoom,
        'ความละเอียด (ม./เซลล์)': +grid.meta.resM.toFixed(1),
        'ระยะเผื่อ (ม.)': Math.round(grid.meta.bufferM),
        'กริด': grid.width + ' × ' + grid.height + ' = ' + s.gridCells.toLocaleString('th-TH'),
        'tile (ไม่มีข้อมูล)': grid.meta.tiles + ' (' + grid.meta.missingTiles + ')',
        'เซลล์ใน polygon': s.cells,
        'พื้นที่ polygon (DEM)': formatArea(s.areaM2),
        'ความสูง ต่ำสุด–สูงสุด (ม.)': s.minElev == null ? '-' : s.minElev.toFixed(1) + ' – ' + s.maxElev.toFixed(1),
        'ความลาดเฉลี่ย (%)': +(s.meanSlope * 100).toFixed(2),
        'เซลล์ที่ถูกเติมหลุม (>1 มม.)': s.filledCells,
        'ลำน้ำ (เส้น)': res.streams.length,
        'จุดออก แสดง / ทั้งหมด': res.outlets.length + ' / ' + s.outletCount,
        'สมดุลพื้นที่ (ควร = 1)': s.balance == null ? 'ไม่ตรวจ (นับน้ำเข้า)' : +s.balance.toFixed(6),
        'เวลา DEM (ms)': Math.round(t1 - t0),
        'เวลาคำนวณ (ms)': Math.round(s.ms.total),
        'เวลารวม (ms)': Math.round(t2 - t0)
      });
      if (res.outlets.length) console.table(res.outlets.map(x => ({ id: x.id, พื้นที่: formatArea(x.areaM2), 'ม²': Math.round(x.areaM2), ทิศ: x.bearing, 'สูง (ม.)': +(+x.elev).toFixed(1), เซลล์: x.cells })));
      console.log('[drainage] เวลาแต่ละขั้น (ms):', s.ms);
      if (grid.meta.downsampled) console.warn('[drainage] ลดความละเอียดเพราะกริดเกินเพดาน ' + grid.meta.maxCells.toLocaleString('th-TH') + ' เซลล์');
      res.warnings.forEach(w => console.warn('[drainage] ' + w));
      console.groupEnd();
      toast(res.warnings.length ? 'คำนวณเสร็จ — มีคำเตือน (ดู console)' : 'คำนวณเสร็จ: ลำน้ำ ' + res.streams.length + ' เส้น · จุดออก ' + res.outlets.length + ' จุด');
      return last;
    } catch (e) {
      console.error('[drainage]', e);
      toast('คำนวณไม่สำเร็จ: ' + e.message, 4000);
      throw e;
    } finally {
      busy = false;
    }
  }

  BPNP.tools.drainage = {
    runOnLastPolygon: opts => runOnPolygon(lastPolygon(), opts),
    runOnPolygon,
    clear() { if (renderer) renderer.clear(); last = null; },
    destroy() { if (renderer) renderer.destroy(); renderer = null; last = null; },
    get last() { return last; }
  };
})();
