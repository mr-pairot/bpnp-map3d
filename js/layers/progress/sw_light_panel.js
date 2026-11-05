/* js/layers/progress/sw_light_panel.js
 * แผงตารางความก้าวหน้า SW - Color Light (เดิม BPNP_Map_Demo js/sw_light_BottomPanel.js)
 * คัดลอกเดิม แก้เฉพาะการซูมให้เห็นทั้งแท็บ และการบินไปที่ไฟสี (MapLibre) — แบบเดียวกับ sw_panel.js ของ SW-LOC
 * item.layer เป็นตัวแทนหมุดจาก sw_light.js (getLatLng / getElement / openPopup / closePopup / isPopupOpen) */
/* sw_light_BottomPanel.js */
/* ปรับปรุงจาก sw_LocBottomPanel.js สำหรับระบบ Signalling - Light
   - อ่านข้อมูลจากโครงสร้าง { Station, No, Sta, offset, Type, progress:{footing, poring_concrete, ins_sig, wiring} }
   - Sta เป็น string รูปแบบ "กม+ม" อยู่แล้ว (ไม่ต้องแปลงจากตัวเลข)
*/
class SWLightBottomPanelManager {
    constructor() {
        this.isInitialized = false;
        this.allData = [];
        this.currentData = [];
        this.currentMap = null;
        this.activeTab = 'all'; // ค่าเริ่มต้นแสดงทั้งหมด
        this.updateDate = '-';

        // ตัวแปรสำหรับเก็บ Timeout ของการกระพริบ
        this._blinkTimeout = null;
    }

