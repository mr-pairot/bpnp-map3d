/* js/tools/measure/embankment.js
 * ─────────────────────────────────────────────────────────────────────────
 * เฟส 5C: mpem.js (ปริมาตรดินถม หลายชั้น + รูปตัด) เดิม — คัดลอกตรงทั้งไฟล์ ทำงานผ่าน Leaflet ชุดย่อยใน lcompat.js (ไม่ใช่ Leaflet จริง)
 * ───────────────────────────────────────────────────────────────────────── */
(function (L) {
//  mpemb.js 
//  Depends on: Leaflet 1.7, Turf.js 6

(function injectStyles() {
  const css = `
    /* ── 🎨 MASTER CONFIGURATION: COLORS & FONT SIZES ───────── */
    :root {
      /* ==== COLORS ==== */
      --emb-color-bg:             #ffffff;
      --emb-color-surf:           #f8f9fa;
      --emb-color-surf2:          #ffffff;
      --emb-color-surf-hover:     #f6fbfe;
      --emb-color-border:         #dee2e6;
      --emb-color-border-dim:     #eeeeee;
      --emb-color-border-input:   #adb5bd;
      
      --emb-color-primary:        #10b981; 
      --emb-color-primary-dark:   #059669;
      --emb-color-primary-bar:    rgba(16, 185, 129, 0.15);
      
      --emb-color-text-main:      #212529;
      --emb-color-text-title:     #333333;
      --emb-color-text-muted:     #6c757d;
      --emb-color-text-dim:       #888888;
      --emb-color-text-card:      #495057;
      --emb-color-text-btn:       #ffffff;
      --emb-color-danger:         #dc3545;
      
      --emb-color-icon:           #666666;
      --emb-color-icon-hover:     #059669;
      
      --emb-color-brown:          #4b5563; 
      --emb-color-brown-light:    #6b7280;
      --emb-color-total-bg:       #ecfdf5;
      
      --emb-color-reset-bg:       #e2e8f0;
      --emb-color-reset-text:     #475569;
      --emb-color-reset-brd:      #cbd5e1;
      --emb-color-reset-hover-bg: #cbd5e1;
      --emb-color-reset-hover-text:#1e293b;
      --emb-color-reset-hover-brd: #94a3b8;

      --emb-color-svg-line:       #10b981;
      --emb-color-svg-fill:       rgba(16, 185, 129, 0.12);
      --emb-color-svg-acc:        #059669;

      /* ==== FONT SIZES ==== */
      --emb-fs-xs:       0.75rem;
      --emb-fs-sm:       0.80rem;
      --emb-fs-md:       0.85rem;
      --emb-fs-lg:       0.9rem;
      --emb-fs-xl:       1rem;
      --emb-fs-xxl:      1.5rem;
      --emb-fs-huge:     1.8rem;
      --emb-fs-base:     11px;
      --emb-fs-title:    13px;
      --emb-fs-sub:      12px;
      --emb-fs-icon:     19px;

      /* ==== SIZING & FONTS ==== */
      --emb-rad:         6px;
      --emb-pw:          264px;
      --emb-ph:          90vh;
      --emb-mono:        'Sarabun','Consolas','Courier New',monospace;
      --emb-sans:        'Sarabun','Segoe UI','Tahoma',sans-serif;
    }

    .emb-main-panel {
      position: fixed;
      top: var(--safe-top, 20px);
      right: var(--safe-right, 20px);
      width: var(--emb-pw);
      max-height: var(--emb-ph);
      background: var(--emb-color-bg);
      border-radius: var(--emb-rad);
      display: none;
      flex-direction: column;
      overflow: hidden; 
      
      box-shadow: 0 2px 5px rgba(0,0,0,0.4);
      z-index: 1001;
      transition: opacity .22s ease, transform .22s ease;
      opacity: 0;
      transform: translateY(-6px);
      color: var(--emb-color-text-main);
      font-family: var(--emb-sans);
      font-size: var(--emb-fs-base);
    }
    .emb-main-panel.visible { display: flex; opacity: 1; transform: translateY(0); }

    .emb-main-ph {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 12px;
      background: var(--emb-color-primary);
      color: var(--emb-color-text-btn);
      flex-shrink: 0; 
      z-index: 100;
    }
    .emb-main-ph-title {
      font-size: var(--emb-fs-title);
      font-weight: 700;
      letter-spacing: 0.5px;
    }
    .emb-btn-close-panel {
      background: none;
      border: none;
      color: var(--emb-color-text-btn);
      font-size: 18px;
      line-height: 1;
      padding: 0 4px;
      cursor: pointer;
      opacity: 0.8;
      transition: opacity 0.2s, transform 0.1s;
    }
    .emb-btn-close-panel:hover { opacity: 1; transform: scale(1.1); }

    .emb-content-wrapper {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow-y: auto;  
      overflow-x: hidden;
      padding: 3px 6px;
    }
    .emb-content-wrapper::-webkit-scrollbar { width: 4px; }
    .emb-content-wrapper::-webkit-scrollbar-track { background: transparent; }
    .emb-content-wrapper::-webkit-scrollbar-thumb { background: #ccc; border-radius: 2px; }
    .emb-content-wrapper::-webkit-scrollbar-thumb:hover { background: #aaa; }

    .emb-section {
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
      margin-bottom: 4px;
      border: 1px solid #eee;
      border-radius: 5px;
      overflow: hidden; 
      background: #fff;
    }
    #emb-panel-profile, #emb-panel-results {
      border-top: 1px solid var(--emb-color-border);
    }

    .emb-ph {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 6px 10px;
      border-bottom: 1px solid transparent;
      flex-shrink: 0;
      background-color: var(--emb-color-primary-bar);
      position: sticky; top: 0; z-index: 10;
      cursor: pointer;
      transition: background-color 0.2s;
      -webkit-tap-highlight-color: transparent;
    }
    .emb-ph:hover {
      background-color: rgba(16, 185, 129, 0.30);
    }

    .emb-ph.active {
      background-color: #ecfdf5;
      border-bottom: 1px solid #a7f3d0;
    }
    .emb-ph-title {
      font-size: var(--emb-fs-sub);
      font-weight: bold;
      color: var(--emb-color-text-main);
      padding: 4px 0;
    }
    .emb-ph.active .emb-ph-title {
      color: #047857;
    }

    .emb-toggle-icon {
      font-size: 11px;
      color: #666;
      transition: transform 0.3s ease;
      flex-shrink: 0;
    }
    .emb-ph.active .emb-toggle-icon {
      transform: rotate(180deg);
    }

    .emb-mini-bar {
      padding: 7px 18px;
      display: none; align-items: center; gap: 17px;
      flex-shrink: 0;
      background: var(--emb-color-surf);
      border-top: 1px solid var(--emb-color-border-dim);
    }
    .emb-section.collapsed .emb-mini-bar  { display: flex; }
    .emb-section.collapsed .emb-panel-body { 
       max-height: 0;
       opacity: 0;
       padding-top: 0;
       padding-bottom: 0; 
    }

    .emb-mini-vol {
      font-family: var(--emb-mono);
      font-size: var(--emb-fs-xxl);
      font-weight: 800;
      color: var(--emb-color-brown);
      flex: 1;
      text-align: right;
    }
    .emb-btn-mini {
      background: var(--emb-color-reset-bg);
      border: 1px solid var(--emb-color-border);
      color: var(--emb-color-text-main);
      border-radius: var(--emb-rad);
      padding: 4px 9px;
      font-size: var(--emb-fs-lg);
      font-weight: 700;
      cursor: pointer;
      white-space: nowrap;
      transition: background .15s;
    }
    .emb-btn-mini:hover { background: var(--emb-color-border); }
    .emb-btn-mini.accent {
      background: var(--emb-color-primary);
      color: var(--emb-color-text-btn);
      border-color: var(--emb-color-primary);
      width: 30%;
    }
    .emb-btn-mini.accent:hover { background: var(--emb-color-primary-dark); }

    .emb-panel-body {
      padding: 5px;
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 4px;
      background: var(--emb-color-surf2);
      overflow: hidden;
      max-height: 800px; 
      opacity: 1;
      transition: max-height 0.3s ease-in-out, 
                  opacity 0.3s ease-in-out, 
                  padding 0.3s ease-in-out;
    }

    .emb-warning-text {
      color: var(--emb-color-danger);
      font-size: var(--emb-fs-xs);
      text-align: center;
      font-weight: 600;
      line-height: 1.5;
      margin: 2px 0 5px 0;
      padding: 4px;
      background-color: rgba(220, 53, 69, 0.05);
      border: 1px dashed rgba(220, 53, 69, 0.3);
      border-radius: 4px;
    }

    .emb-field-group   { display: flex; flex-direction: row; justify-content: space-between; padding: 0 12px; gap: 5px; }
    .emb-field-label   {
      font-size: var(--emb-fs-lg);
      color: var(--emb-color-text-main);
      text-transform: uppercase;
      letter-spacing: .2px;
      padding-top: 4px;
    }
    .emb-num-input {
      background: var(--emb-color-bg);
      border: 1px solid var(--emb-color-border-input);
      border-radius: var(--emb-rad);
      color: var(--emb-color-primary-dark);
      font-family: var(--emb-mono);
      font-size: var(--emb-fs-xl);
      padding: 4px 8px;
      width: 25%;
      text-align: right;
      transition: border-color .2s;
      box-sizing: border-box;
    }
    .emb-num-input:focus { outline: none; border-color: var(--emb-color-primary); }
    .emb-num-input:hover { border-color: var(--emb-color-primary); background: var(--emb-color-surf-hover); }

    .emb-layer-card {
      background: var(--emb-color-surf);
      border: 1px solid var(--emb-color-border-dim);
      border-radius: var(--emb-rad);
      padding: 8px 10px;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .emb-layer-card-title {
      display: flex;
      align-items: center;
      gap: 7px;
      font-weight: bold;
      font-size: var(--emb-fs-base);
      color: var(--emb-color-text-card);
    }
    .emb-layer-dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
    .emb-layer-fields { display: flex; flex-direction: column; gap: 5px; margin-left: 16px;}
    .emb-layer-fields label {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
      font-size: var(--emb-fs-md);
      color: var(--emb-color-text-muted);
    }
    .emb-layer-fields .emb-num-input {
      width: 85px;
      flex-shrink: 0;
      text-align: right;
      padding: 4px 6px;
      font-size: var(--emb-fs-xl);
    }

    .emb-divider { border: none; border-top: 1px solid var(--emb-color-border-dim); margin: 2px 0; }
    .emb-action-row { display: flex; gap: 10px; flex-shrink: 0; padding: 0 10px; }
    .emb-btn-calc {
      flex: 1;
      background: var(--emb-color-primary);
      color: var(--emb-color-text-btn);
      border: none;
      border-radius: var(--emb-rad);
      padding: 9px 8px;
      font-size: var(--emb-fs-lg);
      font-weight: 800;
      cursor: pointer;
      transition: background .2s, transform .1s;
    }
    .emb-btn-calc:hover  { background: var(--emb-color-primary-dark); }
    .emb-btn-calc:active { transform: scale(.97); }
    
    .emb-btn-reset {
      flex: 0 0 auto;
      background: var(--emb-color-reset-bg); 
      color: var(--emb-color-reset-text);
      border: 1px solid var(--emb-color-reset-brd);
      border-radius: var(--emb-rad);
      padding: 9px 12px;
      font-size: var(--emb-fs-lg);
      font-weight: 700;
      cursor: pointer;
      transition: background .2s, color .2s, border-color .2s;
    }
    .emb-btn-reset:hover {
      background: var(--emb-color-reset-hover-bg);
      color: var(--emb-color-reset-hover-text);
      border-color: var(--emb-color-reset-hover-brd);
    }

    .emb-profile-container {
      background: var(--emb-color-surf);
      border: 1px solid var(--emb-color-border-dim);
      border-radius: var(--emb-rad);
      padding: 10px;
      display: flex;
      justify-content: center;
      align-items: center;
      overflow-x: auto;
      overflow-y: hidden;
    }
    .emb-profile-container::-webkit-scrollbar { height: 4px; }
    .emb-profile-container::-webkit-scrollbar-thumb { background: #ccc; border-radius: 2px; }
    .emb-svg-text        { font-family: var(--emb-mono); font-size: var(--emb-fs-base); fill: var(--emb-color-svg-acc); font-weight: 600; }
    .emb-svg-text.dim    { fill: var(--emb-color-text-dim); font-size: var(--emb-fs-sm); }
    .emb-svg-text.acc    { fill: var(--emb-color-svg-acc); }

    .emb-result-header {
      font-size: var(--emb-fs-md);
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 1.4px;
      color: var(--emb-color-primary);
      margin-bottom: 8px;
    }
    .emb-result-table { width: 100%; border-collapse: collapse; font-size: var(--emb-fs-md); }
    .emb-result-table th {
      background: var(--emb-color-surf);
      color: var(--emb-color-text-muted);
      font-size: var(--emb-fs-md);
      letter-spacing: .7px;
      padding: 6px 5px;
      text-align: right;
      border-bottom: 1px solid var(--emb-color-border);
    }
    .emb-result-table th:first-child { text-align: center; }
    .emb-result-table td {
      padding: 6px 5px;
      border-bottom: 1px solid var(--emb-color-border-dim);
      vertical-align: middle;
      color: var(--emb-color-text-main);
    }
    .emb-result-table td:first-child {
      display: flex;
      align-items: center;
      gap: 5px;
      font-weight: 600;
    }
    .emb-result-table td.num { font-family: var(--emb-mono); text-align: right; font-size: var(--emb-fs-xs); }
    .emb-result-table .emb-dot {
      width: 7px; height: 7px;
      border-radius: 50%;
      display: inline-block;
      flex-shrink: 0;
    }
    .emb-total-row td {
      background: var(--emb-color-total-bg);
      color: var(--emb-color-primary-dark);
      font-weight: 700;
      border-top: 2px solid var(--emb-color-primary);
    }
    .emb-total-row td:first-child { justify-content: flex-end; }

    .emb-vol-card {
      margin-top: 10px;
      background: linear-gradient(135deg, rgba(16, 185, 129, 0.08), rgba(5, 150, 105, 0.04));
      border: 1px solid var(--emb-color-primary-bar);
      border-radius: var(--emb-rad);
      padding: 5px 12px;
      text-align: center;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .emb-vol-label { font-size: var(--emb-fs-md); letter-spacing: 1px; color: var(--emb-color-text-muted); }
    .emb-vol-value {
      font-size: var(--emb-fs-huge);
      font-family: var(--emb-mono);
      font-weight: 800;
      color: var(--emb-color-brown);
      line-height: 1.1;
    }
    .emb-vol-unit  { font-size: var(--emb-fs-md); color: var(--emb-color-text-muted); letter-spacing: 1px; }

    .emb-empty-state {
      color: var(--emb-color-text-muted);
      font-size: var(--emb-fs-md);
      text-align: center;
      margin-top: 15px;
      margin-bottom: 15px;
      line-height: 1.9;
    }
  `;
  if (document.getElementById('emb-injected-style')) return;
  const tag = document.createElement('style');
  tag.id = 'emb-injected-style';
  tag.textContent = css;
  document.head.appendChild(tag);
})();

let embDrawnItems        = null;
let embDistanceTooltips  = [];
let embHasResults        = false;
let embLastTotalVol      = 0;
let _embMap              = null;

const EMB_PALETTE = [
  '#475569',
  '#6ee7b7', '#059669',
  '#d4a574', '#92400e',
  '#93c5fd', '#1e3a5f',
  '#fbcfe8', '#9d174d',
  '#a7f3d0', '#065f46',
  '#e8c9a0', '#78350f',
  '#bfdbfe', '#1e40af',
  '#fce7f3', '#831843',
];
const getEmbColor = idx => EMB_PALETTE[Math.min(idx, EMB_PALETTE.length - 1)];
const getEmbLayerCardColor = layerIndex => EMB_PALETTE[1 + layerIndex * 2] || '#475569';

function buildEmbPanelSettingsHTML() {
  document.getElementById('emb-panel-settings').innerHTML = `
    <div class="emb-ph" id="emb-header-settings">
      <span class="emb-ph-title">⚙️ ตั้งค่าการถมดิน</span>
      <i class="fas fa-chevron-down emb-toggle-icon"></i>
    </div>
    <div class="emb-panel-body" id="emb-settings-body">
      
      <div class="emb-warning-text">
        ⚠️ ค่าเริ่มต้นเป็นเพียงค่าแนะนำ <br>
        ค่าใช้จริงต้องได้รับการตรวจสอบและรับรองโดยวิศวกร
      </div>

      <div class="emb-field-group">
        <span class="emb-field-label">จำนวนชั้นถม</span>
        <input type="number" id="emb-num-layers" class="emb-num-input" value="1" min="1" max="8" step="1">
      </div>
      
      <hr class="emb-divider">
      <div id="emb-layer-inputs"></div>
      
      <hr class="emb-divider">
      <div class="emb-action-row">
        <button class="emb-btn-calc" id="emb-btn-calculate">✅ คำนวณ</button>
        <button class="emb-btn-reset" id="emb-btn-reset" title="รีเซ็ตค่าเริ่มต้น">🔄 รีเซ็ต</button>
      </div>
    </div>
    <div class="emb-mini-bar" id="emb-settings-mini" style="display: none">
      <button class="emb-btn-mini accent" id="emb-btn-calc-mini">คำนวณ</button>
      <button class="emb-btn-mini" id="emb-btn-reset-mini">รีเซ็ต</button>
    </div>
  `;
}

function buildEmbPanelProfileHTML() {
  document.getElementById('emb-panel-profile').innerHTML = `
    <div class="emb-ph" id="emb-header-profile">
      <span class="emb-ph-title">📐 รูปตัดการถมดิน</span>
      <i class="fas fa-chevron-down emb-toggle-icon"></i>
    </div>
    <div class="emb-panel-body" id="emb-profile-body">
      <p class="emb-empty-state" id="emb-profile-empty" style="display:none;">คำนวณเพื่อดูรูปตัด</p>
      <div class="emb-profile-container" id="emb-profile-svg-wrapper"></div>
    </div>
    <div class="emb-mini-bar" id="emb-profile-mini" style="display:none;">
      <span style="font-size:var(--emb-fs-sm);color:var(--emb-color-text-muted)">กดขยายเพื่อแสดงรูปตัด</span>
    </div>
  `;
}

function buildEmbPanelResultsHTML() {
  document.getElementById('emb-panel-results').innerHTML = `
    <div class="emb-ph" id="emb-header-results">
      <span class="emb-ph-title">📊 ผลลัพธ์</span>
      <i class="fas fa-chevron-down emb-toggle-icon"></i>
    </div>
    <div class="emb-panel-body" id="emb-results-body">
      <p class="emb-empty-state">กรอกค่าและกด<br><strong>คำนวณ</strong></p>
    </div>
    <div class="emb-mini-bar" id="emb-results-mini">
      <span style="font-size:var(--emb-fs-sm);color:var(--emb-color-text-muted);letter-spacing:.8px">ปริมาตรรวม</span>
      <span class="emb-mini-vol" id="emb-mini-vol-val">—</span>
      <span style="font-size:var(--emb-fs-sm);color:var(--emb-color-text-muted)">ลบ.ม.</span>
    </div>
  `;
}

window.showEmbankmentPanel = function() {
  const el = document.getElementById('emb-main-panel');
  if (!el) return;
  el.style.display = 'flex';
  requestAnimationFrame(() => el.classList.add('visible'));
};

window.hideEmbankmentPanel = function() {
  const el = document.getElementById('emb-main-panel');
  if (!el) return;
  el.classList.remove('visible');
  el.addEventListener('transitionend', () => {
    if (!el.classList.contains('visible')) el.style.display = 'none';
  }, { once: true });
};

function initEmbCollapseToggles() {
  ['settings', 'profile', 'results'].forEach(name => {
    const header = document.getElementById(`emb-header-${name}`);
    if (header) {
      header.addEventListener('click', function() {
        const section = document.getElementById(`emb-panel-${name}`);
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

function fmtEmbNum(n) {
  return n.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function clearEmbDistanceTooltips() {
  embDistanceTooltips.forEach(t => t.remove());
  embDistanceTooltips = [];
}

function buildEmbLayerPanel() {
  const n = parseInt(document.getElementById('emb-num-layers').value) || 1;
  const container = document.getElementById('emb-layer-inputs');
  if (!container) return;
  
  container.innerHTML = '';
  
  for (let i = 0; i < n; i++) {
    const label = String.fromCharCode(65 + i);
    const color = getEmbLayerCardColor(i);
    
    const titleStep1 = (i === 0) ? `โฉนด-ฐานดินถม (${label}1)` : `ชานพัก (${label}1)`;
    const titleHeight = (i === 0) ? `H${label}` : `H${label}`;  
    const defStep1 = (i === 0) ? 0 : 2; 
    const defStep2 = 3;
    const defHeight = 2;

    container.innerHTML += `
      <div class="emb-layer-card" style="border-left:4px solid ${color}">
        <div class="emb-layer-card-title">
          <span class="emb-layer-dot" style="background:${color}"></span>ชั้น ${label}
        </div>
        <div class="emb-layer-fields">
          <label>
            <span>${titleStep1} ม.</span>
            <input type="number" id="emb-layer-step1-${i}" value="${defStep1}" step="0.5" class="emb-num-input">
          </label>
          <label>
            <span>ระยะแนวราบ (${label}2) ม.</span>
            <input type="number" id="emb-layer-step2-${i}" value="${defStep2}" step="0.5" class="emb-num-input">
          </label>
          <label>
            <span>ความสูง (${titleHeight}) ม.</span>
            <input type="number" id="emb-layer-height-${i}" value="${defHeight}" step="0.1" min="0.5" class="emb-num-input">
          </label>
        </div>
      </div>`;
  }
}

function readEmbLayerInputs() {
  const numLayersEl = document.getElementById('emb-num-layers');
  const numLayers = numLayersEl ? parseInt(numLayersEl.value) || 1 : 1; 
  const layers = [];
  
  for (let i = 0; i < numLayers; i++) {
    const s1El = document.getElementById(`emb-layer-step1-${i}`);
    const s2El = document.getElementById(`emb-layer-step2-${i}`);
    const heightEl = document.getElementById(`emb-layer-height-${i}`);

    if (s1El && s2El && heightEl) {
        layers.push({
          step1:  -Math.abs(parseFloat(s1El.value) || 0), 
          step2:  -Math.abs(parseFloat(s2El.value) || 0), 
          height:  Math.abs(parseFloat(heightEl.value) || 1),
        });
    }
  }
  return { layers };
}
function renderEmbProfileSVG(layers) {
  const svgWrapper = document.getElementById('emb-profile-svg-wrapper');
  const emptyState = document.getElementById('emb-profile-empty');
  if (!svgWrapper || !emptyState) return;

  const drawStep1W   = 35; 
  const drawStep2W   = 35;
  const drawHeightH  = 40; 

  const totalHeight = layers.length * drawHeightH;
  const startY = totalHeight + 40; 
  
  let x = 10, y = startY;
  let points  = `${x},${y}`;
  let svgContent = '';

  layers.forEach((lr, i) => {
    const absS1  = Math.abs(lr.step1);
    const absS2  = Math.abs(lr.step2);
    const h      = lr.height;
    const label  = String.fromCharCode(65 + i);

    const nextX_s1 = x + drawStep1W;
    svgContent += `<text 
      x="${(x + nextX_s1) / 2}" y="${y - 6}" 
      class="emb-svg-text acc" text-anchor="middle">${absS1}m</text>`;
    
    points += ` ${nextX_s1},${y}`;
    x = nextX_s1;

    const nextX_s2 = x + drawStep2W;
    const nextY_s2 = y - drawHeightH; 
    
    svgContent += `<line 
      x1="${nextX_s2 + 2}" y1="${y}" x2="${nextX_s2 + 2}" y2="${nextY_s2}" 
      stroke="var(--emb-color-border-input)" stroke-dasharray="2 2" stroke-width="1" opacity="0.7"/>`;
    svgContent += `<text 
      x="${nextX_s2 + 6}" y="${y - (drawHeightH / 2) + 4}" 
      class="emb-svg-text dim" text-anchor="start">${h}m</text>`;

    const hLineY = y + 1;
    svgContent += `<line 
      x1="${x}" y1="${hLineY}" x2="${nextX_s2}" y2="${hLineY}" 
      stroke="var(--emb-color-border-input)" stroke-dasharray="2 2" stroke-width="1" opacity="0.7"/>`;
    svgContent += `<text 
      x="${(x + nextX_s2) / 2}" y="${hLineY + 14}" 
      class="emb-svg-text dim" text-anchor="middle">${absS2}m</text>`;

    points += ` ${nextX_s2},${nextY_s2}`;
    x = nextX_s2;
    y = nextY_s2;
  });

  const topExtendW = drawStep1W + 10; 
  const finalX = x + topExtendW;
  points += ` ${finalX},${y}`;

  const polyPoints = `10,${startY + 2} ${points} ${finalX},${startY + 2}`;
  
  const totalW = finalX + 15;
  const totalH = startY + 22;

  const finalSVG = `
    <svg width="${totalW}" height="${totalH}" 
      viewBox="0 0 ${totalW} ${totalH}" xmlns="http://www.w3.org/2000/svg">
      <polygon points="${polyPoints}" fill="var(--emb-color-svg-fill)"/>
      <polyline points="${points}" fill="none" 
        stroke="var(--emb-color-svg-line)" stroke-width="2.5" stroke-linejoin="round"/>
      ${svgContent}
      <line x1="4" y1="${startY}" x2="10" y2="${startY}" 
        stroke="var(--emb-color-border)" stroke-width="2"/>
    </svg>`;

  emptyState.style.display = 'none';
  svgWrapper.style.display = 'flex';
  svgWrapper.innerHTML = finalSVG;
}

function getEmbArea(geoJSON) {
  const methodInput = document.querySelector('input[name="mp_calc_method"]:checked');
  const method = methodInput ? methodInput.value : 'planar';
  
  if (method === 'geodesic' && typeof turf !== 'undefined') {
    return turf.area(geoJSON);
  } else {
    return calculateEmbPlanarArea(geoJSON);
  }
}

function calculateEmbPlanarArea(geoJSON) {
  let totalArea = 0;
  if (typeof turf !== 'undefined') {
    turf.geomEach(geoJSON, function (geom) {
      if (geom.type === 'Polygon') {
        totalArea += polygonEmbPlanarArea(geom.coordinates);
      } else if (geom.type === 'MultiPolygon') {
        geom.coordinates.forEach(coords => {
          totalArea += polygonEmbPlanarArea(coords);
        });
      }
    });
  }
  return totalArea;
}

function polygonEmbPlanarArea(coordinates) {
  let area = ringEmbPlanarArea(coordinates[0]); 
  for (let i = 1; i < coordinates.length; i++) {
    area -= ringEmbPlanarArea(coordinates[i]); 
  }
  return Math.max(0, area);
}


function ringEmbPlanarArea(coords) {
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

window.calculateEmbankmentOffset = function calculateEmbankmentOffset(suppressAlert = false) {
   if (!document.getElementById('emb-results-body')) {
    if (_embMap || window.map) {
      window.initEmbankment(_embMap || window.map);
    } else {
      if (!suppressAlert) alert('⚠️ ระบบยังไม่พร้อม กรุณารอสักครู่');
      return;
    }
  }
   
  if (!embDrawnItems) {
    if (!_embMap) _embMap = window.map; 
    embDrawnItems = new L.FeatureGroup().addTo(_embMap);
  }
  if (!_embMap && window.map) { _embMap = window.map; }
  if (!_embMap) { if(!suppressAlert) alert('⚠️ ระบบแผนที่ยังไม่พร้อม กรุณารอสักครู่'); return; }
  if (!window.lastDrawnLayer) { if(!suppressAlert) alert('⚠️ กรุณาวาด Polygon บนแผนที่ก่อน'); return; }

  const originalGeoJSON = window.lastDrawnLayer.toGeoJSON();
  const { layers } = readEmbLayerInputs();

  if (embDrawnItems) embDrawnItems.clearLayers();
  clearEmbDistanceTooltips();

  let current = originalGeoJSON;
  const allPolygons = [originalGeoJSON];
  const rawLatLngs = window.lastDrawnLayer.getLatLngs()[0];
  const allAreas = [MeasurePlusCalc.ringArea(rawLatLngs)];
  const volumes = [];
  let totalVol = 0;

  for (let i = 0; i < layers.length; i++) {
    const LData = layers[i];
    const basePoly = turf.buffer(current, LData.step1, { units: 'meters' });
    if (!basePoly) {
      if(!suppressAlert) alert(`⚠️ พื้นที่เล็กเกินไป ไม่สามารถสร้างฐานชั้นที่ ${i+1} ได้`);
      break;
    }
    
    const topPoly = turf.buffer(basePoly, LData.step2, { units: 'meters' });
    if (!topPoly) {
      if(!suppressAlert) alert(`⚠️ พื้นที่เล็กเกินไป ไม่สามารถสร้างยอดชั้นที่ ${i+1} ได้`);
      break;
    }

    allPolygons.push(basePoly, topPoly);
    
    const areaBase = getEmbArea(basePoly);
    const areaTop  = getEmbArea(topPoly);
    allAreas.push(areaBase, areaTop);
    const vol = ((areaBase + areaTop) * LData.height) / 2;
    volumes.push({ vol });
    totalVol += vol;

    current = topPoly;
  }

  allPolygons.forEach((pg, idx) => {
    L.geoJSON(pg, {
      style: {
        color: getEmbColor(idx),
        weight: idx === 0 ? 3 : 2,
        opacity: 0.9,
        fillOpacity: idx === 0 ? 0.06 : 0.10,
        dashArray: idx === 0 ? null : '6 4',
      },
    }).addTo(embDrawnItems);
  });

  embHasResults = true;
  embLastTotalVol = totalVol;

  renderEmbResults(allAreas, volumes, totalVol);
  renderEmbProfileSVG(layers);

  window.showEmbankmentPanel();
   
  const miniVolEl = document.getElementById('emb-mini-vol-val');
  if (miniVolEl) miniVolEl.textContent = fmtEmbNum(totalVol);

  document.getElementById('emb-panel-profile').classList.add('collapsed');
  document.getElementById('emb-header-profile').classList.remove('active');
   
  document.getElementById('emb-panel-results').classList.add('collapsed');
  document.getElementById('emb-header-results').classList.remove('active');

  if (typeof window.showStatus === 'function')
    window.showStatus(`✅ คำนวณถมดินเสร็จ — ${layers.length} ชั้น | ปริมาตรรวม ${fmtEmbNum(totalVol)} ลบ.ม.`);
};

function renderEmbResults(allAreas, volumes, totalVol) {
  const resultsBody = document.getElementById('emb-results-body');
  if (!resultsBody) return;

  const methodInput = document.querySelector('input[name="mp_calc_method"]:checked');
  const method = methodInput ? methodInput.value : 'planar';
  const methodText = method === 'geodesic' 
    ? 'Geodesic (ตามความโค้งผิวโลก)' 
    : 'Planar (บนระนาบ 2 มิติ)';

  const getLayerLabel = (index) => {
    if (index === 0) return 'โฉนด';
    const layerIndex = Math.floor((index - 1) / 2); 
    const isTop = (index - 1) % 2 !== 0; 
    const letter = String.fromCharCode(65 + layerIndex);
    return isTop ? `ชั้น ${letter}2` : `ชั้น ${letter}1`;
  };

  const rows = allAreas.map((area, i) => {
    const color = getEmbColor(i);
    const sqm = fmtEmbNum(area);
    const rai = (area / 1600).toLocaleString('th-TH', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
    
    let volCell = '—';
    if (i > 0 && (i - 1) % 2 !== 0) {
      const vIdx = Math.floor((i - 1) / 2);
      if (vIdx < volumes.length) {
          volCell = `<strong style="color:var(--emb-color-primary-dark)">${fmtEmbNum(volumes[vIdx].vol)}</strong>`;
      }
    }
    
    return `
      <tr>
        <td><span class="emb-dot" style="background:${color}"></span>${getLayerLabel(i)}</td>
        <td class="emb-num">${sqm}</td>
        <td class="emb-num">${rai}</td>
        <td class="emb-num">${volCell}</td>
      </tr>`;
  }).join('');

  resultsBody.innerHTML = `
    <div class="emb-result-header" style="display: none;">รายการคำนวณ</div>
    <table class="emb-result-table">
      <thead>
        <tr>
          <th>ระดับ</th><th>ตร.ม.</th><th>ไร่</th><th>ลบ.ม.</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
        <tr class="emb-total-row" style="display: none;">
          <td colspan="3">ปริมาตรรวม</td>
          <td class="emb-num"><strong>${fmtEmbNum(totalVol)}</strong></td>
        </tr>
      </tbody>
    </table>
    <div style="font-size: var(--emb-fs-xs); color: var(--emb-color-text-muted); text-align: left; margin-top: 4px; margin-bottom: -2px; padding-left: 4px;">
      หมายเหตุ : คำนวณพื้นที่ด้วยวิธี ${methodText}
    </div>
    
    <div class="emb-vol-card">
      <span class="emb-vol-label">ปริมาตรรวม</span>
      <span class="emb-vol-value">${fmtEmbNum(totalVol)}</span>
      <span class="emb-vol-unit">ลูกบาศก์เมตร</span>
    </div>`;
}

function doEmbReset() {
  document.getElementById('emb-num-layers').value = "1";
  buildEmbLayerPanel(); 

  if (window.lastDrawnLayer) {
    calculateEmbankmentOffset();
  } else {
    if (embDrawnItems) embDrawnItems.clearLayers();
    clearEmbDistanceTooltips();
    embHasResults = false;
    embLastTotalVol = 0;

    const rb = document.getElementById('emb-results-body');
    if (rb) rb.innerHTML = '<p class="emb-empty-state">กรอกค่าและกด<br><strong>คำนวณ</strong></p>';
    const mv = document.getElementById('emb-mini-vol-val');
    if (mv) mv.textContent = '—';

    const emptyState = document.getElementById('emb-profile-empty');
    const svgWrapper = document.getElementById('emb-profile-svg-wrapper');
    if (emptyState) emptyState.style.display = 'block';
    if (svgWrapper) { svgWrapper.style.display = 'none'; svgWrapper.innerHTML = ''; }

    document.getElementById('emb-panel-settings').classList.add('collapsed');
    document.getElementById('emb-header-settings').classList.remove('active');
    
    document.getElementById('emb-panel-profile').classList.add('collapsed');
    document.getElementById('emb-header-profile').classList.remove('active');
    
    document.getElementById('emb-panel-results').classList.add('collapsed');
    document.getElementById('emb-header-results').classList.remove('active');
  }
}

window.collapseAllEmbankmentPanels = function() {
  ['settings', 'profile', 'results'].forEach(name => {
    const p = document.getElementById(`emb-panel-${name}`);
    const h = document.getElementById(`emb-header-${name}`);
    if (p && h) { 
      p.classList.add('collapsed'); 
      h.classList.remove('active'); 
    }
  });
};

window.clearEmbankmentData = function() {
  if (embDrawnItems) embDrawnItems.clearLayers();
  clearEmbDistanceTooltips();
  embHasResults = false;
  embLastTotalVol = 0;

  const rb = document.getElementById('emb-results-body');
  if (rb) rb.innerHTML = '<p class="emb-empty-state">กรอกค่าและกด<br><strong>คำนวณ</strong></p>';
  const mv = document.getElementById('emb-mini-vol-val');
  if (mv) mv.textContent = '—';

  const emptyState = document.getElementById('emb-profile-empty');
  const svgWrapper = document.getElementById('emb-profile-svg-wrapper');
  if (emptyState) emptyState.style.display = 'block';
  if (svgWrapper) { svgWrapper.style.display = 'none'; svgWrapper.innerHTML = ''; }

  window.hideEmbankmentPanel();
  window.collapseAllEmbankmentPanels();
};

window.initEmbankment = function(leafletMap) {
  if (!leafletMap) { console.error('[embankment] ไม่ได้รับ map object'); return; }
  _embMap = leafletMap;

  let mainPanel = document.getElementById('emb-main-panel');
  if (!mainPanel) {
    mainPanel = document.createElement('div');
    mainPanel.id = 'emb-main-panel';
    mainPanel.className = 'emb-main-panel';

    const mainHeader = document.createElement('div');
    mainHeader.className = 'emb-main-ph';
    mainHeader.innerHTML = `
      <span class="emb-main-ph-title">📋 รายการตรวจสอบปริมาตรดินถม</span>
      <button class="emb-btn-close-panel" id="emb-btn-close-panel" title="ปิด">×</button>
    `;
    mainPanel.appendChild(mainHeader);

    const contentWrapper = document.createElement('div');
    contentWrapper.id = 'emb-content-wrapper';
    contentWrapper.className = 'emb-content-wrapper';

    const settingsSec = document.createElement('div');
    settingsSec.id = 'emb-panel-settings';
    settingsSec.className = 'emb-section collapsed';

    const profileSec = document.createElement('div');
    profileSec.id = 'emb-panel-profile';
    profileSec.className = 'emb-section collapsed';

    const resultsSec = document.createElement('div');
    resultsSec.id = 'emb-panel-results';
    resultsSec.className = 'emb-section collapsed';

    contentWrapper.appendChild(settingsSec);
    contentWrapper.appendChild(profileSec);
    contentWrapper.appendChild(resultsSec);

    mainPanel.appendChild(contentWrapper);
    document.body.appendChild(mainPanel);
  }

  buildEmbPanelSettingsHTML();
  buildEmbPanelProfileHTML();
  buildEmbPanelResultsHTML();

  embDrawnItems = new L.FeatureGroup();
  _embMap.addLayer(embDrawnItems);

  buildEmbLayerPanel();
  initEmbCollapseToggles();

  document.getElementById('emb-btn-calculate').addEventListener('click', () => calculateEmbankmentOffset(false));
  document.getElementById('emb-btn-calc-mini').addEventListener('click', () => calculateEmbankmentOffset(false));
  document.getElementById('emb-btn-reset').addEventListener('click', doEmbReset);
  document.getElementById('emb-btn-reset-mini').addEventListener('click', doEmbReset);
  document.getElementById('emb-btn-close-panel').addEventListener('click', window.hideEmbankmentPanel);
  
  document.getElementById('emb-num-layers').addEventListener('input', buildEmbLayerPanel);
  document.getElementById('emb-num-layers').addEventListener('change', buildEmbLayerPanel);

  document.addEventListener('change', function(e) {
    if (e.target && e.target.name === 'mp_calc_method') {
      if (window.lastDrawnLayer && embHasResults) {
        calculateEmbankmentOffset(true);
      }
    }
  });

  if (typeof window.showStatus === 'function')
    window.showStatus('เปิดเครื่องมือวัดพื้นที่และวาด Polygon เพื่อเริ่มต้นหาปริมาตรดินถม');
};
})(BPNP.tools.lcompat.L);
