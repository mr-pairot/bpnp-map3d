/* js/layers/structure/footing.js
 * ─────────────────────────────────────────────────────────────────────────
 * เฟส 2: ผัง Footing ของสะพาน VB45 / VB64 / VB88 / VB109 / VB110 / VB118
 *   layoutFootingVBxx  รูป footing (ซูม ≥ 12 / Leaflet 13)
 *   pierNameVBxx       ป้าย P1, P2, ... (เปิดจากปุ่ม "Pier" ในรายการชั้นข้อมูล)
 *     ซูม 15–17 (16–18): ป้ายถาวรเฉพาะ P ที่หาร 5 ลงตัว / ที่เหลือชี้เมาส์ดู
 *     ซูม ≥ 17   (18)  : ป้ายทุกต้น
 * ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  const U = BPNP.layers.utils;
  const SPANS = ['45', '64', '88', '109', '110', '118'];

  const PIER_LABEL = ['concat', 'P', ['to-string', ['get', 'Pier']]];
  const PIER_MAJOR = ['==', ['%', ['to-number', ['get', 'Pier'], -1], 5], 0];
  const HAS_PIER   = ['!=', ['to-string', ['get', 'Pier']], ''];

  function register(map) {
    const R = BPNP.map.registry;
    const pierAllZoom = U.z(18);

    SPANS.forEach(n => {
      const layoutId = 'layoutFootingVB' + n;
      const pierId   = 'pierNameVB' + n;
      const src      = 'src-footing-vb' + n;
      const pierSrc  = 'src-pier-vb' + n;

      R.register(layoutId, {
        slot: 'structure',
        build: async () => ({
          sources: { [src]: { type: 'geojson', data: await U.loadGeoJSON(BPNP.layers.byId(layoutId).source) } },
          layers: [
            { id: src + '-fill', type: 'fill', source: src, minzoom: U.z(13), paint: { 'fill-color': 'darkblue', 'fill-opacity': 0.3 } },
            { id: src + '-line', type: 'line', source: src, minzoom: U.z(13), filter: ['!=', ['get', '_fillOnly'], true],
              paint: { 'line-color': 'darkblue', 'line-width': 2, 'line-opacity': 1 } }
          ]
        }),
        onShow: () => BPNP.auth && BPNP.auth.logUserEvent('Open Layer', layoutId)
      });

      R.register(pierId, {
        slot: 'labels',
        build: async () => {
          U.ensureLabelBox(map, 'label-box-blue', 'rgba(33, 150, 243, 0.9)', { radius: 5 });
          const label = (id, filter, minzoom) => ({
            id, type: 'symbol', source: pierSrc, minzoom, filter,
            layout: U.labelLayout({ 'text-field': PIER_LABEL, 'icon-image': 'label-box-blue', 'text-size': 12 }),
            paint: { 'text-color': '#ffffff' }
          });
          return {
            sources: { [pierSrc]: { type: 'geojson', data: await U.loadGeoJSON(BPNP.layers.byId(pierId).source) } },
            layers: [
              // จุดโปร่งใส ใช้รับการชี้เมาส์
              { id: pierSrc + '-hit', type: 'circle', source: pierSrc, minzoom: U.z(16), filter: HAS_PIER,
                paint: { 'circle-radius': 6, 'circle-opacity': 0, 'circle-stroke-opacity': 0 } },
              label(pierSrc + '-major', ['all', HAS_PIER, PIER_MAJOR], U.z(16)),
              label(pierSrc + '-all', ['all', HAS_PIER, ['!', PIER_MAJOR]], pierAllZoom)
            ]
          };
        },
        afterBuild: () => U.hoverLabel(map, pierSrc + '-hit', f => 'P' + f.properties.Pier, { maxZoom: pierAllZoom, className: 'sta-hover' })
      });
    });
  }

  U.register({ name: 'footing', register });
})();
