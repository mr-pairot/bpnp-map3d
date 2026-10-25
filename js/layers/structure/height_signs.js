/* js/layers/structure/height_signs.js
 * ─────────────────────────────────────────────────────────────────────────
 * ป้ายจำกัดความสูงช่องลอด (เดิม HeightSignManager.js + HeightSignAlert.js)
 *   - เปิด/ปิดจากปุ่ม "ป้าย" ในรายการชั้นข้อมูล (แยกจากการเปิดชั้น Underpass เหมือนเดิม)
 *   - แสดงเมื่อซูม ≥ 13 (Leaflet 14) และอยู่ในจอ · ตัวเลขความสูงอ่านจากขนาดช่องลอด
 *   - เปิดแล้วแสดงกล่องอธิบายความหมายสีตัวเลข 20 วินาที
 *   - ใช้ซ้ำกับสะพานในเฟส 4 (กลุ่ม 'bridge')
 *
 *   BPNP.layers.heightSigns.registerGroup(name, loadItems, { anchorY })
 *     loadItems() → Promise<[{ lngLat, size, status, anchorY?, title?, titleBelow? }]>
 *   BPNP.layers.heightSigns.setEnabled(name, bool) / isEnabled(name)
 *
 * HTML marker: ห้ามกำหนด position ที่ element ราก (.height-limit-sign ใช้ ::before/::after อิงกับรากที่ MapLibre วางแบบ absolute)
 * ───────────────────────────────────────────────────────────────────────── */
'use strict';

(function injectHeightSignStyles() {
    if (document.getElementById('height-sign-style')) return;
    const style = document.createElement('style');
    style.id = 'height-sign-style';
    style.textContent = `
        /* --- สไตล์สำหรับป้ายจำกัดความสูง --- */
        .height-limit-sign {
            background-color: #ffffff;
            border: 3px solid #ef4444;
            border-radius: 50%;
            font-weight: 800;
            font-size: 10.5px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 2px 6px rgba(0,0,0,0.45);
            font-family: 'Inter', 'Sarabun', sans-serif;
            line-height: 1;
            width: 36px;
            height: 36px;
            pointer-events: none;
            user-select: none;
        }
        .height-limit-sign::before {
            content: ''; position: absolute; top: 3px; left: 50%;
            transform: translateX(-50%);
            border-left: 4.5px solid transparent;
            border-right: 4.5px solid transparent;
            border-top: 5px solid #111111;
        }
        .height-limit-sign::after {
            content: ''; position: absolute; bottom: 3px; left: 50%;
            transform: translateX(-50%);
            border-left: 4.5px solid transparent;
            border-right: 4.5px solid transparent;
            border-bottom: 5px solid #111111;
        }

        .no-entry-sign {
            background-color: #ef4444;
            border: 2px solid #ef4444;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: inset 0 0 0 2px #ffffff, 0 2px 6px rgba(0,0,0,0.45);
            width: 34px;
            height: 34px;
            box-sizing: border-box;
            pointer-events: none;
            user-select: none;
        }
        .no-entry-sign::before {
            content: '';
            width: 18px;
            height: 6px;
            background-color: #ffffff;
            border-radius: 0;
        }
    `;
    document.head.appendChild(style);
})();

