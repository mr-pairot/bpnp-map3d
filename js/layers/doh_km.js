/* js/layers/doh_km.js
 * ─────────────────────────────────────────────────────────────────────────
 * เฟส 4B: หลัก กม. กรมทางหลวง (dohKmPost) — เดิม DOH_ShowKM.js
 *   - เปิด/ปิดด้วยปุ่ม "กม. ทล." มุมขวาล่าง (ไม่อยู่ในรายการชั้นข้อมูล และไม่จำสถานะ — เหมือนเดิม)
 *   - จุดสีส้ม ขอบขาว ตั้งแต่ซูม 10 (Leaflet 11)
 *   - ป้ายเลข กม. ในกล่องขาวขอบส้ม ตั้งแต่ซูม 12 (Leaflet 13) อยู่เหนือจุด
 *   - ข้อมูล 52,854 จุด: MapLibre วาดเองทั้งหมด (เดิมต้องใช้ canvas + grid และจำกัดป้าย 600 อัน)
 *   - ป้ายเป็นตัวเลขล้วน จึงใช้ symbol layer ได้ (ดูกติกาป้ายภาษาไทยใน layer_utils.js)
 * ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  const U = BPNP.layers.utils;
  const ID = 'dohKmPost', SRC = 'src-doh-km';
  let toggleEl = null, checkbox = null;

  function boldFont() {
    const f = U.labelFont()[0] || 'Noto Sans Regular';
    return [f.replace(/Regular|Italic/i, 'Bold')];
  }

  function buildToggle() {
    if (toggleEl) return;
    toggleEl = document.createElement('label');
    toggleEl.className = 'toggle-DOH';
    toggleEl.title = 'ซ่อน/แสดง กม. กรมทางหลวง';
    toggleEl.setAttribute('for', 'toggle-doh-km');
    toggleEl.innerHTML = `
      <input type="checkbox" id="toggle-doh-km" class="toggle-DOH__input">
      <span class="toggle-DOH__button">
        <svg class="toggle-DOH__button--correct" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" /></svg>
      </span>`;
    ['mousedown', 'touchstart', 'dblclick'].forEach(ev => toggleEl.addEventListener(ev, e => e.stopPropagation(), { passive: true }));
    toggleEl.addEventListener('contextmenu', e => e.preventDefault());
    checkbox = toggleEl.querySelector('input');
    checkbox.addEventListener('change', async () => {
      const on = checkbox.checked;
      toggleEl.style.opacity = '0.6'; toggleEl.style.pointerEvents = 'none';
      const ok = await BPNP.map.registry.setVisible(ID, on);
      toggleEl.style.opacity = ''; toggleEl.style.pointerEvents = '';
      if (on && !ok) { checkbox.checked = false; BPNP.ui.showAlert('ไม่สามารถโหลดข้อมูลหลัก กม. ได้'); }
      if (on && ok && BPNP.auth) BPNP.auth.logUserEvent('Open Layer', 'แสดงหลัก กม. ทล.');
    });
    document.body.appendChild(toggleEl);
  }

  function register(map) {
    const cfg = BPNP.layers.byId(ID);
    BPNP.map.registry.register(ID, {
      slot: 'general',
      build: async () => {
        U.ensureLabelBox(map, 'label-box-doh', 'rgba(255, 255, 255, 0.8)', { radius: 3, stroke: '#FF5722', strokeWidth: 1 });
        return {
          sources: { [SRC]: { type: 'geojson', data: await U.loadGeoJSON(cfg.source) } },
          layers: [
            { id: SRC + '-dot', type: 'circle', source: SRC, minzoom: U.z(11),
              paint: { 'circle-radius': 4, 'circle-color': '#FF5722', 'circle-opacity': 1,
                       'circle-stroke-color': '#ffffff', 'circle-stroke-width': 1.5, 'circle-stroke-opacity': 1 } },
            { id: SRC + '-label', type: 'symbol', source: SRC, minzoom: U.z(13),
              layout: U.labelLayout({ 'text-field': ['to-string', ['get', 'km']], 'text-font': boldFont(), 'text-size': 11,
                                      'text-offset': [0, -0.45], 'icon-image': 'label-box-doh', 'icon-text-fit-padding': [1, 3, 1, 3] }),
              paint: { 'text-color': '#d84315' } }
          ]
        };
      }
    });
    BPNP.ui.registerButton(buildToggle);
  }

  U.register({ name: 'doh_km', register });
})();
