/* js/ui/bottom_panel.js
 * ─────────────────────────────────────────────────────────────────────────
 * แผงตารางด้านล่าง (เดิม js/bottomPanel.js) — ใช้แสดงรายการแปลงตามสถานะจาก legend
 *
 *   BPNP.ui.bottomPanel.show(title, items, onSelect)
 *     items:    [{ code, props }]   (props = properties ของแปลง: Code, Type, Status)
 *     onSelect: (item) => void      เรียกเมื่อกดแถว (บินไปที่แปลง + เน้น)
 *   BPNP.ui.bottomPanel.hide()
 * ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  const esc = BPNP.escapeHtml;

  let panel, titleEl, tbody;
  let data = [], onSelect = null, sortCol = null, sortDir = 'asc';

  function init() {
    if (panel) return;
    document.body.insertAdjacentHTML('beforeend', `
      <div id="bp-bottom-panel" class="bp-bottom-panel">
        <div class="bp-panel-header">
          <span id="bp-panel-title">รายละเอียดข้อมูลที่ดิน</span>
          <button class="bp-close-btn" title="ปิดหน้าต่าง" type="button">&times;</button>
        </div>
        <div class="bp-table-container">
          <table class="bp-data-table">
            <thead>
              <tr>
                <th style="width: 5%;">ลำดับ</th>
                <th style="width: 15%; cursor: pointer; user-select: none;" data-sort="code" title="คลิกเพื่อเรียงลำดับ">
                  เลขที่ดิน <span id="sort-icon-code" style="color:#adb5bd; font-size: 11px; margin-left: 4px;">⇅</span>
                </th>
                <th style="width: 15%; cursor: pointer; user-select: none;" data-sort="type" title="คลิกเพื่อเรียงลำดับ">
                  ประเภทที่ดิน <span id="sort-icon-type" style="color:#adb5bd; font-size: 11px; margin-left: 4px;">⇅</span>
                </th>
                <th style="width: 65%;">สถานะส่งมอบ</th>
              </tr>
            </thead>
            <tbody id="bp-table-body"></tbody>
          </table>
        </div>
      </div>`);
    panel   = document.getElementById('bp-bottom-panel');
    titleEl = document.getElementById('bp-panel-title');
    tbody   = document.getElementById('bp-table-body');
    panel.querySelector('.bp-close-btn').addEventListener('click', hide);
    panel.querySelectorAll('th[data-sort]').forEach(th => th.addEventListener('click', () => sortTable(th.dataset.sort)));
    ['mousedown', 'touchstart', 'wheel', 'dblclick', 'contextmenu'].forEach(ev =>
      panel.addEventListener(ev, e => e.stopPropagation(), { passive: true }));
  }

  function show(title, items, selectFn) {
    init();
    const typeCounts = {};
    items.forEach(it => { const t = it.props.Type || 'ไม่ระบุ'; typeCounts[t] = (typeCounts[t] || 0) + 1; });
    const typeSummary = Object.entries(typeCounts).map(([t, n]) => `[ ${esc(t)}= ${n} ]`).join(' , ');
    titleEl.innerHTML = `
      <div style="line-height: 1.4;">
        <div>รายการ: ${esc(title)}
          <span style="color: #6c757d; font-size: 0.9em; font-weight: normal;">(รวม ${items.length} แปลง)</span>
        </div>
        <div style="color: #6c757d; font-size: 12px; font-weight: normal; margin-top: 2px;">${typeSummary}</div>
      </div>`;
    data = items.slice();
    onSelect = selectFn;
    sortCol = null; sortDir = 'asc';
    updateSortIcons();
    render();
    panel.classList.add('open');
  }

  function sortTable(col) {
    if (sortCol === col) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
    else { sortCol = col; sortDir = 'asc'; }
    updateSortIcons();
    const key = col === 'code' ? 'Code' : 'Type';
    data.sort((a, b) => {
      const r = String(a.props[key] || '').localeCompare(String(b.props[key] || ''), 'th', { numeric: true });
      return sortDir === 'asc' ? r : -r;
    });
    render();
  }

  function updateSortIcons() {
    ['code', 'type'].forEach(c => {
      const el = document.getElementById('sort-icon-' + c);
      if (!el) return;
      const active = sortCol === c;
      el.textContent = active ? (sortDir === 'asc' ? '▲' : '▼') : '⇅';
      el.style.color = active ? '#0056b3' : '#adb5bd';
    });
  }

  function render() {
    tbody.innerHTML = '';
    data.forEach((item, i) => {
      const p = item.props;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${i + 1}</td>
        <td style="font-weight: bold; color: #0056b3;">${esc(p.Code || 'ไม่ระบุ')}</td>
        <td>${esc(p.Type || '-')}</td>
        <td><span style="padding: 2px 8px; border-radius: 12px; font-size: 12px;">${BPNP.safeHtml(p.Status || '-')}</span></td>`;
      tr.addEventListener('click', () => { if (onSelect) onSelect(item); });
      tbody.appendChild(tr);
    });
  }

  function hide() { if (panel) panel.classList.remove('open'); }

  BPNP.ui.bottomPanel = { show, hide };
  window.bpBottomPanel = BPNP.ui.bottomPanel;   // ชื่อเดิม
})();
