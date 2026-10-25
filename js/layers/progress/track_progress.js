/* js/layers/progress/track_progress.js
 * ─────────────────────────────────────────────────────────────────────────
 * เฟส 4B: Track Progress — กราฟความคืบหน้างานวางรางรายช่วง 100 ม. ตาม กม. ที่อยู่ในจอ
 * (คลาส ProgressManager คัดลอกจาก tw_ProgressManager.js เดิม แก้เฉพาะ path ข้อมูลและการตรวจ "อยู่ในจอ")
 * ส่วนควบคุมท้ายไฟล์แทน tw_progress.js เดิม:
 *   - ชั้น "Track Progress" ในรายการ = เปิด/ปิดแผงกราฟ · ปุ่ม FindProgress มุมขวาล่าง = ทางลัดเดียวกัน
 *   - เปิดแผงแล้วเปิดชั้น กม.ก่อสร้างให้อัตโนมัติ ปิดแผงแล้วคืนสถานะเดิม (ถ้าผู้ใช้ไม่ได้เปลี่ยนเองระหว่างนั้น)
 * CSS: css/layers/track_progress.css
 * ───────────────────────────────────────────────────────────────────────── */
/* tw_ProgressManager.js 
 * แสดง progress แบบ 100ม. ต่อช่อง (10 ช่อง = 1กม.)
 * เพิ่มการแยกสถานะงาน Rail (วางราง) เป็น Prog (4) และ Done (5)
 * เพิ่ม Custom Popup เมื่อคลิกที่ Block 100ม.
 *
 * ── รูปแบบค่าของแต่ละช่อง 100ม. (slot) ─────────────────────────────────
 * ช่องปกติ (ไม่มีตัวอักษร) ค่าสะสมแบบ >= (ยกเว้นค่าติดลบ):
 *    0        ว่างทุกชั้น
 *   -3        ชั้น 1 = Embankment (กำลังก่อสร้าง)
 *   -2        ชั้น 1 = Subgrade เสร็จสิ้น
 *   -1        ชั้น 1 = Subbase เสร็จสิ้น
 *   >=1       Subbase + F/N Subballast เสร็จ
 *   >=2       + Bottom Ballast
 *   >=3       + Sleeper
 *    4        Rail กำลังทำ (prog)   |  >=5 Rail/Flash Butt เสร็จ (done)
 *   >=6       + Fastener
 *    7        Tamping ครั้งแรก(prog) |  >=8 Final Tamping เสร็จ (done)
 *
 * ช่องสะพาน (มีตัวอักษร C / S / V นำหน้า)
 *   C = Concrete Bridge, S = Steel Bridge, V = Viaduct Bridge
 *   - มีแต่ตัวอักษร ("V", "C", "S")  → ชั้น 1-3 เหลืองอ่อน, ชั้น 4-7 ว่าง
 *                                       popup "กำลังสร้างสะพาน"
 *   - มีตัวเลขตามหลัง ("C8", "S3")   → ชั้น 1-3 เหลืองเข้ม, ชั้น 4-7 ตามตัวเลข
 *                                       popup "สะพานแล้วเสร็จ"
 *     (รวมถึง "C0" และเลขติดลบ → เหลืองเข้ม, ชั้น 4-7 ว่าง)
 *   ชั้น 1-3 = Subbase/Subgrade, F/N Subballast, Bottom Ballast
 *   (ชั้น 3 เป็นสีเหลืองตามสถานะสะพานเสมอ ไม่ขึ้นกับตัวเลข)
 */

class ProgressManager {

    // ─── ค่าคงที่ ───────────────────────────────────────────────────────────
    static THRESHOLDS = {
        subballast:    1,
        bottomBallast: 2,
        sleeper:       3,
        rail_prog:     4, 
        rail_done:     5, 
        fastener:      6,
        tamping_prog:  7,
        tamping_done:  8,
    };

