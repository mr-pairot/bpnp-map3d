/* js/layers/structure/bridge.js
 * ─────────────────────────────────────────────────────────────────────────
 * เฟส 4A: สะพาน (สะพานเหล็ก / สะพานคอนกรีต / Overpass) — เดิม BridgeLayerManager3.js
 *
 * การแสดงผลตามซูม (ซูม Leaflet ในวงเล็บ)
 *   ≥ 10 (11)       : จุดวงกลม สีตามชนิด · ขอบสีตาม % ความคืบหน้า
 *   12–15 (13–<16)  : ป้ายชื่อหมุน 90° (ชนิด + กม.)
 *   ≥ 15 (16)       : รูปสะพาน
 *   คลิก → การ์ดความคืบหน้า (จริง vs แผน, รายองค์ประกอบ, วันที่อัปเดต, YouTube)
 *
 * ส่วนตั้งค่า / สไตล์การ์ด / buildProgressHTML คัดลอกจากต้นฉบับโดยไม่แก้ (ไม่มีโค้ด Leaflet)
 * ข้อมูล: data/geojson/structure/bridge_sb|bridge_cb|overpass + data/json/bridge_progress.json
 * ───────────────────────────────────────────────────────────────────────── */
'use strict';

const BRIDGE_SETTINGS = {
    templates: {
        concrete: [
            'Pile', 'Footing', 'Column', 'I-Girder', 'Slab',
            'Handrail', 'Slope Protection', 'Approach Slab',
        ],
        steel: [
            'Pile', 'Footing', 'Column', 'Truss',
            'แผ่นป้าย', 'Slope Protection', 'Approach Slab',
        ],
        overpass: [
            'Pile', 'Footing', 'Column', 'Cross Beam', 'I-Girder', 'Slab',
            'Barrier', 'Transition',
            '//Approach Slab', 'Drainage', '//Electrical System', '//Traffic Sign',
        ],
        viaduct: [
            'Pile', 'Footing', 'Column', 'Cross Beam', 'I-Girder', 'Slab',
            'Truss', 'แผ่นป้าย', 'Slope Protection', 'Approach Slab',
        ],
    },

    sources: [
        {
            id:          'steel_bridge',
            name:        'สะพานเหล็ก (Steel Bridge)',
            geojson:     'data/geojson/structure/bridge_sb.geojson',
            progressUrl: 'data/json/bridge_progress.json',
        },
        {
            id:          'concrete_bridge',
            name:        'สะพานคอนกรีต (Concrete Bridge)',
            geojson:     'data/geojson/structure/bridge_cb.geojson',
            progressUrl: 'data/json/bridge_progress.json',
        },
        {
            id:          'overpass',
            name:        'สะพานข้ามทางรถไฟ (Overpass)',
            geojson:     'data/geojson/structure/overpass.geojson',
            progressUrl: 'data/json/bridge_progress.json',
        },
    ],

    colors: {
        bgMain:      '#0d2b45',
        bgSummary:   'rgba(0,0,0,0.4)',
        borderMain:  'rgba(255,255,255,0.15)',
        divider:     'rgba(255,255,255,0.1)',

        textTitle:   'rgba(255,255,255,0.8)',
        textSub:     'rgba(255,255,255,0.6)',
        textNormal:  'rgba(255,255,255,0.85)',
        textPlan:    '#fdba74',

        status0_dot:    'rgba(255,255,255,0.2)',
        status0_text:   'rgba(255,255,255,0.4)',
        status0_bg:     'transparent',
        status0_border: 'rgba(255,255,255,0.2)',

        status1_main:   '#fcd34d',
        status1_glow:   'rgba(252,211,77,0.7)',
        status1_bg:     'rgba(245,158,11,0.2)',
        status1_border: 'rgba(245,158,11,0.4)',

        status2_main:          '#4ade80',
        status2_dark:          '#22c55e',
        status2_gradStart:     '#16a34a',
        status2_bg:            'rgba(34,197,94,0.15)',
        status2_border:        'rgba(34,197,94,0.3)',
        status2_dark_act:      '#5B7AF5',
        status2_gradStart_act: '#5BC8F5',

        plan_gradStart: '#f5895b',
        plan_dark:      '#ea580c',

        diff_ahead:   '#4ade80',
        diff_behind:  '#f87171',
        diff_zero:    '#ffffff',

        mapSteelBridge:    '#FF8C00',
        mapConcreteBridge: '#00BFFF',
        mapOverpass:       '#8b5cf6',

        markerBorderNotStarted: '#DCDCDC',
        markerBorderInProgress: '#FFCC00',
        markerBorderHalfway:    '#CCFF33',
        markerBorderDone:       '#22c55e',

        get markerBorder0()   { return this.markerBorderNotStarted; },
        get markerBorder50()  { return this.markerBorderInProgress; },
        get markerBorder99()  { return this.markerBorderHalfway;    },
        get markerBorder100() { return this.markerBorderDone;       },
    },
};

