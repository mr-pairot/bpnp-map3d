/* js/layers/video_links.js
 * ─────────────────────────────────────────────────────────────────────────
 * ลิงก์วิดีโอความคืบหน้า (YouTube) ของสถานี — ข้อมูล data/json/video_links.json
 * (เดิม hasStationYoutubeLink / openStationYoutube ใน openYoutubeByKM_box.js)
 * ส่วนของช่องลอด/สะพาน (box_timestamp.json) จะย้ายมาในเฟส 3–4
 * ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';
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

  BPNP.layers.videoLinks = { stationUrl, openStation };
  // ชื่อเดิม
  window.hasStationYoutubeLink = async name => !!(await stationUrl(name));
  window.openStationYoutube = openStation;
})();