    constructor(map, dataUrl = 'data/json/km_data.json', dataProgress = 'data/json/track_progress.json') {
        this.map          = map;
        this.dataUrl      = dataUrl;
        this.dataProgress = dataProgress;

        this.keys      = ['subbase', 'subballast', 'bottomBallast', 'sleeper', 'rail', 'fastener', 'tamping'];
        this.keyLabels = ['Subbase/Subgrade', 'F/N Subballast', 'Bottom Ballast', 'Sleeper', 'Rail/Flash Butt', 'Fastener', 'Final Tamping'];

        this.trackData = [];
        this.meta      = {};
        this.popupTimer = null;
        this.popupEl    = null;
        this._warnedSlots = new Set(); // กัน console.warn ซ้ำสำหรับค่าที่ผิดรูปแบบ

        this.initUI();
        this.setupMapEvents();
        this.setupHoverSync();
        this.loadData();
    }

    // ─── โหลดข้อมูล ──────────────────────────────────────────────────────────
    async loadData() {
        try {
            const [kmRes, progressRes] = await Promise.all([
                fetch(this.dataUrl),
                fetch(this.dataProgress),
            ]);

            if (!kmRes.ok)       throw new Error(`KMdata: HTTP ${kmRes.status}`);
            if (!progressRes.ok) throw new Error(`progressTW: HTTP ${progressRes.status}`);

            const kmJson       = await kmRes.json();
            const progressJson = await progressRes.json();

            const kmMap  = new Map();
            const kmRows = Array.isArray(kmJson) ? kmJson : (kmJson.stations || []);
            kmRows.forEach(item => {
                const key = Math.round(parseFloat(item.km) * 10);
                kmMap.set(key, { lat: item.lat ?? null, lng: item.lng ?? null });
            });

            let stations;
            if (Array.isArray(progressJson)) {
                this.meta = {};
                stations  = progressJson;
            } else {
                this.meta = progressJson.meta || {};
                stations  = progressJson.stations || [];
            }

            this.trackData = this.prepareData(stations, kmMap);
            this.updateProgressUI();

        } catch (error) {
            console.error('[ProgressManager] loadData error:', error);
        }
    }

    // ─── เตรียมข้อมูล ────────────────────────────────────────────────────────
    prepareData(stations, kmMap) {
        return stations.map(item => {
            const km    = parseFloat(item.km);
            const kmKey = Math.round(km * 10);
            const coord = kmMap.get(kmKey) || { lat: null, lng: null };

            const hasSlots = Array.isArray(item.up) && Array.isArray(item.down);

            // ── slots ต่อ 100ม. (ปกติ 10 ค่า, กม.สุดท้ายอาจน้อยกว่า) ──────────
            const upSlots   = hasSlots ? item.up   : Array(10).fill(0);
            const downSlots = hasSlots ? item.down : Array(10).fill(0);

            return {
                km,
                staLabel:  item.sta || this.formatSTA(km * 1000),
                lat:       coord.lat,
                lng:       coord.lng,
                // เก็บ state แต่ละ 100ม. เป็น array
                upSubs:    upSlots.map(slotVal => this.aggregateSingle(slotVal)),
                downSubs:  downSlots.map(slotVal => this.aggregateSingle(slotVal)),
            };
        });
    }

    // ─── แยกค่า slot → { tag, num, valid } ──────────────────────────────────
    // tag : 'C' | 'S' | 'V' | null   (null = ไม่ใช่สะพาน)
    // num : จำนวนเต็ม หรือ null (null = ไม่มีตัวเลขตามหลังตัวอักษร)
    // valid : false ถ้ารูปแบบไม่ถูกต้อง (เช่น "X5") → แสดงเป็นช่องว่าง
    parseSlot(raw) {
        const s = String(raw ?? '0').trim().toUpperCase();

        // ค่าว่าง นับเป็น 0
        if (s === '') return { tag: null, num: 0, valid: true };

        const m = s.match(/^([CSV])?(-?\d+)?$/);
        if (!m) {
            if (!this._warnedSlots.has(s)) {
                this._warnedSlots.add(s);
                console.warn(`[ProgressManager] ค่า slot ไม่ถูกต้อง: "${raw}" (แสดงเป็นช่องว่าง)`);
            }
            return { tag: null, num: 0, valid: false };
        }

        const tag = m[1] || null;
        const num = m[2] != null ? parseInt(m[2], 10) : null;

        // ไม่มีตัวอักษรและไม่มีตัวเลข (ไม่ควรเกิดหลังเช็คค่าว่างแล้ว) → 0
        return { tag, num: (tag === null && num === null) ? 0 : num, valid: true };
    }