(function injectBridgeProgressStyles() {
    if (document.getElementById('bridge-progress-style')) return;

    const C     = BRIDGE_SETTINGS.colors;
    const style = document.createElement('style');
    style.id    = 'bridge-progress-style';

    style.textContent = `
        .bp-wrap {
            margin-top:    6px;
            padding:       6px;
            margin-bottom: 6px;
            background:    ${C.bgMain};
            border-radius: 8px;
            border:        1px solid ${C.borderMain};
            font-family:   'Sarabun', sans-serif;
            box-shadow:    inset 0 2px 4px rgba(0,0,0,0.3);
        }

        .bp-header        { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
        .bp-title         { font-size: 10px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: ${C.textTitle}; }
        .bp-updated       { font-size: 9px; color: ${C.textSub}; display: flex; align-items: center; }
        .bp-updated::before {
            content: '◷';
            opacity: 0.8;
            font-size: 13px;
            margin-right: 3px;
        }

        .bp-summary-box {
            background:    ${C.bgSummary};
            border-radius: 6px;
            padding:       8px;
            border-left:   2px solid ${C.status2_dark_act};
            margin-bottom: 10px;
        }

        .bp-progress-wrapper {
            display: flex;
            gap: 10px;
            align-items: stretch;
        }

        .bp-bar-container {
            flex: 1;
            display: grid;
            grid-template-columns: auto 1fr 35px;
            align-items: center;
            gap: 5px 8px;
        }

        .bp-diff-box {
            background: rgba(255, 255, 255, 0.05);
            border-radius: 6px;
            padding: 4px 6px;
            min-width: 48px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            border: 1px solid rgba(255, 255, 255, 0.04);
            box-shadow: inset 0 1px 2px rgba(0,0,0,0.2);
            transition: all 0.3s ease;
        }

        @keyframes bp-flash-warning {
            0% {
                box-shadow: 0 0 8px rgba(248, 113, 113, 0.7), inset 0 0 4px rgba(248, 113, 113, 0.3);
                border-color: rgba(248, 113, 113, 0.8);
                background-color: rgba(248, 113, 113, 0.15);
            }
            50% {
                box-shadow: 0 0 12px rgba(251, 191, 36, 0.8), inset 0 0 6px rgba(251, 191, 36, 0.4);
                border-color: rgba(251, 191, 36, 0.9);
                background-color: rgba(251, 191, 36, 0.15);
            }
            100% {
                box-shadow: 0 0 8px rgba(248, 113, 113, 0.7), inset 0 0 4px rgba(248, 113, 113, 0.3);
                border-color: rgba(248, 113, 113, 0.8);
                background-color: rgba(248, 113, 113, 0.15);
            }
        }

        .bp-diff-box.bp-diff-box-warning {
            animation: bp-flash-warning 1.5s ease-in-out infinite;
        }

        .bp-diff-label {
            font-size: 10px;
            font-weight: 700;
            height: 12px;
            line-height: 12px;
            margin-bottom: 2px;
        }

        .bp-diff-val {
            font-family: 'Inter', sans-serif;
            font-size: 14px;
            font-weight: 700;
            line-height: 1;
        }

        .bp-bar-label { font-size: 10px; color: rgba(255,255,255,0.7); white-space: nowrap; }

        .bp-bar-bg {
            width: 30px; height: 8px;
            background: rgba(255,255,255,0.2);
            border-radius: 4px; overflow: hidden;
        }

        .bp-bar-plan-fill, .bp-bar-act-fill {
            height: 100%; border-radius: 4px; width: 0%;
            animation: bp-fill-bar 0.9s cubic-bezier(.4,0,.2,1) forwards;
        }

        .bp-bar-plan-fill { background: linear-gradient(90deg, ${C.plan_gradStart}, ${C.plan_dark}); }

        .bp-bar-act-fill {
            background: linear-gradient(90deg, ${C.status2_gradStart_act}, ${C.status2_dark_act});
            position: relative; overflow: hidden;
        }

        .bp-bar-act-fill::after {
            content: ''; position: absolute; top: 0; left: -60%; width: 60%; height: 100%;
            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent);
            opacity: 0; animation: bp-shine 1.2s ease-out 0.4s forwards;
        }

        @keyframes bp-fill-bar { from { width: 0%; } to   { width: var(--target-width, 0%); } }
        @keyframes bp-shine { 0%   { left: -60%; opacity: 0; } 50%  { opacity: 1; } 100% { left: 120%; opacity: 0; } }

        .bp-bar-val {
            font-family: 'Inter', sans-serif; font-size: 11px; font-weight: 600;
            text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap;
            justify-self: end; width: 35px;
        }

        .bp-val-plan { color: ${C.textPlan}; }
        .bp-val-act  { color: ${C.status2_gradStart_act}; }

        .color-ahead  { color: ${C.diff_ahead}; }
        .color-behind { color: ${C.diff_behind}; }
        .color-zero   { color: ${C.diff_zero}; }

        .bp-summary-footer {
            display: flex;
            justify-content: flex-end;
            align-items: center;
            font-size: 9px;
            margin-top: 8px;
            padding-top: 6px;
            border-top: 1px dashed rgba(255,255,255,0.15);
        }

        .bp-end-date { color: rgba(255,255,255,0.85); display: flex; align-items: center; gap: 4px; }

        .bp-divider { height: 1px; background: ${C.divider}; margin-bottom: 7px; }
        .bp-rows    { display: flex; flex-direction: column; gap: 4px; }
        .bp-row     { display: grid; grid-template-columns: 7px 1fr auto; align-items: center; gap: 7px; }

        .bp-dot   { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
        .bp-dot-0 { background: ${C.status0_dot}; }
        .bp-dot-1 { background: ${C.status1_main}; box-shadow: 0 0 5px ${C.status1_glow}; animation: bp-pulse 1.8s ease-in-out infinite; }
        .bp-dot-2 { background: ${C.status2_main}; }
        @keyframes bp-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }

        .bp-fname   { font-size: 11px; color: ${C.textNormal}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .bp-badge   { font-size: 9px; font-weight: 600; padding: 1.5px 5px; border-radius: 3px; min-width: 44px; text-align: center; }
        .bp-badge-0 { background: ${C.status0_bg}; color: ${C.status0_text}; border: 1px solid ${C.status0_border}; }
        .bp-badge-1 { background: ${C.status1_bg}; color: ${C.status1_main}; border: 1px solid ${C.status1_border}; }
        .bp-badge-2 { background: ${C.status2_bg}; color: ${C.status2_main}; border: 1px solid ${C.status2_border}; }

        .bp-nodata  { font-size: 11px; color: ${C.textSub}; font-style: italic; text-align: center; padding: 5px 0; }

        .bp-action-group {
            display: flex;
            flex-direction: column;
            gap: 6px;
            margin-top: 10px;
        }

         .bp-yt-btn {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            width: 100%;
            background-color: #ffffff;
            color: #374151;
            border: 1px solid rgba(239, 68, 68, 0.3);
            padding: 8px;
            border-radius: 6px;
            font-size: 11px;
            font-weight: 600;
            text-decoration: none;
            transition: all 0.2s ease;
            box-sizing: border-box;
        }

        .bp-yt-btn:hover {
            background-color: #f3f4f6;
            color: #1f2937;
            border-color: #ef4444;
        }

        .bp-yt-icon {
            width: 14px;
            height: 14px;
            fill: #ef4444;
        }

        .bp-yt-btn:hover .bp-yt-icon { fill: #dc2626; }

        .structure-popup .leaflet-popup-close-button {
            color:      #adb5bd !important;
            font-size:  26px   !important;
            line-height: 1     !important;
            padding:    0      !important;
            margin:     0      !important;
            top:        5px    !important;
            right:      15px   !important;
            background: none   !important;
            border:     none   !important;
            z-index:    10     !important;
            outline:    none   !important;
            -webkit-user-select:          none;
            user-select:                  none;
            -webkit-tap-highlight-color:  transparent !important;
        }
        .structure-popup .leaflet-popup-close-button:hover {
            color:      #dc3545 !important;
            background: none    !important;
        }
        .structure-popup .leaflet-popup-close-button:focus,
        .structure-popup .leaflet-popup-close-button:active {
            outline:    none !important;
            background: none !important;
            box-shadow: none !important;
        }
    `;

    document.head.appendChild(style);
}());

