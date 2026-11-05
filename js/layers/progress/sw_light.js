/* js/layers/progress/sw_light.js
 * ─────────────────────────────────────────────────────────────────────────
 * SW - Color Light (ไฟสีระบบอาณัติสัญญาณ 250 ต้น) — ย้ายจาก BPNP_Map_Demo (js/sw_light_manager.js)
 *   - ตำแหน่งจาก Sta ("กม+ม") + offset ตั้งฉากกับแนวทาง (alignment ชุดเดียวกับ SW-LOC)
 *   - หมุดรูปไฟสี (assets/markers/sw_light.svg) + จุดสีขั้นงานล่าสุด (4 ขั้น) · กำลังทำ = วงกระเพื่อมสีส้ม
 *   - ชี้เมาส์ → STA + เลขไฟสี · คลิก → การ์ด 4 ขั้น · เปิดชั้น → แผงตาราง + แผงสรุป
 *   - เปิดเฉพาะผู้ใช้ที่ผ่านสวิตช์ config.features.swLight (เริ่มต้น ['editor'])
 *   - แผงตาราง/สรุปของ SW-LOC กับ Color Light ใช้ตำแหน่งเดียวกัน → เปิดแผงหนึ่งแล้วปิดอีกแผง
 * หมุดเป็น HTML marker: element ราก (.sw-light-marker) ไม่มี position/transform (MIGRATION_GUIDE หัวข้อ 19)
 * CSS: css/layers/sw_light.css · แผง: sw_light_panel.js, sw_light_summary.js
 * ───────────────────────────────────────────────────────────────────────── */
'use strict';

// ชื่อสถานีใช้ร่วมกับ SW-LOC (sw_loc.js ประกาศไว้แล้ว)
if (!window.SW_STATION_NAMES) {
    window.SW_STATION_NAMES = {
        PHI: 'ชุมทางบ้านหนองแวงไร่', PLK: 'สถานีภูเหล็ก', KRG: 'สถานีกุดรัง', BRB: 'สถานีบรบือ', MSK: 'สถานีมหาสารคาม',
        ROE: 'สถานีร้อยเอ็ด', CKW: 'สถานีเชียงขวัญ', PCI: 'สถานีโพธิ์ชัย', APT: 'สถานีอำเภอโพนทอง', NOP: 'สถานีหนองพอก'
    };
}

class SWLightManager {
    constructor(map, alignmentData, dataUrl = 'data/json/sw_colorlight.json', iconUrl = 'assets/markers/sw_light.svg') {
        this._map = map;
        this._alignmentData = alignmentData;   // [{ sta, lat, lng }] เรียงตาม sta
        this._dataUrl = dataUrl;
        this._iconUrl = iconUrl;
        this._rawData = null;
        this._swDataList = [];
        this._markers = [];
        this._visible = false;
        this._hover = new maplibregl.Popup({ closeButton: false, closeOnClick: false, anchor: 'bottom', offset: 14,
                                            className: 'bpnp-hover-label sw-light-tooltip' });
    }

    async load() {
        const res = await fetch(this._dataUrl);
        if (!res.ok) throw new Error(`HTTP status: ${res.status}`);
        this._rawData = await res.json();
        this._renderMarkers();
        return this;
    }

    // สถานะภาพรวมจาก progress (ไล่จากขั้นหลังมาหน้า 4 ขั้น)
    _calculateOverallStatus(progress) {
        if (!progress) return { stepIndex: 0, stepState: 0 };
        if ((progress.wiring || 0) > 0) return { stepIndex: 4, stepState: progress.wiring };
        if ((progress.ins_sig || 0) > 0) return { stepIndex: 3, stepState: progress.ins_sig };
        if ((progress.poring_concrete || 0) > 0) return { stepIndex: 2, stepState: progress.poring_concrete };
        if ((progress.footing || 0) > 0) return { stepIndex: 1, stepState: progress.footing };
        return { stepIndex: 0, stepState: 0 };
    }

    _getDetailStatusText(val) {
        if (val === 2) return "แล้วเสร็จ";
        if (val === 1) return "กำลังทำ";
        return "ยังไม่เริ่ม";
    }

    _getBadgeClass(val) {
        if (val === 2) return "badge-done";
        if (val === 1) return "badge-doing";
        return "badge-wait";
    }

    // "2+002" → 2002 (เมตร)
    _parseSta(staValue) {
        if (staValue === null || staValue === undefined) return NaN;
        if (typeof staValue === 'number') return staValue;
        const str = String(staValue).trim();
        const sign = str.startsWith('-') ? -1 : 1;
        const parts = str.replace(/^-/, '').split('+');
        if (parts.length !== 2) { const n = parseFloat(str); return isNaN(n) ? NaN : n; }
        return sign * ((parseFloat(parts[0]) || 0) * 1000 + (parseFloat(parts[1]) || 0));
    }