    // ─── Aggregate สำหรับ slot เดียว (1 ค่า = 1 ช่วง 100ม.) ────────────────
    // ค่าที่คืน:
    //   subbase       : 0 | 2 (done) | -2 (subgrade) | -3 (embankment) | 'bridge-prog' | 'bridge-done'
    //   subballast    : 0 | 2 (done) | 'bridge-prog' | 'bridge-done'
    //   bottomBallast : 0 | 2 (done) | 'bridge-prog' | 'bridge-done'
    //   sleeper, fastener : 0 | 2
    //   rail, tamping : 0 | 1 (prog) | 2 (done)
    //   bridge        : null | 'prog' | 'done'   (ใช้กับ popup)
    aggregateSingle(slotVal) {
        const T = ProgressManager.THRESHOLDS;
        const { tag, num, valid } = this.parseSlot(slotVal);

        const result = {
            subbase: 0, subballast: 0, bottomBallast: 0, sleeper: 0,
            rail: 0, fastener: 0, tamping: 0, bridge: null,
        };

        // รูปแบบผิด → ช่องว่างทั้งหมด
        if (!valid) return result;

        const isBridge = tag !== null;
        const val = num ?? 0; // ใช้กำหนดชั้น 4-7 (สะพานที่ไม่มีเลข = 0 → ว่าง)

        // ── ชั้น 1-3: Subbase/Subgrade, F/N Subballast, Bottom Ballast ─────
        if (isBridge) {
            // มีตัวเลขตามหลัง = สะพานแล้วเสร็จ (เหลืองเข้ม) / ไม่มี = กำลังสร้าง (เหลืองอ่อน)
            const done = num !== null;
            result.bridge     = done ? 'done' : 'prog';
            result.subbase    = done ? 'bridge-done' : 'bridge-prog';
            result.subballast = done ? 'bridge-done' : 'bridge-prog';
            result.bottomBallast = done ? 'bridge-done' : 'bridge-prog';
        } else if (val >= T.subballast) {
            result.subbase    = 2; // งานถึง subballast แสดงว่า subbase เสร็จแล้ว
            result.subballast = 2;
        } else if (val === -1) {
            result.subbase = 2;    // Subbase done
        } else if (val === -2) {
            result.subbase = -2;   // Subgrade
        } else if (val === -3) {
            result.subbase = -3;   // Embankment
        }

        // ── ชั้น 3: Bottom Ballast (ช่องปกติเท่านั้น สะพานถูกกำหนดเป็นสีเหลืองข้างบนแล้ว)
        if (!isBridge) {
            result.bottomBallast = val >= T.bottomBallast ? 2 : 0;
        }

        // ── ชั้น 4-7: ใช้กติกาเดียวกันทั้งช่องปกติและสะพาน (สีปกติตามตัวเลข) ─
        result.sleeper       = val >= T.sleeper       ? 2 : 0;
        result.rail          = val >= T.rail_done ? 2 : val >= T.rail_prog ? 1 : 0;
        result.fastener      = val >= T.fastener      ? 2 : 0;
        result.tamping       = val >= T.tamping_done ? 2 : val >= T.tamping_prog ? 1 : 0;

        return result;
    }

    // ─── Utility ─────────────────────────────────────────────────────────────
    formatSTA(meters) {
        const km = Math.floor(meters / 1000);
        const m  = String(Math.round(meters % 1000)).padStart(3, '0');
        return `${km}+${m}`;
    }
    
    formatThaiDate(isoDate) {
        if (!isoDate) return '';
        const [y, m, d] = isoDate.split('-');
        if (!y || !m || !d) return isoDate;
        return `${d}/${m}/${y}`;
    }

    // ─── ข้อความสถานะใน Popup (ใช้ร่วมกันทั้ง Up/Down) ──────────────────────
    // ลำดับความสำคัญ: สะพาน → Subgrade → Embankment → Subbase → (ไม่แสดง)
    // ไม่แสดงสถานะงานราง
    getStatusText(subState) {
        if (subState.bridge === 'prog') return 'กำลังสร้างสะพาน';
        if (subState.bridge === 'done') return 'สะพานแล้วเสร็จ';
        if (subState.subbase === -2)    return 'Subgrade เสร็จสิ้น';
        if (subState.subbase === -3)    return 'กำลังก่อสร้าง: Embankment';
        if (subState.subbase === 2 && subState.subballast === 0) return 'งาน Subbase เสร็จสิ้น';
        return '';
    }