(function () {
  const SIGN_SIZE = 34, SIGN_GAP = 4;
  // จุดยึดแนวตั้งเดิม (iconAnchor Y ของ Leaflet): Underpass 44 → ป้ายอยู่เหนือจุด 27 px
  //                                              Bridge −(7+4) → ป้ายอยู่ใต้วงกลม (กึ่งกลางต่ำกว่าจุด 28 px)
  const DEFAULT_ANCHOR_Y = 44;
  const MIN_ZOOM = BPNP.geo.fromLeafletZoom(14);
  const groups = {};

  // ความสูงจากข้อความขนาด เช่น "1-2.50x4.00" → 2.5 / "x" → ห้ามผ่าน (เดิม parseHeight)
  function parseHeight(raw) {
    if (!raw) return null;
    const t = String(raw).trim().toLowerCase();
    if (t === 'x') return 'NO_ENTRY';
    const nums = t.replace(/×|\*/g, 'x').match(/\d+(\.\d+)?/g);
    if (!nums || !nums.length) return null;
    const h = parseFloat(nums.length >= 3 ? nums[1] : nums[0]);
    return isNaN(h) ? null : h;
  }

  // ป้ายที่มีคำอธิบาย (ป้ายภาคสนาม): ชี้เมาส์แล้วแสดง STA / Offset / คำอธิบาย (เดิม bindTooltip ของ mark_Sign.js)
  let tip = null;
  function attachTooltip(el, it) {
    if (!it.title) return;
    el.style.cursor = 'pointer';
    el.addEventListener('mouseenter', () => {
      const map = BPNP.map.instance;
      if (tip) tip.remove();
      tip = new maplibregl.Popup({ closeButton: false, closeOnClick: false, className: 'bpnp-hover-label sign-tooltip',
        anchor: it.titleBelow ? 'top' : 'bottom', offset: it.titleBelow ? [0, 30] : [0, -30] })
        .setLngLat(it.lngLat).setHTML(it.title).addTo(map);
    });
    el.addEventListener('mouseleave', () => { if (tip) { tip.remove(); tip = null; } });
  }

  function element(value, status) {
    const el = document.createElement('div');
    if (value === 'NO_ENTRY') {
      el.className = 'no-entry-sign';
    } else {
      el.className = 'height-limit-sign';
      const color = String(status) === '0' ? '#ef4444' : '#111111';
      el.innerHTML = `<span style="color:${color} !important;font-weight:800;">${value.toFixed(1)}</span>` +
                     `<span style="font-size:9px;margin-left:1px;font-weight:700;">m</span>`;
    }
    return el;
  }

  async function ensureSet(name) {
    const g = groups[name];
    if (g.set) return g.set;
    if (!g.loading) {
      g.loading = (async () => {
        const raw = await g.loadItems();
        const used = {};
        const items = [];
        raw.forEach(it => {
          const value = parseHeight(it.size);
          if (value === null) return;
          const key = it.lngLat[0].toFixed(5) + ',' + it.lngLat[1].toFixed(5);
          const slot = used[key] || 0;            // ป้ายซ้อนตำแหน่งเดียวกัน → เรียงไปทางซ้าย (เหมือนเดิม)
          used[key] = slot + 1;
          items.push({ lngLat: it.lngLat, value, status: it.status, slot, anchorY: it.anchorY, title: it.title, titleBelow: it.titleBelow });
        });
        g.set = BPNP.layers.utils.htmlMarkerSet(BPNP.map.instance, {
          items,
          variant: z => (z >= MIN_ZOOM ? 'sign' : null),
          create: it => {
            const el = element(it.value, it.status);
            attachTooltip(el, it);
            const ay = it.anchorY ?? g.anchorY;   // จุดยึดรายป้าย (ป้ายภาคสนาม) หรือของกลุ่ม
            return { element: el, anchor: 'center', offset: [-(it.slot * (SIGN_SIZE + SIGN_GAP)), -(ay - SIGN_SIZE / 2)] };
          }
        });
        return g.set;
      })().catch(err => { g.loading = null; throw err; });
    }
    return g.loading;
  }

  function registerGroup(name, loadItems, opts = {}) {
    groups[name] = { loadItems, enabled: false, set: null, loading: null, anchorY: opts.anchorY ?? DEFAULT_ANCHOR_Y };
  }

  async function setEnabled(name, on) {
    const g = groups[name];
    if (!g) return false;
    g.enabled = !!on;
    try {
      if (on) (await ensureSet(name)).setEnabled(true);
      else if (g.set) g.set.setEnabled(false);
    } catch (err) {
      console.error('[HeightSigns] โหลดข้อมูลไม่สำเร็จ:', err);
      g.enabled = false;
      return false;
    } finally {
      HeightSignAlert.update();
    }
    return true;
  }

  BPNP.layers.heightSigns = {
    registerGroup, setEnabled, parseHeight,
    isEnabled: name => !!(groups[name] && groups[name].enabled),
    has: name => !!groups[name]
  };
})();