    _renderMarkers() {
        const swDataList = [];
        const markerSize = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sw-light-marker-size').trim(), 10) || 24;
        const esc = BPNP.escapeHtml;
        const stepsConfig = [
            { key: 'footing', label: 'Footing' },
            { key: 'poring_concrete', label: 'Poring Concrete' },
            { key: 'ins_sig', label: 'Install Signal' },
            { key: 'wiring', label: 'Wiring' }
        ];
        const dataArray = Array.isArray(this._rawData) ? this._rawData : (this._rawData && this._rawData.data) || [];

        dataArray.forEach(item => {
            const { Station, No, Sta, offset, Type, progress } = item;
            const { stepIndex, stepState } = this._calculateOverallStatus(progress);
            const loc = this._findPointWithHeading(this._parseSta(Sta));
            if (!loc) return;
            let ll = { lat: loc.lat, lng: loc.lng };
            if (offset && offset !== 0) ll = this._calculateOffsetLatLng(loc.lat, loc.lng, loc.heading, offset);

            const staDisplay = Sta || '-';
            let stepsHtml = '';
            stepsConfig.forEach((step, idx) => {
                const val = progress ? (progress[step.key] || 0) : 0;
                const dotRipple = val === 1 ? `<div class="sw-dot-ripple"></div>` : '';
                const dotBgClass = val > 0 ? `sw-light-status-${idx + 1}` : `sw-light-status-0`;
                stepsHtml += `
                    <div class="sw-step-row">
                        <div class="sw-dot-container" style="position: relative; display: flex; align-items: center; justify-content: center; width: 14px; height: 14px; margin-right: 8px;">
                            ${dotRipple}
                            <div class="sw-dot ${dotBgClass} sw-dot-border-${val}" style="position: relative; z-index: 2;"></div>
                        </div>
                        <span class="sw-step-label">${step.label}</span>
                        <span class="sw-badge ${this._getBadgeClass(val)}">${this._getDetailStatusText(val)}</span>
                    </div>`;
            });
            const popupHtml = `
                <div class="sw-popup-card">
                    <div class="sw-popup-header">
                        <div>
                            <div class="sw-popup-title">${esc(No || '-')}</div>
                            <div class="sw-popup-subtitle">${esc(Station || '-')}</div>
                        </div>
                        <span class="sw-popup-type">${esc(Type || '-')}</span>
                    </div>
                    <div class="sw-popup-body">
                        <div class="sw-sta-row">
                            <span class="sw-sta-main"><b>STA:</b> ${esc(staDisplay)}</span>
                            <span class="sw-offset-sub"><b>Offset:</b> ${esc(offset)}m</span>
                        </div>
                        <div class="sw-step-container">${stepsHtml}</div>
                    </div>
                </div>`;

            // หมุด: element รากเป็น .sw-light-marker โดยตรง (เหมือน divIcon เดิม) — ไม่มี position/transform
            const el = document.createElement('div');
            el.className = `sw-light-marker${stepState === 1 ? ' marker-ripple-orange' : ''}`;
            el.style.width = markerSize + 'px';
            el.style.height = markerSize + 'px';
            el.style.cursor = 'pointer';
            el.innerHTML = `<img src="${this._iconUrl}" class="sw-light-icon-img" alt="signal" draggable="false" />
                            <span class="sw-light-status-dot sw-light-status-${stepIndex}"></span>`;
            const lngLat = [ll.lng, ll.lat];
            const marker = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat(lngLat);
            const tip = `<b>STA:</b> ${esc(staDisplay)}<br><b>No:</b> ${esc(No || '-')}`;
            el.addEventListener('mouseenter', () => this._hover.setLngLat(lngLat).setHTML(tip).addTo(this._map));
            el.addEventListener('mouseleave', () => this._hover.remove());

            // ตัวแทนหมุดสำหรับแผงตาราง (API เดียวกับ L.Marker ที่แผงเดิมเรียกใช้)
            let popup = null;
            const layer = {
                getLatLng: () => ({ lat: ll.lat, lng: ll.lng }),
                getElement: () => el,
                openPopup: () => { popup = BPNP.map.popup.open(lngLat, popupHtml, { className: 'structure-popup sw-popup sw-light-popup' }); },
                closePopup: () => { if (popup) popup.remove(); popup = null; },
                isPopupOpen: () => !!(popup && popup.isOpen()),
                feature: { properties: { Code: No, Type: Type, Status: this._getStatusText(stepIndex) } }
            };
            el.addEventListener('click', e => { e.stopPropagation(); this._hover.remove(); layer.openPopup(); });
            this._markers.push(marker);
            swDataList.push({ layer, data: item });
        });
        this._swDataList = swDataList;
    }

    show() {
        if (this._visible) return;
        this._visible = true;
        this._markers.forEach(m => m.addTo(this._map));
        // แผงของ SW-LOC อยู่ตำแหน่งเดียวกัน → ปิดก่อนเปิดแผงของ Color Light
        if (window.swLocPanel) swLocPanel.hide();
        if (window.swSummary) swSummary.hide();
        this._openBottomPanel();
    }