    buildPopupTitle(direction, km, subIdx, subState) {
        const label = direction === 'up' ? '⬆️ Up' : '⬇️ Down';
        const m     = String(subIdx * 100).padStart(3, '0');
        let title   = `${label} กม.${km}+${m}`;

        const status = this.getStatusText(subState);
        if (status) {
            const subStyle = 'font-size:11px; font-weight:400; opacity:0.85;';
            title += `<br><span style="${subStyle}">${status}</span>`;
        }
        return title;
    }

    // ─── Toggle เลเยอร์ กม.ก่อสร้าง ──────────────────────────────────────────
    // ★ FIX: ไม่ toggle STA layer ตรงๆ อีกต่อไป — ให้ window.syncStaLayer
    //   (ใน tw_progress.js) เป็นเจ้าของสิทธิ์เดียวที่จำ/คืนค่าสถานะเดิมของผู้ใช้
    //   เมธอดนี้เก็บไว้เผื่อมีโค้ดเก่าเรียกตรงๆ แต่ภายในจะ delegate ไปที่
    //   window.syncStaLayer แทน เพื่อไม่ให้เกิด race condition กับ setTimeout(50ms)
    //   ใน syncStaLayer เหมือนเดิม (เปิด/ปิดชนกัน STA กระพริบ)
    toggleStaLayer(isVisible) {
        if (typeof window.syncStaLayer === 'function') {
            window.syncStaLayer(isVisible);
        }
    }

    // ─── ควบคุมการเปิด-ปิด (แทน Event ของปุ่มลอยเดิม) ──────────────────────────────────
    toggle(forceShow) {
        // เช็คสถานะปัจจุบัน
        const isCurrentlyHidden = this.panel.style.display === 'none';
        
        // ถ้าบังคับสถานะ (forceShow) มา ให้ใช้ค่านั้น ถ้าไม่ได้ส่งมาให้สลับข้าง(toggle)
        const willShow = typeof forceShow === 'boolean' ? forceShow : isCurrentlyHidden;

        this.panel.style.display = willShow ? 'flex' : 'none';
        
        if (willShow) {
            this.updateProgressUI();
            if (typeof logUserEvent === 'function') {
                logUserEvent("Open Progress Manager", "ผู้ใช้งานกดเปิดหน้าต่าง Track Progress");
            } else {
                console.warn("ไม่พบฟังก์ชัน logUserEvent");
            }
        } else {
             this.hidePopup(); // ปิด popup ด้วยถ้าหากเปิดทิ้งไว้แล้วปิดหน้าต่าง
        }

        // ★ FIX: ลบการ sync checkbox "Track Progress" ออกจากจุดนี้
        // เพราะ window.toggleTrackProgress (tw_progress.js) sync ให้แล้วทุกครั้งก่อนเรียก toggle()
        // การ sync ซ้ำสองที่ไม่ทำให้พัง แต่เป็นโค้ดซ้ำซ้อนที่ไม่จำเป็นและเสี่ยงต่อการดูแลต่อในอนาคต

        // ★ FIX: ลบ this.toggleStaLayer(willShow) ออกจาก path หลักนี้
        // เพราะเมื่อเรียกผ่าน window.toggleTrackProgress, syncStaLayer(targetState)
        // ถูกเรียกไปก่อนหน้านี้แล้วในไฟล์ tw_progress.js — การเรียกซ้ำที่นี่โดยไม่มี memory
        // คือสาเหตุที่ทำให้เลเยอร์ กม.ก่อสร้าง กระพริบ (ปิดทันทีแล้วเปิดกลับใน 50ms)
        // หากในอนาคตมีที่อื่นเรียก instance.toggle() ตรงๆ โดยไม่ผ่าน toggleTrackProgress
        // ให้เรียก window.syncStaLayer(willShow) เอง ณ จุดเรียกนั้น แทนการพึ่งพาที่นี่
    }

