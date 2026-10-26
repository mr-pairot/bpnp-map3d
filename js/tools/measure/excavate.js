/* js/tools/measure/excavate.js
 * ─────────────────────────────────────────────────────────────────────────
 * เฟส 5C: mpex.js (ปริมาตรบ่อขุด หลายชั้น + รูปตัด) เดิม — คัดลอกตรงทั้งไฟล์ ทำงานผ่าน Leaflet ชุดย่อยใน lcompat.js (ไม่ใช่ Leaflet จริง)
 * ───────────────────────────────────────────────────────────────────────── */
(function (L) {
//  mpex.js
//  Depends on: Leaflet 1.7, Turf.js 6, MeasurePlus

(function injectStyles() {
  const css = `
    :root {
      /* ==== COLORS ==== */
      --exc-color-bg:             #ffffff;
      --exc-color-surf:           #f8f9fa;
      --exc-color-surf2:          #ffffff;
      --exc-color-surf-hover:     #f6fbfe;
      --exc-color-border:         #dee2e6;
      --exc-color-border-dim:     #eeeeee;
      --exc-color-border-input:   #adb5bd;
      
      --exc-color-primary:        #0d6efd;
      --exc-color-primary-dark:   #0a58ca;
      --exc-color-primary-bar:    rgba(0,219,255,0.15);
      
      --exc-color-text-main:      #212529;
      --exc-color-text-title:     #333333;
      --exc-color-text-muted:     #6c757d;
      --exc-color-text-dim:       #888888;
      --exc-color-text-card:      #495057;
      --exc-color-text-btn:       #ffffff;
      --exc-color-danger:         #dc3545;
      
      --exc-color-icon:           #666666;
      --exc-color-icon-hover:     #990000;
      
      --exc-color-brown:          #7C4A1E;
      --exc-color-brown-light:    #8B5E3C;
      --exc-color-total-bg:       #e7f1ff;
      
      --exc-color-reset-bg:       #e2e8f0;
      --exc-color-reset-text:     #475569;
      --exc-color-reset-brd:      #cbd5e1;
      --exc-color-reset-hover-bg: #cbd5e1;
      --exc-color-reset-hover-text:#1e293b;
      --exc-color-reset-hover-brd: #94a3b8;

      --exc-color-svg-line:       #C8733A;
      --exc-color-svg-fill:       rgba(139,110,80,0.12);
      --exc-color-svg-acc:        #A0522D;
      --exc-fs-xs:       0.75rem;
      --exc-fs-sm:       0.80rem;
      --exc-fs-md:       0.85rem;
      --exc-fs-lg:       0.9rem;
      --exc-fs-xl:       1rem;
      --exc-fs-xxl:      1.5rem;
      --exc-fs-huge:     1.8rem;
      --exc-fs-base:     11px;
      --exc-fs-title:    13px;
      --exc-fs-sub:      12px;
      --exc-fs-icon:     19px;
      --exc-rad:         6px;
      --exc-pw:          264px;
      --exc-ph:          90vh;
      --exc-mono:        'Sarabun','Consolas','Courier New',monospace;
      --exc-sans:        'Sarabun','Segoe UI','Tahoma',sans-serif;
    }

    .exc-main-panel {
      position: fixed;
      top: var(--safe-top, 20px);
      right: var(--safe-right, 20px);
      width: var(--exc-pw);
      max-height: var(--exc-ph);
      background: var(--exc-color-bg);
      border-radius: var(--exc-rad);
      display: none;
      flex-direction: column;
      overflow: hidden; 
      
      box-shadow: 0 2px 5px rgba(0,0,0,0.4);
      z-index: 1001;
      transition: opacity .22s ease, transform .22s ease;
      opacity: 0;
      transform: translateY(-6px);
      color: var(--exc-color-text-main);
      font-family: var(--exc-sans);
      font-size: var(--exc-fs-base);
    }
    .exc-main-panel.visible { display: flex; opacity: 1; transform: translateY(0); }

    .main-ph {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 12px;
      background: var(--exc-color-primary);
      color: var(--exc-color-text-btn);
      flex-shrink: 0; 
      z-index: 100;
    }
    .main-ph-title {
      font-size: var(--exc-fs-title);
      font-weight: 700;
      letter-spacing: 0.5px;
    }
    .btn-close-panel {
      background: none;
      border: none;
      color: var(--exc-color-text-btn);
      font-size: 18px;
      line-height: 1;
      padding: 0 4px;
      cursor: pointer;
      opacity: 0.8;
      transition: opacity 0.2s, transform 0.1s;
    }
    .btn-close-panel:hover { opacity: 1; transform: scale(1.1); }

    .exc-content-wrapper {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow-y: auto;  
      overflow-x: hidden;
      padding: 3px 6px;
    }
    .exc-content-wrapper::-webkit-scrollbar { width: 4px; }
    .exc-content-wrapper::-webkit-scrollbar-track { background: transparent; }
    .exc-content-wrapper::-webkit-scrollbar-thumb { background: #ccc; border-radius: 2px; }
    .exc-content-wrapper::-webkit-scrollbar-thumb:hover { background: #aaa; }

    .exc-section {
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
      margin-bottom: 4px;
      border: 1px solid #eee;
      border-radius: 5px;
      overflow: hidden; 
      background: #fff;
    }
    #panel-profile, #panel-results {
      border-top: 1px solid var(--exc-color-border);
    }
    .ph {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 6px 10px;
      border-bottom: 1px solid transparent;
      flex-shrink: 0;
      background-color: var(--exc-color-primary-bar);
      position: sticky; top: 0; z-index: 10;
      cursor: pointer;
      transition: background-color 0.2s;
      -webkit-tap-highlight-color: transparent;
    }
    .ph:hover {
      background-color: rgba(0,219,255,0.30);
    }

    .ph.active {
      background-color: #e7f1ff;
      border-bottom: 1px solid #b6d4fe;
    }
    .ph-title {
      font-size: var(--exc-fs-sub);
      font-weight: bold;
      color: var(--exc-color-text-main);
      padding: 4px 0;
    }
    .ph.active .ph-title {
      color: #0000ce;
    }

    .toggle-icon {
      font-size: 11px;
      color: #666;
      transition: transform 0.3s ease;
      flex-shrink: 0;
    }
    .ph.active .toggle-icon {
      transform: rotate(180deg);
    }

    .mini-bar {
      padding: 7px 18px;
      display: none; align-items: center; gap: 17px;
      flex-shrink: 0;
      background: var(--exc-color-surf);
      border-top: 1px solid var(--exc-color-border-dim);
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.25s ease-in-out, visibility 0.25s;
    }
    
    .exc-section.collapsed .mini-bar { 
      display: flex; 
      opacity: 1;
      visibility: visible;
      transition-delay: 0.1s; 
    }

    .exc-section.collapsed .panel-body { 
       max-height: 0;
       opacity: 0;
       padding-top: 0;
       padding-bottom: 0; 
       overflow: hidden; 
       visibility: hidden;
       transition: max-height 0.3s ease-in-out, opacity 0.15s ease-in-out, visibility 0.3s;
    }

    .mini-vol {
      font-family: var(--exc-mono);
      font-size: var(--exc-fs-xxl);
      font-weight: 800;
      color: var(--exc-color-brown);
      flex: 1;
      text-align: right;
    }
    .btn-mini {
      background: var(--exc-color-reset-bg);
      border: 1px solid var(--exc-color-border);
      color: var(--exc-color-text-main);
      border-radius: var(--exc-rad);
      padding: 4px 9px;
      font-size: var(--exc-fs-lg);
      font-weight: 700;
      cursor: pointer;
      white-space: nowrap;
      transition: background .15s;
    }
    .btn-mini:hover { background: var(--exc-color-border); }
    .btn-mini.accent {
      background: var(--exc-color-primary);
      color: var(--exc-color-text-btn);
      border-color: var(--exc-color-primary);
      width: 30%;
    }
    .btn-mini.accent:hover { background: var(--exc-color-primary-dark); }

    .panel-body {
      padding: 5px;
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 4px;
      background: var(--exc-color-surf2);
      overflow: hidden;
      max-height: 800px; 
      opacity: 1;
      transition: max-height 0.3s ease-in-out, 
                  opacity 0.3s ease-in-out, 
                  padding 0.3s ease-in-out;
    }

    .exc-warning-text {
      color: var(--exc-color-danger);
      font-size: var(--exc-fs-xs);
      text-align: center;
      font-weight: 600;
      line-height: 1.5;
      margin: 2px 0 5px 0;
      padding: 4px;
      background-color: rgba(220, 53, 69, 0.05);
      border: 1px dashed rgba(220, 53, 69, 0.3);
      border-radius: 4px;
    }

    .field-group   { display: flex; flex-direction: row; justify-content: space-between; padding: 0 12px; gap: 5px; }
    .field-label   {
      font-size: var(--exc-fs-lg);
      color: var(--exc-color-text-main);
      text-transform: uppercase;
      letter-spacing: .2px;
    }
    .num-input {
      background: var(--exc-color-bg);
      border: 1px solid var(--exc-color-border-input);
      border-radius: var(--exc-rad);
      color: var(--exc-color-primary-dark);
      font-family: var(--exc-mono);
      font-size: var(--exc-fs-xl);
      padding: 4px 8px;
      width: 25%;
      text-align: right;
      transition: border-color .2s;
      box-sizing: border-box;
    }
    .num-input:focus { outline: none; border-color: var(--exc-color-primary); }
    .num-input:hover { border-color: var(--exc-color-primary); background: var(--exc-color-surf-hover); }

    .layer-card {
      background: var(--exc-color-surf);
      border: 1px solid var(--exc-color-border-dim);
      border-radius: var(--exc-rad);
      padding: 8px 10px;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .layer-card-title {
      display: flex;
      align-items: center;
      gap: 7px;
      font-weight: bold;
      font-size: var(--exc-fs-base);
      color: var(--exc-color-text-card);
    }
    .layer-dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
    .layer-fields { display: flex; flex-direction: column; gap: 5px; margin-left: 16px;}
    .layer-fields label {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
      font-size: var(--exc-fs-md);
      color: var(--exc-color-text-muted);
    }
    .layer-fields .num-input {
      width: 78px;
      flex-shrink: 0;
      text-align: right;
      padding: 4px 6px;
      font-size: var(--exc-fs-xl);
    }

    .exc-divider { border: none; border-top: 1px solid var(--exc-color-border-dim); margin: 2px 0; }
    .action-row { display: flex; gap: 10px; flex-shrink: 0; padding: 0 10px; }
    .btn-calc {
      flex: 1;
      background: var(--exc-color-primary);
      color: var(--exc-color-text-btn);
      border: none;
      border-radius: var(--exc-rad);
      padding: 9px 8px;
      font-size: var(--exc-fs-lg);
      font-weight: 800;
      cursor: pointer;
      transition: background .2s, transform .1s;
    }
    .btn-calc:hover  { background: var(--exc-color-primary-dark); }
    .btn-calc:active { transform: scale(.97); }
    
    .btn-reset {
      flex: 0 0 auto;
      background: var(--exc-color-reset-bg); 
      color: var(--exc-color-reset-text);
      border: 1px solid var(--exc-color-reset-brd);
      border-radius: var(--exc-rad);
      padding: 9px 12px;
      font-size: var(--exc-fs-lg);
      font-weight: 700;
      cursor: pointer;
      transition: background .2s, color .2s, border-color .2s;
    }
    .btn-reset:hover {
      background: var(--exc-color-reset-hover-bg);
      color: var(--exc-color-reset-hover-text);
      border-color: var(--exc-color-reset-hover-brd);
    }

    .btn-calc:disabled, .btn-mini.accent:disabled {
      background: var(--exc-color-border-input);
      border-color: var(--exc-color-border-input);
      color: #f8f9fa;
      cursor: not-allowed;
      transform: none;
      box-shadow: none;
    }
    .btn-calc:disabled:hover, .btn-mini.accent:disabled:hover {
      background: var(--exc-color-border-input);
    }

    .profile-container {
      background: var(--exc-color-surf);
      border: 1px solid var(--exc-color-border-dim);
      border-radius: var(--exc-rad);
      padding: 10px;
      display: flex;
      justify-content: center;
      align-items: center;
      overflow-x: auto;
      overflow-y: hidden;
    }
    .profile-container::-webkit-scrollbar { height: 4px; }
    .profile-container::-webkit-scrollbar-thumb { background: #ccc; border-radius: 2px; }
    .svg-text        { font-family: var(--exc-mono); font-size: var(--exc-fs-base); fill: var(--exc-color-svg-acc); font-weight: 600; }
    .svg-text.dim    { fill: var(--exc-color-text-dim); font-size: var(--exc-fs-sm); }
    .svg-text.acc    { fill: var(--exc-color-svg-acc); }

    .result-header {
      font-size: var(--exc-fs-md);
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1.4px;
      color: var(--exc-color-primary);
      margin-bottom: 8px;
    }
    .result-table { width: 100%; border-collapse: collapse; font-size: var(--exc-fs-md); }
    .result-table th {
      background: var(--exc-color-surf);
      color: var(--exc-color-text-muted);
      font-size: var(--exc-fs-md);
      letter-spacing: .7px;
      padding: 6px 5px;
      text-align: right;
      border-bottom: 1px solid var(--exc-color-border);
    }
    .result-table th:first-child { text-align: center; }
    .result-table td {
      padding: 6px 5px;
      border-bottom: 1px solid var(--exc-color-border-dim);
      vertical-align: middle;
      color: var(--exc-color-text-main);
    }
    .result-table td:first-child {
      display: flex;
      align-items: center;
      gap: 5px;
      font-weight: 600;
    }
    .result-table td.num { font-family: var(--exc-mono); text-align: right; font-size: var(--exc-fs-xs); }
    .result-table .dot {
      width: 7px; height: 7px;
      border-radius: 50%;
      display: inline-block;
      flex-shrink: 0;
    }
    .total-row td {
      background: var(--exc-color-total-bg);
      color: var(--exc-color-primary-dark);
      font-weight: 700;
      border-top: 2px solid var(--exc-color-primary);
    }
    .total-row td:first-child { justify-content: flex-end; }

    .vol-card {
      margin-top: 10px;
      background: linear-gradient(135deg, rgba(124,74,30,0.08), rgba(139,94,60,0.04));
      border: 1px solid var(--exc-color-brown-light);
      border-radius: var(--exc-rad);
      padding: 5px 12px;
      text-align: center;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .vol-label { font-size: var(--exc-fs-md); letter-spacing: 1px; color: var(--exc-color-text-muted); }
    .vol-value {
      font-size: var(--exc-fs-huge);
      font-family: var(--exc-mono);
      font-weight: 800;
      color: var(--exc-color-brown);
      line-height: 1.1;
    }
    .vol-unit  { font-size: var(--exc-fs-md); color: var(--exc-color-text-muted);     letter-spacing: 1px; }

    .empty-state {
      color: var(--exc-color-text-muted);
      font-size: var(--exc-fs-md);
      text-align: center;
      margin-top: 15px;
      margin-bottom: 15px;
      line-height: 1.9;
    }
    .dist-tip {
      background: rgba(255,255,255,.95) !important;
      color: var(--exc-color-text-main) !important;
      border: 1px solid var(--exc-color-primary) !important;
      border-radius: 4px !important;
      font-size: 10px !important;
      font-weight: 600;
      padding: 2px 5px !important;
      white-space: nowrap;
      pointer-events: none;
    }
  `;
  if (document.getElementById('exc-injected-style')) return;
  const tag = document.createElement('style');
  tag.id = 'exc-injected-style';
  tag.textContent = css;
  document.head.appendChild(tag);
})();

let drawnItems        = null;
window.lastDrawnLayer = null;
let distanceTooltips  = [];
let hasResults        = false;
let lastTotalVol      = 0;
let _map              = null;

const PALETTE = [
  '#475569', '#2563eb', '#4199FB', '#16a34a', '#86efac',
  '#dc2626', '#fca5a5', '#d97706', '#fcd34d', '#7c3aed',
  '#c4b5fd', '#0891b2', '#67e8f9', '#be185d', '#f9a8d4',
  '#854d0e', '#d4a574',
];

const getColor = idx => PALETTE[Math.min(idx, PALETTE.length - 1)];
const getLayerCardColor = layerIndex => PALETTE[1 + layerIndex * 2] || '#475569';

function buildPanelSettingsHTML() {
  document.getElementById('panel-settings').innerHTML = `
    <div class="ph" id="header-settings">
      <span class="ph-title">⚙️ ตั้งค่าการขุด</span>
      <i class="fas fa-chevron-down toggle-icon"></i>
    </div>
    <div class="panel-body" id="settings-body">
      <div class="exc-warning-text">
        ⚠️ ค่าเริ่มต้นเป็นเพียงค่าแนะนำ <br>
        ค่าใช้จริงต้องได้รับการตรวจสอบและรับรองโดยวิศวกร
      </div>
      <div class="field-group">
        <span class="field-label">จำนวนชั้นขุด</span>
        <input type="number" id="num-layers" class="num-input" value="3" min="1" max="8" step="1">
      </div>
      <hr class="exc-divider">
      <div id="layer-inputs"></div>
      <hr class="exc-divider">
      <div class="action-row">
        <button class="btn-calc" id="btn-calculate" disabled>✅ คำนวณ</button>
        <button class="btn-reset" id="btn-reset" title="รีเซ็ตค่าเริ่มต้น">🔄 รีเซ็ต</button>
      </div>
    </div>
    <div class="mini-bar" id="settings-mini" style="display: none">
      <button class="btn-mini accent" id="btn-calc-mini" disabled>คำนวณ</button>
      <button class="btn-mini" id="btn-reset-mini">รีเซ็ต</button>
    </div>
  `;
}

function buildPanelProfileHTML() {
  document.getElementById('panel-profile').innerHTML = `
    <div class="ph" id="header-profile">
      <span class="ph-title">📐 รูปตัดการขุด</span>
      <i class="fas fa-chevron-down toggle-icon"></i>
    </div>
    <div class="panel-body" id="profile-body">
      <p class="empty-state" id="profile-empty" style="display:none;">คำนวณเพื่อดูรูปตัด</p>
      <div class="profile-container" id="profile-svg-wrapper"></div>
    </div>
    <div class="mini-bar" id="profile-mini" style="display:none;">
      <span style="font-size:var(--exc-fs-sm);color:var(--exc-color-text-muted)">กดขยายเพื่อแสดงรูปตัด</span>
    </div>
  `;
}

function buildPanelResultsHTML() {
  document.getElementById('panel-results').innerHTML = `
    <div class="ph" id="header-results">
      <span class="ph-title">📊 ผลลัพธ์</span>
      <i class="fas fa-chevron-down toggle-icon"></i>
    </div>
    <div class="panel-body" id="results-body">
      <p class="empty-state">กรอกค่าและกด<br><strong>คำนวณ</strong></p>
    </div>
    <div class="mini-bar" id="results-mini">
      <span style="font-size:var(--exc-fs-sm);color:var(--exc-color-text-muted);letter-spacing:.8px">ปริมาตรรวม</span>
      <span class="mini-vol" id="mini-vol-val">—</span>
      <span style="font-size:var(--exc-fs-sm);color:var(--exc-color-text-muted)">ลบ.ม.</span>
    </div>
  `;
}

window.showPanel = function() {
  const el = document.getElementById('exc-main-panel');
  if (!el) return;
  el.style.display = 'flex';
  requestAnimationFrame(() => el.classList.add('visible'));
};

window.hidePanel = function() {
  const el = document.getElementById('exc-main-panel');
  if (!el) return;
  el.classList.remove('visible');
  el.addEventListener('transitionend', () => {
    if (!el.classList.contains('visible')) el.style.display = 'none';
  }, { once: true });
};

function initCollapseToggles() {
  ['settings', 'profile', 'results'].forEach(name => {
    const header = document.getElementById(`header-${name}`);
    if (header) {
      header.addEventListener('click', function() {
        const section = document.getElementById(`panel-${name}`);
        const isCol = section.classList.contains('collapsed');
        if (isCol) { 
          section.classList.remove('collapsed'); 
          this.classList.add('active'); 
        } else { 
          section.classList.add('collapsed'); 
          this.classList.remove('active'); 
        }
      });
    }
  });
}

function fmtNum(n) {
  return n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function clearDistanceTooltips() {
  distanceTooltips.forEach(t => t.remove());
  distanceTooltips = [];
}

window.enableExcavateCalcButton = function() {
  const btn = document.getElementById('btn-calculate');
  const btnMini = document.getElementById('btn-calc-mini');
  if (btn) btn.disabled = false;
  if (btnMini) btnMini.disabled = false;
};

window.disableExcavateCalcButton = function() {
  const btn = document.getElementById('btn-calculate');
  const btnMini = document.getElementById('btn-calc-mini');
  if (btn) btn.disabled = true;
  if (btnMini) btnMini.disabled = true;
};

function buildLayerPanel() {
  const n = parseInt(document.getElementById('num-layers').value) || 1;
  const container = document.getElementById('layer-inputs');
  if (!container) return;
  container.innerHTML = '';
  
  for (let i = 0; i < n; i++) {
    const label = String.fromCharCode(65 + i); 
    const color = getLayerCardColor(i);
    const isFirst = (i === 0);
    const label1 = isFirst ? `โฉนด-ขอบบ่อ (${label}1) ม.` : `ชานพัก (${label}1) ม.`;
    const label2 = `ระยะแนวราบ (${label}2) ม.`;
    const defaultStep1 = isFirst ? 5 : 3;

    container.innerHTML += `
      <div class="layer-card" style="border-left:4px solid ${color}">
        <div class="layer-card-title">
          <span class="layer-dot" style="background:${color}"></span>ชั้น ${label}
        </div>
        <div class="layer-fields">
          <label>
            <span>${label1}</span>
            <input type="number" id="layer-step1-${i}" value="${defaultStep1}" step="0.5" min="0" class="num-input">
          </label>
          <label>
            <span>${label2}</span>
            <input type="number" id="layer-step2-${i}" value="6" step="0.5" min="0" class="num-input">
          </label>
          <label>
            <span>ความลึก (H${label}) ม.</span>
            <input type="number" id="layer-depth-${i}" value="3" step="0.1" min="0.1" class="num-input">
          </label>
        </div>
      </div>`;
  }
  
  container.removeEventListener('input', window.enableExcavateCalcButton);
  container.addEventListener('input', window.enableExcavateCalcButton);
}

function readLayerInputs() {
  const numLayers = parseInt(document.getElementById('num-layers')?.value) || 1;
  const layers = [];
  
  for (let i = 0; i < numLayers; i++) {
    const rawStep1 = parseFloat(document.getElementById(`layer-step1-${i}`)?.value) || 0;
    const rawStep2 = parseFloat(document.getElementById(`layer-step2-${i}`)?.value) || 0;
    const depthVal = parseFloat(document.getElementById(`layer-depth-${i}`)?.value) || 1;

    layers.push({
      step1: -Math.abs(rawStep1), 
      step2: -Math.abs(rawStep2), 
      depth: depthVal,
    });
  }
  return layers;
}

function renderProfileSVG(layers) {
  const svgWrapper = document.getElementById('profile-svg-wrapper');
  const emptyState = document.getElementById('profile-empty');
  if (!svgWrapper || !emptyState || layers.length === 0) return;

  let x = 10, y = 20;
  let points  = `${x},${y}`;
  let svgContent = '';
  let polyPointsArray = [`10,${y}`];

  layers.forEach((lr, i) => {
    const s1 = Math.abs(lr.step1);
    const s2 = Math.abs(lr.step2);
    const d  = lr.depth;
    const drawS1 = Math.max(20, s1 * 5); 
    const drawS2 = Math.max(20, s2 * 5); 
    const drawD  = 35; 

    const nextX1 = x + drawS1;
    svgContent += `<text 
      x="${x + drawS1 / 2}" 
      y="${y - 6}" 
      class="svg-text acc" 
      text-anchor="middle">${s1}m</text>`;
      
    points += ` ${nextX1},${y}`;
    polyPointsArray.push(`${nextX1},${y}`);
    x = nextX1;

    const nextX2 = x + drawS2;
    const nextY2 = y + drawD;
    const midX2  = (x + nextX2) / 2;

    svgContent += `<line 
      x1="${nextX2 + 2}" y1="${y}" 
      x2="${nextX2 + 2}" y2="${nextY2}" 
      stroke="var(--exc-color-border-input)" stroke-dasharray="2 2" stroke-width="1" opacity="0.7"/>`;
    svgContent += `<text 
      x="${nextX2 + 5}" 
      y="${y + drawD / 2 + 4}" 
      class="svg-text dim" 
      text-anchor="start">${d}m</text>`;

    const horizontalLineY = y - 1;
    svgContent += `<line 
      x1="${x}" y1="${horizontalLineY}" 
      x2="${nextX2}" y2="${horizontalLineY}" 
      stroke="var(--exc-color-border-input)" stroke-dasharray="2 2" stroke-width="1" opacity="0.7"/>`;
    svgContent += `<text 
      x="${midX2}" 
      y="${horizontalLineY - 5}" 
      class="svg-text dim" 
      text-anchor="middle">${s2}m</text>`;

    points += ` ${nextX2},${nextY2}`;
    polyPointsArray.push(`${nextX2},${nextY2}`);
    x = nextX2;
    y = nextY2;
  });

  const firstLayerStep1 = Math.abs(layers[0].step1);
  const drawFinalTail = Math.max(25, firstLayerStep1 * 5); 
  const finalX = x + drawFinalTail;
  
  points += ` ${finalX},${y}`;
  polyPointsArray.push(`${finalX},${y}`);
  x = finalX;

  const totalW = x + 15;
  const totalH = y + 22;
  const finalPolyPoints = `10,${y + 12} ${polyPointsArray.join(' ')} ${x},${y + 12}`;
  const finalSVG = `
    <svg width="${totalW}" height="${totalH}" 
      viewBox="0 0 ${totalW} ${totalH}" 
      xmlns="http://www.w3.org/2000/svg">
      <polygon points="${finalPolyPoints}" fill="var(--exc-color-svg-fill)"/>
      <polyline points="${points}" fill="none" 
        stroke="var(--exc-color-svg-line)" stroke-width="2.5" stroke-linejoin="round"/>
      <line x1="4" y1="20" x2="10" y2="20" stroke="var(--exc-color-border)" stroke-width="2"/>
      ${svgContent}
    </svg>`;

  emptyState.style.display = 'none';
  svgWrapper.style.display = 'flex';
  svgWrapper.innerHTML = finalSVG;
}

function getArea(geoJSON) {
  const methodInput = document.querySelector('input[name="mp_calc_method"]:checked');
  const method = methodInput ? methodInput.value : 'planar';
  
  if (method === 'geodesic' && typeof turf !== 'undefined') {
    return turf.area(geoJSON);
  } else {
    return calculatePlanarArea(geoJSON);
  }
}

function calculatePlanarArea(geoJSON) {
  let totalArea = 0;
  if (typeof turf !== 'undefined') {
    turf.geomEach(geoJSON, function (geom) {
      if (geom.type === 'Polygon') {
        totalArea += polygonPlanarArea(geom.coordinates);
      } else if (geom.type === 'MultiPolygon') {
        geom.coordinates.forEach(coords => {
          totalArea += polygonPlanarArea(coords);
        });
      }
    });
  }
  return totalArea;
}

function polygonPlanarArea(coordinates) {
  let area = ringPlanarArea(coordinates[0]); 
  for (let i = 1; i < coordinates.length; i++) {
    area -= ringPlanarArea(coordinates[i]); 
  }
  return Math.max(0, area);
}

function ringPlanarArea(coords) {
  let pts = coords;
  
  if (pts.length > 1 && 
      pts[0][0] === pts[pts.length - 1][0] && 
      pts[0][1] === pts[pts.length - 1][1]) {
    pts = pts.slice(0, -1); 
  }

  if (pts.length < 3) return 0;
  const avgLat = pts.reduce((sum, p) => sum + p[1], 0) / pts.length;
  const cosLat = Math.cos(avgLat * Math.PI / 180);
  const mPerDegLat = 111319.9;           
  const mPerDegLng = 111319.9 * cosLat;  
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const p1 = pts[i];
    const p2 = pts[(i + 1) % pts.length];
    const x1 = p1[0] * mPerDegLng,  y1 = p1[1] * mPerDegLat;
    const x2 = p2[0] * mPerDegLng,  y2 = p2[1] * mPerDegLat;

    area += x1 * y2 - x2 * y1;
  }
  return Math.abs(area / 2);
}

function isValidExcavationPolygon(geoJson) {
  if (!geoJson) return false;
  if (geoJson.type === 'FeatureCollection' && (!geoJson.features || geoJson.features.length === 0)) return false;
  if (geoJson.geometry && geoJson.geometry.coordinates && geoJson.geometry.coordinates.length === 0) return false;
  
  return getArea(geoJson) >= 10; 
}

function validateExcavateInputs() {
  const numLayersEl = document.getElementById('num-layers');
  if (!numLayersEl) {
    console.warn('⚠️ ข้ามการตรวจสอบ: ยังไม่ได้สร้างหน้าต่างการขุด (num-layers is null)');
    return false; 
  }
  const numInput = parseInt(document.getElementById('num-layers').value);
  if (isNaN(numInput) || numInput < 1 || numInput > 8) {
    if(typeof showAlert === 'function') showAlert('⚠️ จำนวนชั้นต้องอยู่ระหว่าง 1 ถึง 8');
    return false;
  }
  
  const layers = parseInt(document.getElementById('num-layers').value) || 1;
  for (let i = 0; i < layers; i++) {
    const s1 = parseFloat(document.getElementById(`layer-step1-${i}`)?.value);
    const s2 = parseFloat(document.getElementById(`layer-step2-${i}`)?.value);
    const d  = parseFloat(document.getElementById(`layer-depth-${i}`)?.value);
    const layerLabel = String.fromCharCode(65 + i);

    if (isNaN(s1) || s1 < 0) {
      if(typeof showAlert === 'function') showAlert(`⚠️ กรุณาระบุระยะร่นชั้น ${layerLabel} ให้ถูกต้อง (ห้ามติดลบ)`);
      return false;
    }
    if (isNaN(s2) || s2 < 0) {
      if(typeof showAlert === 'function') showAlert(`⚠️ กรุณาระบุระยะแนวราบชั้น ${layerLabel} ให้ถูกต้อง (ห้ามติดลบ)`);
      return false;
    }
    if (isNaN(d) || d <= 0) {
      if(typeof showAlert === 'function') showAlert(`⚠️ ความลึกชั้น ${layerLabel} ต้องมากกว่า 0`);
      return false;
    }
  }
  return true;
}

window.calculateMultiOffset = function calculateMultiOffset() {
  if (!validateExcavateInputs()) return;

  const profileCollapsed = document.getElementById('panel-profile').classList.contains('collapsed');
  const resultsCollapsed = document.getElementById('panel-results').classList.contains('collapsed');

  if (!_map) {
    if(typeof showAlert === 'function') showAlert('⚠️ ระบบแผนที่ยังไม่พร้อม กรุณารอสักครู่');
    return;
  }
  if (!window.lastDrawnLayer) {
    if(typeof showAlert === 'function') showAlert('⚠️ กรุณาวาด Polygon บนแผนที่ก่อน');
    return;
  }

  let numLayers = parseInt(document.getElementById('num-layers').value) || 1;
  let layers = readLayerInputs();

  const originalGeoJSON = window.lastDrawnLayer.toGeoJSON();
  if (drawnItems) drawnItems.clearLayers();
  clearDistanceTooltips();

  let current = originalGeoJSON;
  const allPolygons = [originalGeoJSON];
  const allAreas = [getArea(originalGeoJSON)];
  const volumes = [];

  let totalVol = 0;
  let actualLayersUsed = 0;
  let warningCause = '';

  for (let i = 0; i < layers.length; i++) {
    const l = layers[i];
    const layerLabel = String.fromCharCode(65 + i);

    const p1 = turf.buffer(current, l.step1, { units: 'meters' });
    if (!isValidExcavationPolygon(p1)) {
      const stepName = (i === 0) ? 'ระยะร่นโฉนด-ขอบบ่อ' : `ระยะชานพักชั้น ${layerLabel}`;
      warningCause = `ไม่สามารถทำ${stepName}ได้ เนื่องจากพื้นที่เหลือน้อยกว่า 10 ตร.ม.`;
      break;
    }
    const area1 = getArea(p1);

    const p2 = turf.buffer(p1, l.step2, { units: 'meters' });
    if (!isValidExcavationPolygon(p2)) {
      warningCause = `ไม่สามารถทำความลาดเอียงลงก้นบ่อในชั้น ${layerLabel} ได้ เนื่องจากพื้นที่เหลือน้อยกว่า 10 ตร.ม.`;
      break;
    }
    const area2 = getArea(p2);

    allPolygons.push(p1, p2);
    allAreas.push(area1, area2);
    const vol = ((area1 + area2) / 2) * Math.abs(l.depth);
    volumes.push({ vol });
    totalVol += vol;

    current = p2;
    actualLayersUsed = i + 1; 
  }

  if (actualLayersUsed === 0) {
    if(typeof showAlert === 'function') {
      showAlert(`⚠️ พื้นที่บ่อเล็กเกินไป\n\n${warningCause}\nไม่สามารถสร้างชั้นขุดได้ กรุณาปรับลดระยะร่น`);
    }
    hasResults = false;
    lastTotalVol = 0;
    document.getElementById('results-body').innerHTML = '<p class="empty-state">กรอกค่าและกด<br><strong>คำนวณ</strong></p>';
    document.getElementById('mini-vol-val').textContent = '—';
    document.getElementById('profile-empty').style.display = 'block';
    const svgWrapper = document.getElementById('profile-svg-wrapper');
    svgWrapper.style.display = 'none';
    svgWrapper.innerHTML = '';
    return;
  }
  let layersToRender = layers;
  let triggerLayerRebuild = false;

  if (actualLayersUsed < numLayers) {
    layersToRender = layers.slice(0, actualLayersUsed);
    triggerLayerRebuild = true;
  }

  allPolygons.forEach((pg, idx) => {
    L.geoJSON(pg, {
      style: {
        color: getColor(idx),
        weight: idx === 0 ? 3 : 2,
        opacity: 0.9,
        fillOpacity: idx === 0 ? 0.06 : 0.10,
        dashArray: idx === 0 ? null : '6 4'
      }
    }).addTo(drawnItems);
  });

  hasResults = true;
  lastTotalVol = totalVol;

  renderResults(allAreas, volumes, totalVol, actualLayersUsed);
  renderProfileSVG(layersToRender);
  window.showPanel();

  document.getElementById('mini-vol-val').textContent = fmtNum(totalVol);

  document.getElementById('panel-profile').classList.toggle('collapsed', profileCollapsed);
  document.getElementById('header-profile').classList.toggle('active', !profileCollapsed);
  document.getElementById('panel-results').classList.toggle('collapsed', resultsCollapsed);
  document.getElementById('header-results').classList.toggle('active', !resultsCollapsed);

  window.disableExcavateCalcButton();

  if (triggerLayerRebuild) {
    document.getElementById('num-layers').value = actualLayersUsed;
    buildLayerPanel(); 
    if(typeof showAlert === 'function') {
      showAlert(`⚠️ ขุดได้จริงเพียง ${actualLayersUsed} ชั้น (จากที่ตั้งไว้ ${numLayers} ชั้น)\n\nสาเหตุ: ${warningCause}`);
    }
  }

  if (typeof window.showStatus === 'function') {
    if (actualLayersUsed < numLayers) {
      window.showStatus(`⚠️ ขุดได้จริง ${actualLayersUsed}/${numLayers} ชั้น | ปริมาตรรวม ${fmtNum(totalVol)} ลบ.ม.`);
    } else {
      window.showStatus(`✅ คำนวณเสร็จ — ${actualLayersUsed} ชั้น | ปริมาตรรวม ${fmtNum(totalVol)} ลบ.ม.`);
    }
  }
};
        
function renderResults(allAreas, volumes, totalVol, numLayersInput) {
  const methodInput = document.querySelector('input[name="mp_calc_method"]:checked');
  const method = methodInput ? methodInput.value : 'planar';
  const methodText = method === 'geodesic' ? 'Geodesic (ตามความโค้งผิวโลก)' : 'Planar (บนระนาบ 2 มิติ)';

  let rows = '';

  // แถวที่ 0: โฉนดเริ่มต้น
  if (allAreas.length > 0) {
    const sq0 = fmtNum(allAreas[0]);
    const rai0 = (allAreas[0] / 1600).toLocaleString('th-TH', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
    rows += `
      <tr>
        <td><span class="dot" style="background:${getColor(0)}"></span>โฉนด</td>
        <td class="num">${sq0}</td>
        <td class="num">${rai0}</td>
        <td class="num">—</td>
      </tr>`;
  }

  for (let i = 0; i < numLayersInput; i++) {
    const label = String.fromCharCode(65 + i);
    const p1Idx = 1 + (i * 2); 
    const p2Idx = 2 + (i * 2); 

    if (p1Idx < allAreas.length) {
      const a1 = allAreas[p1Idx];
      const rai1 = (a1 / 1600).toLocaleString('th-TH', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
      rows += `
        <tr>
          <td><span class="dot" style="background:${getColor(p1Idx)}"></span>ชั้น ${label}1</td>
          <td class="num">${fmtNum(a1)}</td>
          <td class="num">${rai1}</td>
          <td class="num">—</td>
        </tr>`;
    }

    if (p2Idx < allAreas.length) {
      const a2 = allAreas[p2Idx];
      const rai2 = (a2 / 1600).toLocaleString('th-TH', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
      
      let volCell = '—';
      if (i < volumes.length) {
        volCell = `<strong>${fmtNum(volumes[i].vol)}</strong>`;
      }

      rows += `
        <tr style="border-bottom: 2px solid var(--exc-color-border-dim);">
          <td><span class="dot" style="background:${getColor(p2Idx)}"></span>ชั้น ${label}2</td>
          <td class="num">${fmtNum(a2)}</td>
          <td class="num">${rai2}</td>
          <td class="num">${volCell}</td>
        </tr>`;
    }
  }

  document.getElementById('results-body').innerHTML = `
    <div class="result-header" style="display: none;">รายการคำนวณ</div>
    <table class="result-table">
      <thead>
        <tr>
          <th>ชั้น</th><th>ตร.ม.</th><th>ไร่</th><th>ลบ.ม.</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
    <div style="font-size: var(--exc-fs-xs); color: var(--exc-color-text-muted); text-align: left; margin-top: 4px; margin-bottom: -2px; padding-left: 4px;">
      หมายเหตุ : คำนวณพื้นที่ด้วยวิธี ${methodText}
    </div>
    
    <div class="vol-card">
      <span class="vol-label">ปริมาตรรวม</span>
      <span class="vol-value">${fmtNum(totalVol)}</span>
      <span class="vol-unit">ลูกบาศก์เมตร</span>
    </div>`;
}
function doReset() {
  document.getElementById('num-layers').value = "3";
  buildLayerPanel(); 
  window.enableExcavateCalcButton();
  if (window.lastDrawnLayer) {
    calculateMultiOffset();
  } else {
    if (drawnItems) drawnItems.clearLayers();
    clearDistanceTooltips();
    hasResults = false;
    lastTotalVol = 0;

    const rb = document.getElementById('results-body');
    if (rb) rb.innerHTML = '<p class="empty-state">กรอกค่าและกด<br><strong>คำนวณ</strong></p>';
    const mv = document.getElementById('mini-vol-val');
    if (mv) mv.textContent = '—';

    const emptyState = document.getElementById('profile-empty');
    const svgWrapper = document.getElementById('profile-svg-wrapper');
    if (emptyState) emptyState.style.display = 'block';
    if (svgWrapper) { svgWrapper.style.display = 'none'; svgWrapper.innerHTML = ''; }

    document.getElementById('panel-settings').classList.add('collapsed');
    document.getElementById('header-settings').classList.remove('active');
    
    document.getElementById('panel-profile').classList.add('collapsed');
    document.getElementById('header-profile').classList.remove('active');
    
    document.getElementById('panel-results').classList.add('collapsed');
    document.getElementById('header-results').classList.remove('active');
  }
}

window.collapseAllExcavationPanels = function() {
  ['settings', 'profile', 'results'].forEach(name => {
    const p = document.getElementById(`panel-${name}`);
    const h = document.getElementById(`header-${name}`);
    if (p && h) { 
      p.classList.add('collapsed'); 
      h.classList.remove('active'); 
    }
  });
};

window.clearExcavationData = function() {
  if (drawnItems) drawnItems.clearLayers();
  clearDistanceTooltips();
  hasResults = false;
  lastTotalVol = 0;

  const rb = document.getElementById('results-body');
  if (rb) rb.innerHTML = '<p class="empty-state">กรอกค่าและกด<br><strong>คำนวณ</strong></p>';
  const mv = document.getElementById('mini-vol-val');
  if (mv) mv.textContent = '—';

  const emptyState = document.getElementById('profile-empty');
  const svgWrapper = document.getElementById('profile-svg-wrapper');
  if (emptyState) emptyState.style.display = 'block';
  if (svgWrapper) { svgWrapper.style.display = 'none'; svgWrapper.innerHTML = ''; }

  window.hidePanel();
  window.collapseAllExcavationPanels();
};

window.initExcavate = function(leafletMap) {
  if (!leafletMap) { console.error('[excavate] ไม่ได้รับ map object'); return; }
  _map = leafletMap;

  let mainPanel = document.getElementById('exc-main-panel');
  if (!mainPanel) {
    mainPanel = document.createElement('div');
    mainPanel.id = 'exc-main-panel';
    mainPanel.className = 'exc-main-panel';

    const mainHeader = document.createElement('div');
    mainHeader.className = 'main-ph';
    mainHeader.innerHTML = `
      <span class="main-ph-title">📋 รายการตรวจสอบปริมาตรบ่อ</span>
      <button class="btn-close-panel" id="btn-close-panel" title="ปิด">×</button>
    `;
    mainPanel.appendChild(mainHeader);

    const contentWrapper = document.createElement('div');
    contentWrapper.id = 'exc-content-wrapper';
    contentWrapper.className = 'exc-content-wrapper';

    const settingsSec = document.createElement('div');
    settingsSec.id = 'panel-settings';
    settingsSec.className = 'exc-section collapsed';

    const profileSec = document.createElement('div');
    profileSec.id = 'panel-profile';
    profileSec.className = 'exc-section collapsed';

    const resultsSec = document.createElement('div');
    resultsSec.id = 'panel-results';
    resultsSec.className = 'exc-section collapsed';

    contentWrapper.appendChild(settingsSec);
    contentWrapper.appendChild(profileSec);
    contentWrapper.appendChild(resultsSec);
    mainPanel.appendChild(contentWrapper);
    document.body.appendChild(mainPanel);
  }

  buildPanelSettingsHTML();
  buildPanelProfileHTML();
  buildPanelResultsHTML();

  drawnItems = new L.FeatureGroup();
  _map.addLayer(drawnItems);

  buildLayerPanel();
  initCollapseToggles();

  document.getElementById('btn-calculate').addEventListener('click', calculateMultiOffset);
  document.getElementById('btn-calc-mini').addEventListener('click', calculateMultiOffset);
  document.getElementById('btn-reset').addEventListener('click', doReset);
  document.getElementById('btn-reset-mini').addEventListener('click', doReset);
  document.getElementById('btn-close-panel').addEventListener('click', window.hidePanel);
  document.getElementById('num-layers').addEventListener('input', () => {
    buildLayerPanel();
    window.enableExcavateCalcButton();
  });
  document.addEventListener('change', function(e) {
    if (e.target && e.target.name === 'mp_calc_method') {
      window.enableExcavateCalcButton();
      if (window.lastDrawnLayer && hasResults) {}
    }
  });

  if (typeof window.showStatus === 'function')
    window.showStatus('เปิดเครื่องมือวัดพื้นที่และวาด Polygon เพื่อเริ่มต้น');
};
})(BPNP.tools.lcompat.L);
