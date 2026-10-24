/* js/layers/parcel/parcel_search.js
 * ─────────────────────────────────────────────────────────────────────────
 * ค้นหารหัสแปลง (แทน leaflet-search.js) — แสดงเฉพาะตอนเปิดชั้นแปลงเวนคืน
 *   พิมพ์รหัส → รายการแนะนำ (ขึ้นต้นด้วยข้อความที่พิมพ์ก่อน แล้วจึงที่มีข้อความนั้น)
 *   เลือก / Enter → บินไปที่แปลง (ซูม Leaflet 16) + popup + กะพริบ
 *   ค้นทั้งแปลงในเขตเวนคืนและ Pay Out (แปลงหลักมาก่อน เหมือนเดิม)
 * ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  const esc = BPNP.escapeHtml;
  const MAX_ITEMS = 12;

  let btn = null, box = null, input = null, list = null, msg = null;
  let index = null, active = -1, results = [];

  function build() {
    if (btn) return;
    btn = BPNP.ui.createStandardButton({
      id: 'parcelSearchBtn',
      imageSrc: 'assets/ui/search.png',
      style: { top: 'calc(var(--safe-top) + (var(--map-btn-size) + var(--map-gap)) * 2)', left: 'var(--safe-left)', display: 'none' },
      title: 'ค้นหารหัสแปลง',
      onClick: () => (box.classList.contains('open') ? close() : open())
    });

    box = document.createElement('div');
    box.className = 'parcel-search-box';
    box.innerHTML = `
      <div class="parcel-search-row">
        <input type="search" placeholder="ค้นหาด้วยรหัสแปลง..." autocomplete="off" aria-label="ค้นหาด้วยรหัสแปลง">
        <button type="button" class="parcel-search-cancel" title="ยกเลิก">ยกเลิก</button>
      </div>
      <div class="parcel-search-msg"></div>
      <ul class="parcel-search-list"></ul>`;
    document.body.appendChild(box);
    input = box.querySelector('input');
    list  = box.querySelector('ul');
    msg   = box.querySelector('.parcel-search-msg');
    ['mousedown', 'touchstart', 'wheel', 'dblclick', 'contextmenu', 'click'].forEach(ev =>
      box.addEventListener(ev, e => e.stopPropagation(), { passive: ev !== 'click' && ev !== 'contextmenu' }));

    box.querySelector('.parcel-search-cancel').addEventListener('click', close);
    input.addEventListener('input', update);
    input.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive(Math.min(active + 1, results.length - 1)); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(Math.max(active - 1, 0)); }
      else if (e.key === 'Enter') { e.preventDefault(); choose(results[active >= 0 ? active : 0]); }
      else if (e.key === 'Escape') { close(); }
      e.stopPropagation();   // ไม่ให้ Space/Esc ไปหยุดวงกระเพื่อมของเครื่องมือดูพิกัด
    });
    document.addEventListener('click', e => {
      if (box.classList.contains('open') && !box.contains(e.target) && !btn.contains(e.target)) close();
    });
  }

  function update() {
    const q = input.value.trim().toLowerCase();
    list.innerHTML = '';
    msg.textContent = '';
    active = -1;
    results = [];
    if (!q) return;
    if (!index) index = BPNP.layers.parcel.searchIndex();
    const starts = [], contains = [];
    index.forEach(it => {
      const c = it.code.toLowerCase();
      if (c.indexOf(q) === 0) starts.push(it);
      else if (c.indexOf(q) > 0) contains.push(it);
    });
    results = starts.concat(contains).slice(0, MAX_ITEMS);
    if (!results.length) { msg.textContent = 'ไม่พบข้อมูล'; return; }
    results.forEach((it, i) => {
      const li = document.createElement('li');
      li.innerHTML = `${esc(it.code)}${it.source === 'payout' ? ' <small>(นอกเขตเวนคืน)</small>' : ''}`;
      li.addEventListener('click', () => choose(it));
      li.addEventListener('mouseenter', () => setActive(i));
      list.appendChild(li);
    });
  }

  function setActive(i) {
    active = i;
    list.querySelectorAll('li').forEach((li, k) => li.classList.toggle('active', k === i));
  }

  function choose(it) {
    if (!it) { msg.textContent = 'ไม่พบข้อมูล'; return; }
    close();
    BPNP.layers.parcel.goTo(it.source, it.index, { leafletZoom: 16 });
    BPNP.auth && BPNP.auth.logUserEvent('Search Parcel', it.code);
  }

  function open() {
    box.classList.add('open');
    btn.classList.add('active');
    setTimeout(() => input.focus(), 50);
  }

  function close() {
    if (!box) return;
    box.classList.remove('open');
    btn.classList.remove('active');
    input.value = '';
    list.innerHTML = '';
    msg.textContent = '';
  }

  BPNP.layers.parcelSearch = {
    show() { build(); index = null; btn.style.display = ''; },
    hide() { if (!btn) return; close(); btn.style.display = 'none'; }
  };
})();
