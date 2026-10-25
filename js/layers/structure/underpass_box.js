/* js/layers/structure/underpass_box.js
 * ─────────────────────────────────────────────────────────────────────────
 * เฟส 3: Underpass และ Box Culvert (เดิม setupStructureLayer ใน main.js + setUnderpassLegend.js)
 *
 * การแสดงผลตามซูม (ซูม Leaflet ในวงเล็บ)
 *   < 12 (13)   : ไม่แสดง
 *   12–13 (13)  : จุดสี่เหลี่ยม + ป้ายชื่อ (หมุน 90°)
 *   13–15 (14–15): จุดสี่เหลี่ยม + ป้ายชื่อ + กม.
 *   ≥ 15 (16)   : รูปโครงสร้าง + จุดสี่เหลี่ยม · ชี้เมาส์ที่รูปเห็นชื่อ + กม.
 *   คลิกรูปหรือจุด → การ์ดข้อมูล (กม., ขนาด, ความยาว) + ปุ่ม YouTube ถ้ามีวิดีโอ
 *
 * Underpass: สีตามขนาดช่องลอด + legend มุมขวาบน + ป้ายความสูง (height_signs.js)
 * ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  const U = BPNP.layers.utils;
  const esc = BPNP.escapeHtml;

  const YT_ICON = '<svg class="bp-yt-icon" viewBox="0 0 24 24"><path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/></svg>';

  // สี Underpass ตามขนาด (เดิม getUnderpassStyle)
  function underpassColors(p) {
    const v = String(p.size || p.name || '').toLowerCase().replace(/\s/g, '');
    if (v.includes('2.50x4.00')) return { fill: '#87CEFA', line: '#8E24AA' };
    if (v.includes('4.00x4.00')) return { fill: '#32CD32', line: '#8E24AA' };
    if (v.includes('2.50x6.00')) return { fill: '#87CEFA', line: '#006400' };
    if (v.includes('4.00x6.00')) return { fill: '#32CD32', line: '#006400' };
    return { fill: '#ccc', line: '#333' };
  }

  const TYPES = {
    layer_underpass: {
      name: 'Underpass', key: 'underpass', labelAnchor: 'top', labelOffset: [0, 30],
      colors: underpassColors, lineOpacity: 1, squareBorder: c => c.line
    },
    layer_boxculvert: {
      name: 'Box Culvert', key: 'boxculvert', labelAnchor: 'bottom', labelOffset: [0, -30],
      colors: () => ({ fill: '#FBC02D', line: '#FBC02D' }), lineOpacity: 0.9, squareBorder: () => '#fff'
    }
  };

  const Z_NAME = U.z(13), Z_KM = U.z(14), Z_PATH = U.z(16);

  // จุดสี่เหลี่ยม 12 px ขอบ 2 px (เดิม L.divIcon custom-square-icon)
  function ensureSquare(map, fill, border) {
    const id = `sq-${fill}-${border}`;
    if (map.hasImage(id)) return id;
    const pr = 2, size = 16 * pr, c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    g.fillStyle = border; g.fillRect(0, 0, size, size);
    g.fillStyle = fill;   g.fillRect(2 * pr, 2 * pr, size - 4 * pr, size - 4 * pr);
    map.addImage(id, g.getImageData(0, 0, size, size), { pixelRatio: pr });
    return id;
  }

  function staOf(p) {
    const sta = p['Sta.'] || '-';
    return { sta, clean: sta !== '-' ? String(sta).split('.')[0].trim() : '-' };
  }

  function popupHtml(T, p) {
    const { sta } = staOf(p);
    const len = parseFloat(p.Length);
    return `
      <div class="structure-popup-card ${T.key}-theme">
        <div class="structure-popup-header"><span>${esc(T.name)}</span></div>
        <div class="structure-popup-body">
          <div class="structure-popup-row"><span class="structure-popup-label">กม.</span><span class="structure-popup-value">${esc(sta)}</span></div>
          <div class="structure-popup-divider"></div>
          <div class="structure-popup-row"><span class="structure-popup-label">ขนาด</span><span class="structure-popup-value">${esc(p.size || '-')}</span></div>
          <div class="structure-popup-divider"></div>
          <div class="structure-popup-row"><span class="structure-popup-label">ความยาว</span><span class="structure-popup-value">${!isNaN(len) ? len.toFixed(2) + ' ม.' : '-'}</span></div>
          <div class="bp-action-group">
            <button type="button" class="bp-yt-btn structure-yt-btn" style="margin: 0 6px; width: 95%; display:none;">${YT_ICON} ดูความคืบหน้า (YouTube)</button>
          </div>
        </div>
      </div>`;
  }

  async function openPopup(T, p, at) {
    const popup = BPNP.map.popup.open(at, popupHtml(T, p), { className: `structure-popup ${T.key}-theme`, maxWidth: '350px' });
    if (!popup) return;
    const btn = popup.getElement().querySelector('.structure-yt-btn');
    const { clean } = staOf(p);
    const links = await BPNP.layers.videoLinks.structureLinks(clean, T.name);
    if (!btn || !btn.isConnected) return;
    if (links.length) {
      btn.style.display = 'flex';
      btn.addEventListener('click', () => BPNP.layers.videoLinks.openStructure(clean, T.name));
    } else {
      btn.remove();
    }
  }

  // ── legend Underpass (เดิม createUnderpassLegend — ค่าเริ่มต้นขยาย ไม่จำสถานะ) ──
  let upLegend = null;
  function underpassLegend() {
    if (upLegend) return upLegend;
    const div = document.createElement('div');
    div.className = 'info legend underpass-legend';
    let collapsed = false, animating = false;
    const item = (fill, line, text, d) => `
      <div class="legend-item animate" style="animation-delay: ${d}s;">
        <i style="background:${fill}; border: 2px solid ${line}; width:18px; height:18px;"></i>
        <div>${text}</div>
      </div>`;
    function render() {
      div.innerHTML = collapsed ? `
        <div class="legend-header">
          <div class="legend-collapsed-items"><b>Underpass</b></div>
          <button id="toggleUpLegendBtn" type="button" style="pointer-events: auto;">⏬ ขยาย</button>
        </div>` : `
        <div class="legend-header" style="margin-bottom: 8px;">
          <div style="line-height: 1.4;"><b>สัญลักษณ์ Underpass</b> <br><span class="legend-date">ขนาด สูง x กว้าง</span></div>
          <button id="toggleUpLegendBtn" type="button" style="pointer-events: auto;">⏪ ย่อ</button>
        </div>
        <div class="legend-content">
          ${item('#87CEFA', '#8E24AA', '2.5 x 4.0 m. ', 0.1)}
          ${item('#32CD32', '#8E24AA', '4.0 x 4.0 m. ', 0.2)}
          ${item('#87CEFA', '#006400', '2.5 x 6.0 m. ', 0.3)}
          ${item('#32CD32', '#006400', '4.0 x 6.0 m. ', 0.4)}
        </div>`;
      div.querySelector('#toggleUpLegendBtn').onclick = e => {
        e.preventDefault(); e.stopPropagation();
        if (animating) return;
        animating = true;
        if (collapsed) {
          div.classList.remove('collapsed'); div.classList.add('expanding');
          setTimeout(() => { collapsed = false; render(); div.classList.remove('expanding'); animating = false; }, 400);
        } else {
          div.classList.add('collapsing');
          div.querySelectorAll('.legend-item').forEach(el => { el.style.opacity = '0'; el.style.transform = 'translateY(-10px)'; });
          setTimeout(() => { collapsed = true; div.classList.remove('collapsing'); div.classList.add('collapsed'); render(); animating = false; }, 200);
        }
      };
    }
    render();
    upLegend = div;
    return div;
  }

  // ── ข้อมูล (โหลดครั้งเดียว ใช้ร่วมกับป้ายความสูง) ──
  const dataCache = {};
  function loadData(id) {
    if (!dataCache[id]) {
      dataCache[id] = U.loadGeoJSON(BPNP.layers.byId(id).source).then(fc => {
        const T = TYPES[id];
        const polys = [], points = [];
        (fc.features || []).forEach(f => {
          if (!f.geometry) return;
          const p = Object.assign({}, f.properties);
          const c = T.colors(p);
          p._fill = c.fill; p._line = c.line; p._border = T.squareBorder(c);
          // เส้นขอบแยก (_outline) → วาดเป็นเส้นอย่างเดียว ไม่นับเป็นโครงสร้าง
          if (p._outline) { polys.push({ type: 'Feature', properties: p, geometry: f.geometry }); return; }
          if (!/Polygon/.test(f.geometry.type)) return;
          const center = U.bboxCenter(f.geometry);
          polys.push({ type: 'Feature', properties: p, geometry: f.geometry });
          points.push({ type: 'Feature', properties: p, geometry: { type: 'Point', coordinates: center } });
        });
        return { polys, points };
      }).catch(err => { delete dataCache[id]; throw err; });
    }
    return dataCache[id];
  }

  function registerType(map, id) {
    const T = TYPES[id];
    const src = 'src-' + T.key, srcPt = 'src-' + T.key + '-pt';
    let labels = null;

    BPNP.map.registry.register(id, {
      slot: 'structure',
      build: async () => {
        const { polys, points } = await loadData(id);
        points.forEach(f => { f.properties._icon = ensureSquare(map, f.properties._fill, f.properties._border); });
        labels = U.htmlMarkerSet(map, {
          items: points.map(f => ({ lngLat: f.geometry.coordinates, props: f.properties })),
          variant: z => (z >= Z_PATH ? null : z >= Z_KM ? 'km' : z >= Z_NAME ? 'name' : null),
          create: (it, v) => {
            const el = document.createElement('div');
            el.className = `structure-label ${T.key}-label`;
            el.innerHTML = `<div class="rotate-inner">${esc(T.name)}${v === 'km' ? '<br>กม. ' + esc(it.props['Sta.'] || '-') : ''}</div>`;
            return { element: el, anchor: T.labelAnchor, offset: T.labelOffset };
          }
        });
        return {
          sources: {
            [src]:   { type: 'geojson', data: { type: 'FeatureCollection', features: polys } },
            [srcPt]: { type: 'geojson', data: { type: 'FeatureCollection', features: points } }
          },
          layers: [
            { id: src + '-fill', type: 'fill', source: src, minzoom: Z_PATH, paint: { 'fill-color': ['get', '_fill'], 'fill-opacity': 0.3 } },
            { id: src + '-line', type: 'line', source: src, minzoom: Z_PATH, filter: ['!=', ['get', '_fillOnly'], true],
              paint: { 'line-color': ['get', '_line'], 'line-width': 2, 'line-opacity': T.lineOpacity } },
            { id: srcPt + '-sq', type: 'symbol', source: srcPt, minzoom: Z_NAME,
              layout: { 'icon-image': ['get', '_icon'], 'icon-allow-overlap': true, 'icon-ignore-placement': true } }
          ]
        };
      },
      afterBuild: () => {
        map.on('click', src + '-fill', e => { if (!BPNP.tools.isBusy()) openPopup(T, e.features[0].properties, [e.lngLat.lng, e.lngLat.lat]); });
        map.on('click', srcPt + '-sq', e => { if (!BPNP.tools.isBusy()) openPopup(T, e.features[0].properties, e.features[0].geometry.coordinates); });
        [src + '-fill', srcPt + '-sq'].forEach(lid => {
          map.on('mouseenter', lid, () => { map.getCanvas().style.cursor = 'pointer'; });
          map.on('mouseleave', lid, () => { map.getCanvas().style.cursor = ''; });
        });
        U.hoverLabel(map, src + '-fill', f => `${T.name}  กม. ${f.properties['Sta.'] || '-'}`, { className: 'structure-hover' });
      },
      onShow: () => {
        if (labels) labels.setEnabled(true);
        if (id === 'layer_underpass') U.legendStack().appendChild(underpassLegend());
        BPNP.auth && BPNP.auth.logUserEvent('Open Layer', T.name);
      },
      onHide: () => {
        if (labels) labels.setEnabled(false);
        if (id === 'layer_underpass' && upLegend) upLegend.remove();
      }
    });
  }

  function register(map) {
    registerType(map, 'layer_underpass');
    registerType(map, 'layer_boxculvert');
    // ป้ายความสูงใช้ข้อมูลชุดเดียวกับชั้น Underpass (เปิดได้แม้ไม่ได้เปิดชั้น เหมือนเดิม)
    if (BPNP.layers.heightSigns) {
      BPNP.layers.heightSigns.registerGroup('underpass', async () => {
        const { points } = await loadData('layer_underpass');
        return points.map(f => ({ lngLat: f.geometry.coordinates, size: f.properties.size }));
      });
    }
  }

  U.register({ name: 'underpass_box', register });
})();