    init() {
        if (this.isInitialized) return;

        const panelHTML = `
            <div id="sw-light-bottom-panel" class="sw-light-bottom-panel">
                <div class="sw-panel-header">
                    <div class="sw-panel-title-container">
                        <span class="sw-panel-title" id="light-panel-title">งาน Signalling - Colour Light</span>
                        <span class="sw-panel-title2" >[DEMO] </span>
                        <span class="sw-panel-subtitle" id="light-panel-subtitle">Update : -</span>

                        <button class="sw-close-btn" title="ปิดหน้าต่าง" onclick="swLightPanel.hide()">&times;</button>
                    </div>

                    <div class="sw-tabs-container" id="sw-light-tabs-container">
                        </div>
                </div>

                <div class="sw-table-container" >
                    <table class="sw-data-table">
                        <thead>
                            <tr>
                                <th class="sw-th-seq">ลำดับ</th>
                                <th class="sw-th-sta">Sta.</th>
                                <th class="sw-th-name">No.</th>
                                <th class="sw-th-type">Type</th>
                                <th class="sw-th-status">Status</th>
                            </tr>
                        </thead>
                        <tbody id="light-table-body"></tbody>
                    </table>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', panelHTML);

        this.panel = document.getElementById('sw-light-bottom-panel');
        this.tbody = document.getElementById('light-table-body');
        this.subtitle = document.getElementById('light-panel-subtitle');
        this.tabsContainer = document.getElementById('sw-light-tabs-container');
        this.isInitialized = true;
    }

    // แปลง Sta string "2+002" ให้เป็นตัวเลข (เมตร) สำหรับใช้เรียงลำดับ/เปรียบเทียบ
    parseSta(staValue) {
        if (staValue === undefined || staValue === null) return 0;
        if (typeof staValue === 'number') return staValue;
        const str = String(staValue).trim();
        const parts = str.split('+');
        if (parts.length !== 2) {
            const n = parseFloat(str);
            return isNaN(n) ? 0 : n;
        }
        const km = parseFloat(parts[0]) || 0;
        const m = parseFloat(parts[1]) || 0;
        return km * 1000 + m;
    }

    getStatusInfo(progress) {
        if (!progress) return { text: '-', color: '#adb5bd' };

        const getColorByStatus = (statusValue) => {
            if (statusValue === 2) return '#2e7d32'; // แล้วเสร็จ (เขียว)
            if (statusValue === 1) return '#ff9800'; // กำลังทำ (ส้ม)
            return '#9e9e9e'; // ยังไม่ทำ (เทา)
        };

        // ไล่เช็คจากขั้นตอนล่าสุดไปหาขั้นตอนแรกสุด
        if ((progress.wiring || 0) > 0) return { text: 'Wiring', color: getColorByStatus(progress.wiring) };
        if ((progress.ins_sig || 0) > 0) return { text: 'Install Signal', color: getColorByStatus(progress.ins_sig) };
        if ((progress.poring_concrete || 0) > 0) return { text: 'Poring Concrete', color: getColorByStatus(progress.poring_concrete) };
        if ((progress.footing || 0) > 0) return { text: 'Footing', color: getColorByStatus(progress.footing) };

        return { text: 'ยังไม่เริ่ม', color: '#9e9e9e' };
    }

    formatThaiDate(isoDate) {
        if (!isoDate || isoDate === '-') return '-';
        const parts = isoDate.split('-');
        if (parts.length !== 3) return isoDate;
        const [y, m, d] = parts;
        const yearBE = parseInt(y, 10) + 543;
        return `${d}/${m}/${yearBE}`;
    }

    generateTabs() {
        const prefixes = new Set();

        this.allData.forEach(item => {
            const data = item.data;
            if (data && data.Station) {
                prefixes.add(String(data.Station).toUpperCase());
            }
        });

        // เรียงลำดับ prefix ตามลำดับที่กำหนดใน window.SW_STATION_NAMES ก่อน
        const nameOrder = window.SW_STATION_NAMES ? Object.keys(window.SW_STATION_NAMES) : [];
        const orderedPrefixes = [];

        nameOrder.forEach(code => {
            if (prefixes.has(code)) {
                orderedPrefixes.push(code);
                prefixes.delete(code);
            }
        });

        // prefix ที่เหลือ (ไม่มีใน mapping) เรียงตัวอักษรต่อท้าย
        Array.from(prefixes).sort().forEach(code => orderedPrefixes.push(code));

        let tabsHTML = `<button class="sw-tab ${this.activeTab === 'all' ? 'active' : ''}" data-tab="all" onclick="swLightPanel.filterTab('all')" title="ทั้งหมด">ทั้งหมด</button>`;

        orderedPrefixes.forEach(prefix => {
            const isActive = this.activeTab === prefix ? 'active' : '';
            const fullName = (window.SW_STATION_NAMES && window.SW_STATION_NAMES[prefix]) || prefix;
            tabsHTML += `<button class="sw-tab ${isActive}" data-tab="${prefix}" onclick="swLightPanel.filterTab('${prefix}')" title="${fullName}">${prefix}</button>`;
        });

        if (this.tabsContainer) {
            this.tabsContainer.innerHTML = tabsHTML;
        }
    }

    show(updateDate, layerDataArray, mapInstance) {
        if (!this.isInitialized) this.init();

        this.updateDate = updateDate;
        this.allData = layerDataArray;
        this.currentMap = mapInstance;

        if (this.subtitle) {
            this.subtitle.innerHTML = `Update : ${this.formatThaiDate(this.updateDate)}`;
        }

        this.generateTabs();
        this.filterTab(this.activeTab);

        this.panel.classList.add('open');
    }

    hide() {
        if (this.panel) {
            this.panel.classList.remove('open');
        }
    }

    filterTab(tabId) {
        this.activeTab = tabId;

        document.querySelectorAll('#sw-light-tabs-container .sw-tab').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabId);
        });

        if (tabId === 'all') {
            this.currentData = [...this.allData];
        } else {
            this.currentData = this.allData.filter(item => {
                const station = item.data?.Station || '';
                return String(station).toUpperCase() === tabId;
            });
        }

        this.currentData.sort((a, b) => {
            const staA = this.parseSta(a.data?.Sta);
            const staB = this.parseSta(b.data?.Sta);
            return staA - staB;
        });

        this.renderTableBody();

        // เมื่อกรองข้อมูลเสร็จ ให้ซูม แล้วเปิดเอฟเฟกต์
        this._zoomToFitCurrentData();
        this._applyGlowEffect();

        // Summary Panel
        const displayTabName = tabId === 'all' ? 'ทั้งหมด' : tabId;
        if (typeof swLightSummary !== 'undefined') {
            swLightSummary.show(displayTabName, this.updateDate, this.currentData);
        }
    }

    // ฟังก์ชันซูม
    _zoomToFitCurrentData() {
        if (!this.currentMap || this.currentData.length === 0) return;

        const pts = this.currentData.filter(it => it.layer && it.layer.getLatLng).map(it => it.layer.getLatLng());
        if (!pts.length) return;
        const b = new maplibregl.LngLatBounds([pts[0].lng, pts[0].lat], [pts[0].lng, pts[0].lat]);
        pts.forEach(p => b.extend([p.lng, p.lat]));
        const h = window.innerHeight;
        this.currentMap.fitBounds(b, {
            padding: { top: h * 0.30 + 20, bottom: h * 0.35 + 20, left: 50, right: 50 },
            maxZoom: BPNP.geo.fromLeafletZoom(17),
            duration: 600
        });
    }

    // ฟังก์ชันเช็คว่าขั้นตอนล่าสุดของงานนี้ กำลังทำอยู่ (สถานะ = 1) หรือไม่
    _isDoingStatus(progress) {
        if (!progress) return false;

        if ((progress.wiring || 0) > 0) return progress.wiring === 1;
        if ((progress.ins_sig || 0) > 0) return progress.ins_sig === 1;
        if ((progress.poring_concrete || 0) > 0) return progress.poring_concrete === 1;
        if ((progress.footing || 0) > 0) return progress.footing === 1;

        return false;
    }

    // จัดการเงาสีฟ้าให้หมุด และเพิ่มกระเพื่อมสีส้มถ้ากำลังทำ
    _applyGlowEffect() {
        if (this._blinkTimeout) {
            clearTimeout(this._blinkTimeout);
            this._blinkTimeout = null;
        }

        // ล้างเอฟเฟกต์เดิมออกทั้งหมด
        this.allData.forEach(item => {
            if (item.layer) {
                const el = item.layer.getElement();
                if (el) {
                    el.classList.remove('marker-glow-blink', 'marker-glow-blue', 'marker-ripple-orange');
                }
            }
        });

        // 1. ใส่เอฟเฟกต์กระพริบให้ Current Data
        this.currentData.forEach(item => {
            if (item.layer) {
                const el = item.layer.getElement();
                if (el) {
                    el.classList.add('marker-glow-blink');

                    if (this._isDoingStatus(item.data.progress)) {
                        el.classList.add('marker-ripple-orange');
                    }
                }
            }
        });

        // 2. เมื่อหมดเวลากระพริบ ให้เปลี่ยนเป็นเงาค้างไว้
        this._blinkTimeout = setTimeout(() => {
            this.currentData.forEach(item => {
                if (item.layer) {
                    const el = item.layer.getElement();
                    if (el) {
                        el.classList.remove('marker-glow-blink');
                        el.classList.add('marker-glow-blue');
                    }
                }
            });
        }, 1500);
    }

    // หยุดการกระพริบทันที แล้วค้างเงาไว้ (ใช้ตอนกดที่ตาราง)
    _stopBlinkingAndSetGlow() {
        if (this._blinkTimeout) {
            clearTimeout(this._blinkTimeout);
            this._blinkTimeout = null;
        }

        this.currentData.forEach(item => {
            if (item.layer) {
                const el = item.layer.getElement();
                if (el) {
                    el.classList.remove('marker-glow-blink');
                    el.classList.add('marker-glow-blue');

                    if (this._isDoingStatus(item.data.progress)) {
                        if (!el.classList.contains('marker-ripple-orange')) {
                            el.classList.add('marker-ripple-orange');
                        }
                    } else {
                        el.classList.remove('marker-ripple-orange');
                    }
                }
            }
        });
    }

    renderTableBody() {
        if (!this.tbody) return;
        this.tbody.innerHTML = '';

        if (this.currentData.length === 0) {
            this.tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #adb5bd; padding: 20px;">ไม่พบข้อมูล</td></tr>`;
            return;
        }

