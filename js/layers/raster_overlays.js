/* js/layers/raster_overlays.js
 * ─────────────────────────────────────────────────────────────────────────
 * เลเยอร์ raster ซ้อนทับ (เฟส 1): ผังที่ดิน กรมที่ดิน, ผังเมือง DPT (WMS), TomTom Traffic
 * ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  const keys = BPNP.config.keys || {};

  const LONGDO_ATTR = '&copy; <a href="https://map.longdo.com/" target="_blank">Longdo Map</a>';

  const DEFS = {
    dol: {
      tiles: [`https://ms.longdo.com/mmmap/tile.php?proj=epsg3857&mode=dol_hd&zoom={z}&x={x}&y={y}&HD=1&key=${keys.longdo || ''}`],
      maxzoom: 20, attribution: LONGDO_ATTR
    },
    dpt: {
      // WMS 1.1.1 → MapLibre แทนที่ {bbox-epsg-3857} ให้ทุก tile
      tiles: ['https://ms.longdo.com/mapproxy/service?SERVICE=WMS&REQUEST=GetMap&VERSION=1.1.1&LAYERS=cityplan_dpt&STYLES=&FORMAT=image/png&TRANSPARENT=TRUE&SRS=EPSG:3857&WIDTH=256&HEIGHT=256&BBOX={bbox-epsg-3857}'],
      maxzoom: 20, attribution: LONGDO_ATTR
    },
    tomtomTraffic: {
      tiles: [`https://api.tomtom.com/traffic/map/4/tile/flow/relative/{z}/{x}/{y}.png?key=${keys.tomtom || ''}`],
      maxzoom: 22, attribution: '&copy; <a href="https://www.tomtom.com/" target="_blank">TomTom</a>'
    }
  };

  function register() {
    Object.keys(DEFS).forEach(id => {
      const d = DEFS[id];
      BPNP.map.registry.register(id, {
        slot: 'raster-overlay',
        attribution: d.attribution,
        build: () => ({
          sources: { ['ov-' + id]: { type: 'raster', tiles: d.tiles, tileSize: 256, maxzoom: d.maxzoom } },
          layers:  [{ id: 'ov-' + id, type: 'raster', source: 'ov-' + id, paint: { 'raster-opacity': 1 } }]
        })
      });
    });
  }

  BPNP.layers.rasterOverlays = { register };
})();
