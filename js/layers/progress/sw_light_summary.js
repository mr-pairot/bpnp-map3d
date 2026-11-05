/* js/layers/progress/sw_light_summary.js
 * แผงสรุปกราฟความก้าวหน้า SW - Color Light (คัดลอกจาก BPNP_Map_Demo js/sw_light_summary_panel.js — ไม่มีโค้ดแผนที่) */
/* sw_light_summary_panel.js */
'use strict';
/* ปรับปรุงจาก sw_summary_panel.js สำหรับระบบ Signalling - Light
   - jobTypes ลดจาก 8 เหลือ 4 ขั้น: footing, poring_concrete, ins_sig, wiring
   - ใช้สี CSS variable ชุดใหม่ --sw-light-status-1..4
   - Sta เป็น string อยู่แล้ว จึงแปลงเฉพาะตอนเปรียบเทียบหาค่า min/max
*/

function getCssVariableLight(varName) {
    return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
}

class SWLightSummaryPanel {
    constructor() {
        this.isInitialized = false;
        this.panel = null;
        this._renderTimeout = null;
        this.jobTypes = [
            { key: 'footing',          name: 'Footing',          color: getCssVariableLight('--sw-light-status-1') },
            { key: 'poring_concrete',  name: 'Poring Concrete',  color: getCssVariableLight('--sw-light-status-2') },
            { key: 'ins_sig',          name: 'Install Signal',   color: getCssVariableLight('--sw-light-status-3') },
            { key: 'wiring',           name: 'Wiring',           color: getCssVariableLight('--sw-light-status-4') }
        ];
    }