        this.currentData.forEach((item, index) => {
            const data = item.data;
            if (!data) return;

            const staDisplay = data.Sta || '-';
            const statusInfo = this.getStatusInfo(data.progress);

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="text-align: center;">${index + 1}</td>
                <td style="font-weight: bold; text-align: center;">${staDisplay}</td>
                <td style="font-weight: 600; color: #0d2b45; padding-left: 10px;">${data.No || '-'}</td>
                <td style="text-align: center;"><span style="background: rgba(0,0,0,0.05); padding: 2px 6px; border-radius: 4px; font-size: 11px;">${data.Type || '-'}</span></td>
                <td style="text-align: center; font-weight: bold; color: ${statusInfo.color};">${statusInfo.text}</td>
            `;

            tr.onclick = () => {
                this._stopBlinkingAndSetGlow();

                if (this.currentMap && item.layer) {
                    const latlng = item.layer.getLatLng();
                    this.currentMap.jumpTo({ center: [latlng.lng, latlng.lat], zoom: BPNP.geo.fromLeafletZoom(18) });

                    if (item.layer.isPopupOpen && item.layer.isPopupOpen()) {
                        item.layer.closePopup();
                    }
                    setTimeout(() => item.layer.openPopup(), 300);
                }
            };

            this.tbody.appendChild(tr);
        });
    }
}

window.swLightPanel = new SWLightBottomPanelManager();

