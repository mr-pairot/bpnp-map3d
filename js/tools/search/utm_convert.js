/* js/tools/search/utm_convert.js
 * ─────────────────────────────────────────────────────────────────────────
 * เฟส 5B: แปลงค่า UTM / LatLng (เดิม convertUTM.js) — เปิดจากแผงค้นหา/พิกัด
 *   แท็บ Lat/Lng → UTM และ UTM → Lat/Lng (Zone 47N / 48N) · ผลลัพธ์ + หมุด + บิน + วงกระเพื่อม
 *   สูตรแปลงพิกัดอยู่ที่ core/geo_utils.js (BPNP.geo.latLngToUTM / utmToLatLng)
 * CSS: css/tools/utm_convert.css
 * ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  const T = () => BPNP.tools.utils;
  let panel = null, marker = null;

  const fmt3 = n => n.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });

  function showPoint(lat, lng) {
    marker = T().remove(marker);
    marker = T().add(T().marker(lat, lng, { url: 'assets/markers/route-start.png', size: [26, 26] }));
    T().flyTo(lat, lng, 14);
    T().ripple(lat, lng, 2000);
  }

  function clearPoint() { marker = T().remove(marker); T().stopRipple(); }

  function open() {
    close();
    panel = document.createElement('div');
    panel.id = 'convertPanel';
    panel.className = 'convert-panel';
    panel.innerHTML = `
      <div class="convert-header">
        <h3>แปลงค่า UTM / LatLng</h3>
        <button id="closeConvertBtn" type="button">✖</button>
      </div>
      <div class="convert-tabs">
        <button class="tab-btn active" data-tab="latlng" type="button">Lat/Lng → UTM</button>
        <button class="tab-btn" data-tab="utm" type="button">UTM → Lat/Lng</button>
      </div>
      <div class="convert-body">
        <div id="latlng-tab" class="tab-content active">
          <label>Latitude, Longitude:</label>
          <input type="text" id="latlngInput_convert" placeholder="กรอกละติจูด,ลองจิจูด">
          <button id="convertToUTMBtn" type="button">แปลงเป็น UTM</button>
          <button id="resetLatLngBtn" type="button">รีเซ็ต</button>
          <div id="utmResult" class="convert-result"></div>
        </div>
        <div id="utm-tab" class="tab-content">
          <label>Northing (N):</label>
          <input type="text" id="northingInput" placeholder="N">
          <label>Easting (E):</label>
          <input type="text" id="eastingInput" placeholder="E">
          <div class="radio-group">
            <label><input type="radio" name="zone" value="47"> Zone 47N</label>
            <label><input type="radio" name="zone" value="48" checked> Zone 48N</label>
          </div>
          <button id="convertToLatLngBtn" type="button">แปลงเป็น Lat/Lng</button>
          <button id="resetUTMBtn" type="button">รีเซ็ต</button>
          <div id="latlngResult" class="convert-result"></div>
        </div>
      </div>`;
    document.body.appendChild(panel);
    T().blockMap(panel);
    const $ = id => panel.querySelector('#' + id);

    panel.querySelectorAll('.tab-btn').forEach(btn => btn.addEventListener('click', () => {
      panel.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      panel.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      $(`${btn.dataset.tab}-tab`).classList.add('active');
    }));

    function toUTM() {
      const input = $('latlngInput_convert').value.trim();
      if (!input) { BPNP.ui.showAlert('กรุณากรอกพิกัด Lat,Lng'); return; }
      const c = input.split(',').map(s => parseFloat(s.trim()));
      if (c.length !== 2 || isNaN(c[0]) || isNaN(c[1])) { BPNP.ui.showAlert('กรุณากรอกพิกัดในรูปแบบ lat,lng'); return; }
      const [lat, lng] = c;
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) { BPNP.ui.showAlert('พิกัดไม่ถูกต้อง: Latitude -90..90, Longitude -180..180'); return; }
      const u = BPNP.geo.latLngToUTM(lat, lng);
      $('utmResult').innerHTML = `<strong>UTM Coordinates:</strong><br>Zone: ${u.zone}N<br>Easting: ${fmt3(u.easting)}<br>Northing: ${fmt3(u.northing)}`;
      showPoint(lat, lng);
    }

    function toLatLng() {
      const n = parseFloat(($('northingInput').value || '').trim().replace(/,/g, ''));
      const e = parseFloat(($('eastingInput').value || '').trim().replace(/,/g, ''));
      const z = panel.querySelector('input[name="zone"]:checked');
      const zone = z ? parseInt(z.value, 10) : 48;
      if (isNaN(n) || isNaN(e)) { BPNP.ui.showAlert('กรุณากรอกค่า Northing และ Easting'); return; }
      if (e < 100000 || e > 900000) { BPNP.ui.showAlert('ค่า Easting ไม่ถูกต้อง: 100,000 - 900,000'); return; }
      if (n < 0 || n > 10000000) { BPNP.ui.showAlert('ค่า Northing ไม่ถูกต้อง: 0 - 10,000,000'); return; }
      const c = BPNP.geo.utmToLatLng(e, n, zone);
      $('latlngResult').innerHTML = `<strong>Lat/Lng Coordinates:</strong><br>Latitude: ${c.lat.toFixed(6)}<br>Longitude: ${c.lng.toFixed(6)}`;
      showPoint(c.lat, c.lng);
    }

    $('convertToUTMBtn').addEventListener('click', toUTM);
    $('convertToLatLngBtn').addEventListener('click', toLatLng);
    $('resetLatLngBtn').addEventListener('click', () => { $('latlngInput_convert').value = ''; $('utmResult').innerHTML = ''; clearPoint(); });
    $('resetUTMBtn').addEventListener('click', () => {
      $('northingInput').value = ''; $('eastingInput').value = '';
      panel.querySelector('input[name="zone"][value="48"]').checked = true;
      $('latlngResult').innerHTML = ''; clearPoint();
    });
    $('closeConvertBtn').addEventListener('click', close);
    panel.querySelectorAll('input[type=text]').forEach(inp => inp.addEventListener('keydown', ev => {
      ev.stopPropagation();
      if (ev.key === 'Enter') (inp.id === 'latlngInput_convert' ? toUTM : toLatLng)();
    }));
  }

  function close() {
    clearPoint();
    if (panel) { panel.remove(); panel = null; }
  }

  BPNP.tools.utmConvert = { open, close };
  window.createConvertPanel = open;   // ชื่อเดิม
})();
