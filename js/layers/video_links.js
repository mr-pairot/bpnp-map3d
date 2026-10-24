/* js/layers/video_links.js
 * ─────────────────────────────────────────────────────────────────────────
 * ลิงก์วิดีโอความคืบหน้า (YouTube) ของสถานี — ข้อมูล data/json/video_links.json
 * (เดิม hasStationYoutubeLink / openStationYoutube ใน openYoutubeByKM_box.js)
 * และของ Underpass / Box Culvert ตาม กม. — data/json/box_timestamp.json (เดิม openYoutubeByKM_box.js)
 * ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  const esc = BPNP.escapeHtml;
  let data = null;

  async function load() {
    if (!data) data = await BPNP.core.dataCache.getJSON('data/json/video_links.json');
    return data;
  }

  // ชื่อใน KML ใช้ "ป้ายหยุดรถไฟ" แต่ในไฟล์ลิงก์ใช้ "ที่หยุดรถ"
  const normalize = name => String(name || '').replace('ป้ายหยุดรถไฟ', 'ที่หยุดรถ');

  async function stationUrl(name) {
    try { return (await load())[normalize(name)] || null; }
    catch (err) { console.error('[VideoLinks] โหลดไม่สำเร็จ:', err); return null; }
  }

  async function openStation(name) {
    const url = await stationUrl(name);
    if (url) {
      window.open(url, '_blank', 'noopener');
      BPNP.auth && BPNP.auth.logUserEvent('Open YouTube', name);
    } else {
      BPNP.ui.showAlert('ไม่พบวิดีโอของ ' + name);
    }
  }

  // ── โครงสร้างตาม กม. (Underpass / Box Culvert) — data/json/box_timestamp.json ──
  // รูปแบบข้อมูล: { "<เดือน>": [ { "กม.": "1+900", "ชื่องาน": "Underpass", "ลิ้งก์": "https://..." }, ... ], ... }
  let boxData = null;
  async function loadBox() {
    if (!boxData) boxData = await BPNP.core.dataCache.getJSON('data/json/box_timestamp.json');
    return boxData;
  }

  async function structureLinks(km, type) {
    try {
      const data = await loadBox();
      const out = [];
      Object.keys(data).forEach(month => {
        const m = (data[month] || []).find(it => it['กม.'] === km && it['ชื่องาน'] === type);
        if (m && m['ลิ้งก์'] && String(m['ลิ้งก์']).trim() !== '') out.push({ month, link: String(m['ลิ้งก์']).trim() });
      });
      return out;
    } catch (err) {
      console.error('[VideoLinks] โหลด box_timestamp ไม่สำเร็จ:', err);
      return [];
    }
  }

  async function openStructure(km, type) {
    const links = await structureLinks(km, type);
    if (!links.length) return;
    BPNP.auth && BPNP.auth.logUserEvent('Open YouTube', `${type} กม. ${km}`);
    if (links.length === 1) { window.open(links[0].link, '_blank', 'noopener'); return; }
    showMonthModal(links, km, type);
  }

  // มีหลายเดือน → ให้เลือก (เดิม showMonthSelectionModal)
  function showMonthModal(links, km, type) {
    const old = document.getElementById('youtube-month-modal');
    if (old) old.remove();
    const icon = '<svg class="bp-yt-icon" viewBox="0 0 24 24" width="20" height="20" fill="white" style="margin-right:8px;"><path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/></svg>';
    const buttons = links.map(it => `
      <a href="${esc(it.link)}" target="_blank" rel="noopener" class="bp-yt-btn" style="display:flex; align-items:center; padding:10px; background:#1e40af; color:white; text-decoration:none; border-radius:4px; margin-bottom: 8px;">
        ${icon} เดือน ${esc(it.month)}
      </a>`).join('');
    document.body.insertAdjacentHTML('beforeend', `
      <div id="youtube-month-modal" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.6); z-index:9999; display:flex; align-items:center; justify-content:center;">
        <div style="background:#0d2b45; padding:20px; border-radius:8px; width:300px; border:1px solid rgba(255,255,255,0.15); color:white;">
          <h4 style="margin:0 0 10px 0; font-size:14px; color:#fcd34d;">เลือกเดือนที่ต้องการดู</h4>
          <div style="font-size:12px; margin-bottom:15px; opacity:0.8;">${esc(type)} (กม. ${esc(km)})</div>
          ${buttons}
          <button type="button" class="yt-modal-cancel" style="width:100%; padding:8px; background:transparent; border:1px solid #444; color:#fff; border-radius:4px; cursor:pointer; margin-top:10px;">ยกเลิก</button>
        </div>
      </div>`);
    const modal = document.getElementById('youtube-month-modal');
    modal.querySelector('.yt-modal-cancel').addEventListener('click', () => modal.remove());
  }

  BPNP.layers.videoLinks = { stationUrl, openStation, structureLinks, openStructure };
  // ชื่อเดิม
  window.hasStationYoutubeLink = async name => !!(await stationUrl(name));
  window.openStationYoutube = openStation;
  window.hasYoutubeLink  = async (km, type) => (await structureLinks(km, type)).length > 0;
  window.openYoutubeByKm = openStructure;
})();
