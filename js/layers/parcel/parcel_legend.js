/* js/layers/parcel/parcel_legend.js
 * ─────────────────────────────────────────────────────────────────────────
 * Legend "ข้อมูลพื้นที่เวนคืน" (เดิม addPolygonLandLegend ใน setPatternLegend.js)
 *   - ย่อ/ขยาย (จำสถานะไว้ในเครื่อง ค่าเริ่มต้น = ย่อ)
 *   - จำนวนแปลง + พื้นที่ ตามสถานะหน้างาน (StatusWork)
 *   - [รายละเอียด] ของสถานะ 0, 2, 81, 82, 91, 92 → รายการรหัสแปลง + แผงตารางด้านล่าง
 *
 *   BPNP.layers.parcelLegend.create(features, { onSelect(item), onShowList(title, items), onHideList() }) → element
 * ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  const esc = BPNP.escapeHtml;
  const STATE_KEY = 'legend_collapsed';
  const CLICKABLE = ['0', '2', '81', '82', '91', '92'];

  function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function create(features, handlers = {}) {
    const C = BPNP.layers.parcelColors;
    // ── สรุปข้อมูล ──
    const summary = {};
    const lists = {};
    CLICKABLE.forEach(k => { lists[k] = []; });
    const dates = new Set();
    features.forEach((f, idx) => {
      const p = f.properties || {};
      const status = p.StatusWork;
      if (status !== undefined) {
        summary[status] = summary[status] || { count: 0, area: 0 };
        summary[status].count += 1;
        summary[status].area  += parseFloat(p.Area) || 0;
        if (CLICKABLE.includes(status)) lists[status].push({ code: p.Code || 'ไม่ระบุรหัส', props: p, index: idx });
      }
      if (p.update_date) dates.add(p.update_date);
    });
    CLICKABLE.forEach(k => lists[k].sort((a, b) => String(a.code).localeCompare(String(b.code), 'th')));
    const latestDate = Array.from(dates).sort().pop() || 'ไม่ระบุวันที่';

    const fmtCount = new Intl.NumberFormat('th-TH');
    const fmtArea  = new Intl.NumberFormat('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

    // ── DOM ──
    const div = document.createElement('div');
    div.className = 'info legend';
    const saved = BPNP.storage.get(STATE_KEY);
    let collapsed = saved === null ? true : saved === 'true';
    let animating = false;

    const iconBox = (color, border) => `<i style="background:${hexToRgba(color, 0.5)};border:${border};"></i>`;

    const detailList = key => {
      if (!lists[key] || !lists[key].length) return '';
      return `<div id="list-panel-${key}" class="detail-list-panel">` +
        lists[key].map((it, i) => `<span class="detail-list-item" data-status="${key}" data-i="${i}">${esc(it.code)}</span>`).join('') +
        `</div>`;
    };

    const item = (label, color, key, border, delay = 0) => {
      const d = summary[key] || { count: 0, area: 0 };
      const clickable = CLICKABLE.includes(key) && d.count > 0;
      return `
        <div class="legend-item" style="animation-delay: ${delay}s;">
          ${iconBox(color, border)}
          <div style="width: 100%;">
            <div style="margin-bottom: 2px;"><strong>${label}</strong></div>
            <div>
              <small>${fmtCount.format(d.count)} แปลง
                <span style="color: #888; font-size: 0.9em;">(${fmtArea.format(d.area)} ตร.ม.)</span>
              </small>
              ${clickable ? `<span class="detail-toggle-btn" data-target="${key}" style="margin-left: 8px; cursor: pointer; color: blue;">[รายละเอียด]</span>` : ''}
            </div>
            ${clickable ? detailList(key) : ''}
          </div>
        </div>`;
    };

    function render() {
      let html = `
        <div class="legend-header">
          <strong>ข้อมูลพื้นที่เวนคืน</strong>
          <button id="toggleLegendBtn" type="button" style="pointer-events: auto;">${collapsed ? '⏬ ขยาย' : '⏪ ย่อ'}</button>
        </div>`;
      if (!collapsed && latestDate !== 'ไม่ระบุวันที่') html += `<span class="legend-date">วันที่ ${esc(latestDate)}</span>`;

      if (collapsed) {
        html += `
          <div class="legend-collapsed-items">
            ${iconBox(C.green,  `1px solid ${C.green}`)}<span>เข้าได้</span>
            ${iconBox(C.yellow, `1px solid ${C.yellow}`)}<span>เข้าบางส่วน</span>
            ${iconBox(C.red,    `1px solid ${C.red}`)}<span>เข้าไม่ได้</span>
            ${iconBox(C.gray,   `1px solid ${C.gray}`)}<span>รอส่งมอบ</span>
          </div>`;
      } else {
        html += item('เข้าพื้นที่ได้', C.green, '1', `1px solid ${C.green}`, 0.1);
        html += item('เข้าพื้นที่ได้บางส่วน', C.yellow, '2', `1px solid ${C.yellow}`, 0.2);
        html += item('เข้าพื้นที่ไม่ได้', C.red, '0', `1px solid ${C.red}`, 0.3);
        html += '<hr class="mp-divider" style="margin-bottom:5px;">';
        html += item('รอส่งมอบ/ทำสัญญาแล้ว [เข้าแล้ว]', C.blue2, '81', `2px dashed ${C.green}`, 0.4);
        html += item('รอส่งมอบ/ทำสัญญาแล้ว [ยังไม่เข้า]', C.gray, '82', `2px dashed ${C.green}`, 0.5);
        html += item('รอส่งมอบ/ยังไม่ทำสัญญา [เข้าแล้ว]', C.blue2, '91', `2px dashed ${C.gray}`, 0.6);
        html += item('รอส่งมอบ/ยังไม่ทำสัญญา[ยังไม่เข้า]', C.gray, '92', `2px dashed ${C.gray}`, 0.7);
        html += item('รอส่งมอบ/ป่า', C.gray, '4', `2px dashed ${C.blue}`, 0.8);
      }
      div.innerHTML = html;

      if (!collapsed) {
        setTimeout(() => div.querySelectorAll('.legend-item').forEach(el => el.classList.add('animate')), 50);

        div.querySelectorAll('.detail-toggle-btn').forEach(btn => {
          btn.onclick = e => {
            e.preventDefault(); e.stopPropagation();
            const key = btn.dataset.target;
            const panel = div.querySelector(`#list-panel-${key}`);
            if (!panel) return;
            if (panel.classList.contains('show')) {
              panel.classList.remove('show');
              btn.innerText = '[รายละเอียด]';
              if (handlers.onHideList) handlers.onHideList();
            } else {
              div.querySelectorAll('.detail-list-panel.show').forEach(p => p.classList.remove('show'));
              div.querySelectorAll('.detail-toggle-btn').forEach(b => { if (b !== btn) b.innerText = '[รายละเอียด]'; });
              panel.classList.add('show');
              btn.innerText = '[ซ่อน]';
              const strong = btn.closest('.legend-item').querySelector('strong');
              if (handlers.onShowList) handlers.onShowList(strong ? strong.innerText : 'ข้อมูลที่ดิน', lists[key]);
            }
          };
        });

        div.querySelectorAll('.detail-list-item').forEach(el => {
          el.onclick = e => {
            e.preventDefault(); e.stopPropagation();
            const it = lists[el.dataset.status][Number(el.dataset.i)];
            if (it && handlers.onSelect) handlers.onSelect(it);
          };
        });
      }

      const toggle = div.querySelector('#toggleLegendBtn');
      toggle.onclick = e => {
        e.preventDefault(); e.stopPropagation();
        if (animating) return;
        animating = true;
        if (collapsed) {
          div.classList.remove('collapsed');
          div.classList.add('expanding');
          setTimeout(() => {
            collapsed = false;
            BPNP.storage.set(STATE_KEY, 'false');
            render();
            div.classList.remove('expanding');
            animating = false;
          }, 400);
        } else {
          div.classList.add('collapsing');
          div.querySelectorAll('.legend-item').forEach(el => { el.style.opacity = '0'; el.style.transform = 'translateY(-10px)'; });
          setTimeout(() => {
            collapsed = true;
            BPNP.storage.set(STATE_KEY, 'true');
            div.classList.remove('collapsing');
            div.classList.add('collapsed');
            render();
            animating = false;
          }, 200);
        }
      };
    }

    if (collapsed) div.classList.add('collapsed');
    render();
    return div;
  }

  BPNP.layers.parcelLegend = { create };
})();
