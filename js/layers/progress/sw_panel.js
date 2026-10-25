/* js/layers/progress/sw_panel.js
 * แผงตารางความก้าวหน้า SW-LOC (เดิม sw_LocBottomPanel.js)
 * คัดลอกเดิม แก้เฉพาะการซูมให้เห็นทั้งแท็บ และการบินไปที่ตู้ (MapLibre)
 * item.layer เป็นตัวแทนหมุดจาก sw_loc.js (getLatLng / getElement / openPopup / closePopup / isPopupOpen) */
/* sw_LocBottomPanel.js */
class SWLocBottomPanelManager {
    constructor() {
        this.isInitialized = false;
        this.allData = []; 
        this.currentData = []; 
        this.currentMap = null;
        this.activeTab = 'all'; 
        this.updateDate = '-';
        this._blinkTimeout = null; 
    }

    init() {
        if (this.isInitialized) return;

        const panelHTML = `
            <div id="sw-loc-bottom-panel" class="sw-bottom-panel">
                <div class="sw-panel-header">
                    <div class="sw-panel-title-container">
                        <span class="sw-panel-title" id="loc-panel-title">ความก้าวหน้างาน Signalling - LOC</span>
                        <span class="sw-panel-title2" >[DEMO] </span>
                        <span class="sw-panel-subtitle" id="loc-panel-subtitle">Update : -</span>
                        
                        <button class="sw-close-btn" title="ปิดหน้าต่าง" onclick="swLocPanel.hide()">&times;</button>
                    </div>
                    
                    <div class="sw-tabs-container" id="sw-loc-tabs-container">
                        </div>
                </div>

                <div class="sw-table-container" >
                    <table class="sw-data-table">
                        <thead>
                            <tr>
                                <th class="sw-th-seq">ลำดับ</th>
                                <th class="sw-th-sta">Sta.</th>
                                <th class="sw-th-name">Name</th>
                                <th class="sw-th-type">Type</th>
                                <th class="sw-th-status">Status</th>
                            </tr>
                        </thead>
                        <tbody id="loc-table-body"></tbody>
                    </table>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', panelHTML);
        
        this.panel = document.getElementById('sw-loc-bottom-panel');
        this.tbody = document.getElementById('loc-table-body');
        this.subtitle = document.getElementById('loc-panel-subtitle'); 
        this.tabsContainer = document.getElementById('sw-loc-tabs-container');
        this.isInitialized = true;
    }

    formatSta(staValue) {
        if (staValue === undefined || staValue === null || isNaN(staValue)) return '-';
        const num = Number(staValue);
        const km = Math.floor(num / 1000);
        const m = Math.floor(num % 1000).toString().padStart(3, '0');
        return `${km}+${m}`;
    }

    getStatusInfo(details) {
        if (!details) return { text: '-', color: '#adb5bd' };
        
        const getColorByStatus = (statusValue) => {
            if (statusValue === 2) return '#2e7d32'; // แล้วเสร็จ (เขียว)
            if (statusValue === 1) return '#ff9800'; // กำลังทำ (ส้ม)
            return '#9e9e9e'; // ยังไม่ทำ (เทา)
        };
        
        if ((details.ins_loc || 0) > 0) return { text: 'Install LOC', color: getColorByStatus(details.ins_loc) };
        if ((details.gard_rail || 0) > 0) return { text: 'Guard Rail', color: getColorByStatus(details.gard_rail) };
        if ((details.loc_base || 0) > 0) return { text: 'LOC Base', color: getColorByStatus(details.loc_base) };
        if ((details.floor_wall || 0) > 0) return { text: 'Floor/Wall', color: getColorByStatus(details.floor_wall) };
        if ((details.beam || 0) > 0) return { text: 'Beam', color: getColorByStatus(details.beam) };
        if ((details.column || 0) > 0) return { text: 'Column', color: getColorByStatus(details.column) };
        if ((details.footing || 0) > 0) return { text: 'Footing', color: getColorByStatus(details.footing) };
        if ((details.survey || 0) > 0) return { text: 'Survey', color: getColorByStatus(details.survey) };
        
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
            if (data && data.name) {
                const prefix = data.name.substring(0, 3).toUpperCase();
                prefixes.add(prefix);
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
    
        let tabsHTML = `<button class="sw-tab ${this.activeTab === 'all' ? 'active' : ''}" data-tab="all" onclick="swLocPanel.filterTab('all')" title="ทั้งหมด">ทั้งหมด</button>`;
        
        orderedPrefixes.forEach(prefix => {
            const isActive = this.activeTab === prefix ? 'active' : '';
            const fullName = (window.SW_STATION_NAMES && window.SW_STATION_NAMES[prefix]) || prefix;
            tabsHTML += `<button class="sw-tab ${isActive}" data-tab="${prefix}" onclick="swLocPanel.filterTab('${prefix}')" title="${fullName}">${prefix}</button>`;
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

        document.querySelectorAll('.sw-tab').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabId);
        });

        if (tabId === 'all') {
            this.currentData = [...this.allData];
        } else {
            this.currentData = this.allData.filter(item => {
                const name = item.data?.name || '';
                return name.substring(0, 3).toUpperCase() === tabId;
            });
        }

        this.currentData.sort((a, b) => {
            const staA = a.data?.sta || 0;
            const staB = b.data?.sta || 0;
            return staA - staB;
        });

        this.renderTableBody();
        this._zoomToFitCurrentData();
        this._applyGlowEffect();

        const displayTabName = tabId === 'all' ? 'ทั้งหมด' : tabId;
        if (typeof swSummary !== 'undefined') {
            swSummary.show(displayTabName, this.updateDate, this.currentData);
        }
    }

    // ซูมให้เห็นตู้ทั้งหมดในแท็บ (เว้นที่ด้านบน/ล่างให้แผงสรุปและตาราง เหมือนเดิม)
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

    _isDoingStatus(details) {
        if (!details) return false;
        if ((details.ins_loc || 0) > 0) return details.ins_loc === 1;
        if ((details.gard_rail || 0) > 0) return details.gard_rail === 1;
        if ((details.loc_base || 0) > 0) return details.loc_base === 1;
        if ((details.floor_wall || 0) > 0) return details.floor_wall === 1;
        if ((details.beam || 0) > 0) return details.beam === 1;
        if ((details.column || 0) > 0) return details.column === 1;
        if ((details.footing || 0) > 0) return details.footing === 1;
        if ((details.survey || 0) > 0) return details.survey === 1;
        
        return false;
    }

    _applyGlowEffect() {
        if (this._blinkTimeout) {
            clearTimeout(this._blinkTimeout);
            this._blinkTimeout = null;
        }

        this.allData.forEach(item => {
            if (item.layer) {
                const el = item.layer.getElement();
                if (el) {
                    el.classList.remove('marker-glow-blink', 'marker-glow-blue', 'marker-ripple-orange');
                }
            }
        });

        this.currentData.forEach(item => {
            if (item.layer) {
                const el = item.layer.getElement();
                if (el) {
                    el.classList.add('marker-glow-blink');
                    
                    if (this._isDoingStatus(item.data.statusDetails)) {
                        el.classList.add('marker-ripple-orange');
                    }
                }
            }
        });


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
                  
                    if (this._isDoingStatus(item.data.statusDetails)) {
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

            const formattedSta = this.formatSta(data.sta);
            const statusInfo = this.getStatusInfo(data.statusDetails);

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="text-align: center;">${index + 1}</td>
                <td style="font-weight: bold; text-align: center;">${formattedSta}</td>
                <td style="font-weight: 600; color: #0d2b45; padding-left: 10px;">${data.name || '-'}</td>
                <td style="text-align: center;"><span style="background: rgba(0,0,0,0.05); padding: 2px 6px; border-radius: 4px; font-size: 11px;">${data.type || '-'}</span></td>
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

window.swLocPanel = new SWLocBottomPanelManager();