    // ─── สร้าง UI ────────────────────────────────────────────────────────────
    initUI() {
        const old = document.getElementById('track-progress-panel');
        if (old) old.remove();

        // legend เรียงจาก Tamping (บน) → Sub (ล่าง) 
        let legendHtml = '';
        [...this.keyLabels].reverse().forEach((label, idx) => {
            const keyIdx = this.keys.length - 1 - idx;
            const key = this.keys[keyIdx];
            
            if (key === 'rail') {
                legendHtml += `
                    <div class="legend-task-item" data-layer="${key}">
                        <span class="legend-dot dot-rail-prog"></span>Rail
                        <span class="legend-dot dot-rail-done" style="margin-left: 9px;"></span>Flash Butt
                    </div>`;
            } 
            else if (key === 'tamping') {
                legendHtml += `
                    <div class="legend-task-item" data-layer="${key}">
                        <span class="legend-dot dot-tamping-prog"></span>First
                        <span class="legend-dot dot-tamping-done" style="margin-left: 6px;"></span>Final Tamp
                    </div>`;
            }
            else if (key === 'subbase') {
                legendHtml += `
                    <div class="legend-task-item" data-layer="${key}">
                        <span class="legend-dot dot-subgrade"></span>Subgrade
                        <span class="legend-dot dot-subbase" style="margin-left: 6px;"></span>Subbase
                    </div>`;
            }
            else {
                legendHtml += `
                    <div class="legend-task-item" data-layer="${key}">
                        <span class="legend-dot dot-${key}"></span>${label}
                    </div>`;
            }
        });

        document.body.insertAdjacentHTML('beforeend', `
            <div id="progress-custom-popup" class="progress-custom-popup"></div>

            <div id="track-progress-panel" class="progress-panel-container">
                <div class="progress-header">
                    <div class="progress-track-title-container">
                        <div class="progress-title-wrapper">
                            <span id="progress-track-title">ความคืบหน้างานราง: Trackworks</span>
                            <span id="progress-track-subtitle" class="progress-track-subtitle">Update : -</span>
                        </div>
                        <button class="bp-close-btn" title="ปิดหน้าต่าง">&times;</button>
                    </div>
                </div>

                <div class="dual-track-layout">
                    <div class="track-labels">
                        <div class="label-row"><span class="track-icon">⬆️</span> Up <br>Track</div>
                        <div class="label-axis">STA (กม.)</div>
                        <div class="label-row"><span class="track-icon">⬇️</span> Down <br>Track</div>
                    </div>

                    <div id="track-data-area" class="track-data-area">
                        <div id="row-up"   class="data-row"></div>
                        <div id="row-axis" class="axis-row"></div>
                        <div id="row-down" class="data-row"></div>
                    </div>

                    <div class="track-legend-right">
                        <div class="legend-tasks-group">${legendHtml}</div>
                        <div class="label-axis"></div>
                        <div class="legend-tasks-group">${legendHtml}</div>
                    </div>
                </div>
            </div>
        `);

        this.panel   = document.getElementById('track-progress-panel');
        this.rowUp   = document.getElementById('row-up');
        this.rowAxis = document.getElementById('row-axis');
        this.rowDown = document.getElementById('row-down');

        // ผูกตัวแปร Popup และกำหนด Event ให้กดคลิกเพื่อปิด
        this.popupEl = document.getElementById('progress-custom-popup');
        this.popupEl.addEventListener('click', () => this.hidePopup());

        // ดักจับตอนเลื่อน Scroll แถบแนวนอน ให้ปิด Popup
        const dataArea = document.getElementById('track-data-area');
        if (dataArea) {
            dataArea.addEventListener('scroll', () => this.hidePopup());
        }

        this.panel.querySelector('.bp-close-btn').addEventListener('click', () => {
            if (typeof logUserEvent === 'function') {
                logUserEvent("Close Progress Manager", "ผู้ใช้งานกด ปิดหน้าต่าง Track Progress ด้วยปุ่มกากบาท");
            }
            // ★ FIX: ห้ามเรียก this.toggle(false) ตรงๆ อีกต่อไป เพราะ toggle() ทำแค่
            // ซ่อน/แสดง panel เท่านั้น (ไม่ยุ่งกับ STA layer และไม่ sync checkbox
            // "Track Progress" แล้ว หลังการแก้ไขรอบก่อน) ทำให้ปุ่มกากบาทไม่ปิด STA
            //
            // ให้เรียก window.toggleTrackProgress(false) แทน — เป็นจุดเดียวกันกับที่
            // layer checkbox ("layer_track_progress" case ใน main.js) เรียกใช้ตอนปิด
            // เพื่อให้ทั้งสองทาง (ปุ่มกากบาท / ติ๊กปิดเลเยอร์) มีลำดับการทำงานเหมือนกัน
            // เป๊ะ 100%: sync checkbox "Track Progress" → syncStaLayer(false) (คืนค่า STA
            // เดิมด้วย memory+delay 50ms) → this.toggle(false) (ซ่อน panel จริง)
            if (typeof window.toggleTrackProgress === 'function') {
                window.toggleTrackProgress(false);
            } else {
                // fallback เผื่อ toggleTrackProgress ยังไม่ถูกโหลด (ไม่ควรเกิดขึ้นในทางปฏิบัติ)
                this.toggle(false);
            }
        });

        this.panel.style.display = 'none';
    }