    hide() {
        this._visible = false;
        this._hover.remove();
        this._markers.forEach(m => m.remove());
        if (window.swLightPanel) swLightPanel.hide();
        if (window.swLightSummary) swLightSummary.hide();
    }

    _getStatusText(statusVal) {
        const statuses = ["ยังไม่เริ่ม", "Footing", "Poring Concrete", "Install Signal", "Wiring"];
        return statuses[statusVal] || "ไม่ทราบสถานะ";
    }

    _openBottomPanel() {
        if (!window.swLightPanel) return;
        const updateDate = (this._rawData && !Array.isArray(this._rawData) && this._rawData.lastUpdated) || '-';
        swLightPanel.show(updateDate, this._swDataList, this._map);
    }

    // --- คณิตศาสตร์ตำแหน่ง (เหมือน sw_loc.js) ---
    _findPointWithHeading(targetSTA) {
        if (isNaN(targetSTA)) return null;
        const data = this._alignmentData;
        let lowerPoint = null, upperPoint = null;
        for (let i = 0; i < data.length; i++) {
            if (data[i].sta === targetSTA) { lowerPoint = data[i]; upperPoint = data[i + 1] || data[i]; break; }
            if (data[i].sta < targetSTA) { lowerPoint = data[i]; }
            else if (data[i].sta > targetSTA) { upperPoint = data[i]; break; }
        }
        if (!lowerPoint || !upperPoint) return null;
        if (lowerPoint.sta === upperPoint.sta) return { lat: lowerPoint.lat, lng: lowerPoint.lng, heading: 0 };
        const ratio = (targetSTA - lowerPoint.sta) / (upperPoint.sta - lowerPoint.sta);
        const lat = lowerPoint.lat + ratio * (upperPoint.lat - lowerPoint.lat);
        const lng = lowerPoint.lng + ratio * (upperPoint.lng - lowerPoint.lng);
        return { lat, lng, heading: this._calculateHeading(lowerPoint.lat, lowerPoint.lng, upperPoint.lat, upperPoint.lng) };
    }

    _calculateHeading(lat1, lng1, lat2, lng2) {
        const toRad = d => d * Math.PI / 180, toDeg = r => r * 180 / Math.PI;
        const dLng = toRad(lng2 - lng1);
        const y = Math.sin(dLng) * Math.cos(toRad(lat2));
        const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) - Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng);
        return (toDeg(Math.atan2(y, x)) + 360) % 360;
    }

    _calculateOffsetLatLng(lat, lng, heading, offset) {
        const R = 6378137, toRad = d => d * Math.PI / 180, toDeg = r => r * 180 / Math.PI;
        const brngRad = toRad((heading + (offset > 0 ? 90 : -90)) % 360);
        const latRad = toRad(lat), lngRad = toRad(lng), ad = Math.abs(offset) / R;
        const newLatRad = Math.asin(Math.sin(latRad) * Math.cos(ad) + Math.cos(latRad) * Math.sin(ad) * Math.cos(brngRad));
        const newLngRad = lngRad + Math.atan2(Math.sin(brngRad) * Math.sin(ad) * Math.cos(latRad), Math.cos(ad) - Math.sin(latRad) * Math.sin(newLatRad));
        return { lat: toDeg(newLatRad), lng: toDeg(newLngRad) };
    }
}

(function () {
  const ID = 'layer_sw_light';
  const FEATURE = 'swLight';
  let manager = null;
  const allowed = () => !!(BPNP.features && BPNP.features.isOn(FEATURE));

  function register(map) {
    BPNP.map.registry.register(ID, {
      slot: 'progress',
      build: async () => {
        const points = await BPNP.alignment.load();
        const aln = points.map(p => ({ sta: p.station, lat: p.lat, lng: p.lng }));
        manager = await new SWLightManager(map, aln, BPNP.layers.byId(ID).source).load();
        window.swlightManager = manager;
        return {};
      },
      onShow: () => {
        // กันเปิดโดยผู้ใช้ที่ไม่มีสิทธิ์ (เช่น ค่าที่บันทึกไว้ในเครื่อง)
        if (!allowed()) { setTimeout(() => BPNP.map.registry.setVisible(ID, false), 0); return; }
        if (manager) manager.show();
        BPNP.auth && BPNP.auth.logUserEvent('Open Layer', 'เปิดเลเยอร์ SW - Color Light');
      },
      onHide: () => { if (manager) manager.hide(); }
    });
    // role เปลี่ยนระหว่างใช้งาน (ตรวจซ้ำเมื่อกลับเข้าแอป) → ไม่มีสิทธิ์แล้วปิดชั้น
    if (BPNP.events) BPNP.events.on('features:change', () => {
      if (!allowed() && BPNP.map.registry.isVisible(ID)) BPNP.map.registry.setVisible(ID, false);
    });
  }
  BPNP.layers.utils.register({ name: 'sw_light', register });
})();
