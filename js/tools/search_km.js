/* js/tools/search_km.js
 * ─────────────────────────────────────────────────────────────────────────
 * เฟส 5A: ค้นหา กม. (เดิม search_sta.js)
 *   - ปุ่ม assets/ui/search.png คอลัมน์ซ้าย แถวบนสุด
 *   - พิมพ์ กม. (เช่น 10+500 หรือ 10500) → รายการแนะนำจากจุด alignment ทุก 20 ม. (สูงสุด 20 รายการ)
 *   - เลือก → หมุด กม. สีฟ้า + บินไปซูม Leaflet 14 + วงกระเพื่อมหลัง 2 วินาที + แสดงพิกัด
 *   - ปิดแผง → ลบหมุดและหยุดวงกระเพื่อม
 * CSS: css/tools/search_km.css
 * ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  const T = () => BPNP.tools.utils;
  let panel = null, input = null, suggest = null, latLngDiv = null, marker = null, visible = false;

  const formatSta = n => { n = Number(n); return `${Math.floor(n / 1000)}+${String(n % 1000).padStart(3, '0')}`; };

  function pinHtml(staString) {
    let km = staString, frac = '+000';
    if (staString.includes('+')) {
      const [a, b] = staString.split('+');
      km = a; frac = String(parseInt(b || '0', 10)).padStart(3, '0');
    }
    return `
      <svg width="33" height="44" viewBox="0 0 35 45" xmlns="http://www.w3.org/2000/svg">
        <path d="M28.205 3.217H6.777c-2.367 0-4.286 1.87-4.286 4.179v19.847c0 2.308 1.919 4.179 4.286 4.179h5.357l5.337 13.58 5.377-13.58h5.357c2.366 0 4.285-1.87 4.285-4.179V7.396c0-2.308-1.919-4.179-4.285-4.179" fill="#32a9dd"></path>
        <text x="17.5" y="15" text-anchor="middle" fill="#fff" font-family="Sarabun" font-weight="bold" font-size="12px">${BPNP.escapeHtml(km)}</text>
        <line x1="4" y1="17" x2="31" y2="17" stroke="#fff" stroke-width="1" />
        <text x="17.5" y="28" text-anchor="middle" fill="#fff" font-family="Sarabun" font-size="8px">${BPNP.escapeHtml(frac)}</text>
      </svg>`;
  }

  function build() {
    if (panel) return;
    panel = document.createElement('div');
    panel.id = 'staPanel';
    panel.style.display = 'none';
    panel.innerHTML = `
      <h3>ค้นหา กม.</h3>
      <button id="staCloseBtn" class="sta-close-btn" type="button" title="ปิด">✖</button>
      <div class="input-wrapper">
        <input id="staInputBox" type="text" placeholder="เช่น 10+500" autocomplete="off" inputmode="decimal" />
        <div id="suggestionBox"></div>
      </div>
      <div id="staLatLng" class="sta-latlng"></div>`;
    document.body.appendChild(panel);
    T().blockMap(panel);
    input = panel.querySelector('#staInputBox');
    suggest = panel.querySelector('#suggestionBox');
    latLngDiv = panel.querySelector('#staLatLng');

    input.addEventListener('input', onInput);
    input.addEventListener('keydown', e => {
      e.stopPropagation();   // ไม่ให้ Space/Esc ไปหยุดวงกระเพื่อมของเครื่องมือดูพิกัด
      if (e.key === 'Enter') { e.preventDefault(); suggest.style.display = 'none'; goTo(input.value.trim()); }
      if (e.key === 'Escape') reset();
    });
    panel.querySelector('#staCloseBtn').addEventListener('click', reset);
    document.addEventListener('click', e => {
      if (suggest && e.target !== input && !suggest.contains(e.target)) suggest.style.display = 'none';
    });
  }

  // จับคู่ตามรูปแบบ กม.: ส่วนหน้า '+' = กม. (ต้องตรงทั้งตัว) · ส่วนหลัง '+' = เมตรที่ขึ้นต้นด้วยค่าที่พิมพ์
  //   "121+"   → 121+000 … 121+980        "121+5" → 121+500 … 121+580        "10+500" → 10+500
  //   "121"    → กม. ที่ขึ้นต้นด้วย 121 (121+…, 1210+… ถ้ามี) เรียงตาม กม.
  // (เดิมตัด '+' ทิ้งแล้วเทียบตัวเลขล้วน "121+" จึงได้ 12+1xx ปนมาด้วย)
  function matchStations(points, val) {
    const v = val.replace(/\s+/g, '');
    let test;
    if (v.includes('+')) {
      const [k, m = ''] = v.split('+');
      if (!/^\d+$/.test(k) || !/^\d*$/.test(m)) return [];
      const km = Number(k);
      test = st => Math.floor(st / 1000) === km && String(st % 1000).padStart(3, '0').startsWith(m);
    } else {
      if (!/^\d+$/.test(v)) return [];
      test = st => String(Math.floor(st / 1000)).startsWith(v);
    }
    return points.filter(p => test(Number(p.station))).sort((a, b) => a.station - b.station).slice(0, 20);
  }

  async function onInput() {
    const val = input.value.trim();
    if (!val) { suggest.style.display = 'none'; return; }
    const points = await BPNP.alignment.load().catch(() => []);
    if (!points.length) return;
    const matches = matchStations(points, val);
    suggest.innerHTML = '';
    if (!matches.length) { suggest.style.display = 'none'; return; }
    matches.forEach(p => {
      const txt = formatSta(p.station);
      const item = document.createElement('div');
      item.className = 'suggestion-item';
      item.textContent = txt;
      item.addEventListener('click', e => { e.stopPropagation(); input.value = txt; suggest.style.display = 'none'; goTo(txt); });
      suggest.appendChild(item);
    });
    suggest.style.display = 'block';
  }

  async function goTo(staInput) {
    if (!staInput) return;
    const parts = staInput.split('+');
    if (parts.length !== 2 || parts[0] === '' || isNaN(parts[0]) || isNaN(parts[1])) {
      BPNP.ui.showAlert('กรุณากรอกรูปแบบ 0+000');
      return;
    }
    const staVal = Number(parts[0]) * 1000 + Number(parts[1]);
    const points = await BPNP.alignment.load().catch(() => []);
    if (!points.length) { BPNP.ui.showAlert('ยังไม่มีข้อมูล Alignment'); return; }
    const found = points.find(p => Number(p.station) === staVal);
    if (!found) { BPNP.ui.showAlert('ไม่พบข้อมูลที่ต้องการ'); return; }

    const { lat, lng } = found;
    latLngDiv.textContent = `พิกัด: ${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    marker = T().remove(marker);
    marker = T().add(T().marker(lat, lng, { html: pinHtml(formatSta(staVal)), size: [34, 44], anchor: 'bottom', className: 'sta-search-pin' }));
    T().flyTo(lat, lng, 14);
    T().ripple(lat, lng, 2000);
    BPNP.auth && BPNP.auth.logUserEvent('Search KM', formatSta(staVal));
  }

  function reset() {
    T().stopRipple();
    marker = T().remove(marker);
    visible = false;
    if (!panel) return;
    panel.style.display = 'none';
    input.value = '';
    suggest.style.display = 'none';
    latLngDiv.textContent = '';
  }

  function toggle(e) {
    if (e) e.preventDefault();
    build();
    if (visible) { reset(); return; }
    visible = true;
    panel.style.display = 'block';
    input.value = '';
    suggest.style.display = 'none';
    latLngDiv.textContent = '';
    BPNP.alignment.load().catch(() => {});   // โหลดล่วงหน้าระหว่างผู้ใช้พิมพ์
    setTimeout(() => input.focus(), 200);
  }

  BPNP.ui.registerButton(() => {
    BPNP.ui.createStandardButton({
      id: 'searchStaBtn',
      imageSrc: 'assets/ui/search.png',
      style: { top: 'var(--safe-top)', left: 'var(--safe-left)' },
      title: 'ค้นหา STA',
      onClick: toggle
    });
  });

  BPNP.tools.searchKm = { toggle, goTo, reset };
  window.uiActions = window.uiActions || {};
  window.uiActions.toggleSearchSta = toggle;   // ชื่อเดิม
})();