    // ─── Map events ──────────────────────────────────────────────────────────
    setupMapEvents() {
        let timer;
        const handler = () => {
            clearTimeout(timer);
            timer = setTimeout(() => this.updateProgressUI(), 300);
        };
        this.map.on('moveend', handler);
        this.map.on('zoomend', handler);

        // สั่งซ่อน Popup ทันทีที่ผู้ใช้เริ่มขยับแผนที่ หรือซูมแผนที่
        this.map.on('movestart', () => this.hidePopup());
        this.map.on('zoomstart', () => this.hidePopup());
    }

    // ─── Hover sync ──────────────────────────────────────────────────────────
    setupHoverSync() {
        if (!this.panel) return;
        const toggle = (e, add) => {
            const el    = e.target.closest('[data-layer]');
            if (!el) return;
            const layer = el.getAttribute('data-layer');
            if (layer) {
                this.panel.querySelectorAll(`[data-layer="${layer}"]`)
                          .forEach(n => n.classList.toggle('hover-active', add));
            }
        };
        this.panel.addEventListener('mouseover', e => toggle(e, true));
        this.panel.addEventListener('mouseout',  e => toggle(e, false));
    }

    // ─── อัปเดต UI ───────────────────────────────────────────────────────────
    updateProgressUI() {
        if (this.trackData.length === 0 || this.panel.style.display === 'none') return;

        const subtitle = document.getElementById('progress-track-subtitle');
        if (subtitle && this.meta.updated) {
            subtitle.textContent = 'Update : ' + this.formatThaiDate(this.meta.updated);
        }

        const bounds      = this.map.getBounds();
        const visibleData = this.trackData.filter(item => {
            if (item.lat == null || item.lng == null) return false;
            return bounds.contains([item.lng, item.lat]);
        });

        this.renderChart(visibleData);
    }

