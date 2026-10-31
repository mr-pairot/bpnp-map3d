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
 * CSS: css/tools/search_address.css (ใช้คลาสเดิม)
 * ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  const T = () => BPNP.tools.utils;
  const esc = BPNP.escapeHtml;
  const DATA_URL = 'data/json/thai_address.json';
  const MAX_OPTIONS = 5;          // จำนวนรายการแนะนำขณะพิมพ์ (ช่องว่าง = แสดงทั้งหมด)
  const ZOOM_SUBDISTRICT = 13;    // ซูมเมื่อแสดงกลางตำบล
  const LONGDO = () => (BPNP.config.keys && BPNP.config.keys.longdoServices) || '';
  const collator = new Intl.Collator('th');

  let addressData = null, loading = null, panel = null, poiMarkers = [];
  let province = null, district = null, subdistrict = null;

  /* ---------- ข้อมูล ---------- */
  function expand(raw) {
    return (raw.provinces || []).map(([name, districts]) => ({
      name,
      label: name === 'กรุงเทพมหานคร' ? name : `จังหวัด${name}`,
      bangkok: name === 'กรุงเทพมหานคร',
      districts: districts.map(([prefix, dName, subs]) => ({
        name: dName,
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

  function clearMarkers() { poiMarkers.forEach((m) => m.remove()); poiMarkers = []; }

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
        <input type="text" id="provinceInput" list="provinceList" placeholder="พิมพ์จังหวัด" autocomplete="off" />
        <datalist id="provinceList"></datalist>
        <input type="text" id="districtInput" list="districtList" placeholder="พิมพ์อำเภอ" autocomplete="off" />
        <datalist id="districtList"></datalist>
        <input type="text" id="subdistrictInput" list="subdistrictList" placeholder="พิมพ์ตำบล" autocomplete="off" />
        <datalist id="subdistrictList"></datalist>
      </div>
      <div class="address-footer">
        <label for="manualAddress">อื่นๆ :</label>
        <input type="text" id="manualAddress" placeholder="หมู่บ้าน สถานที่ (ไม่บังคับ)" />
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

    function syncProvince() {
      if (!addressData) return;
      fillList(addressData, provIn, provList);
      const found = findByName(addressData, provIn.value);
      if (found !== province) {
        province = found;
        resetDistrict();
        distIn.placeholder = province && province.bangkok ? 'พิมพ์เขต' : 'พิมพ์อำเภอ';
        subIn.placeholder = province && province.bangkok ? 'พิมพ์แขวง' : 'พิมพ์ตำบล';
        if (province) { fillList(province.districts, distIn, distList); distIn.focus(); }
      }
    }
    function syncDistrict() {
      if (!province) return;
      fillList(province.districts, distIn, distList);
      const found = findByName(province.districts, distIn.value);
      if (found !== district) {
        district = found;
        resetSub();
        if (district) { fillList(district.subs, subIn, subList); subIn.focus(); }
      }
    }
    function syncSub() {
      if (!district) return;
      fillList(district.subs, subIn, subList);
      const found = findByName(district.subs, subIn.value);
      if (found !== subdistrict) {
        subdistrict = found;
        if (subdistrict) manual.focus();
      }
    }

    provIn.addEventListener('input', syncProvince);
    distIn.addEventListener('input', syncDistrict);
    subIn.addEventListener('input', syncSub);
    provIn.addEventListener('focus', () => { if (addressData) fillList(addressData, provIn, provList); });
    distIn.addEventListener('focus', () => { if (province) fillList(province.districts, distIn, distList); });
    subIn.addEventListener('focus', () => { if (district) fillList(district.subs, subIn, subList); });
    manual.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); search(); } });
    $('searchAddressBtn').addEventListener('click', search);
    $('closeAddressPanel').addEventListener('click', close);

    /* ---------- ผลลัพธ์ ---------- */
    function showResults(items, { single = false } = {}) {
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
        row.addEventListener('click', () => { T().flyTo(it.lat, it.lng, 14); setTimeout(openPopup, 1600); T().ripple(it.lat, it.lng, 2000); });
        box.appendChild(row);
      });
      if (!pts.length) return;
      if (single || pts.length === 1) {
        T().flyTo(pts[0][0], pts[0][1], ZOOM_SUBDISTRICT);
        T().ripple(pts[0][0], pts[0][1], 2000);
      } else {
        // เดิม: fitBounds(pad 0.2) แล้วไม่ให้ซูมใกล้กว่า Leaflet 10
        T().fitPoints(pts, { padding: 60, maxLeafletZoom: 10 });
      }
    }

    function centroidResult(note) {
      const s = subdistrict;
      return {
        lat: s.lat, lng: s.lng, zip: s.zip,
        title: `${s.label} ${district.label} ${province.label}`,
        note: note || `กลาง${s.prefix}โดยประมาณ, รหัสไปรษณีย์ ${s.zip || '-'}`
      };
    }

    async function geocode(keyword) {
      const res = await fetch(`https://search.longdo.com/addresslookup/api/addr/geocoding?text=${encodeURIComponent(keyword)}&key=${encodeURIComponent(LONGDO())}`);
      const data = await res.json();
      return ((data && data.data) || []).map((p) => {
        const pt = p.point && p.point[0];
        return pt && pt.lat && pt.lon ? { lat: pt.lat, lng: pt.lon } : null;
      }).filter(Boolean);
    }

    async function search() {
      if (!addressData) { BPNP.ui.showAlert('ข้อมูลจังหวัดยังโหลดไม่เสร็จ'); return; }
      syncProvince(); syncDistrict(); syncSub();
      if (!province || !district || !subdistrict) {
        const miss = !province ? 'จังหวัด' : !district ? (province.bangkok ? 'เขต' : 'อำเภอ') : (province.bangkok ? 'แขวง' : 'ตำบล');
        BPNP.ui.showAlert(`กรุณาเลือก${miss}จากรายการ`);
        return;
      }
      const extra = manual.value.trim();
      const hasLatLng = subdistrict.lat !== null && subdistrict.lng !== null;
      const place = `${subdistrict.label} ${district.label} ${province.label}`;
      const keyword = extra ? `${extra} ${place}` : place;

      // 1) ไม่กรอก "อื่นๆ" และมีพิกัดในข้อมูล → กลางตำบลทันที
      if (!extra && hasLatLng) {
        showResults([centroidResult()], { single: true });
        BPNP.auth && BPNP.auth.logUserEvent('Search Address', place);
        return;
      }

      // 2) ค้นผ่าน Longdo
      box.innerHTML = `🔎 กำลังค้นหา "${esc(keyword)}"...`;
      let pts = [];
      let failed = false;
      if (LONGDO()) {
        try { pts = await geocode(keyword); } catch (err) { console.error(err); failed = true; }
      } else {
        failed = true;
      }
      if (!panel) return; // ปิดแผงระหว่างรอ

      if (pts.length) {
        showResults(pts.map((p) => ({ ...p, title: keyword, zip: subdistrict.zip })));
      } else if (hasLatLng) {
        // 3) ไม่พบ/ผิดพลาด → ใช้กลางตำบลแทน
        const why = failed ? 'ค้นหาด้วย Longdo ไม่สำเร็จ' : `ไม่พบ "${extra}"`;
        showResults([centroidResult(`${why} จึงแสดงกลาง${subdistrict.prefix}โดยประมาณ`)], { single: true });
      } else {
        clearMarkers();
        box.textContent = failed ? '⚠️ เกิดข้อผิดพลาดในการค้นหา' : '❌ ไม่พบข้อมูล';
      }
      BPNP.auth && BPNP.auth.logUserEvent('Search Address', keyword);
    }
  }

  function close() {
    clearMarkers();
    T().stopRipple();
    if (panel) { panel.remove(); panel = null; }
    province = district = subdistrict = null;
  }

  BPNP.tools.addressSearch = { open, close };
  window.createAddressPanel = open;   // ชื่อเดิม
})();
