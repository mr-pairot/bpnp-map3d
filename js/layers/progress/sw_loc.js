/* js/layers/progress/sw_loc.js
 * ─────────────────────────────────────────────────────────────────────────
 * เฟส 4B: SW - LOC (ตู้ควบคุมระบบอาณัติสัญญาณ 216 ตู้) — เดิม sw_loc_manager.js
 *   - ตำแหน่งจาก STA + offset ตั้งฉากกับแนวทาง (ใช้ alignment ชุดเดียวกับ Sta/O/S — เดิมโหลด KML ซ้ำ)
 *   - หมุดสีตามขั้นงานล่าสุด (8 ขั้น) ขอบตามสถานะ · กำลังทำ = วงกระเพื่อมสีส้ม
 *   - ชี้เมาส์ → STA + ชื่อ · คลิก → การ์ดขั้นงาน · เปิดชั้น → แผงตาราง + แผงสรุป
 * หมุดเป็น HTML marker: element ราก (.sw-loc-marker) ไม่มี position/transform (MIGRATION_GUIDE หัวข้อ 19)
 * CSS: css/layers/sw_loc.css, css/layers/sw_panel.css
 * ───────────────────────────────────────────────────────────────────────── */
'use strict';

window.SW_STATION_NAMES = {
    PHI: 'ชุมทางบ้านหนองแวงไร่',
    PLK: 'สถานีภูเหล็ก',
    KRG: 'สถานีกุดรัง',
    BRB: 'สถานีบรบือ',
    MSK: 'สถานีมหาสารคาม',
    ROE: 'สถานีร้อยเอ็ด',
    CKW: 'สถานีเชียงขวัญ',
    PCI: 'สถานีโพธิ์ชัย',
    APT: 'สถานีอำเภอโพนทอง',
    NOP: 'สถานีหนองพอก'
};


class SWLocManager {
    constructor(map, alignmentData, dataUrl = 'data/json/sw_loc.json') {
        this._map = map;
        this._alignmentData = alignmentData;   // [{ sta, lat, lng }] เรียงตาม sta
        this._dataUrl = dataUrl;
        this._rawData = null;
        this._swDataList = [];
        this._markers = [];
        this._visible = false;
        this._hover = new maplibregl.Popup({ closeButton: false, closeOnClick: false, anchor: 'bottom', offset: 12,
                                            className: 'bpnp-hover-label sw-loc-tooltip' });
    }

    async load() {
        const res = await fetch(this._dataUrl);
        if (!res.ok) throw new Error(`HTTP status: ${res.status}`);
        this._rawData = await res.json();
        this._renderMarkers();
        return this;
    }

