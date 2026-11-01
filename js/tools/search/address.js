/* js/tools/search/address.js
 * ─────────────────────────────────────────────────────────────────────────
 * ค้นหาพิกัดตามที่อยู่ — เปิดจากแผงค้นหา/พิกัด (hub.js)
 *   - จังหวัด → อำเภอ/เขต → ตำบล/แขวง (รายการแนะนำ) + "อื่นๆ"
 *   - ไม่กรอก "อื่นๆ"  → ปักหมุดกลางตำบลจากข้อมูลทันที (ไม่เรียก API)
 *   - กรอก "อื่นๆ"     → ค้นหาด้วย Longdo Geocoding · ไม่พบ/ผิดพลาด → ใช้กลางตำบลแทน
 *   - ตำบลที่ไม่มีพิกัดในข้อมูล (ส่วนใหญ่แขวงใน กทม.) → ค้นหาด้วย Longdo
 *   - ผลลัพธ์: หมุด + รายการ (กดแล้วบินไป + popup + วงกระเพื่อม)
 *
 * ข้อมูล: data/json/thai_address.json สร้างจาก kongvut/thai-province-data (api/latest, schema v3)
 *         ด้วย tools/build-address-data.js — โหลดผ่าน DataCache (ใช้ได้แม้ออฟไลน์)
 * แก้ใน 3.10.02:
 *   - ลิงก์ข้อมูลเดิมบน GitHub ตอบ 404 หลัง repo ต้นทางจัดโครงสร้างใหม่ → ใช้ไฟล์ในโปรเจกต์
 *   - เปลี่ยนจังหวัด/อำเภอแล้วล้างช่องถัดไป · แตะช่องแล้วแสดงรายการทันที
 *   - พิมพ์คำนำหน้ามาด้วยได้ (จ. อ. อำเภอ เขต ต. ตำบล แขวง)
 *   - คำค้น Longdo ใช้คำนำหน้าถูกตามประเภท (ตำบล/อำเภอ/จังหวัด หรือ แขวง/เขต/กรุงเทพมหานคร)
 * แก้ล่าสุด (ตรวจโค้ด):
 *   - พิมพ์ชื่อที่เป็นคำขึ้นต้นของอีกชื่อ (เช่น สำโรง/สำโรงกลาง) ไม่หลุดไปช่องถัดไปแล้ว — ย้ายโฟกัสเมื่อ change/Enter เท่านั้น · Enter ในช่องตำบลค้นหาได้
 *   - ผล Longdo: เช็ก res.ok · จำกัด 8 รายการ · ตัดผลที่ไกลจากพื้นที่เลือกเกิน 30 กม. · เรียงตามระยะ · ใช้ชื่อจาก API ถ้ามี · ไม่ใส่รหัสไปรษณีย์ตำบลให้ผล Longdo
 *   - กันค้นซ้อน/ผลเก่าทับผลใหม่ (request token + timeout 8 วินาที + ปิดปุ่มระหว่างค้น + ยกเลิกเมื่อเปลี่ยนที่อยู่/ปิดแผง)
 *   - ซูมผลหลายจุดไม่เกินระดับ 15 (เดิม 10)
 *   - ตำบลไม่มีพิกัดและ Longdo ไม่เจอ → ใช้กลางอำเภอ (ค่าเฉลี่ยพิกัดตำบลในอำเภอ)
 *   - กรองอำเภอที่ไม่มีตำบลย่อยออกจากข้อมูล · เคลียร์ timer popup เมื่อล้างหมุด/ปิดแผง
 *   - ปุ่ม ✕ ท้ายแต่ละช่อง ล้างแบบลดหลั่น (จังหวัด→ล้างอำเภอ/ตำบล/อื่นๆ ด้วย) + ล้างหมุด/รายการผลทุกครั้ง · ✕ แสดงเมื่อเลือกถูกต้องแล้ว (อื่นๆ = มีข้อความ)
 *   - แถวล่าง disable (สีจาง) จนกว่าแถวบนเลือกถูกต้อง · จุดเด้งรอคำตอบที่แถวแรกที่ยังไม่ถูกต้อง
 *   - ปุ่มค้นหา disable เมื่อค่าในช่องไม่ต่างจากการค้นครั้งล่าสุด (ค้นล้มเหลวไม่นับ ลองใหม่ได้)
 * CSS: css/tools/search_address.css (ใช้คลาสเดิม)
 * ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  const T = () => BPNP.tools.utils;
  const esc = BPNP.escapeHtml;
  const DATA_URL = 'data/json/thai_address.json';
  const MAX_OPTIONS = 5;          // จำนวนรายการแนะนำขณะพิมพ์ (ช่องว่าง = แสดงทั้งหมด)
  const ZOOM_SUBDISTRICT = 13;    // ซูมเมื่อแสดงกลางตำบล
  const ZOOM_DISTRICT = 12;       // ซูมเมื่อแสดงกลางอำเภอ (ไม่มีพิกัดตำบล)
  const ZOOM_MAX_MULTI = 15;      // ซูมสูงสุดเมื่อแสดงหลายผลลัพธ์ (Leaflet zoom)
  const FETCH_TIMEOUT_MS = 8000;  // timeout ค้น Longdo
  const MAX_GEOCODE_RESULTS = 8;  // จำนวนผล Longdo สูงสุดที่แสดง
  const MAX_RESULT_KM = 30;       // ผล Longdo ไกลจากพื้นที่ที่เลือกเกินนี้ถือว่าไม่เกี่ยวข้อง
  const LONGDO = () => (BPNP.config.keys && BPNP.config.keys.longdoServices) || '';
  const collator = new Intl.Collator('th');

  let addressData = null, loading = null, panel = null, poiMarkers = [], popupTimers = [];
  let searchSeq = 0, searchAbort = null;   // กันค้นซ้อน/ผลเก่าทับผลใหม่
  let province = null, district = null, subdistrict = null;

  /* ---------- ข้อมูล ---------- */
  function expand(raw) {
    return (raw.provinces || []).map(([name, districts]) => ({
      name,
      label: name === 'กรุงเทพมหานคร' ? name : `จังหวัด${name}`,
      bangkok: name === 'กรุงเทพมหานคร',
      // ตัดอำเภอที่ไม่มีตำบลย่อย (ข้อมูลต้นทางผิดปกติ) — เลือกแล้วไปต่อไม่ได้
      districts: districts.filter(([, , subs]) => Array.isArray(subs) && subs.length).map(([prefix, dName, subs]) => ({
        name: dName,
        prefix,
        label: prefix + dName,
        subs: subs.map(([sp, sName, zip, lat, lng]) => ({ name: sName, label: sp + sName, prefix: sp, zip, lat, lng }))
      }))
    }));
  }

  async function fetchJSON(url) {
    const dc = BPNP.core && BPNP.core.dataCache;
    if (dc && typeof dc.getJSON === 'function') {
      try { return await dc.getJSON(url); } catch (err) { console.warn('[address] DataCache ใช้ไม่ได้ ดึงตรงแทน', err); }
    }
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }

  function loadData() {
    if (addressData) return Promise.resolve(addressData);
    if (!loading) {
      loading = fetchJSON(DATA_URL)
        .then((raw) => { addressData = expand(raw); return addressData; })
        .catch((err) => { loading = null; throw err; });
    }
    return loading;
  }

  // ตัดช่องว่างและคำนำหน้าที่ผู้ใช้อาจพิมพ์มา เช่น "อ.บ้านไผ่" "อำเภอ บ้านไผ่" "เขตพระนคร"
  const PREFIX_RE = /^(จังหวัด|จ\.|อำเภอ|อ\.|เขต|ข\.|ตำบล|ต\.|แขวง)/;
  function norm(s) {
    return String(s || '').replace(/\s+/g, '').replace(PREFIX_RE, '').toLowerCase();
  }
  const findByName = (items, text) => {
    const q = norm(text);
    return q ? (items || []).find((it) => norm(it.name) === q) || null : null;
  };

  /* ---------- รายการแนะนำ ---------- */
  function fillList(items, input, list) {
    const q = norm(input.value);
    let shown = (items || []).slice().sort((a, b) => collator.compare(a.name, b.name));
    if (q) {
      shown = shown.filter((it) => norm(it.name).includes(q))
        .sort((a, b) => (norm(b.name).startsWith(q) - norm(a.name).startsWith(q)))
        .slice(0, MAX_OPTIONS);
    }
    list.innerHTML = '';
    shown.forEach((it) => {
      const opt = document.createElement('option');
      opt.value = it.name;
      list.appendChild(opt);
    });
  }

  function clearMarkers() {
    poiMarkers.forEach((m) => m.remove()); poiMarkers = [];
    popupTimers.forEach(clearTimeout); popupTimers = [];
  }

  const hasCoord = (s) => typeof s.lat === 'number' && typeof s.lng === 'number';
  function districtCentroid(dist) {
    const pts = dist.subs.filter(hasCoord);
    if (!pts.length) return null;
    return { lat: pts.reduce((a, s) => a + s.lat, 0) / pts.length, lng: pts.reduce((a, s) => a + s.lng, 0) / pts.length };
  }
  function kmBetween(lat1, lng1, lat2, lng2) {
    const rad = Math.PI / 180, dLat = (lat2 - lat1) * rad, dLng = (lng2 - lng1) * rad;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
    return 2 * 6371 * Math.asin(Math.sqrt(h));
  }

  /* ---------- แผง ---------- */
  function open() {
    if (panel) return;
    panel = document.createElement('div');
    panel.id = 'addressPanel';
    panel.innerHTML = `
      <div class="address-header">
        <h3>ค้นหาพิกัดจากที่อยู่</h3>
        <button id="closeAddressPanel" type="button" aria-label="ปิด">✖</button>
      </div>
      <div class="address-body">
        <div class="addr-row">
          <input type="text" id="provinceInput" list="provinceList" placeholder="พิมพ์จังหวัด" autocomplete="off" />
          <span class="addr-slot"><button type="button" class="addr-clear" id="clearProvince" aria-label="ล้างจังหวัด" disabled>✕</button><span class="addr-wait" id="waitProvince" aria-hidden="true"><i></i><i></i><i></i></span></span>
        </div>
        <datalist id="provinceList"></datalist>
        <div class="addr-row">
          <input type="text" id="districtInput" list="districtList" placeholder="พิมพ์อำเภอ" autocomplete="off" />
          <span class="addr-slot"><button type="button" class="addr-clear" id="clearDistrict" aria-label="ล้างอำเภอ" disabled>✕</button><span class="addr-wait" id="waitDistrict" aria-hidden="true"><i></i><i></i><i></i></span></span>
        </div>
        <datalist id="districtList"></datalist>
        <div class="addr-row">
          <input type="text" id="subdistrictInput" list="subdistrictList" placeholder="พิมพ์ตำบล" autocomplete="off" />
          <span class="addr-slot"><button type="button" class="addr-clear" id="clearSubdistrict" aria-label="ล้างตำบล" disabled>✕</button><span class="addr-wait" id="waitSubdistrict" aria-hidden="true"><i></i><i></i><i></i></span></span>
        </div>
        <datalist id="subdistrictList"></datalist>
      </div>
      <div class="address-footer">
        <label for="manualAddress">อื่นๆ :</label>
        <input type="text" id="manualAddress" placeholder="หมู่บ้าน สถานที่ (ไม่บังคับ)" />
        <button type="button" class="addr-clear" id="clearManual" aria-label="ล้างอื่นๆ" disabled>✕</button>
      </div>
      <div class="address-search">
        <button id="searchAddressBtn" type="button">ค้นหา</button>
      </div>
      <div id="villageResult" aria-live="polite"></div>`;
    document.body.appendChild(panel);
    T().blockMap(panel);
    const $ = (id) => panel.querySelector('#' + id);
    const provIn = $('provinceInput'), distIn = $('districtInput'), subIn = $('subdistrictInput'), manual = $('manualAddress');
    const provList = $('provinceList'), distList = $('districtList'), subList = $('subdistrictList');
    const box = $('villageResult');
    const searchBtn = $('searchAddressBtn');
    const wait = { prov: $('waitProvince'), dist: $('waitDistrict'), sub: $('waitSubdistrict') };
    const clr = { prov: $('clearProvince'), dist: $('clearDistrict'), sub: $('clearSubdistrict'), manual: $('clearManual') };
    let searching = false;
    let lastKey = null;   // คีย์ของการค้นล่าสุดที่สำเร็จ — ค่าในช่องเท่าเดิมแล้วปุ่มค้นหาไม่ active
    panel.querySelectorAll('input').forEach((i) => i.addEventListener('keydown', (e) => e.stopPropagation()));

    box.textContent = 'กำลังโหลดข้อมูลจังหวัด...';
    loadData()
      .then(() => { box.textContent = ''; fillList(addressData, provIn, provList); })
      .catch(() => { box.textContent = '⚠️ โหลดข้อมูลจังหวัดไม่สำเร็จ ลองปิดแล้วเปิดใหม่'; });

    function resetDistrict() {
      district = null; subdistrict = null;
      distIn.value = ''; subIn.value = '';
      distList.innerHTML = ''; subList.innerHTML = '';
    }
    function resetSub() {
      subdistrict = null;
      subIn.value = '';
      subList.innerHTML = '';
    }

    // ยกเลิกการค้นที่ค้างอยู่ (เปลี่ยนที่อยู่ระหว่างรอ) — ผลเก่าจะถูกทิ้ง
    function cancelSearch() {
      searchSeq++;
      if (searchAbort) { searchAbort.abort(); searchAbort = null; }
      if (searching) { searching = false; box.textContent = ''; }
      refreshSearchBtn();
    }

    // sync* แค่อัปเดตสถานะ/รายการ — ไม่ย้ายโฟกัส (เดิมย้ายทันทีที่ชื่อตรงเป๊ะ ทำให้พิมพ์ชื่อที่เป็นคำขึ้นต้นของอีกชื่อไม่ได้)
    function syncProvince() {
      if (!addressData) return;
      fillList(addressData, provIn, provList);
      const found = findByName(addressData, provIn.value);
      if (found !== province) {
        cancelSearch();
        province = found;
        resetDistrict();
        distIn.placeholder = province && province.bangkok ? 'พิมพ์เขต' : 'พิมพ์อำเภอ';
        subIn.placeholder = province && province.bangkok ? 'พิมพ์แขวง' : 'พิมพ์ตำบล';
        if (province) fillList(province.districts, distIn, distList);
      }
    }
    function syncDistrict() {
      if (!province) return;
      fillList(province.districts, distIn, distList);
      const found = findByName(province.districts, distIn.value);
      if (found !== district) {
        cancelSearch();
        district = found;
        resetSub();
        if (district) fillList(district.subs, subIn, subList);
      }
    }
    function syncSub() {
      if (!district) return;
      fillList(district.subs, subIn, subList);
      const found = findByName(district.subs, subIn.value);
      if (found !== subdistrict) { cancelSearch(); subdistrict = found; }
    }
    // ย้ายโฟกัสเมื่อผู้ใช้ "เลือก/ยืนยัน" แล้วเท่านั้น (change = เลือกจากรายการ/Enter/ออกจากช่อง) และเฉพาะตอนที่ช่องนั้นยังโฟกัสอยู่
    function advanceOnChange(input, sync, ready, next) {
      input.addEventListener('change', () => { sync(); refreshUi(); if (ready() && document.activeElement === input) next.focus(); });
    }

    /* ---------- ปุ่ม ✕ / ปุ่มค้นหา ---------- */
    const currentKey = () => JSON.stringify([province && province.name, district && district.name, subdistrict && subdistrict.name, manual.value.trim()]);
    function updateClear() {
      clr.prov.disabled = !province;          // แสดงเมื่อเลือกถูกต้องแล้วเท่านั้น (disabled = ซ่อน ดู CSS)
      clr.dist.disabled = !district;
      clr.sub.disabled = !subdistrict;
      clr.manual.disabled = !manual.value;    // อื่นๆ ไม่มีรายการให้ตรวจ → มีข้อความก็แสดง
      // แถวล่างปิดไว้ (สีจาง) จนกว่าแถวบนจะเลือกถูกต้อง
      distIn.disabled = !province;
      subIn.disabled = !district;
      manual.disabled = !subdistrict;
      // จุดเด้ง "รอคำตอบ" เฉพาะแถวแรกที่ยังเลือกไม่ถูกต้อง (แถวถัดไปรอคิวอยู่)
      const next = !province ? 'prov' : !district ? 'dist' : !subdistrict ? 'sub' : null;
      Object.keys(wait).forEach((k) => wait[k].classList.toggle('on', k === next));
    }
    function refreshSearchBtn() {
      // กดค้นได้เมื่อเลือก จังหวัด/อำเภอ/ตำบล ถูกต้องครบทั้ง 3 แล้วเท่านั้น · ค่าเท่าเดิมกับการค้นล่าสุด/กำลังค้น → กดไม่ได้
      const complete = !!(province && district && subdistrict);
      searchBtn.disabled = searching || !complete || (lastKey !== null && lastKey === currentKey());
    }
    function refreshUi() { updateClear(); refreshSearchBtn(); }

    function clearResults() {
      cancelSearch();
      clearMarkers();
      T().stopRipple();
      box.innerHTML = '';
      lastKey = null;
    }
    // ล้างแบบลดหลั่น: ล้างช่องที่กด + ทุกช่องที่อยู่ถัดลงไป พร้อมล้างผลลัพธ์
    function clearField(which) {
      clearResults();
      if (which === 'prov') { provIn.value = ''; manual.value = ''; syncProvince(); provIn.focus(); }
      else if (which === 'dist') { distIn.value = ''; manual.value = ''; syncDistrict(); distIn.focus(); }
      else if (which === 'sub') { subIn.value = ''; manual.value = ''; syncSub(); subIn.focus(); }
      else { manual.value = ''; manual.focus(); }
      refreshUi();
    }

    provIn.addEventListener('input', () => { syncProvince(); refreshUi(); });
    distIn.addEventListener('input', () => { syncDistrict(); refreshUi(); });
    subIn.addEventListener('input', () => { syncSub(); refreshUi(); });
    manual.addEventListener('input', refreshUi);
    clr.prov.addEventListener('click', () => clearField('prov'));
    clr.dist.addEventListener('click', () => clearField('dist'));
    clr.sub.addEventListener('click', () => clearField('sub'));
    clr.manual.addEventListener('click', () => clearField('manual'));
    advanceOnChange(provIn, syncProvince, () => province, distIn);
    advanceOnChange(distIn, syncDistrict, () => district, subIn);
    advanceOnChange(subIn, syncSub, () => subdistrict, manual);
    // Enter ในช่องตำบล → ค้นหา (เมื่อเลือกตำบลถูกต้องแล้ว)
    subIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); syncSub(); refreshUi(); if (subdistrict) search(); } });
    provIn.addEventListener('focus', () => { if (addressData) fillList(addressData, provIn, provList); });
    distIn.addEventListener('focus', () => { if (province) fillList(province.districts, distIn, distList); });
    subIn.addEventListener('focus', () => { if (district) fillList(district.subs, subIn, subList); });
    manual.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); search(); } });
    searchBtn.addEventListener('click', search);
    $('closeAddressPanel').addEventListener('click', close);

    /* ---------- ผลลัพธ์ ---------- */
    function showResults(items, { single = false, zoom = ZOOM_SUBDISTRICT } = {}) {
      clearMarkers();
      T().stopRipple();
      box.innerHTML = '';
      const pts = [];
      items.forEach((it) => {
        const m = T().add(T().marker(it.lat, it.lng, { url: 'assets/markers/route-start.png', size: [26, 26] }));
        const openPopup = T().bindPopup(m, esc(it.title) + (it.zip ? `<br>รหัสไปรษณีย์ ${esc(String(it.zip))}` : ''));
        poiMarkers.push(m);
        pts.push([it.lat, it.lng]);
        const row = document.createElement('div');
        row.className = 'search-result-item';
        row.style.cursor = 'pointer';
        row.innerHTML = `<div class="title">${esc(it.title)}</div>`
          + `<div class="coords">(lat:${it.lat}, lng:${it.lng})</div>`
          + (it.note ? `<div class="coords">${esc(it.note)}</div>` : '');
        row.addEventListener('click', () => { T().flyTo(it.lat, it.lng, 14); popupTimers.push(setTimeout(openPopup, 1600)); T().ripple(it.lat, it.lng, 2000); });
        box.appendChild(row);
      });
      if (!pts.length) return;
      if (single || pts.length === 1) {
        T().flyTo(pts[0][0], pts[0][1], zoom);
        T().ripple(pts[0][0], pts[0][1], 2000);
      } else {
        // ผลหลายจุดมักอยู่ใกล้กัน (ระดับหมู่บ้าน) — จำกัดซูมสูงสุดที่ระดับ 15 (เดิม 10 ซูมไกลเกินไป)
        T().fitPoints(pts, { padding: 60, maxLeafletZoom: ZOOM_MAX_MULTI });
      }
    }

    // กลางตำบล (ใช้ค่าที่เลือกไว้ตอนเริ่มค้น ไม่อ่านตัวแปรกลางที่อาจเปลี่ยนระหว่างรอ)
    function centroidResult(sub, dist, prov, note) {
      return {
        lat: sub.lat, lng: sub.lng, zip: sub.zip,
        title: `${sub.label} ${dist.label} ${prov.label}`,
        note: note || `กลาง${sub.prefix}โดยประมาณ, รหัสไปรษณีย์ ${sub.zip || '-'}`
      };
    }

    async function geocode(keyword, signal) {
      const res = await fetch(`https://search.longdo.com/addresslookup/api/addr/geocoding?text=${encodeURIComponent(keyword)}&key=${encodeURIComponent(LONGDO())}`, { signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return ((data && data.data) || []).map((p) => {
        const pt = p.point && p.point[0];
        const lat = pt ? Number(pt.lat) : NaN, lng = pt ? Number(pt.lon) : NaN;
        if (!isFinite(lat) || !isFinite(lng) || (!lat && !lng)) return null;
        // ฟิลด์ชื่อ/ที่อยู่ของ Longdo ยังไม่ได้ยืนยัน — อ่านแบบระวัง ไม่มี → ใช้คำค้นแทน
        const label = [p.name, p.address, p.display_name].find((v) => typeof v === 'string' && v.trim());
        return { lat, lng, label: label ? label.trim() : '' };
      }).filter(Boolean);
    }

    async function search() {
      if (searching || searchBtn.disabled) return;
      if (!addressData) { BPNP.ui.showAlert('ข้อมูลจังหวัดยังโหลดไม่เสร็จ'); return; }
      syncProvince(); syncDistrict(); syncSub(); refreshUi();
      if (!province || !district || !subdistrict) {
        const miss = !province ? 'จังหวัด' : !district ? (province.bangkok ? 'เขต' : 'อำเภอ') : (province.bangkok ? 'แขวง' : 'ตำบล');
        BPNP.ui.showAlert(`กรุณาเลือก${miss}จากรายการ`);
        return;
      }
      const prov = province, dist = district, sub = subdistrict;   // snapshot ณ เวลากดค้น
      const extra = manual.value.trim();
      const hasLatLng = hasCoord(sub);
      const key = JSON.stringify([prov.name, dist.name, sub.name, extra]);
      const place = `${sub.label} ${dist.label} ${prov.label}`;
      const keyword = extra ? `${extra} ${place}` : place;

      // 1) ไม่กรอก "อื่นๆ" และมีพิกัดในข้อมูล → กลางตำบลทันที
      if (!extra && hasLatLng) {
        showResults([centroidResult(sub, dist, prov)], { single: true });
        lastKey = key; refreshSearchBtn();
        BPNP.auth && BPNP.auth.logUserEvent('Search Address', place);
        return;
      }

      // 2) ค้นผ่าน Longdo (มี timeout · ยกเลิกได้ · ผลเก่าถูกทิ้งด้วย seq)
      const seq = ++searchSeq;
      const ctrl = new AbortController();
      searchAbort = ctrl;
      searching = true;
      refreshSearchBtn();
      box.innerHTML = `🔎 กำลังค้นหา "${esc(keyword)}"...`;
      let pts = [];
      let failed = false;
      let outOfArea = false;
      if (LONGDO()) {
        const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
        try { pts = await geocode(keyword, ctrl.signal); }
        catch (err) { if (seq === searchSeq) { console.error(err); failed = true; } }
        finally { clearTimeout(timer); }
      } else {
        failed = true;
      }
      if (seq !== searchSeq) return;   // ถูกยกเลิก (เปลี่ยนที่อยู่/ปิดแผง/ค้นใหม่) → ทิ้งผลเก่า
      searching = false;
      searchAbort = null;
      let shown = false;

      // กรอง/เรียง/จำกัดผล Longdo เทียบกับจุดอ้างอิง (กลางตำบล ไม่มี → กลางอำเภอ)
      const dc = districtCentroid(dist);
      const ref = hasLatLng ? { lat: sub.lat, lng: sub.lng } : dc;
      if (ref && pts.length) {
        const before = pts.length;
        pts = pts.map((p) => ({ ...p, km: kmBetween(ref.lat, ref.lng, p.lat, p.lng) }))
          .filter((p) => p.km <= MAX_RESULT_KM)
          .sort((a, b) => a.km - b.km);
        outOfArea = !pts.length && before > 0;
      }
      pts = pts.slice(0, MAX_GEOCODE_RESULTS);

      if (pts.length) {
        shown = true;
        // ไม่ใส่รหัสไปรษณีย์ตำบลให้ผล Longdo — จุดอาจอยู่คนละตำบล
        showResults(pts.map((p, i) => ({
          lat: p.lat, lng: p.lng,
          title: p.label || (pts.length > 1 ? `${keyword} (${i + 1})` : keyword)
        })));
      } else {
        const target = extra || place;
        const why = failed ? 'ค้นหาด้วย Longdo ไม่สำเร็จ'
          : outOfArea ? `ผลค้นหา "${target}" อยู่ไกลจากพื้นที่ที่เลือก`
            : `ไม่พบ "${target}"`;
        if (hasLatLng) {
          // 3) ไม่พบ/ผิดพลาด → ใช้กลางตำบลแทน
          shown = true;
          showResults([centroidResult(sub, dist, prov, `${why} จึงแสดงกลาง${sub.prefix}โดยประมาณ`)], { single: true });
        } else if (dc) {
          // 4) ตำบลไม่มีพิกัดในข้อมูล → ใช้กลางอำเภอ (ค่าเฉลี่ยพิกัดตำบลที่มี)
          shown = true;
          showResults([{
            lat: dc.lat, lng: dc.lng, zip: sub.zip, title: place,
            note: `${why} และไม่มีพิกัด${sub.prefix}ในข้อมูล จึงแสดงกลาง${dist.prefix}โดยประมาณ, รหัสไปรษณีย์ ${sub.zip || '-'}`
          }], { single: true, zoom: ZOOM_DISTRICT });
        } else {
          clearMarkers();
          box.textContent = failed ? '⚠️ เกิดข้อผิดพลาดในการค้นหา' : '❌ ไม่พบข้อมูล';
        }
      }
      if (shown && !failed) lastKey = key;   // ค้นล้มเหลวไม่นับ → ปุ่มค้นหายังกดลองใหม่ได้
      refreshSearchBtn();
      BPNP.auth && BPNP.auth.logUserEvent('Search Address', keyword);
    }

    refreshUi();
  }

  function close() {
    const wasOpen = !!panel;
    searchSeq++;   // ทิ้งผลค้นที่ยังค้างอยู่
    if (searchAbort) { searchAbort.abort(); searchAbort = null; }
    clearMarkers();
    T().stopRipple();
    if (panel) { panel.remove(); panel = null; }
    province = district = subdistrict = null;
    if (wasOpen && typeof api.onClose === 'function') api.onClose();   // แจ้งแผงหลัก (hub.js) ให้รีเซ็ตโหมด
  }

  const api = BPNP.tools.addressSearch = { open, close, onClose: null };
  window.createAddressPanel = open;   // ชื่อเดิม
})();
