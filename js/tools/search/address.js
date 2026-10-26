/* js/tools/search/address.js
 * ─────────────────────────────────────────────────────────────────────────
 * เฟส 5B: ค้นหาพิกัดตามที่อยู่ (เดิม search_address.js) — เปิดจากแผงค้นหา/พิกัด
 *   - จังหวัด → อำเภอ → ตำบล (รายการแนะนำสูงสุด 5) + "อื่นๆ" → ค้นหาด้วย Longdo Geocoding
 *   - ผลลัพธ์: หมุดทุกจุด + รายการ (กดแล้วบินไป + popup + วงกระเพื่อม) · ซูมให้เห็นทุกจุดไม่ใกล้กว่า Leaflet 10
 *   - ข้อมูลจังหวัด/อำเภอ/ตำบล: kongvut/thai-province-data (เหมือนเดิม)
 * แก้จากเดิม: ตัวฟังเหตุการณ์ไม่ซ้อนทุกครั้งที่เลือกจังหวัด/อำเภอ · ข้อความค้นหา escape ก่อนแสดง
 * CSS: css/tools/search_address.css
 * ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  const T = () => BPNP.tools.utils;
  const esc = BPNP.escapeHtml;
  const DATA_URL = 'https://raw.githubusercontent.com/kongvut/thai-province-data/master/api_province_with_amphure_tambon.json';
  const MAX_OPTIONS = 5;
  const LONGDO = () => (BPNP.config.keys && BPNP.config.keys.longdoServices) || '';

  let addressData = null, panel = null, poiMarkers = [];
  let province = null, district = null;

  async function loadData() {
    if (!addressData) addressData = await (await fetch(DATA_URL)).json();
    return addressData;
  }

  function fillList(items, input, list) {
    const q = input.value.toLowerCase();
    list.innerHTML = '';
    (items || []).filter(it => it.name_th.toLowerCase().includes(q)).slice(0, MAX_OPTIONS).forEach(it => {
      const opt = document.createElement('option');
      opt.value = it.name_th;
      list.appendChild(opt);
    });
  }

  function clearMarkers() { poiMarkers.forEach(m => m.remove()); poiMarkers = []; }

  function open() {
    if (panel) return;
    panel = document.createElement('div');
    panel.id = 'addressPanel';
    panel.innerHTML = `
      <div class="address-header">
        <h3>ค้นหาพิกัดจากที่อยู่ (ทดลองใช้)</h3>
        <button id="closeAddressPanel" type="button">✖</button>
      </div>
      <div class="address-body">
        <input type="text" id="provinceInput" list="provinceList" placeholder="พิมพ์จังหวัด" autocomplete="off" />
        <datalist id="provinceList"></datalist>
        <input type="text" id="districtInput" list="districtList" placeholder="พิมพ์อำเภอ" autocomplete="off" />
        <datalist id="districtList"></datalist>
        <input type="text" id="subdistrictInput" list="subdistrictList" placeholder="พิมพ์ตำบล" autocomplete="off" />
        <datalist id="subdistrictList"></datalist>
      </div>
      <div class="address-footer">
        <label for="manualAddress">อื่นๆ :</label>
        <input type="text" id="manualAddress" placeholder="ระบุเพิ่ม..." />
      </div>
      <div class="address-search">
        <button id="searchAddressBtn" type="button">ค้นหา</button>
      </div>
      <div id="villageResult"></div>`;
    document.body.appendChild(panel);
    T().blockMap(panel);
    const $ = id => panel.querySelector('#' + id);
    const provIn = $('provinceInput'), distIn = $('districtInput'), subIn = $('subdistrictInput'), manual = $('manualAddress');
    panel.querySelectorAll('input').forEach(i => i.addEventListener('keydown', e => e.stopPropagation()));

    loadData().catch(() => { $('villageResult').textContent = '⚠️ โหลดข้อมูลจังหวัดไม่สำเร็จ'; });

    provIn.addEventListener('input', () => {
      if (!addressData) return;
      fillList(addressData, provIn, $('provinceList'));
      province = addressData.find(p => p.name_th === provIn.value) || null;
      if (province) distIn.focus();
    });
    distIn.addEventListener('input', () => {
      if (!province) return;
      fillList(province.amphure, distIn, $('districtList'));
      district = province.amphure.find(d => d.name_th === distIn.value) || null;
      if (district) subIn.focus();
    });
    subIn.addEventListener('input', () => {
      if (!district) return;
      fillList(district.tambon, subIn, $('subdistrictList'));
      if (district.tambon.some(t => t.name_th === subIn.value)) manual.focus();
    });
    manual.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); search(); } });
    $('searchAddressBtn').addEventListener('click', search);
    $('closeAddressPanel').addEventListener('click', close);

    async function search() {
      const prov = provIn.value.trim(), dist = distIn.value.trim(), sub = subIn.value.trim(), extra = manual.value.trim();
      if (!prov || !dist || !sub) { BPNP.ui.showAlert('กรุณาเลือกจังหวัด อำเภอ ตำบลให้ครบ'); return; }
      const keyword = `${extra},${sub}, อ.${dist}, จ.${prov}`;
      const box = $('villageResult');
      box.innerHTML = `🔎 กำลังค้นหา "${esc(keyword)}"...`;
      try {
        const res = await fetch(`https://search.longdo.com/addresslookup/api/addr/geocoding?text=${encodeURIComponent(keyword)}&key=${encodeURIComponent(LONGDO())}`);
        const data = await res.json();
        clearMarkers();
        box.innerHTML = '';
        if (!data || !data.data || !data.data.length) { box.innerText = '❌ ไม่พบข้อมูล'; return; }
        const pts = [];
        data.data.forEach(p => {
          const lat = p.point && p.point[0] && p.point[0].lat, lng = p.point && p.point[0] && p.point[0].lon;
          if (!lat || !lng) return;
          const m = T().add(T().marker(lat, lng, { url: 'assets/markers/route-start.png', size: [26, 26] }));
          const openPopup = T().bindPopup(m, esc(keyword));
          poiMarkers.push(m);
          pts.push([lat, lng]);
          const item = document.createElement('div');
          item.className = 'search-result-item';
          item.style.cursor = 'pointer';
          item.innerHTML = `<div class="title">${esc(keyword)}</div><div class="coords">(lat:${lat}, lng:${lng})</div>`;
          item.addEventListener('click', () => { T().flyTo(lat, lng, 14); setTimeout(openPopup, 1600); T().ripple(lat, lng, 2000); });
          box.appendChild(item);
        });
        // เดิม: fitBounds(pad 0.2) แล้วไม่ให้ซูมใกล้กว่า Leaflet 10
        if (pts.length) T().fitPoints(pts, { padding: 60, maxLeafletZoom: 10 });
        BPNP.auth && BPNP.auth.logUserEvent('Search Address', keyword);
      } catch (err) {
        console.error(err);
        box.innerText = '⚠️ เกิดข้อผิดพลาดในการค้นหา';
      }
    }
  }

  function close() {
    clearMarkers();
    T().stopRipple();
    if (panel) { panel.remove(); panel = null; }
    province = district = null;
  }

  BPNP.tools.addressSearch = { open, close };
  window.createAddressPanel = open;   // ชื่อเดิม
})();
