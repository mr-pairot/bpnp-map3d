/* js/map/basemaps.js
 * ─────────────────────────────────────────────────────────────────────────
 * แผนที่พื้นหลังทั้งหมดอยู่ใน style เดียว แล้วสลับด้วย visibility
 * (ห้ามใช้ map.setStyle() เพราะเลเยอร์ข้อมูลที่เพิ่มไว้จะหายทั้งหมด)
 *
 *   BPNP.map.basemaps.list                  รายการ { id, name, type, available }
 *   BPNP.map.basemaps.buildStyle(activeId)  → Promise<style JSON> (ใช้ตอนสร้างแผนที่)
 *   BPNP.map.basemaps.setActive(id)
 *   BPNP.map.basemaps.active / .attribution
 *
 * แผนที่เวกเตอร์ (OpenFreeMap) โหลด style ตอนเปิดแอป และเก็บสำเนาไว้ใช้ตอนออฟไลน์
 * ป้ายถนน/สถานที่ปรับเป็นภาษาไทยตั้งแต่ก่อนสร้างแผนที่ (เดิม forceThaiLabels ใน main.js)
 * ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  const CFG = BPNP.config;
  const STYLE_CACHE_KEY = 'vector_style_cache';
  const STYLE_TIMEOUT_MS = 5000;
  const VECTOR_ID = 'ofm';
  const HYBRID_ID = 'ofm-satellite';

  const tk = (CFG.keys && CFG.keys.tracestrack) || '';

  // ลำดับเดียวกับเวอร์ชัน Leaflet
  const RASTERS = [
    { id: 'osm',         name: 'OpenStreetMap',    maxzoom: 19, attribution: '&copy; OpenStreetMap contributors',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'] },
    { id: VECTOR_ID,     name: 'OpenFreeMap (Vector)', vector: true,
      attribution: '&copy; OpenStreetMap contributors | OpenFreeMap' },
    // ภาพดาวเทียม Esri + อาคาร 3D (เฉพาะโหมด 3D) + ชื่อถนน/สถานที่ (ปุ่ม "ก") จาก OpenFreeMap — v3.9.05
    { id: HYBRID_ID,     name: 'OpenFreeMap (Vector) + Satellite', hybrid: true, maxzoom: 18,
      attribution: '&copy; Esri | &copy; OpenStreetMap contributors | OpenFreeMap',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'] },
    { id: 'gstreets',    name: 'Google Streets',   maxzoom: 20, attribution: '&copy; Google',
      tiles: [0, 1, 2, 3].map(n => `https://mt${n}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}`) },
    { id: 'ghybrid',     name: 'Google Hybrid',    maxzoom: 20, attribution: '&copy; Google Hybrid',
      tiles: [0, 1, 2, 3].map(n => `https://mt${n}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}`) },
    { id: 'satellite',   name: 'Satellite',        maxzoom: 18, attribution: '&copy; Esri',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'] },
    { id: 'terrain',     name: 'Terrain',          maxzoom: 17, attribution: '&copy; OpenTopoMap',
      tiles: ['a', 'b', 'c'].map(s => `https://${s}.tile.opentopomap.org/{z}/{x}/{y}.png`) },
    { id: 'tracestrack', name: 'Tracestrack Topo', maxzoom: 19, attribution: '&copy; <a href="https://www.tracestrack.com/" target="_blank">Tracestrack</a>',
      tiles: [`https://tile.tracestrack.com/topo__/{z}/{x}/{y}.webp?key=${tk}`] }
  ];

  let vectorLayerIds = [];
  let hybridBuildingIds = [], hybridLabelIds = [];
  const HYBRID_LABELS_KEY = 'map_hybrid_labels';     // จำการเปิด/ปิดชื่อ (ค่าเริ่มต้น เปิด)
  let hybridLabelsOn = true;
  let labelsBtn = null;
  let labelFont = ['Noto Sans Regular'];   // ฟอนต์ที่ glyph server มีแน่นอน (ใช้กับป้ายของเลเยอร์ข้อมูล)
  let vectorAvailable = false;
  let activeId = null;

  // ── โหลด style เวกเตอร์ (มี timeout + สำเนาออฟไลน์) ──
  async function fetchVectorStyle() {
    const ctrl = ('AbortController' in window) ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), STYLE_TIMEOUT_MS) : null;
    try {
      const res = await fetch(CFG.map.vectorStyleUrl, { signal: ctrl ? ctrl.signal : undefined });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const style = await res.json();
      try { BPNP.storage.set(STYLE_CACHE_KEY, JSON.stringify(style)); } catch (e) {}
      return style;
    } catch (err) {
      console.warn('[Basemaps] โหลด style เวกเตอร์ไม่สำเร็จ ใช้สำเนาในเครื่อง (ถ้ามี):', err.message);
      return BPNP.storage.getJSON(STYLE_CACHE_KEY);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  // ── ปรับป้ายเป็นภาษาไทย (ย้ายจาก forceThaiLabels เดิม ทำกับ JSON ก่อนสร้างแผนที่) ──
  function applyThaiLabels(layers) {
    let srcName = 'openmaptiles', srcLayer = 'transportation_name', font = ['Noto Sans Regular'];
    const sample = layers.find(l => l.type === 'symbol' && l.id.includes('highway'));
    if (sample) {
      srcName  = sample.source || srcName;
      srcLayer = sample['source-layer'] || srcLayer;
      if (sample.layout && sample.layout['text-font']) font = sample.layout['text-font'];
    }

    layers.forEach(l => {
      if (l.type !== 'symbol' || !l.layout || !l.layout['text-field']) return;
      const id = l.id.toLowerCase();
      const tf = JSON.stringify(l.layout['text-field']);
      if (tf.includes('housenumber') || id.includes('shield') || tf === '"{ref}"' || tf === '["get","ref"]') return;

      if (id.includes('highway') || id.includes('road') || id.includes('street')) {
        l.layout['text-field'] = [
          'case',
          ['match', ['get', 'class'], ['motorway', 'trunk', 'primary', 'secondary'], true, false], '',
          ['all', ['has', 'name:th'], ['!=', ['get', 'name:th'], '']], ['get', 'name:th'],
          ['all', ['has', 'name'], ['!=', ['get', 'name'], '']], ['get', 'name'],
          ['all', ['has', 'ref'], ['!=', ['get', 'ref'], '']], ['concat', '[ ', ['get', 'ref'], ' ]'],
          ''
        ];
        l.layout['text-size'] = ['interpolate', ['linear'], ['zoom'], 10, 10, 14, 11];
        l.paint = Object.assign({}, l.paint, {
          'text-color': '#101720', 'text-halo-color': '#fffff0', 'text-halo-width': 1.2, 'text-halo-blur': 0
        });
      } else {
        l.layout['text-field'] = ['coalesce', ['get', 'name:th'], ['get', 'name']];
      }
    });

    // ชื่อถนนสายหลักภาษาไทยตามแนวเส้น
    layers.push({
      id: 'bpnp-major-road-names',
      type: 'symbol',
      source: srcName,
      'source-layer': srcLayer,
      minzoom: 9,
      filter: ['all',
        ['==', '$type', 'LineString'],
        ['in', 'class', 'motorway', 'trunk', 'primary', 'secondary'],
        ['any', ['has', 'name:th'], ['has', 'name']]
      ],
      layout: {
        'text-field': ['coalesce', ['get', 'name:th'], ['get', 'name']],
        'symbol-placement': 'line',
        'text-font': font,
        'text-size': ['interpolate', ['linear'], ['zoom'], 10, 10, 14, 12],
        'symbol-spacing': 400,
        'text-keep-upright': true
      },
      paint: { 'text-color': '#101720', 'text-halo-color': '#fffff0', 'text-halo-width': 1.5, 'text-halo-blur': 0 }
    });
    return layers;
  }

  function setVis(layer, visible) {
    layer.layout = Object.assign({}, layer.layout, { visibility: visible ? 'visible' : 'none' });
    return layer;
  }

  // ── สร้าง style รวม ──
  async function buildStyle(wantedId) {
    const vec = await fetchVectorStyle();
    vectorAvailable = !!(vec && Array.isArray(vec.layers));

    activeId = byId(wantedId) ? wantedId : (CFG.map.defaultBasemap || 'osm');
    if (activeId === VECTOR_ID && !vectorAvailable) activeId = 'osm';

    const style = {
      version: 8,
      name: 'BPNP Map 3D',
      glyphs: (vec && vec.glyphs) || CFG.map.fallbackGlyphs,
      sources: {},
      layers: [
        // พื้นหลังสำรอง (มองเห็นระหว่างรอ tile)
        { id: 'bm-background', type: 'background', paint: { 'background-color': '#f2efe9' } }
      ]
    };
    if (vec && vec.sprite) style.sprite = vec.sprite;

    RASTERS.filter(b => !b.vector).forEach(b => {
      style.sources['bm-' + b.id] = { type: 'raster', tiles: b.tiles, tileSize: 256, maxzoom: b.maxzoom, attribution: b.attribution };
      style.layers.push(setVis({ id: 'bm-' + b.id, type: 'raster', source: 'bm-' + b.id }, b.id === activeId));
    });

    if (vectorAvailable) {
      const fonts = vec.layers.filter(l => l.type === 'symbol' && l.layout && Array.isArray(l.layout['text-font']))
                               .map(l => l.layout['text-font'][0]);
      const regular = fonts.find(f => /Regular/i.test(f)) || fonts[0];
      if (regular) labelFont = [regular];
      Object.assign(style.sources, vec.sources);
      const vLayers = applyThaiLabels(JSON.parse(JSON.stringify(vec.layers)));
      vectorLayerIds = vLayers.map(l => l.id);
      vLayers.forEach(l => style.layers.push(setVis(l, activeId === VECTOR_ID)));

      // ── รายการ OpenFreeMap + Satellite: ใช้ source เวกเตอร์เดิมร่วมกัน (ไม่ดาวน์โหลดซ้ำ) ──
      const vecSrc = Object.keys(vec.sources).find(k => vec.sources[k].type === 'vector') || 'openmaptiles';
      // อาคาร 3D สีเทาตามความสูง — แสดงเฉพาะโหมด 3D (applyHybrid)
      const bId = 'bm-hyb-buildings';
      style.layers.push(setVis({
        id: bId, type: 'fill-extrusion', source: vecSrc, 'source-layer': 'building', minzoom: 14,   // = Leaflet 15
        filter: ['!=', ['get', 'hide_3d'], true],
        paint: {
          'fill-extrusion-color': ['interpolate', ['linear'], ['coalesce', ['get', 'render_height'], 3],
            0, '#e5e7eb', 15, '#cbd5e1', 40, '#9ca3af', 100, '#6b7280'],
          'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'],
            14, 0,
            15, ['coalesce', ['get', 'render_height'], 3]],
          'fill-extrusion-base': ['interpolate', ['linear'], ['zoom'],
            14, 0,
            15, ['coalesce', ['get', 'render_min_height'], 0]],
          'fill-extrusion-opacity': 0.85
        }
      }, false));
      hybridBuildingIds = [bId];
      // ชื่อถนน/สถานที่ภาษาไทย: ตัวหนังสือขาว ขอบเข้ม อ่านได้บนภาพดาวเทียม
      hybridLabelIds = [];
      vLayers.filter(l => l.type === 'symbol' && ['place', 'transportation_name', 'water_name'].includes(l['source-layer']) && l.layout && l.layout['text-field'])
        .forEach(l => {
          const c = JSON.parse(JSON.stringify(l));
          c.id = 'bm-hyb-lbl-' + l.id;
          // ป้ายหมายเลขถนน (ข้อความจาก "ref" + ไอคอนกรอบ road_N จาก sprite) — คงแบบเดียวกับ OpenFreeMap (Vector) ทุกอย่าง (v3.9.06)
          // ระบุจากไอคอนกรอบ (ref_length / network) หรือชื่อชั้น — ไม่ใช้ข้อความ เพราะชื่อถนนภาษาไทยมี ref เป็นค่าสำรอง
          const icon = JSON.stringify(l.layout['icon-image'] || '');
          const isShield = /shield/.test(l.id) || /ref_length/.test(icon);
          if (!isShield) {
            delete c.layout['icon-image'];                   // ชื่อ: ไม่ใช้จุดวงกลมหน้าชื่อหมู่บ้าน/เมือง
            c.paint = Object.assign({}, c.paint, { 'text-color': '#ffffff', 'text-halo-color': 'rgba(0,0,0,0.85)', 'text-halo-width': 1.6, 'text-halo-blur': 0.3 });
          }
          style.layers.push(setVis(c, false));
          hybridLabelIds.push(c.id);
        });
    }
    return style;
  }

  function byId(id) { return RASTERS.find(b => b.id === id) || null; }

  function setActive(id) {
    const map = BPNP.map.instance;
    const b = byId(id);
    if (!map || !b) return false;
    if (b.vector && !vectorAvailable) return false;

    RASTERS.filter(x => !x.vector).forEach(x => {
      if (map.getLayer('bm-' + x.id)) map.setLayoutProperty('bm-' + x.id, 'visibility', x.id === id ? 'visible' : 'none');
    });
    vectorLayerIds.forEach(lid => {
      if (map.getLayer(lid)) map.setLayoutProperty(lid, 'visibility', b.vector ? 'visible' : 'none');
    });
    activeId = id;
    applyHybrid();
    BPNP.events.emit('basemap:change', id);
    return true;
  }

  // ── รายการ OpenFreeMap + Satellite: อาคาร (เฉพาะ 3D) · ชื่อ (ปุ่ม "ก") · ปุ่มแสดงเฉพาะรายการนี้ ──
  function applyHybrid() {
    const map = BPNP.map.instance;
    if (!map) return;
    const on = activeId === HYBRID_ID;
    const is3d = !!(BPNP.map.terrain && BPNP.map.terrain.isOn());
    hybridBuildingIds.forEach(id => { if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on && is3d ? 'visible' : 'none'); });
    hybridLabelIds.forEach(id => { if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', on && hybridLabelsOn ? 'visible' : 'none'); });
    if (labelsBtn) {
      labelsBtn.style.display = on && hybridLabelIds.length ? '' : 'none';
      labelsBtn.classList.toggle('active', hybridLabelsOn);
      labelsBtn.title = hybridLabelsOn ? 'ชื่อถนน/สถานที่: เปิด (กดเพื่อปิด)' : 'ชื่อถนน/สถานที่: ปิด (กดเพื่อแสดง)';
    }
  }

  function setHybridLabels(onOff) {
    hybridLabelsOn = !!onOff;
    BPNP.storage.set(HYBRID_LABELS_KEY, hybridLabelsOn ? '1' : '0');
    applyHybrid();
    if (BPNP.core.toast) BPNP.core.toast.show(hybridLabelsOn ? 'ชื่อถนน/สถานที่: เปิด' : 'ชื่อถนน/สถานที่: ปิด', false, 1500);
  }

  // ปุ่ม "ก" กลม ซ้ายปุ่มภูมิประเทศ (แถวเดียวกับปุ่ม 3D) — ตำแหน่งคงที่ ไม่ขยับเมื่อสลับ 2D/3D
  if (BPNP.ui && BPNP.ui.registerButton) BPNP.ui.registerButton(() => {
    hybridLabelsOn = BPNP.storage.get(HYBRID_LABELS_KEY) !== '0';
    labelsBtn = BPNP.ui.createStandardButton({
      id: 'labelsBtn',
      html: '<span class="labels-glyph">ก</span>',
      style: { bottom: 'calc(var(--safe-bottom) + 65px + (var(--map-btn-size) + var(--map-gap)) * 1)',
               right: 'calc(var(--safe-right) + (var(--map-btn-size) + var(--map-gap)) * 2)', display: 'none' },
      title: '',
      onClick: () => setHybridLabels(!hybridLabelsOn)
    });
    applyHybrid();
  });
  if (BPNP.events) BPNP.events.on('map:3d', applyHybrid);

  BPNP.map.basemaps = {
    VECTOR_ID, HYBRID_ID,
    buildStyle, applyHybrid, setHybridLabels,
    setActive,
    get list() {
      return RASTERS.map(b => ({ id: b.id, name: b.name, type: b.vector ? 'vector' : (b.hybrid ? 'hybrid' : 'raster'), available: b.vector ? vectorAvailable : true }));
    },
    get active() { return activeId; },
    get labelFont() { return labelFont; },
    get attribution() { const b = byId(activeId); return b ? b.attribution : ''; },
    // เลเยอร์ของแผนที่ฐานทั้งหมด (registry วางเลเยอร์ข้อมูลไว้เหนือชุดนี้)
    get topLayerId() {
      const map = BPNP.map.instance;
      const layers = map ? map.getStyle().layers : [];
      return layers.length ? layers[layers.length - 1].id : null;
    }
  };
})();
