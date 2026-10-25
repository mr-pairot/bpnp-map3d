/* js/layers/parcel/parcel.js
 * ─────────────────────────────────────────────────────────────────────────
 * เฟส 3: แปลงที่ดินเวนคืน (polygonLand) + แปลงนอกเขตเวนคืน (Pay Out)
 * (เดิม setPatternLegend.js, setPatternLegend_2.js, setPopup.js และส่วน polygonLand ใน main.js)
 *
 *   - สีตามสถานะหน้างาน StatusWork (ชุดสีเดิม) / Pay Out สีเทา
 *   - แสดงเมื่อซูม ≥ 10 (Leaflet 11) · ชี้เมาส์เห็นรหัสแปลง
 *   - คลิก → popup (รหัส, กม.โดยประมาณ, ประเภท, สถานะส่งมอบ, สถานะหน้างาน, รูปแปลง)
 *   - legend มุมขวาบน + แผงตารางด้านล่าง + ค้นหารหัสแปลง (parcel_search.js)
 *
 * รูปทรงแปลงจาก CAD ถูกจัดแบบ even-odd ตอน build แล้ว (tools/kml2geojson.js)
 * ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  const U = BPNP.layers.utils;
  const esc = BPNP.escapeHtml;

  // ── สี (เดิม setPatternLegend.js) ──
  const C = {
    green: '#00CC00', yellow: '#FFD700', red: '#FF0000', gray: '#778899',
    blue: '#acf7f7', blue2: '#1E90FF', default: '#FEFDEC', default2: '#CCCCCC'
  };
  BPNP.layers.parcelColors = C;

  const SW = ['to-string', ['get', 'StatusWork']];
  const FILL = ['match', SW, '0', C.red, '1', C.green, '2', C.yellow, '4', C.gray, '81', C.blue2, '82', C.gray, '91', C.blue2, '92', C.gray, C.default2];
  const LINE = ['match', SW, '0', C.red, '1', C.green, '2', C.yellow, '4', C.blue, '81', C.green, '82', C.green, '91', C.gray, '92', C.gray, C.default];
  const SOLID   = ['match', SW, ['0', '1', '2'], true, false];
  const DASH44  = ['match', SW, ['4', '81', '82', '91', '92'], true, false];
  const WIDTH44 = ['match', SW, ['81', '82'], 2, 1.5];
  // รูปที่ติด _fillOnly ใช้วาดพื้นอย่างเดียว เส้นขอบวาดจาก feature _outline ท้ายไฟล์ (ดู tools/kml2geojson.js)
  const NOT_FILL_ONLY = ['!=', ['get', '_fillOnly'], true];
  const isOutline = f => !!(f && f.properties && f.properties._outline);

  const SRC = 'src-parcel', SRC_PAY = 'src-payout', SRC_FLASH = 'src-parcel-flash';
  const MIN_ZOOM = U.z(11);

  let mainFeatures = [], payFeatures = [];
  let legendEl = null;

  // ── รหัสแปลง → ชื่อไฟล์รูป (assets/parcels ใช้อักษรละติน: ท → T) ──
  const THAI_TO_LATIN = { 'ท': 'T' };
  const imageCode = code => String(code).replace(/[\u0E00-\u0E7F]/g, ch => THAI_TO_LATIN[ch] || ch);

  const STATUS_WORK_TEXT = {
    '#N/A': 'รอรับมอบพื้นที่', '0': 'เข้าพื้นที่ไม่ได้', '1': 'เข้าพื้นที่ได้', '2': 'เข้าพื้นที่บางส่วน',
    '81': 'เข้าพื้นที่แล้ว', '82': 'ยังไม่เข้าพื้นที่', '91': 'เข้าพื้นที่แล้ว', '92': 'ยังไม่เข้าพื้นที่'
  };

  function statusColor(status) {
    switch (status) {
      case 'ส่งมอบแล้ว': return C.green;
      case 'อยู่ระหว่างส่งมอบ': return C.yellow;
      case 'ยังไม่ส่งมอบ': return C.red;
      default: return C.gray;
    }
  }

  // ── popup แปลงในเขตเวนคืน (เดิม setPopup.js → createPopupContent) ──
  function parcelPopupHtml(p, center) {
    const code = p.Code || 'ไม่ระบุ';
    const status = p.Status || 'ไม่ระบุ';
    const statusWork = p.StatusWork || 'ไม่ระบุ';
    const remark = p.Remark || '';
    const payDate = p.Pay_Date || '';

    let stationInfo = '';
    const A = BPNP.alignment;
    if (center && A.isLoaded) {
      const r = A.findStationOffset(center);
      if (r) stationInfo = `<div><strong class="label-sta">กม.(ประมาณ) : </strong><span class="sta">${A.formatStation(r.station)}</span></div>`;
    } else if (!A.isLoaded) {
      A.load().catch(() => {});
    }

    let statusHtml = `<div style="display: inline-block; vertical-align: top; color:${statusColor(status)};"><span>${BPNP.safeHtml(status)}</span>`;
    if (status === 'ส่งมอบแล้ว' && payDate) statusHtml += `<div style="font-size: 0.9em; margin-top: 1px;">วันที่ ${esc(payDate)}</div>`;
    statusHtml += `</div>`;

    // หมายเหตุ: เดิมกำหนดสีข้อความ "สถานะหน้างาน" ด้วยค่าที่เป็น object จึงไม่มีผล → คงสีข้อความปกติไว้เหมือนเดิม
    return `
      <div class="custom-polygonLand-popup">
        <div><strong class="label">เลขแปลง  : </strong><span class="parcel-code">${esc(code)}</span></div>
        ${stationInfo}
        <div><strong class="label">ประเภทที่ดิน : </strong> ${esc(p.Type || 'ไม่ระบุ')}</div>
        <div><strong class="label">สถานะส่งมอบ:</strong> ${statusHtml}</div>
        <div><strong class="label">สถานะหน้างาน:</strong> <span>${esc(STATUS_WORK_TEXT[statusWork] || 'ไม่ทราบสถานะ')}</span></div>
        ${remark ? `<div><em style="color:gray;">หมายเหตุ: ${BPNP.safeHtml(remark)}</em></div>` : ''}
        <hr style="margin: 5px 0; border: 0; border-top: 1px solid #eee;">
        <div class="parcel-gallery"></div>
      </div>`;
  }

  // รูปแปลง 1–4 รูป (แสดงเฉพาะรูปที่มีอยู่จริง)
  function loadGallery(popup, code) {
    if (!popup || !code || code === 'ไม่ระบุ') return;
    const box = popup.getElement() && popup.getElement().querySelector('.parcel-gallery');
    if (!box) return;
    const base = imageCode(code);
    for (let i = 1; i <= 4; i++) {
      const src = `assets/parcels/${encodeURIComponent(base)}_${i}.jpg`;
      const img = new Image();
      img.onload = () => {
        const a = document.createElement('a');
        a.href = src; a.target = '_blank'; a.className = 'parcel-img-link';
        a.innerHTML = `<img src="${src}" class="parcel-thumb" alt="img-${i}" />`;
        box.appendChild(a);
      };
      img.src = src;
    }
  }

  function payPopupHtml(p) {
    return `
      <div style="line-height:1.6;font-size:14px;">
        <div><strong>เลขแปลง : </strong><span style="color:#1a237e;font-weight:bold;font-size:16px;">${esc(p.Code || p.name || 'ไม่ระบุรหัส')}</span></div>
        <div><strong>สถานะ : </strong><span style="color:#555;">อยู่นอกเขตเวนคืน</span></div>
      </div>`;
  }

  function openPopupFor(source, feature, at) {
    if (source === 'payout') {
      BPNP.map.popup.open(at, payPopupHtml(feature.properties || {}), { className: 'pay-out-popup' });
      return;
    }
    const center = U.bboxCenter(feature.geometry);
    const popup = BPNP.map.popup.open(at, parcelPopupHtml(feature.properties || {}, center), { maxWidth: '320px' });
    loadGallery(popup, (feature.properties || {}).Code);
  }

  // ── กะพริบ / เน้นแปลง ──
  let flashTimer = null, flashToken = 0;
  function flash(feature, mode = 'flash') {
    const map = BPNP.map.instance;
    const src = map && map.getSource(SRC_FLASH);
    if (!src) return;
    clearInterval(flashTimer);
    const fc = { type: 'FeatureCollection', features: [feature] };
    const empty = { type: 'FeatureCollection', features: [] };
    const token = ++flashToken;
    // เริ่มนับเวลาหลังแผนที่เลื่อน/วาดเสร็จ (เครื่องช้าจะยังเห็นครบเวลา)
    const afterIdle = fn => {
      let done = false;
      const go = () => { if (!done && token === flashToken) { done = true; fn(); } };
      map.once('idle', go);
      setTimeout(go, 3000);
    };
    if (mode === 'highlight') {
      // แถวในแผงล่าง: ขอบแดงหนา 2 วินาที (เหมือนเดิม)
      map.setPaintProperty('parcel-flash-fill', 'fill-opacity', 0);
      map.setPaintProperty('parcel-flash-line', 'line-width', 6);
      src.setData(fc);
      afterIdle(() => { flashTimer = setTimeout(() => { if (token === flashToken) src.setData(empty); }, 2000); });
      return;
    }
    // ค้นหา / legend: กะพริบแดง 3 รอบ (6 ครั้ง × 300 ms)
    map.setPaintProperty('parcel-flash-fill', 'fill-opacity', 0.8);
    map.setPaintProperty('parcel-flash-line', 'line-width', 5);
    src.setData(fc);
    afterIdle(() => {
      let n = 1;
      flashTimer = setInterval(() => {
        if (token !== flashToken) { clearInterval(flashTimer); return; }
        if (n >= 6) { clearInterval(flashTimer); src.setData(empty); return; }
        src.setData(n % 2 === 0 ? fc : empty);
        n++;
      }, 300);
    });
  }

  // บินไปที่แปลง → popup + เน้น
  function goTo(source, index, { leafletZoom = 16, mode = 'flash', popup = true } = {}) {
    const feature = (source === 'payout' ? payFeatures : mainFeatures)[index];
    if (!feature) return;
    const map = BPNP.map.instance;
    const center = U.bboxCenter(feature.geometry);
    map.jumpTo({ center, zoom: U.z(leafletZoom) });
    if (popup) setTimeout(() => openPopupFor(source, feature, center), 300);
    flash(feature, mode);
  }

  // ── ดัชนีค้นหา (แปลงหลักก่อน แล้วจึง Pay Out เหมือนเดิม) ──
  function searchIndex() {
    const out = [];
    mainFeatures.forEach((f, i) => { if (isOutline(f)) return; const c = String((f.properties || {}).Code || '').trim(); if (c) out.push({ code: c, source: 'main', index: i }); });
    payFeatures.forEach((f, i) => { if (isOutline(f)) return; const p = f.properties || {}; const c = String(p.Code || p.name || '').trim(); if (c) out.push({ code: c, source: 'payout', index: i }); });
    return out;
  }

  function showLegend() {
    if (!legendEl) {
      // feature _outline อยู่ท้ายไฟล์เสมอ → ตัดออกแล้ว index ของแปลงยังตรงกับ mainFeatures
      legendEl = BPNP.layers.parcelLegend.create(mainFeatures.filter(f => !isOutline(f)), {
        onSelect: it => goTo('main', it.index, { leafletZoom: 18 }),
        onShowList: (title, items) => BPNP.ui.bottomPanel.show(title, items, it => goTo('main', it.index, { leafletZoom: 18, mode: 'highlight' })),
        onHideList: () => BPNP.ui.bottomPanel.hide()
      });
    }
    // ลำดับมุมขวาบนเหมือนเดิม: ช่องค้นหา → legend
    const stack = U.legendStack();
    const searchEl = BPNP.layers.parcelSearch && BPNP.layers.parcelSearch.element;
    if (searchEl && searchEl.parentNode === stack) searchEl.after(legendEl);
    else stack.prepend(legendEl);
  }

  function register(map) {
    BPNP.map.registry.register('polygonLand', {
      slot: 'general',
      build: async () => {
        const cfg = BPNP.layers.byId('polygonLand');
        const [main, pay] = await Promise.all([
          U.loadGeoJSON(cfg.source),
          U.loadGeoJSON(cfg.source2).catch(err => { console.warn('[Parcel] ไม่พบ Pay Out:', err.message); return { type: 'FeatureCollection', features: [] }; })
        ]);
        mainFeatures = main.features || [];
        payFeatures = pay.features || [];
        const empty = { type: 'FeatureCollection', features: [] };
        const lineLayer = (id, filter, color, width, dash) => ({
          id, type: 'line', source: SRC, minzoom: MIN_ZOOM, filter: ['all', filter, NOT_FILL_ONLY],
          paint: Object.assign({ 'line-color': color, 'line-width': width, 'line-opacity': 1 }, dash ? { 'line-dasharray': dash } : {})
        });
        return {
          sources: {
            [SRC]:       { type: 'geojson', data: main, generateId: true },
            [SRC_PAY]:   { type: 'geojson', data: pay,  generateId: true },
            [SRC_FLASH]: { type: 'geojson', data: empty }
          },
          layers: [
            { id: 'parcel-fill', type: 'fill', source: SRC, minzoom: MIN_ZOOM, paint: { 'fill-color': FILL, 'fill-opacity': 0.5 } },
            lineLayer('parcel-line-solid', SOLID, LINE, 2, null),
            lineLayer('parcel-line-dash', DASH44, LINE, WIDTH44, [2, 2]),
            lineLayer('parcel-line-default', ['all', ['!', SOLID], ['!', DASH44]], C.default, 1, [2, 4]),
            { id: 'payout-fill', type: 'fill', source: SRC_PAY, minzoom: MIN_ZOOM, paint: { 'fill-color': '#CCCCCC', 'fill-opacity': 0.5 } },
            { id: 'payout-line', type: 'line', source: SRC_PAY, minzoom: MIN_ZOOM, filter: NOT_FILL_ONLY, paint: { 'line-color': '#FEFDEC', 'line-width': 1, 'line-opacity': 1 } },
            { id: 'parcel-flash-fill', type: 'fill', source: SRC_FLASH, paint: { 'fill-color': '#FF6666', 'fill-opacity': 0.8 } },
            { id: 'parcel-flash-line', type: 'line', source: SRC_FLASH, paint: { 'line-color': '#FF0000', 'line-width': 5, 'line-opacity': 1 } }
          ]
        };
      },
      afterBuild: () => {
        // คลิก: Pay Out อยู่ชั้นบน (เหมือนเดิม) → ตรวจก่อน
        map.on('click', e => {
          if (!BPNP.map.registry.isVisible('polygonLand') || BPNP.tools.isBusy()) return;
          const hits = map.queryRenderedFeatures(e.point, { layers: ['payout-fill', 'parcel-fill'] });
          if (!hits.length) return;
          const h = hits[0];
          const source = h.layer.id === 'payout-fill' ? 'payout' : 'main';
          const feature = (source === 'payout' ? payFeatures : mainFeatures)[h.id] || h;
          openPopupFor(source, feature, [e.lngLat.lng, e.lngLat.lat]);
        });
        ['parcel-fill', 'payout-fill'].forEach(lid => {
          map.on('mouseenter', lid, () => { map.getCanvas().style.cursor = 'pointer'; });
          map.on('mouseleave', lid, () => { map.getCanvas().style.cursor = ''; });
          U.hoverLabel(map, lid, f => (f.properties || {}).Code || (f.properties || {}).name || 'Unknown Code', { className: 'land-hover', offset: 8 });
        });
      },
      onShow: () => {
        if (BPNP.layers.parcelSearch) BPNP.layers.parcelSearch.show();
        showLegend();
        BPNP.auth && BPNP.auth.logUserEvent('Open Layer', 'เปิดเลเยอร์ ข้อมูลเวนคืน (พร้อม Pay Out)');
      },
      onHide: () => {
        if (legendEl) legendEl.remove();
        if (BPNP.layers.parcelSearch) BPNP.layers.parcelSearch.hide();
        BPNP.ui.bottomPanel.hide();
      }
    });
  }

  BPNP.layers.parcel = { goTo, searchIndex, flash, imageCode };
  U.register({ name: 'parcel', register });
})();