function formatThaiDate(isoDate) {
    if (!isoDate) return '';
    const [y, m, d] = isoDate.split('-');
    if (!y || !m || !d) return isoDate;
    const year = parseInt(y, 10);
    return isNaN(year) ? isoDate : `${d}/${m}/${year + 543}`;
}

function buildProgressHTML(row, displayItems, updated, sta = '', ytLink = null) {
    if (!row) {
        return `<div class="bp-wrap"><div class="bp-nodata">ไม่พบข้อมูลความก้าวหน้า</div></div>`;
    }

    const actPct  = row.pct      ?? 0;
    const planPct = row.planPct ?? actPct;
    const diff    = actPct - planPct;

    const updatedStr = updated ? formatThaiDate(updated) : '';
    const endDateStr = row.endDate ? formatThaiDate(row.endDate) : 'ระบุภายหลัง';
    const endDateAppStr = row.endDateApp ? formatThaiDate(row.endDateApp) : 'ระบุภายหลัง';

    const BADGE_LABEL = { 0: 'ยังไม่เริ่ม', 1: 'ดำเนินการ', 2: 'แล้วเสร็จ' };

    let diffLabel = '';
    let diffValStr = '±0.0%';
    let diffColorClass = 'color-zero';
    let diffBoxExtraClass = '';

    if (diff > 0) {
        diffLabel = 'เร็ว';
        diffValStr = `+${Math.abs(diff).toFixed(1)}%`;
        diffColorClass = 'color-ahead';
    } else if (diff < 0) {
        diffLabel = 'ช้า';
        diffValStr = `-${Math.abs(diff).toFixed(1)}%`;
        diffColorClass = 'color-behind';
        diffBoxExtraClass = 'bp-diff-box-warning';
    }

    const rowsHTML = displayItems.map(({ name, status }) => `
        <div class="bp-row">
            <div class="bp-dot bp-dot-${status}"></div>
            <div class="bp-fname">${name}</div>
            <div class="bp-badge bp-badge-${status}">${BADGE_LABEL[status] ?? 'ไม่ระบุ'}</div>
        </div>
    `).join('');

    let imageBtnHTML = '';
    if (window.bridgeImageManager) {
        imageBtnHTML = window.bridgeImageManager.buildImageButtonHTML(sta);
    }

    let ytBtnHTML = '';
    if (ytLink) {
        ytBtnHTML = `
            <a href="${ytLink}" target="_blank" class="bp-yt-btn">
                <svg class="bp-yt-icon" viewBox="0 0 24 24">
                    <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
                </svg>
                ดูวิดีโอความก้าวหน้าล่าสุด
            </a>
        `;
    }

    let actionGroupHTML = '';
    if (ytBtnHTML || imageBtnHTML) {
        actionGroupHTML = `
            <div class="bp-action-group">
                ${ytBtnHTML}
                ${imageBtnHTML}
            </div>
        `;
    }

    return `
        <div class="bp-wrap">
            <div class="bp-header">
                <div class="bp-title">สถานะความก้าวหน้า</div>
                ${updatedStr ? `<div class="bp-updated">${updatedStr}</div>` : ''}
            </div>

            <div class="bp-summary-box">
                <div class="bp-progress-wrapper">
                    <div class="bp-bar-container">
                        <span class="bp-bar-label">แผนงาน</span>
                        <div class="bp-bar-bg">
                            <div class="bp-bar-plan-fill" style="--target-width: ${planPct}%;" onanimationstart="window.animateBridgeNumbers && window.animateBridgeNumbers(this)"></div>
                        </div>
                        <span class="bp-bar-val bp-val-plan" data-val="${planPct}">${planPct.toFixed(1)}%</span>

                        <span class="bp-bar-label">ผลงาน</span>
                        <div class="bp-bar-bg">
                            <div class="bp-bar-act-fill" style="--target-width: ${actPct}%;"></div>
                        </div>
                        <span class="bp-bar-val bp-val-act" data-val="${actPct}">${actPct.toFixed(1)}%</span>
                    </div>

                    <div class="bp-diff-box ${diffBoxExtraClass}">
                        <div class="bp-diff-label ${diffColorClass}">${diffLabel}</div>
                        <div class="bp-diff-val ${diffColorClass}">${diffValStr}</div>
                    </div>
                </div>

                <div class="bp-summary-footer" style="flex-direction: column; align-items: flex-start; gap: 5px;">
                    <div style="font-weight: 700; color: #fcd34d; letter-spacing: 0.5px; width: 100%; text-align: left;">
                        🏁 แผนแล้วเสร็จ (แผนเร่งรัด)
                    </div>
                    <div style="display: flex; gap: 19px; background: rgba(0,0,0,0.3); padding: 0px 8px 0px 10px; border-radius: 4px; width: 100%;">
                        <div class="bp-end-date">สะพาน : <br>${endDateStr}</div>
                        <div class="bp-end-date">คอสะพาน : <br>${endDateAppStr}</div>
                    </div>
                </div>

            </div>

            <div class="bp-divider"></div>
            <div class="bp-rows">${rowsHTML}</div>

            ${actionGroupHTML}
        </div>
    `;
}

