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

  const tk = (CFG.keys && CFG.keys.tracestrack) || '';

  // ลำดับเดียวกับเวอร์ชัน Leaflet
  const RASTERS = [
    { id: 'osm',         name: 'OpenStreetMap',    maxzoom: 19, attribution: '&copy; OpenStreetMap contributors',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'] },
    { id: VECTOR_ID,     name: 'OpenFreeMap (Vector)', vector: true,
      attribution: '&copy; OpenStreetMap contributors | OpenFreeMap' },
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
      Object.assign(style.sources, vec.sources);
      const vLayers = applyThaiLabels(JSON.parse(JSON.stringify(vec.layers)));
      vectorLayerIds = vLayers.map(l => l.id);
      vLayers.forEach(l => style.layers.push(setVis(l, activeId === VECTOR_ID)));
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
    BPNP.events.emit('basemap:change', id);
    return true;
  }

  BPNP.map.basemaps = {
    VECTOR_ID,
    buildStyle,
    setActive,
    get list() {
      return RASTERS.map(b => ({ id: b.id, name: b.name, type: b.vector ? 'vector' : 'raster', available: b.vector ? vectorAvailable : true }));
    },
    get active() { return activeId; },
    get attribution() { const b = byId(activeId); return b ? b.attribution : ''; },
    // เลเยอร์ของแผนที่ฐานทั้งหมด (registry วางเลเยอร์ข้อมูลไว้เหนือชุดนี้)
    get topLayerId() {
      const map = BPNP.map.instance;
      const layers = map ? map.getStyle().layers : [];
      return layers.length ? layers[layers.length - 1].id : null;
    }
  };
})();
