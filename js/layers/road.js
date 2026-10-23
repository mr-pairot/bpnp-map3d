/* js/layers/road.js
 * ─────────────────────────────────────────────────────────────────────────
 * เฟส 2: ผังถนน Service Rd. + Access Rd. (roadLayout) — แสดงเมื่อซูม ≥ 13 (Leaflet 14)
 *   สีพื้น  ตามประเภทผิวทาง (Type)
 *   เส้นขอบ Submit = 1 → น้ำเงินเส้นทึบ / อื่น ๆ → ส้มเส้นประ
 * ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  const U = BPNP.layers.utils;
  const esc = BPNP.escapeHtml;

  const SUBMITTED = ['==', ['to-string', ['get', 'Submit']], '1'];

  const FILL_BY_TYPE = ['match', ['downcase', ['to-string', ['get', 'Type']]],
    'asphaltic',    '#256718',
    'concrete',     '#ADD8E6',
    'crushed rock', '#A52A2A',
    'subbase',      '#FEDA62',
    '#333333'
  ];

  function popupHtml(f) {
    const p = f.properties || {};
    const submitted = String(p.Submit) === '1';
    const row = (label, value) => `
      <div class="road-popup-row">
        <span class="road-popup-label">${label}</span>
        <span class="road-popup-value">${value}</span>
      </div>`;
    return `
      <div class="road-popup">
        <div class="road-popup-header"><span>Road Layout</span></div>
        <div class="road-popup-body">
          ${row('กม.', esc(p['Sta.'] || '-'))}
          <div class="road-popup-divider"></div>
          ${row('ความกว้าง', `${esc(p.Width || '-')} <small>m.</small>`)}
          <div class="road-popup-divider"></div>
          ${row('ประเภทผิวทาง', esc(p.Type || '-'))}
          <div class="road-popup-divider"></div>
          ${row('สถานะ', submitted ? 'Submitted' : 'Pending')}
        </div>
      </div>`;
  }

  function register(map) {
    const cfg = BPNP.layers.byId('roadLayout');
    const minzoom = U.z(14);

    BPNP.map.registry.register('roadLayout', {
      slot: 'general',
      build: async () => ({
        sources: { 'src-road': { type: 'geojson', data: await U.loadGeoJSON([cfg.source, cfg.source2]) } },
        layers: [
          { id: 'road-fill', type: 'fill', source: 'src-road', minzoom,
            paint: { 'fill-color': FILL_BY_TYPE, 'fill-opacity': 0.9 } },
          { id: 'road-line-submitted', type: 'line', source: 'src-road', minzoom, filter: SUBMITTED,
            paint: { 'line-color': 'blue', 'line-width': 1, 'line-opacity': 1 } },
          { id: 'road-line-pending', type: 'line', source: 'src-road', minzoom, filter: ['!', SUBMITTED],
            paint: { 'line-color': '#FF4500', 'line-width': 1, 'line-opacity': 1, 'line-dasharray': [3, 3] } }
        ]
      }),
      afterBuild: () => U.clickPopup(map, 'road-fill', popupHtml, { maxWidth: '300px' }),
      onShow: () => BPNP.auth && BPNP.auth.logUserEvent('Open Layer', 'layout Roadwork')
    });
  }

  U.register({ name: 'road', register });
})();