window.animateBridgeNumbers = function (element) {
    const wrap = element.closest('.bp-wrap');
    if (!wrap) return;

    if (wrap.dataset.animating) return;
    wrap.dataset.animating = 'true';

    const els = wrap.querySelectorAll('.bp-bar-val');

    els.forEach(el => {
        const target = parseFloat(el.getAttribute('data-val'));
        if (isNaN(target)) return;

        el.textContent = '0.0%';

        const duration  = 900;
        const startTime = performance.now();

        function update(now) {
            const timeProgress = Math.min((now - startTime) / duration, 1);
            const easeProgress = 1 - Math.pow(1 - timeProgress, 3);
            el.textContent = (target * easeProgress).toFixed(1) + '%';
            if (timeProgress < 1) {
                requestAnimationFrame(update);
            } else {
                el.textContent = target.toFixed(1) + '%';
            }
        }

        requestAnimationFrame(update);
    });

    setTimeout(() => { if (wrap) delete wrap.dataset.animating; }, 1000);
};

/* ════════════════════════════════════════════════════════════════════════
 * ส่วนแผนที่ (เขียนใหม่สำหรับ MapLibre — เดิม class BridgeLayerManager)
 * ════════════════════════════════════════════════════════════════════════ */
(function () {
  const U = BPNP.layers.utils;
  const esc = BPNP.escapeHtml;
  const C = BRIDGE_SETTINGS.colors;

  const Z_POINT = U.z(11), Z_LABEL = U.z(13), Z_PATH = U.z(16);
  const SRC = 'src-bridge', SRC_PT = 'src-bridge-pt';

  const features = [];      // ข้อมูลสะพานทั้งหมด (ใช้ร่วมกับแผงตาราง / แจ้งเตือนล่าช้า / ป้ายความสูง)
  const outlines = [];      // เส้นขอบแยก (_outline) จากตอน build — วาดเป็นเส้นอย่างเดียว
  let loading = null, labels = null, ytLinks = {};

  const normalizeSta   = s => (s ? String(s).replace(/\s+/g, '').toLowerCase().replace(/km\.?/g, '').split('.')[0] : '');
  const normalizeYtKey = s => (s ? String(s).replace(/กม\.?/g, '').replace(/\s+/g, '').trim() : '');
  const removeParens   = s => (s ? String(s).replace(/\([^)]*\)/g, '').replace(/\s{2,}/g, ' ').trim() : '-');

  function fillColor(sourceId, isSteel) {
    if (sourceId === 'overpass') return C.mapOverpass;
    return isSteel ? C.mapSteelBridge : C.mapConcreteBridge;
  }
  function borderColor(pct) {
    if (pct === 100) return C.markerBorderDone;
    if (pct > 50)    return C.markerBorderHalfway;
    if (pct > 0)     return C.markerBorderInProgress;
    return C.markerBorderNotStarted;
  }
  function displayItems(typeKey, templates, row, sta) {
    const original = templates[typeKey] || [];
    return (BRIDGE_SETTINGS.templates[typeKey] || []).reduce((acc, name) => {
      if (name.startsWith('//')) return acc;
      const i = original.indexOf(name);
      if (i === -1) { BPNP.log(`[Missing Data] กม. ${sta}: ไม่พบ "${name}" ใน JSON`); return acc; }
      acc.push({ name, status: (row && row.values && row.values[i]) ?? 0 });
      return acc;
    }, []);
  }
  function detailHtml(sourceId, sta, span, length, roadway, agency) {
    if (sourceId === 'overpass') {
      return `<div class="structure-popup-detail">
                <b>กม.:</b> ${esc(removeParens(sta))}<br>
                <b>ขนาด:</b> ${esc(span)} = ${esc(removeParens(length))} ม.<br>
                <b>ทางกว้าง:</b> ${esc(removeParens(roadway))} ม.<br>
                <b>หน่วยงาน:</b> ${esc(removeParens(agency))}
              </div>`;
    }
    return `<div class="structure-popup-detail"><b>กม. :</b> ${esc(sta)}<br><b>ขนาด:</b> ${esc(span)} = ${esc(length)} ม.</div>`;
  }

  async function loadAll() {
    if (loading) return loading;
    loading = (async () => {
      try {
        const raw = await BPNP.core.dataCache.getJSON('data/json/video_links.json');
        Object.entries(raw || {}).forEach(([k, v]) => { ytLinks[normalizeYtKey(k)] = v; });
      } catch (e) { console.warn('[Bridge] โหลดลิงก์ YouTube ไม่สำเร็จ', e); }

      for (const source of BRIDGE_SETTINGS.sources) {
        let progress = { rows: [], templates: {}, updated: '' };
        try { progress = await BPNP.core.dataCache.getJSON(source.progressUrl); } catch (e) { console.warn('[Bridge] อ่านความคืบหน้าไม่สำเร็จ', e); }
        const progressMap = {};
        (progress.rows || []).forEach(r => { progressMap[normalizeSta(r.sta)] = r; });
        const templates = progress.templates || {};
        const updated = progress.updated || '';

        let fc;
        try { fc = await U.loadGeoJSON(source.geojson); } catch (e) { console.warn('[Bridge] โหลดไม่สำเร็จ:', source.geojson, e); continue; }
        (fc.features || []).forEach(f => {
          if (!f.geometry) return;
          const p = f.properties || {};
          if (p._outline) {
            const steel = source.id === 'steel_bridge' || String(p.Type || source.name).includes('Steel');
            outlines.push({ type: 'Feature', properties: { _fill: fillColor(source.id, steel), _outline: true }, geometry: f.geometry });
            return;
          }
          if (!/Polygon/.test(f.geometry.type)) return;
          const sta = p['Sta.'] || '-';
          const bridgeType = p.Type || source.name;
          const isSteel = source.id === 'steel_bridge' || String(bridgeType).includes('Steel');
          const key = normalizeSta(sta);
          const row = progressMap[key] || null;
          const pct = row?.pct ?? 0;
          const planPct = row?.planPct ?? pct;
          const color = fillColor(source.id, isSteel);
          let center = U.bboxCenter(f.geometry);
          if (source.id === 'overpass' && p.Coordinate) {
            const [la, ln] = String(p.Coordinate).split(',').map(x => parseFloat(String(x).trim()));
            if (!isNaN(la) && !isNaN(ln)) center = [ln, la];
          }
          const typeKey = row?.type ?? (source.id === 'overpass' ? 'overpass' : (isSteel ? 'steel' : 'concrete'));
          const items = displayItems(typeKey, templates, row, sta);
          const detail = detailHtml(source.id, sta, p.Span || '-', p.Length || '-', p.Roadway || '-', p.Agency || '-');
          const ytLink = ytLinks[normalizeYtKey(sta)] || null;
          const idx = features.length;
          features.push({
            idx, properties: p, geometry: f.geometry, center, textColor: color, border: borderColor(pct),
            sta, bridgeType, sourceId: source.id, pct, planPct,
            endDate: row?.endDate ?? null, values: row?.values ?? [],
            activeFields: BRIDGE_SETTINGS.templates[typeKey] || [], updatedDate: updated,
            heightLimit: row?.height_limit ?? null,
            popupHtml: () => `
              <div class="structure-popup-title" style="color:${color}; border-bottom-color:${color};">${esc(bridgeType)}</div>
              ${detail}
              ${buildProgressHTML(row, items, updated, key, ytLink)}`
          });
        });
      }
      return features;
    })().catch(err => { loading = null; throw err; });
    return loading;
  }

  function openPopup(f, at) {
    BPNP.map.popup.open(at || f.center, f.popupHtml(), { className: 'structure-popup bridge-popup', maxWidth: '230px' });
  }

  // ป้ายชื่อหมุน 90° (เดิม _getOrCreateLabel) — element รากขนาด 0 ไม่มี position (กติกาหัวข้อ 19)
  function labelElement(f) {
    const el = document.createElement('div');
    el.className = 'structure-label bridge-label';
    el.style.width = '0'; el.style.height = '0';
    el.innerHTML = `
      <div style="position:absolute; left:0; top:0; transform-origin:0 0; transform:rotate(-90deg) translate(15px, -50%); white-space:nowrap;">
        <div class="rotate-inner" style="position:relative; border-left:5px solid ${f.textColor}; border-bottom:1px solid #999; padding:2px 5px; background-color:rgba(255,255,255,0.9); transform:none !important;">
          <div style="position:absolute; top:50%; left:-11px; transform:translateY(-50%); border-width:6px 6px 6px 0; border-style:solid; border-color:transparent ${f.textColor} transparent transparent;"></div>
          <b>${esc(f.bridgeType)}</b><br>กม. ${esc(f.sta)}
        </div>
      </div>`;
    return el;
  }

  // บินไปที่สะพาน + เปิด popup (ใช้จากแผงตาราง)
  function goTo(f) {
    const map = BPNP.map.instance;
    BPNP.map.popup.close();
    map.jumpTo({ center: f.center, zoom: U.z(18) });
    setTimeout(() => openPopup(f), 300);
  }

  function register(map) {
    BPNP.map.registry.register('layer_bridge', {
      slot: 'structure',
      build: async () => {
        await loadAll();
        labels = U.htmlMarkerSet(map, {
          items: features.map(f => ({ lngLat: f.center, f })),
          variant: z => (z >= Z_LABEL && z < Z_PATH ? 'label' : null),
          create: it => ({ element: labelElement(it.f), anchor: 'center' })
        });
        const polys = features.map(f => ({ type: 'Feature', properties: { _idx: f.idx, _fill: f.textColor, _fillOnly: !!f.properties._fillOnly }, geometry: f.geometry }))
          .concat(outlines);
        const pts = features.map(f => ({ type: 'Feature', properties: { _idx: f.idx, _fill: f.textColor, _border: f.border }, geometry: { type: 'Point', coordinates: f.center } }));
        return {
          sources: {
            [SRC]:    { type: 'geojson', data: { type: 'FeatureCollection', features: polys } },
            [SRC_PT]: { type: 'geojson', data: { type: 'FeatureCollection', features: pts } }
          },
          layers: [
            { id: SRC + '-fill', type: 'fill', source: SRC, minzoom: Z_PATH, filter: ['!=', ['get', '_outline'], true], paint: { 'fill-color': ['get', '_fill'], 'fill-opacity': 0.3 } },
            { id: SRC + '-line', type: 'line', source: SRC, minzoom: Z_PATH, filter: ['!=', ['get', '_fillOnly'], true],
              paint: { 'line-color': ['get', '_fill'], 'line-width': 1, 'line-opacity': 1 } },
            { id: SRC_PT + '-circle', type: 'circle', source: SRC_PT, minzoom: Z_POINT,
              paint: { 'circle-radius': 7, 'circle-color': ['get', '_fill'], 'circle-opacity': 0.95,
                       'circle-stroke-color': ['get', '_border'], 'circle-stroke-width': 3, 'circle-stroke-opacity': 1 } }
          ]
        };
      },
      afterBuild: () => {
        // วงกลมอยู่บนรูปสะพาน → ตรวจก่อน · popup ที่วงกลมเปิดที่จุดศูนย์กลาง / ที่รูปเปิดที่จุดคลิก (เหมือนเดิม)
        map.on('click', e => {
          if (!BPNP.map.registry.isVisible('layer_bridge') || BPNP.tools.isBusy()) return;
          if (BPNP.map.hit3d && BPNP.map.hit3d(e.point)) return;                   // โดนรูป 3D (สะพาน 3D เปิดการ์ดเองใน bridge_3d.js)
          const hits = map.queryRenderedFeatures(e.point, { layers: [SRC_PT + '-circle', SRC + '-fill'] });
          if (!hits.length) return;
          const f = features[hits[0].properties._idx];
          if (f) openPopup(f, hits[0].layer.id.endsWith('-circle') ? f.center : [e.lngLat.lng, e.lngLat.lat]);
        });
        [SRC_PT + '-circle', SRC + '-fill'].forEach(lid => {
          map.on('mouseenter', lid, () => { map.getCanvas().style.cursor = 'pointer'; });
          map.on('mouseleave', lid, () => { map.getCanvas().style.cursor = ''; });
        });
      },
      onShow: () => {
        if (labels) labels.setEnabled(true);
        if (BPNP.layers.bridgePanel) BPNP.layers.bridgePanel.show(features);
        if (BPNP.layers.bridgeAlert) BPNP.layers.bridgeAlert.setAvailable(true);
        BPNP.auth && BPNP.auth.logUserEvent('Open Layer', 'เปิดเลเยอร์ สะพาน');
      },
      onHide: () => {
        if (labels) labels.setEnabled(false);
        if (BPNP.layers.bridgePanel) BPNP.layers.bridgePanel.hide();
        if (BPNP.layers.bridgeAlert) BPNP.layers.bridgeAlert.setAvailable(false);
      }
    });

    // ป้ายความสูงสะพาน: ใต้วงกลม (เดิม anchorY = −(circleRadius 7 + gap 4))
    if (BPNP.layers.heightSigns) {
      BPNP.layers.heightSigns.registerGroup('bridge', async () => {
        await loadAll();
        return features.filter(f => f.heightLimit).map(f => ({ lngLat: f.center, size: String(f.heightLimit) }));
      }, { anchorY: -(7 + 4) });

      // ป้ายความสูงภาคสนาม (เดิม mark_Sign.js → SignLayerManager) — data/json/height_signs.json 64 ป้าย
      // วางตาม STA + offset · offset < 0 ป้ายอยู่เหนือจุด (anchorY 44) / อื่น ๆ ใต้จุด (−10) · status 0 = ตัวเลขแดง
      BPNP.layers.heightSigns.registerGroup('field', async () => {
        await BPNP.alignment.load();
        const list = await BPNP.core.dataCache.getJSON('data/json/height_signs.json');
        const esc = BPNP.escapeHtml;
        return (list || []).map(sg => {
          const p = BPNP.alignment.pointAt(Number(sg.sta), Number(sg.offset) || 0);
          if (!p) { console.warn('[FieldSigns] ไม่พบ STA ในแนวทาง:', sg.sta); return null; }
          const below = !(Number(sg.offset) < 0);
          return {
            lngLat: [p.lng, p.lat], size: sg.height, status: sg.status,
            anchorY: below ? -10 : 44,
            title: sg.description ? `<b>STA:</b> ${esc(sg.sta)}<br><b>Offset:</b> ${esc(sg.offset)} ม.<br>${BPNP.safeHtml(sg.description)}` : null,
            titleBelow: below
          };
        }).filter(Boolean);
      });
    }
  }

  BPNP.layers.bridge = { loadAll, goTo, openPopup, get features() { return features; } };
  U.register({ name: 'bridge', register });
})();