    _calculateOverallStatus(details) {
        if (!details) return { stepIndex: 0, stepState: 0 };
        
        if ((details.ins_loc || 0) > 0) return { stepIndex: 8, stepState: details.ins_loc };
        if ((details.gard_rail || 0) > 0) return { stepIndex: 7, stepState: details.gard_rail };
        if ((details.loc_base || 0) > 0) return { stepIndex: 6, stepState: details.loc_base };
        if ((details.floor_wall || 0) > 0) return { stepIndex: 5, stepState: details.floor_wall };
        if ((details.beam || 0) > 0) return { stepIndex: 4, stepState: details.beam };
        if ((details.column || 0) > 0) return { stepIndex: 3, stepState: details.column };
        if ((details.footing || 0) > 0) return { stepIndex: 2, stepState: details.footing };
        if ((details.survey || 0) > 0) return { stepIndex: 1, stepState: details.survey };
        
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

    _getDotClass(val) {
        if (val === 2) return "sw-dot-2"; // สีเขียว
        if (val === 1) return "sw-dot-1"; // สีเหลืองกระพริบ
        return "sw-dot-0";                // สีเทา
    }

    _formatSTA(sta) {
        if (sta === null || sta === undefined || isNaN(sta)) return String(sta);

        const sign = sta < 0 ? '-' : '';
        const absSta = Math.abs(sta);

        const km = Math.floor(absSta / 1000);
        const remainder = absSta - km * 1000;

        const isInteger = Number.isInteger(remainder);
        const remainderStr = isInteger
            ? String(Math.round(remainder)).padStart(3, '0')
            : remainder.toFixed(2).padStart(6, '0');

        return `${sign}${km}+${remainderStr}`;
    }

    _renderMarkers() {
        const swDataList = [];
        const markerSize = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sw-marker-size').trim(), 10) || 10;
        const esc = BPNP.escapeHtml;
        const stepsConfig = [
            { key: 'survey', label: 'Survey' }, { key: 'footing', label: 'Footing' }, { key: 'column', label: 'Column' },
            { key: 'beam', label: 'Beam' }, { key: 'floor_wall', label: 'Floor & Wall' }, { key: 'loc_base', label: 'LOC Base' },
            { key: 'gard_rail', label: 'Guard Rail' }, { key: 'ins_loc', label: 'Install LOC' }
        ];

        this._rawData.data.forEach(item => {
            const { sta, offset, name, type, statusDetails } = item;
            const { stepIndex, stepState } = this._calculateOverallStatus(statusDetails);
            const loc = this._findPointWithHeading(sta);
            if (!loc) return;
            let ll = { lat: loc.lat, lng: loc.lng };
            if (offset && offset !== 0) ll = this._calculateOffsetLatLng(loc.lat, loc.lng, loc.heading, offset);

            const staDisplay = this._formatSTA(sta);
            let stepsHtml = '';
            stepsConfig.forEach((step, idx) => {
                const val = statusDetails ? (statusDetails[step.key] || 0) : 0;
                const dotRipple = val === 1 ? `<div class="sw-dot-ripple"></div>` : '';
                const dotBgClass = val > 0 ? `sw-status-${idx + 1}` : `sw-status-0`;
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
                        <span class="sw-popup-title">${esc(name)}</span>
                        <span class="sw-popup-type">${esc(type)}</span>
                    </div>
                    <div class="sw-popup-body">
                        <div class="sw-sta-row">
                            <span class="sw-sta-main"><b>STA:</b> ${staDisplay}</span>
                            <span class="sw-offset-sub"><b>Offset:</b> ${esc(offset)}m</span>
                        </div>
                        <div class="sw-step-container">${stepsHtml}</div>
                    </div>
                </div>`;

            // หมุด: element รากเป็น .sw-loc-marker โดยตรง (เหมือน divIcon เดิม) — ไม่มี position/transform
            const el = document.createElement('div');
            el.className = `sw-loc-marker sw-status-${stepIndex} sw-border-${stepState}${stepState === 1 ? ' marker-ripple-orange' : ''}`;
            el.style.width = markerSize + 'px';
            el.style.height = markerSize + 'px';
            el.style.cursor = 'pointer';
            const lngLat = [ll.lng, ll.lat];
            const marker = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat(lngLat);
            const tip = `<b>STA:</b> ${staDisplay}<br><b>Name:</b> ${esc(name)}`;
            el.addEventListener('mouseenter', () => this._hover.setLngLat(lngLat).setHTML(tip).addTo(this._map));
            el.addEventListener('mouseleave', () => this._hover.remove());

            // ตัวแทนหมุดสำหรับแผงตาราง (API เดียวกับ L.Marker ที่แผงเดิมเรียกใช้)
            let popup = null;
            const layer = {
                getLatLng: () => ({ lat: ll.lat, lng: ll.lng }),
                getElement: () => el,
                openPopup: () => { popup = BPNP.map.popup.open(lngLat, popupHtml, { className: 'structure-popup sw-popup' }); },
                closePopup: () => { if (popup) popup.remove(); popup = null; },
                isPopupOpen: () => !!(popup && popup.isOpen()),
                feature: { properties: { Code: name, Type: type, Status: this._getStatusText(stepIndex) } }
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
        // แผงของ SW - Color Light อยู่ตำแหน่งเดียวกัน → ปิดก่อนเปิดแผงของ SW-LOC (v3.10.09)
        if (window.swLightPanel) swLightPanel.hide();
        if (window.swLightSummary) swLightSummary.hide();
        this._openBottomPanel();
    }

    hide() {
        this._visible = false;
        this._hover.remove();
        this._markers.forEach(m => m.remove());
        if (window.swLocPanel) swLocPanel.hide();
        if (window.swSummary) swSummary.hide();
    }

    _getStatusText(statusVal) {
        const statuses = [
            "ยังไม่เริ่ม", "Survey", "Footing", "Column", "Beam", "Floor & Wall", "LOC Base", "Guard Rail", "Install LOC"
        ];
        return statuses[statusVal] || "ไม่ทราบสถานะ";
    }

    _openBottomPanel() {
        if (window.swLocPanel) swLocPanel.show(this._rawData.lastUpdated || '-', this._swDataList, this._map);
    }

    _findPointWithHeading(targetSTA) {
        const data = this._alignmentData;
        let lowerPoint = null, upperPoint = null;
        for (let i = 0; i < data.length; i++) {
            if (data[i].sta === targetSTA) {
                lowerPoint = data[i];
                upperPoint = data[i + 1] || data[i];
                break;
            }
            if (data[i].sta < targetSTA) { lowerPoint = data[i]; } 
            else if (data[i].sta > targetSTA) { upperPoint = data[i]; break; }
        }
        if (!lowerPoint || !upperPoint) return null;
        if (lowerPoint.sta === upperPoint.sta) return { lat: lowerPoint.lat, lng: lowerPoint.lng, heading: 0 };

        const ratio   = (targetSTA - lowerPoint.sta) / (upperPoint.sta - lowerPoint.sta);
        const lat     = lowerPoint.lat + ratio * (upperPoint.lat - lowerPoint.lat);
        const lng     = lowerPoint.lng + ratio * (upperPoint.lng - lowerPoint.lng);
        const heading = this._calculateHeading(lowerPoint.lat, lowerPoint.lng, upperPoint.lat, upperPoint.lng);
        return { lat, lng, heading };
    }

    _calculateHeading(lat1, lng1, lat2, lng2) {
        const toRad = (deg) => (deg * Math.PI) / 180;
        const toDeg = (rad) => (rad * 180) / Math.PI;
        const dLng  = toRad(lng2 - lng1);
        const y     = Math.sin(dLng) * Math.cos(toRad(lat2));
        const x     = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) - Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng);
        return (toDeg(Math.atan2(y, x)) + 360) % 360;
    }

    _calculateOffsetLatLng(lat, lng, heading, offset) {
        const R = 6378137;
        const perpHeading = (heading + (offset > 0 ? 90 : -90)) % 360;
        const distance = Math.abs(offset);
        const toRad = (deg) => (deg * Math.PI) / 180;
        const toDeg = (rad) => (rad * 180) / Math.PI;

        const brngRad = toRad(perpHeading);
        const latRad = toRad(lat);
        const lngRad = toRad(lng);
        const angularDistance = distance / R;

        const newLatRad = Math.asin(Math.sin(latRad) * Math.cos(angularDistance) + Math.cos(latRad) * Math.sin(angularDistance) * Math.cos(brngRad));
        const newLngRad = lngRad + Math.atan2(Math.sin(brngRad) * Math.sin(angularDistance) * Math.cos(latRad), Math.cos(angularDistance) - Math.sin(latRad) * Math.sin(newLatRad));
        return { lat: toDeg(newLatRad), lng: toDeg(newLngRad) };
    }
}

(function () {
  const ID = 'layer_sw_loc';
  let manager = null;
  function register(map) {
    BPNP.map.registry.register(ID, {
      slot: 'progress',
      build: async () => {
        const points = await BPNP.alignment.load();
        const aln = points.map(p => ({ sta: p.station, lat: p.lat, lng: p.lng }));
        manager = await new SWLocManager(map, aln, BPNP.layers.byId(ID).source).load();
        window.swLocManager = manager;
        return {};
      },
      onShow: () => { if (manager) manager.show(); BPNP.auth && BPNP.auth.logUserEvent('Open Layer', 'เปิดเลเยอร์ SW - LOC'); },
      onHide: () => { if (manager) manager.hide(); }
    });
  }
  BPNP.layers.utils.register({ name: 'sw_loc', register });
})();