(function injectHeightSignAlertStyles() {
    if (document.getElementById('height-sign-alert-style')) return;
    
    const style = document.createElement('style');
    style.id = 'height-sign-alert-style';
    style.textContent = `
        .height-sign-alert-box {
            position: fixed;
            bottom: var(--safe-bottom, 20px); 
            left: 50%;
            transform: translate(-50%, 150%); 
            width: 90%;
            max-width: 380px; /* ปรับขนาดความกว้างให้พอดีกับการอ่านบนมือถือ */
            background-color: rgba(13, 43, 69, 0.95);
            color: #ffffff;
            border: 1px solid rgba(255, 255, 255, 0.2);
            border-radius: 12px; /* ปรับมุมให้โค้งมนดูนุ่มนวลขึ้น */
            box-shadow: 0 8px 24px rgba(0,0,0,0.5);
            padding: 12px 16px; /* ใช้ padding จัดพื้นที่ว่างภายใน */
            display: flex;
            flex-direction: column;
            font-family: 'Sarabun', sans-serif;
            font-size: 11px;
            line-height: 1.5;
            z-index: 1001;
            transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            pointer-events: none;
        }
        .height-sign-alert-box.show-alert {
            transform: translate(-50%, 0);
        }
        
        /* สไตล์สำหรับส่วนหัวข้อ */
        .alert-header {
            display: flex;
            align-items: center;
            font-size: 13px;
            font-weight: bold;
            border-bottom: 1px solid rgba(255, 255, 255, 0.15);
            padding-bottom: 6px;
            margin-bottom: 8px;
            color: #f8fafc;
        }
        .height-sign-alert-icon {
            font-size: 16px;
            margin-right: 8px;
            color: #fcd34d;
            animation: warnBounce 1.8s ease-in-out infinite;
        }
        
        /* สไตล์สำหรับข้อความอธิบาย */
        .alert-text-group p {
            margin: 2px 0;
            color: #e2e8f0;
        }
        .alert-subtext {
            color: #94a3b8;
            font-size: 10px;
            margin-bottom: 8px !important;
        }
        
        /* สไตล์สำหรับกล่องบอกความหมายสี (Legend) */
        .alert-legend-container {
            display: flex;
            flex-direction: column;
            gap: 5px;
            background: rgba(0, 0, 0, 0.25);
            padding: 8px 10px;
            border-radius: 6px;
        }
        .alert-legend-item {
            display: flex;
            align-items: center;
        }
        .legend-badge {
            font-weight: 700;
            background: rgba(255, 255, 255, 0.9);
            padding: 2px 6px;
            border-radius: 4px;
            margin-right: 8px;
            display: inline-block;
            min-width: 55px;
            text-align: center;
        }
        .legend-badge.red { color: #ef4444; }
        .legend-badge.black { color: #111111; }

        @keyframes warnBounce {
            0%, 100% { transform: scale(1); }
            20%  { transform: scale(1.3) translateY(-2px); }
            40%  { transform: scale(0.9) translateY(1px); }
            60%  { transform: scale(1.15) translateY(-1px); }
            80%  { transform: scale(0.95) translateY(1px); }
        }
    `;
    document.head.appendChild(style);
})();

const HeightSignAlert = {
    _hideTimeout: null, 

    init: function() {
        if (document.getElementById('height-sign-alert-container')) return;
        
        const alertDiv = document.createElement('div');
        alertDiv.id = 'height-sign-alert-container';
        alertDiv.className = 'height-sign-alert-box';
        alertDiv.innerHTML = `
            <div class="alert-header">
                <span class="height-sign-alert-icon">⚠️</span>
                <span>ข้อมูลป้ายความสูงช่องลอด</span>
            </div>
            
            <div class="alert-text-group">
                <p>• ตัวเลขบนป้ายคือ <b>ช่องลอดจริงในสนาม</b> (ไม่ใช่ตัวเลขหน้าป้าย)</p>
                <p class="alert-subtext">* ไม่แสดงข้อมูล = รอการสำรวจ</p>
            </div>
            
            <div class="alert-legend-container">
                <div class="alert-legend-item">
                    <span class="legend-badge red">อักษรสีแดง</span> 
                    <span>ใช้ค่าอ้างอิงจากระดับดินเดิม</span>
                </div>
                <div class="alert-legend-item">
                    <span class="legend-badge black">อักษรสีดำ</span> 
                    <span>ใช้ค่าออกแบบใหม่ (อนุมัติแล้ว)</span>
                </div>
            </div>
        `;
        
        document.body.appendChild(alertDiv);
    },

    update: function() {
        this.init(); 
        
        const alertDiv = document.getElementById('height-sign-alert-container');
        if (!alertDiv) return;

        const isUnderpassActive = !!(BPNP.layers.heightSigns && BPNP.layers.heightSigns.isEnabled('underpass'));
        const isBridgeActive = !!(BPNP.layers.heightSigns && BPNP.layers.heightSigns.isEnabled('bridge'));

        if (this._hideTimeout) {
            clearTimeout(this._hideTimeout);
            this._hideTimeout = null;
        }

        if (isUnderpassActive || isBridgeActive) {
            alertDiv.classList.add('show-alert');
            
            this._hideTimeout = setTimeout(() => {
                alertDiv.classList.remove('show-alert');
            }, 20000);

        } else {
            alertDiv.classList.remove('show-alert');
        }
    }
};