    init() {
        if (this.isInitialized) return;

        const style = document.createElement('style');
        style.innerHTML = `
            #sw-light-summary-panel {
                position: fixed;
                top: 5px;
                right: 9px;
                width: 330px;
                background-color: #ffffff;
                border: 1px solid #1a4971;
                border-radius: 8px;
                box-shadow: 0 4px 15px rgba(0,0,0,0.2);
                font-family: 'Sarabun', sans-serif;
                z-index: 1000;

                max-height: 33vh;
                display: flex;
                flex-direction: column;

                transform-origin: top;
                transform: scaleY(0);
                opacity: 0;
                transition: transform 0.35s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.3s ease;
                pointer-events: none;
            }
            #sw-light-summary-panel.sw-summary-open {
                transform: scaleY(1);
                opacity: 1;
                pointer-events: auto;
            }

            .sw-summary-header {
                background: linear-gradient(135deg, #021f59 0%, #035aa7 100%);
                color: white;
                padding: 10px 14px;
                border-radius: 7px 7px 0 0;
                display: flex;
                justify-content: space-between;
                align-items: center;
                z-index: 2;
            }

            .sw-summary-title-main {
                font-size: 13px;
                font-weight: bold;
                display: flex;
                align-items: center;
            }

            .sw-summary-close-btn {
                background: transparent; border: none; color: white;
                font-size: 20px; cursor: pointer; line-height: 1;
                position: absolute; top: -2px; right: 6px;
            }
            .sw-summary-close-btn:hover { color: #dc3545;}

            .sw-summary-body {
                padding: 9px 7px;
                overflow: hidden;
                display: flex;
                flex-direction: column;
                flex-grow: 1;

                transform-origin: top;
                transform: scaleY(1);
                opacity: 1;
                transition: transform 0.25s cubic-bezier(0.25, 1, 0.5, 1), opacity 0.2s ease;
            }

            .sw-summary-body.sw-content-changing {
                transform: scaleY(0);
                opacity: 0;
            }

            .sw-summary-range {
                font-size: 13px; font-weight: 600; color: #0d2b45;
                margin-bottom: 8px;
                line-height: 1.4;
            }

            .sw-sum-table {
                display: flex;
                flex-direction: column;
                margin-bottom: 5px;
                border: 1px solid #eeeeee;
                border-radius: 6px;
                overflow-x: hidden;
                overflow-y: auto;
                scrollbar-width: thin;
            }
            .sw-sum-table::-webkit-scrollbar {
                width: 6px;
            }
            .sw-sum-table::-webkit-scrollbar-thumb {
                background-color: #cbd5e0;
                border-radius: 3px;
            }
            .sw-sum-row {
                display: grid;
                grid-template-columns: 95px 1fr 1fr 1fr 60px;
                align-items: center;
                border-bottom: 1px solid #eeeeee;
                background: #fff;
            }
            .sw-sum-row:last-child {
                border-bottom: none;
            }
            .sw-sum-header-row {
                position: sticky;
                top: 0;
                z-index: 2;
                background: #f8f9fa;
                font-weight: 700;
                color: #0d2b45;
                font-size: 11px;
                text-align: center;
                border-bottom: 2px solid #e0e0e0;
            }
            .sw-sum-cell {
                padding: 6px 4px;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                text-align: center;
            }
            .sw-sum-cell.job-title {
                padding-left: 8px;
                font-weight: 600;
                color: #333;
                font-size: 11px;
            }

            .sw-sum-val-count { font-size: 12px; font-weight: 600; line-height: 1.2; }
            .sw-sum-val-pct { font-size: 10px; color: #757575; line-height: 1.2; }

            #sw-light-sum-list {
                overflow-y: auto;
                flex-grow: 1;
                min-height: 50px;
                scrollbar-width: thin;
            }
            #sw-light-sum-list::-webkit-scrollbar { width: 6px; }
            #sw-light-sum-list::-webkit-scrollbar-thumb { background-color: #ccc; border-radius: 3px; }

            .val-wait { color: #757575; }
            .val-doing { color: #ff9800; }
            .val-done { color: #4caf50; }

            .sw-bar-wrapper {
                display: flex; align-items: center; width: 100%; gap: 4px; padding-right: 4px;
            }
            .sw-bar-bg {
                flex-grow: 1; height: 6px; background: #e0e0e0; border-radius: 3px;
                overflow: hidden; position: relative;
            }
            .bp-bar-fill {
                height: 100%; background: #2196f3; border-radius: 3px;
                width: 0%; position: relative;
                animation: bp-fill-bar 0.9s cubic-bezier(.4,0,.2,1) forwards;
            }
            .bp-bar-fill::after {
                content: ""; position: absolute; top:0; left:0; right:0; bottom:0;
                background: linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent);
                animation: bp-shine 1.2s ease-out 0.4s forwards;
            }
            .sw-bar-text {
                font-size: 13px; font-weight: 600; color: #0d2b45;
                width: 26px; text-align: right; font-variant-numeric: tabular-nums;
            }

            @keyframes bp-fill-bar { from { width: 0%; } to { width: var(--target-width, 0%); } }
            @keyframes bp-shine { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }

            .sw-summary-updatedate { font-size: 10px; color: #757575; text-align: right; }

            .sw-tab-dropdown {
                background-color: rgba(255, 255, 255, 0.95);
                color: #021f59;
                padding: 2px 22px 2px 8px;
                border-radius: 12px;
                font-size: 13px;
                font-weight: 600;
                margin-left: 8px;
                border: 1px solid rgba(0, 0, 0, 0.1);
                outline: none;
                cursor: pointer;
                appearance: none;
                -webkit-appearance: none;
                background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23021f59'%3E%3Cpath d='M7 10l5 5 5-5z'/%3E%3C/svg%3E");
                background-repeat: no-repeat;
                background-position: right 4px center;
                background-size: 18px;
                font-family: 'Sarabun', sans-serif;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                transition: all 0.2s ease;
                max-width: 195px;
                text-overflow: ellipsis;
            }
            .sw-tab-dropdown:hover {
                background-color: #ffffff;
                box-shadow: 0 2px 6px rgba(0,0,0,0.15);
            }
            .sw-tab-dropdown:focus {
                box-shadow: 0 0 0 2px rgba(2, 31, 89, 0.4);
            }
        `;
        document.head.appendChild(style);

        const panelHTML = `
            <div id="sw-light-summary-panel">
                <div class="sw-summary-header">
                    <div class="sw-summary-title-main">
                        สรุป Light ช่วง
                        <select id="sw-light-sum-dropdown" class="sw-tab-dropdown"></select>
                    </div>
                    <button class="sw-summary-close-btn" onclick="swLightSummary.hide()">&times;</button>
                </div>
                <div class="sw-summary-body" id="sw-light-summary-body-el">
                    <div class="sw-summary-range" id="sw-light-sum-range">จากกม. - ถึงกม. -<br>จำนวน 0 แห่ง</div>
                    <div class="sw-sum-table" id="sw-light-sum-list"></div>
                    <div class="sw-summary-updatedate" id="sw-light-sum-updatedate">อัปเดทวันที่ -</div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', panelHTML);

        this.panel = document.getElementById('sw-light-summary-panel');
        this.elBody = document.getElementById('sw-light-summary-body-el');
        this.elRange = document.getElementById('sw-light-sum-range');
        this.elList = document.getElementById('sw-light-sum-list');
        this.elUpdateDate = document.getElementById('sw-light-sum-updatedate');

        this.isInitialized = true;
    }

    // แปลง Sta string "2+002" ให้เป็นตัวเลข (เมตร) สำหรับเปรียบเทียบ min/max
    _parseSta(staValue) {
        if (staValue === undefined || staValue === null) return null;
        if (typeof staValue === 'number') return staValue;
        const str = String(staValue).trim();
        const parts = str.split('+');
        if (parts.length !== 2) {
            const n = parseFloat(str);
            return isNaN(n) ? null : n;
        }
        const km = parseFloat(parts[0]);
        const m = parseFloat(parts[1]);
        if (isNaN(km) || isNaN(m)) return null;
        return km * 1000 + m;
    }

    _formatThaiDate(isoDate) {
        if (!isoDate || isoDate === '-') return '-';
        const parts = isoDate.split('-');
        if (parts.length !== 3) return isoDate;
        const [y, m, d] = parts;
        return `${d}/${m}/${parseInt(y, 10) + 543}`;
    }

    _populateDropdown() {
        const dropdown = document.getElementById('sw-light-sum-dropdown');
        if (!dropdown) return;

        dropdown.innerHTML = '';
        let html = `<option value="all">ทั้งหมด</option>`;

        if (window.swLightPanel && window.swLightPanel.allData) {
            const prefixes = new Set();
            window.swLightPanel.allData.forEach(item => {
                if (item.data && item.data.Station) {
                    prefixes.add(String(item.data.Station).toUpperCase());
                }
            });

            const nameOrder = window.SW_STATION_NAMES ? Object.keys(window.SW_STATION_NAMES) : [];
            const orderedPrefixes = [];

            nameOrder.forEach(code => {
                if (prefixes.has(code)) {
                    orderedPrefixes.push(code);
                    prefixes.delete(code);
                }
            });

            Array.from(prefixes).sort().forEach(code => orderedPrefixes.push(code));

            orderedPrefixes.forEach(prefix => {
                const fullName = (window.SW_STATION_NAMES && window.SW_STATION_NAMES[prefix]) || prefix;
                html += `<option value="${prefix}">${prefix} - ${fullName}</option>`;
            });
        }

        dropdown.innerHTML = html;

        dropdown.onchange = (e) => {
            const val = e.target.value;
            if (window.swLightPanel) {
                window.swLightPanel.filterTab(val);
            }
        };
    }

    show(tabName, updateDate, currentData) {
        if (!this.isInitialized) this.init();

        if (this._renderTimeout) {
            clearTimeout(this._renderTimeout);
            this._renderTimeout = null;
        }

        if (!currentData || currentData.length === 0) {
            this.hide();
            return;
        }

        const renderDataContent = () => {
            const dropdown = document.getElementById('sw-light-sum-dropdown');
            if (dropdown) {
                if (dropdown.options.length <= 1) this._populateDropdown();
                const targetValue = tabName === 'ทั้งหมด' ? 'all' : tabName;
                dropdown.value = targetValue;
            }

            const totalItems = currentData.length;
            let minStaNum = Infinity;
            let maxStaNum = -Infinity;
            let strMinSta = '-';
            let strMaxSta = '-';

            currentData.forEach(item => {
                const staStr = item.data?.Sta;
                const staNum = this._parseSta(staStr);
                if (staNum !== null) {
                    if (staNum < minStaNum) { minStaNum = staNum; strMinSta = staStr; }
                    if (staNum > maxStaNum) { maxStaNum = staNum; strMaxSta = staStr; }
                }
            });

            const stats = {};
            this.jobTypes.forEach(job => stats[job.key] = { doing: 0, done: 0 });

            currentData.forEach(item => {
                const progress = item.data?.progress;
                if (progress) {
                    this.jobTypes.forEach(job => {
                        const statusVal = progress[job.key];
                        if (statusVal === 1) stats[job.key].doing++;
                        else if (statusVal === 2) stats[job.key].done++;
                    });
                }
            });

            this.elRange.innerHTML = `จากกม. ${strMinSta} ถึงกม. ${strMaxSta} (จำนวน ${totalItems} แห่ง)`;
            this.elUpdateDate.textContent = `อัปเดทวันที่ ${this._formatThaiDate(updateDate)}`;

            let listHTML = `
                <div class="sw-sum-row sw-sum-header-row">
                    <div class="sw-sum-cell" style="align-items: flex-start; padding-left: 10px;">รายละเอียด</div>
                    <div class="sw-sum-cell">ยังไม่เริ่ม</div>
                    <div class="sw-sum-cell">กำลังทำ</div>
                    <div class="sw-sum-cell">แล้วเสร็จ</div>
                    <div class="sw-sum-cell">ภาพรวม</div>
                </div>
            `;

            this.jobTypes.forEach(job => {
                const doingCount = stats[job.key].doing;
                const doneCount = stats[job.key].done;
                const waitCount = totalItems - doingCount - doneCount;

                const doingPct = totalItems > 0 ? (doingCount / totalItems) * 100 : 0;
                const donePct = totalItems > 0 ? (doneCount / totalItems) * 100 : 0;
                const waitPct = totalItems > 0 ? (waitCount / totalItems) * 100 : 0;
                const overallPct = donePct;

                listHTML += `
                    <div class="sw-sum-row">
                        <div class="sw-sum-cell job-title" style="flex-direction: row; justify-content: flex-start; gap: 6px;">
                             <span style="width: 12px; height: 12px; border-radius: 3px; background-color: ${job.color}; flex-shrink: 0; box-shadow: 0 1px 2px rgba(0,0,0,0.2);"></span>
                             <span>${job.name}</span>
                        </div>
                        <div class="sw-sum-cell"><span class="sw-sum-val-count val-wait">${waitCount}</span><span class="sw-sum-val-pct">${waitPct.toFixed(1)}%</span></div>
                        <div class="sw-sum-cell"><span class="sw-sum-val-count val-doing">${doingCount}</span><span class="sw-sum-val-pct">${doingPct.toFixed(1)}%</span></div>
                        <div class="sw-sum-cell"><span class="sw-sum-val-count val-done">${doneCount}</span><span class="sw-sum-val-pct">${donePct.toFixed(1)}%</span></div>
                        <div class="sw-sum-cell" style="padding-left: 2px;">
                            <div class="sw-bar-wrapper">
                                <div class="sw-bar-bg"><div class="bp-bar-fill" style="--target-width: ${overallPct.toFixed(1)}%;" onanimationstart="window.animateSWLightNumbers && window.animateSWLightNumbers(this)"></div></div>
                                <span class="sw-bar-text" data-val="${overallPct}">${overallPct.toFixed(0)}%</span>
                            </div>
                        </div>
                    </div>
                `;
            });

            this.elList.innerHTML = listHTML;

            if (!this.panel.classList.contains('sw-summary-open')) {
                this.panel.classList.add('sw-summary-open');
            }

            if (this.elBody) {
                this.elBody.classList.remove('sw-content-changing');
            }
        };

        if (this.panel.classList.contains('sw-summary-open')) {
            if (this.elBody) {
                this.elBody.classList.add('sw-content-changing');
                this._renderTimeout = setTimeout(renderDataContent, 250);
            } else {
                renderDataContent();
            }
        } else {
            renderDataContent();
        }
    }

    hide() {
        if (this.panel) {
            this.panel.classList.remove('sw-summary-open');
        }
    }
}

window.swLightSummary = new SWLightSummaryPanel();

// ============================================================================
// Animation Helper: รันตัวเลขทศนิยมภาพรวม (Light)
// ============================================================================
window.animateSWLightNumbers = function (element) {
    const wrap = element.closest('.sw-bar-wrapper');
    if (!wrap) return;

    if (wrap.dataset.animating) return;
    wrap.dataset.animating = 'true';

    const textEl = wrap.querySelector('.sw-bar-text');
    if (!textEl) return;

    const target = parseFloat(textEl.getAttribute('data-val'));
    if (isNaN(target)) return;

    textEl.textContent = '0%';

    const duration  = 900;
    const startTime = performance.now();

    function update(now) {
        const timeProgress = Math.min((now - startTime) / duration, 1);
        const easeProgress = 1 - Math.pow(1 - timeProgress, 3);

        textEl.textContent = (target * easeProgress).toFixed(0) + '%';

        if (timeProgress < 1) {
            requestAnimationFrame(update);
        } else {
            textEl.textContent = target.toFixed(0) + '%';
        }
    }

    requestAnimationFrame(update);

    setTimeout(() => { if (wrap) delete wrap.dataset.animating; }, 1000);
};

