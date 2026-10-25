/* js/layers/parcel/parcel_search.js
 * ─────────────────────────────────────────────────────────────────────────
 * ค้นหารหัสแปลง — หน้าตาและตำแหน่งเหมือน leaflet-search ของเวอร์ชันเดิม
 *   - มุมขวาบน เหนือ legend แปลงเวนคืน (แสดงเฉพาะตอนเปิดชั้นแปลงเวนคืน)
 *   - ปุ่ม 26×26 รูป assets/ui/search-icon-2.png (sprite 3 สถานะ: ปกติ / ชี้เมาส์ / ยกเลิก)
 *   - กดปุ่ม → ช่องพิมพ์กว้าง 113 px ขอบน้ำเงิน ทางซ้ายของปุ่ม + รายการแนะนำด้านล่าง
 *   - เลือก / Enter / กดปุ่มค้นหา → บินไปที่แปลง (ซูม Leaflet 16) + popup + กะพริบ
 *   - ค้นทั้งแปลงในเขตเวนคืนและ Pay Out (แปลงหลักก่อน เหมือนเดิม)
 * CSS: css/layers/parcel.css
 * ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  const esc = BPNP.escapeHtml;
  const MAX_TIPS = 50;

  let ctl = null, input = null, tips = null, alertEl = null;
  let index = null, active = -1, results = [];

  function build() {
    if (ctl) return;
    ctl = document.createElement('div');
    ctl.className = 'parcel-search-ctl';
    ctl.innerHTML = `
      <input class="ps-input" type="text" placeholder="ค้นหาด้วยรหัสแปลง..." autocomplete="off" aria-label="ค้นหาด้วยรหัสแปลง">
      <a class="ps-cancel" href="#" title="ยกเลิก"><span>ยกเลิก</span></a>
      <button class="ps-button" type="button" title="ค้นหา..."></button>
      <ul class="ps-tips"></ul>
      <div class="ps-alert"></div>`;
    input   = ctl.querySelector('.ps-input');
    tips    = ctl.querySelector('.ps-tips');
    alertEl = ctl.querySelector('.ps-alert');

    ['mousedown', 'touchstart', 'wheel', 'dblclick'].forEach(ev =>
      ctl.addEventListener(ev, e => e.stopPropagation(), { passive: true }));
    ctl.addEventListener('contextmenu', e => e.preventDefault());

    // ปุ่มค้นหา: ยังไม่ขยาย → ขยาย / ขยายแล้วมีข้อความ → ค้นหา / ว่าง → ย่อ
    ctl.querySelector('.ps-button').addEventListener('click', e => {
      e.preventDefault(); e.stopPropagation();
      if (!ctl.classList.contains('open')) { expand(); return; }
      if (input.value.trim()) choose(results[active >= 0 ? active : 0]);
      else collapse();
    });
    ctl.querySelector('.ps-cancel').addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); collapse(); });
    input.addEventListener('input', update);
    input.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive(Math.min(active + 1, results.length - 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(Math.max(active - 1, 0)); }
      else if (e.key === 'Enter') { e.preventDefault(); choose(results[active >= 0 ? active : 0]); }
      else if (e.key === 'Escape') { collapse(); }
      e.stopPropagation();   // ไม่ให้ Space/Esc ไปหยุดวงกระเพื่อมของเครื่องมือดูพิกัด
    });
    document.addEventListener('click', e => {
      if (ctl.classList.contains('open') && !ctl.contains(e.target) && !input.value.trim()) collapse();
    });
  }

  function update() {
    const q = input.value.trim().toLowerCase();
    tips.innerHTML = '';
    alertEl.textContent = '';
    active = -1;
    results = [];
    ctl.classList.toggle('has-text', !!q);
    if (!q) return;
    if (!index) index = BPNP.layers.parcel.searchIndex();
    const starts = [], contains = [];
    index.forEach(it => {
      const c = it.code.toLowerCase();
      if (c.indexOf(q) === 0) starts.push(it);
      else if (c.indexOf(q) > 0) contains.push(it);
    });
    results = starts.concat(contains).slice(0, MAX_TIPS);
    if (!results.length) { alertEl.textContent = 'ไม่พบข้อมูล'; return; }
    results.forEach((it, i) => {
      const li = document.createElement('li');
      li.className = 'ps-tip';
      li.innerHTML = `${esc(it.code)}${it.source === 'payout' ? ' <small>(นอกเขต)</small>' : ''}`;
      li.addEventListener('click', e => { e.stopPropagation(); choose(it); });
      li.addEventListener('mouseenter', () => setActive(i));
      tips.appendChild(li);
    });
  }

  function setActive(i) {
    active = i;
    tips.querySelectorAll('li').forEach((li, k) => li.classList.toggle('ps-tip-select', k === i));
  }

  function choose(it) {
    if (!it) { alertEl.textContent = 'ไม่พบข้อมูล'; return; }
    collapse();
    BPNP.layers.parcel.goTo(it.source, it.index, { leafletZoom: 16 });
    BPNP.auth && BPNP.auth.logUserEvent('Search Parcel', it.code);
  }

  function expand() {
    ctl.classList.add('open');
    setTimeout(() => input.focus(), 50);
  }

  function collapse() {
    if (!ctl) return;
    ctl.classList.remove('open', 'has-text');
    input.value = '';
    tips.innerHTML = '';
    alertEl.textContent = '';
    input.blur();
  }

  BPNP.layers.parcelSearch = {
    // วางไว้บนสุดของมุมขวาบน (เหนือ legend) เหมือนลำดับใน Leaflet: ปุ่มเต็มจอ → ค้นหา → legend
    show() { build(); index = null; BPNP.layers.utils.legendStack().prepend(ctl); },
    hide() { if (!ctl) return; collapse(); ctl.remove(); },
    get element() { return ctl; }
  };
})();
