/* js/layers/structure/bridge_alert.js
 * ─────────────────────────────────────────────────────────────────────────
 * แจ้งเตือนงานสะพานล่าช้า (เดิม Critical_Alert_Str.js)
 *   - ปุ่ม "Bridge: Critical Alert" แสดงเฉพาะตอนเปิดชั้น Bridge (คอลัมน์ซ้าย)
 *   - เปิดแล้ว → จุดกระเพื่อมสีแดง/ส้ม/เหลืองที่สะพานที่เข้าเกณฑ์
 *       แดง  : เปิดใช้ และ (เวลาเหลือ < X วัน  หรือ ล่าช้า > Y %)
 *       ส้ม  : เปิดใช้ และ (ล่าช้า > Y %       และ เวลาเหลือ < X วัน)
 *       เหลือง: เปิดใช้ และ (ล่าช้า > Y %       และ เวลาเหลือ < X วัน)
 *     ล่าช้า = % แผน − % จริง · สะพานที่เสร็จ 100% ไม่แจ้ง
 *   - แผงตั้งเกณฑ์ (ชี้เมาส์ค้าง 1 วินาที หรือเปิดสวิตช์) · บันทึกค่าในเครื่อง
 * CSS: css/layers/bridge_alert.css
 * ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  const DEFAULTS = {
    red:    { enabled: true, delayPct: 90, daysRemaining: 0  },
    orange: { enabled: true, delayPct: 30, daysRemaining: 45 },
    yellow: { enabled: true, delayPct: 30, daysRemaining: 60 }
  };
  const STORAGE_KEY = 'critical_alert_config_v3';
  const clone = o => JSON.parse(JSON.stringify(o));

  let wrapper = null, panel = null, toggle = null;
  let active = false, available = false;
  let config = loadConfig();
  let markers = [];

  function loadConfig() {
    const saved = BPNP.storage.getJSON(STORAGE_KEY);
    const merged = clone(DEFAULTS);
    if (saved) ['red', 'orange', 'yellow'].forEach(k => { if (saved[k]) Object.assign(merged[k], saved[k]); });
    return merged;
  }
  const saveConfig = () => BPNP.storage.setJSON(STORAGE_KEY, config);

  function group(title, key, bg, fields) {
    const sliders = fields.map(f => `
      <div class="slider-row">
        <label style="display:flex; justify-content:space-between; align-items:center; margin-bottom:2px;">
          <span style="color:#4b5563;">${f.l}</span>
          <span style="font-size:13px; font-weight:900; color:#1e3a8a;"><span data-val="${key}.${f.k}"></span> ${f.unit}</span>
        </label>
        <input type="range" data-key="${key}.${f.k}" min="${f.min}" max="${f.max}" step="${f.step}">
      </div>`).join('');
    return `<div class="group ${bg}"><div class="group-title">${title}<input type="checkbox" data-toggle="${key}"></div>${sliders}</div>`;
  }

  function build() {
    if (wrapper) return;
    wrapper = document.createElement('div');
    wrapper.className = 'critical-alert-wrapper';
    wrapper.style.display = 'none';
    wrapper.innerHTML = `
      <label class="toggle-alert-str" for="toggle-alert-bridge" title="เปิด/ปิด แจ้งเตือนสถานะความล่าช้า">
        <input type="checkbox" id="toggle-alert-bridge" class="toggle-alert__input">
        <span class="toggle-alert__button">
          <svg class="toggle-alert__button--correct" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
        </span>
      </label>
      <div class="alert-panel">
        <button class="bp-close-btn" type="button" title="ปิดหน้าต่าง">&times;</button>
        ${group('🔴 เคสแดง', 'red', 'red-bg', [
          { k: 'delayPct', l: 'ล่าช้า >', unit: '%', min: 0, max: 100, step: 5 },
          { k: 'daysRemaining', l: 'หรือ เวลาเหลือ <', unit: 'วัน', min: -30, max: 60, step: 5 }])}
        ${group('🟠 เคสส้ม', 'orange', 'orange-bg', [
          { k: 'delayPct', l: 'ล่าช้า >', unit: '%', min: 0, max: 100, step: 5 },
          { k: 'daysRemaining', l: 'และ เวลาเหลือ <', unit: 'วัน', min: 0, max: 60, step: 15 }])}
        ${group('🟡 เคสเหลือง', 'yellow', 'yellow-bg', [
          { k: 'delayPct', l: 'ล่าช้า >', unit: '%', min: 0, max: 100, step: 5 },
          { k: 'daysRemaining', l: 'และ เวลาเหลือ <', unit: 'วัน', min: 0, max: 60, step: 15 }])}
        <div class="actions">
          <button class="btn set" type="button">บันทึก</button>
          <button class="btn reset" type="button">ค่าเริ่มต้น</button>
        </div>
      </div>`;
    document.body.appendChild(wrapper);
    panel  = wrapper.querySelector('.alert-panel');
    toggle = wrapper.querySelector('#toggle-alert-bridge');
    ['mousedown', 'touchstart', 'wheel', 'dblclick'].forEach(ev =>
      wrapper.addEventListener(ev, e => e.stopPropagation(), { passive: true }));
    wrapper.addEventListener('contextmenu', e => e.preventDefault());
    bind();
    syncUI();
    BPNP.ui.leftColumnAdd(wrapper, 10);
  }

  function bind() {
    let hoverTimer, idleTimer;
    toggle.onchange = e => { setActive(e.target.checked); e.target.checked ? showPanel() : hidePanel(); };
    wrapper.onmouseenter = () => {
      clearTimeout(idleTimer);
      hoverTimer = setTimeout(() => {
        if (!toggle.checked) { toggle.checked = true; setActive(true); }
        showPanel();
      }, 1000);
    };
    wrapper.onmouseleave = () => { clearTimeout(hoverTimer); idleTimer = setTimeout(hidePanel, 5000); };
    panel.querySelector('.set').onclick = () => { readUI(); saveConfig(); render(); hidePanel(); };
    panel.querySelector('.reset').onclick = () => { config = clone(DEFAULTS); syncUI(); saveConfig(); render(); };
    panel.querySelector('.bp-close-btn').onclick = e => { e.stopPropagation(); clearTimeout(idleTimer); hidePanel(); };
  }

  function syncUI() {
    panel.querySelectorAll('input[type=range]').forEach(sl => {
      const val = sl.dataset.key.split('.').reduce((o, k) => (o ? o[k] : undefined), config);
      const out = panel.querySelector(`[data-val="${sl.dataset.key}"]`);
      if (val !== undefined) { sl.value = val; out.textContent = val; }
      sl.oninput = () => { out.textContent = sl.value; };
    });
    panel.querySelectorAll('[data-toggle]').forEach(cb => {
      const k = cb.dataset.toggle;
      cb.checked = !!config[k].enabled;
      cb.onchange = () => { config[k].enabled = cb.checked; };
    });
  }

  function readUI() {
    panel.querySelectorAll('input[type=range]').forEach(sl => {
      const [k, field] = sl.dataset.key.split('.');
      config[k][field] = Number(sl.value);
    });
  }

  const showPanel = () => panel.classList.add('active');
  const hidePanel = () => { if (panel) panel.classList.remove('active'); };

  function daysRemaining(endDate, today) {
    if (!endDate) return Infinity;
    const d = new Date(endDate);
    if (isNaN(d.getTime())) return Infinity;
    d.setHours(0, 0, 0, 0);
    return Math.ceil((d.getTime() - today.getTime()) / 86400000);
  }

  function resolveColor(c, delay, days) {
    if (c.red?.enabled    && (days < c.red.daysRemaining || delay > c.red.delayPct))            return 'red';
    if (c.orange?.enabled && (delay > c.orange.delayPct  && days < c.orange.daysRemaining))     return 'orange';
    if (c.yellow?.enabled && (delay > c.yellow.delayPct  && days < c.yellow.daysRemaining))     return 'yellow';
    return null;
  }

  function clearMarkers() { markers.forEach(m => m.remove()); markers = []; }

  function render() {
    clearMarkers();
    if (!active || !BPNP.layers.bridge) return;
    const map = BPNP.map.instance;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    BPNP.layers.bridge.features.forEach(f => {
      const pct = f.pct || 0;
      if (pct >= 100) return;
      const color = resolveColor(config, (f.planPct || pct) - pct, daysRemaining(f.endDate, today));
      if (!color || !f.center) return;
      // ราก 0×0 ไม่มี position (กติกาหัวข้อ 19) — วงกระเพื่อมจัดกึ่งกลางด้วย margin −20 px เหมือนเดิม
      const el = document.createElement('div');
      el.className = 'empty-alert-icon';
      el.style.width = '0'; el.style.height = '0';
      el.innerHTML = `<div class="alert-ripple-container"><div class="alert-ripple alert-ripple-${color}"></div></div>`;
      markers.push(new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat(f.center).addTo(map));
    });
  }

  function setActive(on) {
    active = !!on;
    if (active) render(); else { clearMarkers(); hidePanel(); }
  }

  // เรียกจาก bridge.js เมื่อเปิด/ปิดชั้น Bridge
  function setAvailable(on) {
    build();
    available = !!on;
    wrapper.style.display = available ? '' : 'none';
    if (!available && toggle.checked) { toggle.checked = false; setActive(false); }
    BPNP.ui.leftColumnRefresh();
  }

  BPNP.layers.bridgeAlert = {
    setAvailable, refresh: () => { if (active) render(); },
    get active() { return active; }, get config() { return clone(config); }
  };
})();