    // ─── Render chart ────────────────────────────────────────────────────────
    renderChart(visibleData) {
        this.hidePopup(); // ปิด popup หากมีการวาดตารางใหม่

        this.rowUp.innerHTML   = '';
        this.rowAxis.innerHTML = '';
        this.rowDown.innerHTML = '';

        if (visibleData.length === 0) {
            this.rowAxis.innerHTML =
                '<div class="chart-message">เลื่อนแผนที่ไปยังพื้นที่ก่อสร้างเพื่อดูข้อมูล</div>';
            return;
        }

        // จำนวน station ที่จะแสดง (แต่ละ station = 10 ช่อง)
        // จำกัดไม่เกิน 30 station เพื่อไม่แน่น
        if (visibleData.length > 30) {
            this.rowAxis.innerHTML =
                '<div class="chart-message">กรุณาซูมเข้าเพื่อดูรายละเอียดช่วง กม.</div>';
            return;
        }

        visibleData.sort((a, b) => a.km - b.km).forEach((item, stIdx) => {
            const isFirst = stIdx === 0;

            // ── Up Track: สร้าง sub-blocks (ปกติ 10 ช่อง) ─────────────────
            const upGroup = document.createElement('div');
            upGroup.className = 'km-group'; 

            item.upSubs.forEach((subState, subIdx) => {
                const title = this.buildPopupTitle('up', item.km, subIdx, subState);
                upGroup.appendChild(this.createBlock(subState, title));
            });
            this.rowUp.appendChild(upGroup);

            // ── Axis: label กม. กึ่งกลาง group ────────────────────────────
            const axisGroup = document.createElement('div');
            axisGroup.className = 'axis-km-group' + (isFirst ? '' : ' km-group-border');

            const tick = document.createElement('div');
            tick.className = 'axis-tick';
            tick.innerHTML = `<span class="tick-km">${item.km}</span>`;
            axisGroup.appendChild(tick);
            this.rowAxis.appendChild(axisGroup);

            // ── Down Track ──────────────────────────────────────────────────
            const downGroup = document.createElement('div');
            downGroup.className = 'km-group'; 

            item.downSubs.forEach((subState, subIdx) => {
                const title = this.buildPopupTitle('down', item.km, subIdx, subState);
                downGroup.appendChild(this.createBlock(subState, title));
            });
            this.rowDown.appendChild(downGroup);
        });
    }

    // ─── สร้าง Sub-Block (100ม.) ──────────────────────────────────────────────
    createBlock(progressObj, title) {
        const block     = document.createElement('div');
        block.className = 'progress-block';
        
        // เปลี่ยนจากการใช้ title ปกติ เป็น data-title เพื่อป้องกัน Default Tooltip บังกัน
        block.dataset.title = title;

        let html = '';
        this.keys.forEach((k, idx) => {
            const state = progressObj[k];
            const n     = idx + 1; // เลเยอร์ที่ 1-7 ตามลำดับ
            const layer = (cls) => `<div class="progress-layer layer-${n} ${cls}" data-layer="${k}"></div>`;
            const empty = `<div class="progress-layer layer-incomplete" data-layer="${k}"></div>`;
            
            if (k === 'subbase') {
                // ชั้น 1: Subbase/Subgrade/Embankment + สะพาน
                if      (state === 'bridge-done') html += layer('bridge-done');
                else if (state === 'bridge-prog') html += layer('bridge-prog');
                else if (state === 2)             html += layer('done');
                else if (state === -2)            html += layer('subgrade');
                else if (state === -3)            html += layer('embankment');
                else                              html += empty;
            } else if (k === 'subballast' || k === 'bottomBallast') {
                // ชั้น 2-3: F/N Subballast, Bottom Ballast + สะพาน
                if      (state === 'bridge-done') html += layer('bridge-done');
                else if (state === 'bridge-prog') html += layer('bridge-prog');
                else if (state === 2)             html += layer('done');
                else                              html += empty;
            } else {
                // ชั้น 4-7: สีปกติ (สะพานไม่มีสีพิเศษ)
                if      (state === 2) html += layer('done');
                else if (state === 1) html += layer('prog');
                else                  html += empty;
            }
        });
        
        block.innerHTML = html;

        // ผูก Event Click ให้ Block แต่ละอัน
        block.addEventListener('click', (e) => {
            e.stopPropagation(); // ป้องกันเหตุการณ์ซ้อนทับกัน
            this.showPopup(block, title);
        });

        return block;
    }

    // ─── ระบบ Custom Popup ────────────────────────────────────────────────────
    showPopup(element, text) {
        if (!this.popupEl) return;

        // เคลียร์ Timer เดิมถ้ามีการคลิกรัวๆ
        if (this.popupTimer) clearTimeout(this.popupTimer);

        // ใส่ข้อความและสั่งโชว์ เพื่อให้ Browser คำนวณความกว้างได้
        this.popupEl.innerHTML = text;
        this.popupEl.classList.add('show');

        // ใช้ requestAnimationFrame เพื่อให้รอ HTML อัปเดตขนาดให้เสร็จก่อน แล้วค่อยคำนวณตำแหน่ง
        requestAnimationFrame(() => {
            // ดึงพิกัดและขนาดของ Block ที่ถูกคลิก
            const rect = element.getBoundingClientRect();
            // ดึงขนาดของ Popup ตัวเอง
            const popupRect = this.popupEl.getBoundingClientRect();

            // คำนวณให้อยู่กึ่งกลาง Block (X) และอยู่เหนือ Block (Y)
            let left = rect.left + (rect.width / 2) - (popupRect.width / 2);
            let top = rect.top - popupRect.height - 5; 

            // ป้องกันไม่ให้ Popup ล้นขอบจอด้านซ้ายหรือขวา
            if (left < 10) left = 10;
            if (left + popupRect.width > window.innerWidth - 10) left = window.innerWidth - popupRect.width - 10;

            this.popupEl.style.left = `${left}px`;
            this.popupEl.style.top = `${top}px`;
        });

        // ตั้งเวลา 5 วินาทีให้หายไปเอง
        this.popupTimer = setTimeout(() => {
            this.hidePopup();
        }, 5000);
    }

