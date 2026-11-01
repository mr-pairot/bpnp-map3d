/* js/tools/search/hub.js
 * ─────────────────────────────────────────────────────────────────────────
 * เฟส 5B: แผงค้นหา/พิกัด (เดิม routing_ui.js + routing_main.js)
 *   ปุ่มแถวบน ช่องที่ 2 → แผงเลื่อนออกจากซ้าย มี 5 โหมด (เลือกได้ทีละโหมด กดซ้ำ = รีเซ็ต)
 *     1. ค้นหาเส้นทาง      : คลิกแผนที่ จุดเริ่ม → จุดหมาย → ทางผ่าน (ลากหมุดได้) · OSRM + เส้นทางสำรอง · Export KML
 *     2. ค้นหาที่อยู่ตามพิกัด : lat,lng → หมุด + บิน + วงกระเพื่อม + ที่อยู่จาก Longdo
 *     3. ค้นหาพิกัดตามที่อยู่ : address.js
 *     4. แปลงค่าและค้นหา    : utm_convert.js
 *     5. แปลงค่าหลายแถว    : utm_multi.js
 *   ขณะอยู่ในโหมดเส้นทาง: การคลิกแผนที่ใช้วางจุด (ชั้นข้อมูล/ดูพิกัด ไม่เปิด popup — BPNP.tools.isBusy)
 *   เส้นทาง: เดิมใช้ Leaflet Routing Machine → เรียก OSRM โดยตรง (เซิร์ฟเวอร์เดิม, alternatives เหมือนเดิม)
 *   แผงหลักมีปุ่มย่อ(−)/ขยาย(V) ซ้ายปุ่มปิด: ยุบขึ้นบน/คลี่ลงล่างแบบเคลื่อนไหว · ย่อแล้วโหมด/ข้อมูลยังอยู่ แถบแสดงชื่อโหมดปัจจุบัน · เปิดใหม่/ปิดแผงจะกลับเป็นแบบเต็ม
 * CSS: css/tools/search_hub.css
 * ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  const T = () => BPNP.tools.utils;
  const esc = BPNP.escapeHtml;
  const map = () => BPNP.map.instance;
  const LONGDO = () => (BPNP.config.keys && BPNP.config.keys.longdoServices) || '';
  const OSRM = 'https://router.project-osrm.org/route/v1/driving/';

  // สีเส้นทาง (เดิม cRoute1..3) — หลัก: ขอบขาว 10 + น้ำเงิน 5 · สำรอง: ขอบขาว 8 + แดง/ส้ม 4
  const ROUTE_COLORS = ['#0000ff', 'red', '#f39c12'];
  const ICONS = { start: 'assets/markers/route-start.png', via: 'assets/markers/route-via.png', end: 'assets/markers/route-end.png' };
  const SRC = 'src-route';

  let panel = null, el = {};
  let mode = 'idle';
  let waypoints = [], markers = [], findMarker = null, routePopups = [], routeReq = 0, lastRoutes = null;

  // ── ย่อ/ขยายแผง ──
  const MODE_TITLES = {
    idle: 'ค้นหา/พิกัด', route: 'ค้นหาเส้นทาง', findLocation: 'ค้นหาที่อยู่ตามพิกัด',
    findAddress: 'ค้นหาพิกัดตามที่อยู่', convertUTM: 'แปลงค่าและค้นหา', convertUTMMulti: 'แปลงค่าหลายแถว'
  };
  const COLLAPSE_MS = 340;   // ให้มากกว่า transition ใน CSS (0.3s) เล็กน้อย
  let collapsed = false, collapseTimer = null;

  function updateTitle() {
    if (el.panelTitle) el.panelTitle.textContent = MODE_TITLES[mode] || MODE_TITLES.idle;
  }
  function setMode(m) { mode = m; updateTitle(); }

  // next=true ยุบขึ้นบน · false คลี่ลงล่าง · instant=ไม่เคลื่อนไหว (เปิดใหม่/ปิดแผง/ตั้งค่าลดการเคลื่อนไหว)
  function setCollapsed(next, instant) {
    if (!panel || next === collapsed) return;
    collapsed = next;
    const body = el.panelBody;
    clearTimeout(collapseTimer);
    panel.classList.toggle('collapsed', next);
    el.minBtn.textContent = next ? 'V' : '−';
    el.minBtn.setAttribute('aria-label', next ? 'ขยายแผง' : 'ย่อแผง');
    el.minBtn.setAttribute('aria-expanded', String(!next));
    el.panelTitle.setAttribute('aria-hidden', String(!next));
    body.toggleAttribute('inert', next);   // ย่อแล้วโฟกัส/อ่านเนื้อหาด้านในไม่ได้
    updateTitle();
    const finish = () => { body.classList.remove('is-animating'); if (!collapsed) body.style.height = ''; };
    if (instant || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      body.style.height = next ? '0px' : '';
      finish();
      return;
    }
    body.classList.add('is-animating');
    body.style.height = body.offsetHeight + 'px';          // จุดเริ่ม (ความสูงปัจจุบัน — รองรับกดสลับกลางทาง)
    void body.offsetHeight;                                  // บังคับ reflow ก่อนตั้งปลายทาง
    body.style.height = (next ? 0 : body.scrollHeight) + 'px';
    collapseTimer = setTimeout(finish, COLLAPSE_MS);         // เสร็จแล้วคืน height:auto ให้เนื้อหาปรับขนาดเองได้
  }

  // ── แผง ──
  function build() {
    if (panel) return;
    document.body.insertAdjacentHTML('beforeend', `
      <div class="floating-panel" id="control-panel">
        <div id="panelTitle" class="panel-title" aria-hidden="true"></div>
        <div id="panelBody" class="panel-body">
        <fieldset class="button-group" id="group-route">
          <legend>ค้นหาเส้นทาง</legend>
          <button id="routeBtn" type="button">ค้นหาเส้นทาง</button>
        </fieldset>
        <fieldset class="button-group" id="group-location">
          <legend>ค้นหาตำแหน่ง/ที่อยู่</legend>
          <button id="findLocationBtn" type="button">ค้นหาที่อยู่ตามพิกัด</button>
          <button id="findAddressBtn" type="button">ค้นหาพิกัดตามที่อยู่</button>
        </fieldset>
        <fieldset class="button-group" id="group-convert">
          <legend>แปลงค่า</legend>
          <button id="convertUTMBtn" type="button">แปลงค่าและค้นหา</button>
          <button id="convertUTM_MultiBtn" type="button">แปลงค่าหลายแถว</button>
        </fieldset>
        <div id="coord-inputs"></div>
        <div id="find-location-inputs" style="display:none;">
          <input type="text" id="latlngInput" placeholder="กรอกละติจูด,ลองจิจูด">
          <button id="searchLatLngBtn" type="button">ค้นหา</button>
        </div>
        <div id="showInstruction" class="instruction"></div>
        </div>
        <button id="minBtn" type="button" aria-label="ย่อแผง" aria-expanded="true">−</button>
        <button id="exitBtn" type="button">✖</button>
      </div>`);
    panel = document.getElementById('control-panel');
    ['routeBtn', 'findLocationBtn', 'findAddressBtn', 'convertUTMBtn', 'convertUTM_MultiBtn', 'coord-inputs',
     'find-location-inputs', 'latlngInput', 'searchLatLngBtn', 'showInstruction', 'exitBtn', 'minBtn', 'panelBody', 'panelTitle', 'group-route', 'group-location', 'group-convert']
      .forEach(id => { el[id] = document.getElementById(id); });
    T().blockMap(panel);

    el.exitBtn.addEventListener('click', e => { e.stopPropagation(); panel.classList.remove('show'); setCollapsed(false, true); resetAll(); });
    el.minBtn.addEventListener('click', e => { e.stopPropagation(); setCollapsed(!collapsed); });
    updateTitle();
    el.routeBtn.addEventListener('click', activateRoute);
    el.findLocationBtn.addEventListener('click', activateFindLocation);
    el.findAddressBtn.addEventListener('click', activateFindAddress);
    el.convertUTMBtn.addEventListener('click', activateConvertUTM);
    el.convertUTM_MultiBtn.addEventListener('click', activateConvertUTMMulti);
    el.searchLatLngBtn.addEventListener('click', findLocation);
    el.latlngInput.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') findLocation(); });

    map().on('click', onMapClick);
  }

  // ปุ่มแถวบน (เดิม toggleRoutingPanel): เปิดแผงและแสดงทุกกลุ่ม
  function openPanel(e) {
    if (e) { e.stopPropagation(); e.preventDefault(); }
    build();
    setCollapsed(false, true);   // เปิดแผงใหม่ = แบบเต็มเสมอ
    panel.classList.add('show');
    ['group-route', 'group-location', 'group-convert'].forEach(id => { el[id].style.display = 'block'; });
    ['routeBtn', 'findLocationBtn', 'findAddressBtn', 'convertUTMBtn', 'convertUTM_MultiBtn'].forEach(id => { el[id].style.display = 'inline-block'; });
    el['coord-inputs'].style.display = 'none';
    el['find-location-inputs'].style.display = 'none';
    el.showInstruction.innerHTML = '';
  }

  function hideAll() {
    ['routeBtn', 'findLocationBtn', 'findAddressBtn', 'convertUTMBtn', 'convertUTM_MultiBtn'].forEach(id => { el[id].style.display = 'none'; });
    el['coord-inputs'].style.display = 'none';
    el['find-location-inputs'].style.display = 'none';
    el.showInstruction.innerHTML = '';
    ['group-route', 'group-location', 'group-convert'].forEach(id => { el[id].style.display = 'none'; });
  }

  function resetAll() {
    if (!panel) return;
    T().stopRipple();
    setMode('idle');
    ['group-route', 'group-location', 'group-convert'].forEach(id => { el[id].style.display = 'block'; });
    el.routeBtn.textContent = 'ค้นหาเส้นทาง';
    el.findLocationBtn.textContent = 'ค้นหาที่อยู่ตามพิกัด';
    el.findAddressBtn.textContent = 'ค้นหาพิกัดตามที่อยู่';
    el.convertUTMBtn.textContent = 'แปลงค่าและค้นหา';
    el.convertUTM_MultiBtn.textContent = 'แปลงค่าหลายแถว';
    ['routeBtn', 'findLocationBtn', 'findAddressBtn', 'convertUTMBtn', 'convertUTM_MultiBtn'].forEach(id => { el[id].style.display = 'inline-block'; });
    el['coord-inputs'].style.display = 'none';
    el['find-location-inputs'].style.display = 'none';
    el.showInstruction.innerHTML = '';
    el.latlngInput.value = '';
    clearRoute(true);
    findMarker = T().remove(findMarker);
    if (BPNP.tools.addressSearch) BPNP.tools.addressSearch.close();
    if (BPNP.tools.utmConvert) BPNP.tools.utmConvert.close();
    if (BPNP.tools.utmMulti) BPNP.tools.utmMulti.close();
  }

  // ── โหมด ──
  function activateRoute() {
    if (mode === 'route') { resetAll(); return; }
    setMode('route');
    hideAll();
    el['group-route'].style.display = 'block';
    el.routeBtn.textContent = 'รีเซ็ต';
    el.routeBtn.style.display = 'inline-block';
    el['coord-inputs'].style.display = 'block';
    clearRoute(true);
    el['coord-inputs'].innerHTML = '';
    el.showInstruction.innerHTML = 'คลิกจุดเริ่มต้น จุดหมาย <br>และทางผ่าน(ถ้ามี)';
  }

  function activateFindLocation() {
    if (mode === 'findLocation') { resetAll(); return; }
    setMode('findLocation');
    hideAll();
    el['group-location'].style.display = 'block';
    el.findLocationBtn.textContent = 'รีเซ็ต';
    el.findLocationBtn.style.display = 'inline-block';
    el.showInstruction.innerHTML = 'กรอกพิกัดแล้วกด<b>ค้นหา</b><br>แสดงตำแหน่งและที่อยู่';
    el['find-location-inputs'].style.display = 'block';
  }

  function activateFindAddress() {
    if (mode === 'findAddress') { resetAll(); return; }
    setMode('findAddress');
    if (BPNP.tools.addressSearch) BPNP.tools.addressSearch.open();
  }

  function activateConvertUTM() {
    if (mode === 'convertUTM') { resetAll(); return; }
    setMode('convertUTM');
    hideAll();
    el['group-convert'].style.display = 'block';
    el.convertUTMBtn.textContent = 'รีเซ็ต';
    el.convertUTMBtn.style.display = 'inline-block';
    if (BPNP.tools.utmMulti) BPNP.tools.utmMulti.close();
    if (BPNP.tools.utmConvert) BPNP.tools.utmConvert.open();
  }

  function activateConvertUTMMulti() {
    if (mode === 'convertUTMMulti') { resetAll(); return; }
    setMode('convertUTMMulti');
    hideAll();
    el['group-convert'].style.display = 'block';
    el.convertUTM_MultiBtn.textContent = 'รีเซ็ต';
    el.convertUTM_MultiBtn.style.display = 'inline-block';
    if (BPNP.tools.utmConvert) BPNP.tools.utmConvert.close();
    if (BPNP.tools.utmMulti) BPNP.tools.utmMulti.open();
  }

  // ── ค้นหาที่อยู่ตามพิกัด ──
  function findLocation() {
    const [lat, lng] = el.latlngInput.value.trim().split(',').map(parseFloat);
    if (isNaN(lat) || isNaN(lng)) { BPNP.ui.showAlert('กรุณากรอกพิกัดในรูปแบบ lat,lng'); return; }
    findMarker = T().remove(findMarker);
    findMarker = T().add(T().marker(lat, lng, { url: ICONS.start, size: [26, 26] }));
    T().flyTo(lat, lng, 14);
    T().ripple(lat, lng, 2000);
    el.showInstruction.innerHTML = 'กำลังค้นหาที่อยู่...';
    fetch(`https://api.longdo.com/map/services/address?lon=${lng}&lat=${lat}&noelevation=1&key=${encodeURIComponent(LONGDO())}`)
      .then(r => r.json())
      .then(d => {
        const parts = [d.road, d.subdistrict, d.district, d.province, d.country, d.postcode].filter(Boolean);
        el.showInstruction.innerHTML = parts.length
          ? `ที่อยู่: <br>${esc(parts.join(' '))}`
          : `พิกัด: ${lat}, ${lng}<br>❌ ไม่พบข้อมูลที่อยู่`;
      })
      .catch(() => { el.showInstruction.innerHTML = `พิกัด: ${lat}, ${lng}<br>⚠️ เกิดข้อผิดพลาดในการค้นหาที่อยู่`; });
    BPNP.auth && BPNP.auth.logUserEvent('Find Location', `${lat},${lng}`);
  }

  // ── ค้นหาเส้นทาง ──
  function onMapClick(e) {
    if (mode !== 'route' || waypoints.length >= 3) return;
    const pt = { lat: e.lngLat.lat, lng: e.lngLat.lng };
    const idx = waypoints.length;
    const role = idx === 0 ? 'start' : (idx === 1 ? 'end' : 'via');
    const m = T().add(T().marker(pt.lat, pt.lng, { url: ICONS[role], size: [26, 26], draggable: true }));
    if (idx < 2) { waypoints.push(pt); markers.push(m); }
    else { waypoints.splice(1, 0, pt); markers.splice(1, 0, m); }   // ทางผ่านแทรกกลาง
    bindDrag();
    updateInputs();
    drawRoute();
  }

  function bindDrag() {
    markers.forEach((m, i) => {
      m.off('dragend');
      m.on('dragend', () => { const p = m.getLngLat(); waypoints[i] = { lat: p.lat, lng: p.lng }; updateInputs(); drawRoute(); });
    });
  }

  function updateInputs() {
    const box = el['coord-inputs'];
    box.innerHTML = '';
    waypoints.forEach((pt, i) => {
      const role = i === 0 ? 'start' : (i === waypoints.length - 1 ? 'end' : 'via');
      const label = i === 0 ? 'จุดเริ่ม :' : (i === waypoints.length - 1 ? 'จุดหมาย :' : 'ทางผ่าน :');
      const showRemove = waypoints.length === 3 && i === 1;
      const row = document.createElement('div');
      row.className = 'coord-row';
      row.innerHTML = `
        <label><img src="${ICONS[role]}" class="role-icon" alt="${role}">${label}</label>
        <input type="text" value="${pt.lat.toFixed(6)}, ${pt.lng.toFixed(6)}" data-idx="${i}">
        ${showRemove ? `<span class="remove-btn" data-idx="${i}">✖</span>` : ''}`;
      box.appendChild(row);
    });
    box.querySelectorAll('input').forEach(inp => {
      inp.addEventListener('keydown', e => e.stopPropagation());
      inp.addEventListener('change', e => {
        const i = +e.target.dataset.idx;
        const [lat, lng] = e.target.value.split(',').map(parseFloat);
        if (isNaN(lat) || isNaN(lng)) return;
        waypoints[i] = { lat, lng };
        markers[i].setLngLat([lng, lat]);
        drawRoute();
      });
    });
    box.querySelectorAll('.remove-btn').forEach(b => b.addEventListener('click', () => removeVia(+b.dataset.idx)));
  }

  function removeVia(i) {
    markers[i].remove();
    markers.splice(i, 1);
    waypoints.splice(i, 1);
    bindDrag();
    updateInputs();
    drawRoute();
  }

  function routeLayers() {
    const m = map();
    if (m.getSource(SRC)) return;
    m.addSource(SRC, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    // วาดเส้นสำรองก่อน เส้นหลักอยู่บนสุด (rank 0)
    m.addLayer({ id: SRC + '-casing', type: 'line', source: SRC, layout: { 'line-join': 'round', 'line-cap': 'round', 'line-sort-key': ['-', 10, ['get', 'rank']] },
      paint: { 'line-color': '#ffffff', 'line-width': ['case', ['==', ['get', 'rank'], 0], 10, 8], 'line-opacity': 0.8 } });
    m.addLayer({ id: SRC + '-line', type: 'line', source: SRC, layout: { 'line-join': 'round', 'line-cap': 'round', 'line-sort-key': ['-', 10, ['get', 'rank']] },
      paint: { 'line-color': ['get', 'color'], 'line-width': ['case', ['==', ['get', 'rank'], 0], 5, 4], 'line-opacity': ['case', ['==', ['get', 'rank'], 0], 0.7, 0.8] } });
  }

  function clearRoute(all) {
    routeReq++;
    routePopups.forEach(p => p.remove());
    routePopups = [];
    lastRoutes = null;
    const s = map() && map().getSource(SRC);
    if (s) s.setData({ type: 'FeatureCollection', features: [] });
    if (all) { markers.forEach(m => m.remove()); markers = []; waypoints = []; }
  }

  async function drawRoute() {
    if (waypoints.length < 2) return;
    clearRoute(false);
    const req = routeReq;
    const coords = waypoints.map(p => `${p.lng},${p.lat}`).join(';');
    let data;
    try {
      const r = await fetch(`${OSRM}${coords}?overview=full&geometries=geojson&alternatives=2&steps=false`);
      data = await r.json();
    } catch (err) {
      if (req === routeReq) el.showInstruction.innerHTML = '⚠️ ไม่สามารถเชื่อมต่อระบบค้นหาเส้นทางได้';
      return;
    }
    if (req !== routeReq || mode !== 'route') return;
    if (!data || data.code !== 'Ok' || !data.routes || !data.routes.length) {
      el.showInstruction.innerHTML = '❌ ไม่พบเส้นทาง';
      return;
    }
    routeLayers();
    const routes = data.routes.slice(0, 3);
    lastRoutes = routes;
    map().getSource(SRC).setData({ type: 'FeatureCollection', features: routes.map((rt, i) => ({
      type: 'Feature', properties: { rank: i, color: ROUTE_COLORS[i] }, geometry: rt.geometry })) });

    let html = `<button id="exportKmlBtn" class="button-group" type="button">Export(ทางหลัก) to KML</button><hr>`;
    routes.forEach((rt, i) => {
      const dist = (rt.distance / 1000).toFixed(2);
      const tmin = Math.round(rt.duration / 60), hrs = Math.floor(tmin / 60), mins = tmin % 60;
      const time = hrs ? `${hrs} ชม. ${mins} นาที` : `${mins} นาที`;
      const label = i === 0 ? 'เส้นทางหลัก' : `เส้นทางสำรอง ${i}`;
      const cs = rt.geometry.coordinates, mid = cs[Math.floor(cs.length / 2)];
      routePopups.push(new maplibregl.Popup({ className: 'route-popup', closeOnClick: false, anchor: 'bottom', maxWidth: '220px' })
        .setLngLat(mid).setHTML(`<strong>${label}</strong><br>ระยะทาง: ${dist} กม.<br>เวลาประมาณ: ${time}`).addTo(map()));
      html += `<div style="color: ${ROUTE_COLORS[i]}"><strong>${label}</strong><br>ระยะทาง: ${dist} กม.<br>เวลาประมาณ: ${time}</div><br>`;
    });
    el.showInstruction.innerHTML = html;
    document.getElementById('exportKmlBtn').addEventListener('click', () => {
      if (lastRoutes && lastRoutes.length) T().download(kml(lastRoutes[0].geometry.coordinates, 'Main Route'), 'route.kml');
    });
    BPNP.auth && BPNP.auth.logUserEvent('Route', `${waypoints.length} จุด`);
  }

  function kml(coords, name) {
    const c = coords.map(([lng, lat]) => `${lng},${lat},0`).join(' ');
    return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${name}</name>
    <Placemark>
      <name>${name}</name>
      <Style><LineStyle><color>ff0000ff</color><width>4</width></LineStyle></Style>
      <LineString><coordinates>${c}</coordinates></LineString>
    </Placemark>
  </Document>
</kml>`;
  }

  // คลิกแผนที่ขณะวางจุดเส้นทาง → ชั้นข้อมูล/ดูพิกัดไม่เปิด popup
  BPNP.tools.registerBusy(() => mode === 'route');

  BPNP.ui.registerButton(() => {
    BPNP.ui.createStandardButton({
      id: 'togglePanelBtn',
      imageSrc: 'assets/markers/location.png',
      style: { top: 'var(--safe-top)', left: 'calc(var(--safe-left) + var(--map-btn-size) + var(--map-gap))' },
      title: 'ค้นหาเส้นทาง',
      onClick: openPanel
    });
  });

  BPNP.tools.searchHub = { open: openPanel, resetAll, get mode() { return mode; } };
  window.resetAll = resetAll;
  window.uiActions = window.uiActions || {};
  window.uiActions.toggleRoutingPanel = openPanel;
})();
