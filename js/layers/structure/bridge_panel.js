/* js/layers/structure/bridge_panel.js
 * ─────────────────────────────────────────────────────────────────────────
 * แผงตารางความก้าวหน้างานสะพาน (เดิม BridgeBottomPanel.js)
 *   - เปิดอัตโนมัติเมื่อเปิดชั้น Bridge / ปิดเมื่อปิดชั้น (เหมือนเดิม)
 *   - แท็บ: ทั้งหมด / Concrete / Steel / Overpass · เรียงตาม กม.
 *   - กดแถว → บินไปที่สะพาน (ซูม Leaflet 18) + เปิดการ์ดความคืบหน้า
 *   - ส่วนหัวมีช่องสำหรับปุ่ม Critical Alert (headerSlot) — แผง Alert (bridge_alert.js) คลี่ขึ้นเหนือแผงนี้
 * ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  const esc = BPNP.escapeHtml;

  let panel = null, tbody = null, subtitle = null;
  const hideListeners = [];
  let allData = [], activeTab = 'all';

  function init() {
    if (panel) return;
    document.body.insertAdjacentHTML('beforeend', `
      <div id="bridge-bottom-panel" class="bp-bottom-panel">
        <div class="bp-panel-header">
          <div class="bp-panel-title-container">
            <span id="bridge-panel-title">รายละเอียดความก้าวหน้างานสะพาน</span>
            <span id="bridge-panel-subtitle" class="bridge-panel-subtitle">Update : -</span>
            <span id="bridge-alert-slot" class="bridge-alert-slot"></span>
            <button class="bp-close-btn" type="button" title="ปิดหน้าต่าง">&times;</button>
          </div>
          <div class="bridge-tabs">
            <button class="bridge-tab active" type="button" data-tab="all">ทั้งหมด</button>
            <button class="bridge-tab" type="button" data-tab="concrete_bridge">Concrete Bridge</button>
            <button class="bridge-tab" type="button" data-tab="steel_bridge">Steel Bridge</button>
            <button class="bridge-tab" type="button" data-tab="overpass">Overpass</button>
          </div>
        </div>
        <div class="bp-table-container">
          <table class="bp-dataBridge-table">
            <thead>
              <tr>
                <th class="th-seq">ลำดับ</th>
                <th class="th-sta">Sta.</th>
                <th class="th-span">Span</th>
                <th class="th-length">Length</th>
                <th class="th-pct">%</th>
                <th class="th-progress">ความก้าวหน้า</th>
              </tr>
            </thead>
            <tbody id="bridge-table-body"></tbody>
          </table>
        </div>
      </div>`);
    panel    = document.getElementById('bridge-bottom-panel');
    tbody    = document.getElementById('bridge-table-body');
    subtitle = document.getElementById('bridge-panel-subtitle');
    panel.querySelector('.bp-close-btn').addEventListener('click', hide);
    panel.querySelectorAll('.bridge-tab').forEach(b => b.addEventListener('click', () => filterTab(b.dataset.tab)));
    ['mousedown', 'touchstart', 'wheel', 'dblclick'].forEach(ev =>
      panel.addEventListener(ev, e => e.stopPropagation(), { passive: true }));
  }

  function formatThaiDate(iso) {
    if (!iso) return '-';
    const parts = String(iso).split('-');
    if (parts.length !== 3) return iso;
    const [y, m, d] = parts;
    return `${d}/${m}/${parseInt(y, 10) + 543}`;
  }

  function show(features) {
    init();
    allData = features || [];
    filterTab(activeTab);
    panel.classList.add('open');
  }

  function hide() { if (panel) panel.classList.remove('open'); hideListeners.forEach(fn => { try { fn(); } catch (e) { console.error(e); } }); }

  // ช่องในส่วนหัวสำหรับปุ่มเสริม (ใช้โดย bridge_alert.js) · onHide: แจ้งเมื่อแผงถูกปิด
  function headerSlot() { init(); return document.getElementById('bridge-alert-slot'); }
  function onHide(fn) { hideListeners.push(fn); }

  function filterTab(tab) {
    activeTab = tab;
    panel.querySelectorAll('.bridge-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    const data = (tab === 'all' ? allData.slice() : allData.filter(f => f.sourceId === tab))
      .sort((a, b) => String(a.sta).localeCompare(String(b.sta), 'th', { numeric: true }));
    const withDate = data.find(f => f.updatedDate);
    subtitle.textContent = `Update : ${withDate ? formatThaiDate(withDate.updatedDate) : '-'}`;
    render(data);
  }

  const BADGE = {
    0: '<span style="color:#dc3545">รอ</span>',
    1: '<span style="color:#f59e0b">กำลังทำ</span>',
    2: '<span style="color:#10b981">เสร็จ</span>'
  };

  function render(data) {
    tbody.innerHTML = '';
    if (!data.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #adb5bd; padding: 20px;">ไม่พบข้อมูล</td></tr>`;
      return;
    }
    data.forEach((f, i) => {
      const p = f.properties || {};
      const hasProgress = f.values && f.values.length > 0;
      let details = '<span style="color:#adb5bd; font-style: italic;">ไม่พบข้อมูล</span>';
      if (hasProgress && f.activeFields && f.activeFields.length) {
        const arr = [];
        f.activeFields.forEach((field, k) => {
          if (!field.startsWith('//')) arr.push(`<b>${esc(field)}:</b> ${BADGE[f.values[k] ?? 0] || BADGE[0]}`);
        });
        if (arr.length) details = arr.join(' | ');
      }
      const pctText  = hasProgress ? `${Number(f.pct).toFixed(1)}%` : 'N/A';
      const pctColor = hasProgress ? (f.pct === 100 ? '#10b981' : (f.pct === 0 ? '#BCBAC7' : '#e9b76f')) : '#adb5bd';
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${i + 1}</td>
        <td style="font-weight: bold; color: ${f.textColor || '#000'};">${esc(f.sta)}</td>
        <td><div class="span-text-clamp">${esc(p.Span || '-')}</div></td>
        <td>${p.Length ? esc(p.Length) + ' ม.' : '-'}</td>
        <td style="font-weight: bold; color: ${pctColor};">${pctText}</td>
        <td><div class="progress-text-clamp">${details}</div></td>`;
      tr.addEventListener('click', () => BPNP.layers.bridge.goTo(f));
      tbody.appendChild(tr);
    });
  }

  BPNP.layers.bridgePanel = { show, hide, filterTab, headerSlot, onHide, get data() { return allData; } };
  window.bridgePanel = BPNP.layers.bridgePanel;   // ชื่อเดิม
})();