    hidePopup() {
        if (this.popupEl) {
            this.popupEl.classList.remove('show');
        }
        if (this.popupTimer) {
            clearTimeout(this.popupTimer);
            this.popupTimer = null;
        }
    }
}

/* ════════════════════════════════════════════════════════════════════════
 * ส่วนควบคุม (เดิม tw_progress.js)
 * ════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  const ID = 'layer_track_progress';
  let manager = null;
  let staBefore = null;            // สถานะชั้น กม.ก่อสร้าง ก่อนเปิดแผง (null = ไม่ได้จำ)
  let changingSta = false;

  function staCheckbox() { return document.getElementById('ov_showSTA'); }
  function setOverlay(id, on) {
    const cb = document.getElementById('ov_' + id);
    if (!cb || cb.checked === on) return;
    cb.checked = on;
    cb.dispatchEvent(new Event('change'));
  }

  // เดิม window.syncStaLayer
  function syncSta(opening) {
    const cb = staCheckbox();
    if (!cb) return;
    changingSta = true;
    if (opening) {
      if (staBefore === null) staBefore = cb.checked;
      if (!cb.checked) setOverlay('showSTA', true);
    } else if (staBefore !== null) {
      const target = staBefore;
      staBefore = null;
      setTimeout(() => { changingSta = true; setOverlay('showSTA', target); changingSta = false; }, 50);
    }
    changingSta = false;
  }

  function show(on) {
    if (!manager) {
      manager = new ProgressManager(BPNP.map.instance);
      window.progressManagerInstance = manager;
    }
    manager.toggle(on);
    manager.isVisible = on;
  }

  // ปุ่มปิดในแผง / ปุ่มลัด → ผ่านช่องติ๊กในรายการ (จุดเดียวกัน บันทึกสถานะให้เอง)
  window.toggleTrackProgress = forceShow => {
    const cur = BPNP.map.registry.isVisible(ID);
    const target = typeof forceShow === 'boolean' ? forceShow : !cur;
    const cb = document.getElementById('ov_' + ID);
    if (cb) { if (cb.checked !== target) { cb.checked = target; cb.dispatchEvent(new Event('change')); } }
    else BPNP.map.registry.setVisible(ID, target);
  };
  window.syncStaLayer = syncSta;

  function register() {
    BPNP.map.registry.register(ID, {
      slot: 'progress',
      build: () => ({}),
      onShow: () => { syncSta(true); show(true); },
      onHide: () => { if (manager) show(false); syncSta(false); }
    });
    // ผู้ใช้ติ๊กชั้น กม.ก่อสร้างเองระหว่างเปิดแผง → ไม่ต้องคืนค่าเดิม (เหมือนเดิม)
    document.addEventListener('change', e => {
      if (!changingSta && e.target && e.target.id === 'ov_showSTA' && e.isTrusted) staBefore = null;
    });
    BPNP.ui.registerButton(() => {
      BPNP.ui.createStandardButton({
        id: 'progressBtn',
        imageSrc: 'assets/ui/find-progress.png',
        style: { bottom: 'calc(var(--safe-bottom) + 65px)', right: 'calc(var(--safe-right) + 60px)' },
        title: 'แสดง/ซ่อน ความคืบหน้างานวางราง',
        onClick: () => window.toggleTrackProgress()
      });
    });
  }

  BPNP.layers.utils.register({ name: 'track_progress', register });
})();
