/* js/tools/measure/measure_plus.js
 * ─────────────────────────────────────────────────────────────────────────
 * เฟส 5C: mp.js (วัดระยะ/พื้นที่/วงกลม, นำเข้า/ส่งออก, ปรับพื้นที่) เดิม — คัดลอกตรงทั้งไฟล์ ทำงานผ่าน Leaflet ชุดย่อยใน lcompat.js (ไม่ใช่ Leaflet จริง)
 * แก้เฉพาะ: path รูปไอคอน img/ → assets/ui/ · ensureVolumeTools (โหลดพร้อมกันแทนโหลดทีหลัง)
 * ───────────────────────────────────────────────────────────────────────── */
(function (L) {
// mp.js
class MeasurePlus {
  constructor(map, options = {}) {
    this._map = map;
    this.options = {
      lineColor: "#0ea5e9",
      fillColor: "#0ea5e9",
      lineWeight: 3,
      units: "thai",
      calcMethod: "planar", 
      markerShape: "circle",
      markerColor: "#0000ff",
      markerSize: 10,
      showLabels: true,
      showMarkers: true,
      mainIconUrl: "assets/ui/pencil.png",
      ...options,
    };
    this._init();
  }

  _init() {
    this._panelWrapper = L.DomUtil.create("div", "mp-panel");
    this._panelWrapper.style.zIndex = "9999";
    this._panel = L.DomUtil.create(
      "div",
      "measure-plus-panel",
      this._panelWrapper
    );
    this._panel.style.display = "none";
    this._panel.innerHTML = this._renderPanelHTML();
    document.body.appendChild(this._panelWrapper);
    L.DomEvent.disableClickPropagation(this._panelWrapper);
    L.DomEvent.disableScrollPropagation(this._panelWrapper);

    this._completedDrawLayer  = L.layerGroup().addTo(this._map);
    this._activeDrawLayer     = L.layerGroup().addTo(this._map);
    this._drawLayer           = this._completedDrawLayer;       
    this._vertexLayer         = L.layerGroup().addTo(this._map);
    this._tempVertexLayer     = L.layerGroup().addTo(this._map);
    this._completedLabelLayer = L.layerGroup().addTo(this._map);
    this._activeLabelLayer    = L.layerGroup().addTo(this._map);
    this._labelLayer          = this._completedLabelLayer;      

    this._features = [];
    this._featureIdCounter = 0;
    this._deletedFeatures = [];

    this._points = [];
    this._vertexMarkers = [];
    this._segmentLabels = [];
    this._circleLabels = [];
    this._tempLine = null;
    this._closingLine = null;
    this._tempLabel = null;
    this._closingLabel = null;
    this._mode = null;
    this._isDrawing = false;
    this._longPressTimeout = null;
    this._longPressFired = false;

    this._blinkInterval = null;
    this._blinkTempLayer = null;
    
    this._isAdjustingArea = false; 

    this._bindUI();
    this._addBlinkStyle();
  }

  _exitAdjustMode() {
      this._isAdjustingArea = false;
      this._features.forEach(f => {
          if (f.shapeLayer && f.shapeLayer._path) {
              L.DomUtil.removeClass(f.shapeLayer._path, 'mp-shape-hover-blue');
              L.DomUtil.removeClass(f.shapeLayer._path, 'mp-shape-selected-blue');
          }
      });
  }

  _addBlinkStyle() {
    if (!document.getElementById('mp-blink-style')) {
      const style = document.createElement('style');
      style.id = 'mp-blink-style';
      style.innerHTML = `
        .mp-blink-effect {
            filter: drop-shadow(0px 0px 6px rgba(255, 0, 0, 0.9));
            transition: opacity 0.15s ease-in-out, fill-opacity 0.15s ease-in-out;
        }
      `;
      document.head.appendChild(style);
    }
  }

  _renderPanelHTML() {
    return `
      <button class="mp-close-btn" title="ปิด">×</button>
      <div class="mp-modes">
        <button data-mode="line" class="mp-btn" title="คลิกวัดระยะ"><img src="assets/ui/polyline.png" class="mp-icon"></button>
        <button data-mode="polygon" class="mp-btn" title="คลิกวัดพื้นที่หลายเหลี่ยม"><img src="assets/ui/polygon.png" class="mp-icon"></button>
        <button data-mode="circle" class="mp-btn" title="คลิกวัดพื้นที่วงกลม"><img src="assets/ui/circle.png" class="mp-icon"></button>
        <button data-mode="deleteOBJ" class="mp-btn mp-deleteOBJ" title="ลบวัตถุ"><img src="assets/ui/delete.png"></button>
        <button data-mode="clear" class="mp-btn mp-eraser" title="ล้างทั้งหมด"><img src="assets/ui/eraser.png" class="mp-icon"></button>
      </div>

  <details class="mp-settings modern" >
    <summary>Settings</summary>
    <div style="display:flex;flex-direction:column;gap:6px;margin-top:6px;margin-left:5px;
      margin-right:3px;">

      <div class="mp-group-box">
        <div class="mp-group-row">
          <label class="mp-row-label">วิธีคำนวณพื้นที่ / ระยะทาง</label>
          <div class="mp-segmented-control">
            <input type="radio" id="calc-planar" name="mp_calc_method" data-opt="calcMethod" value="planar" checked>
            <label for="calc-planar">Planar</label>
            <input type="radio" id="calc-geodesic" name="mp_calc_method" data-opt="calcMethod" value="geodesic">
            <label for="calc-geodesic">Geodesic</label>
          </div>
        </div>
        <hr class="mp-group-divider">
        <div class="mp-group-column">
          <label class="mp-row-label">หน่วย</label>
          <select data-opt="units">
            <option value="metric">Metric</option>
            <option value="thai" selected>ไทย</option>
          </select>
        </div>
      </div>
      
      <div class="mp-group-box">
        <div class="color-column">
          <label>สีเส้น
            <input type="color" data-opt="lineColor" value="#3388ff">
          </label>
          <label>สีพื้น
            <input type="color" data-opt="fillColor" value="#3388ff">
          </label>
        </div>
        <label class="mp-checkbox">
          <input type="checkbox" data-opt="showLabels" checked> แสดงป้ายระยะ/พื้นที่
        </label>
        <hr class="mp-group-divider">
        <label class="mp-checkbox">
          <input type="checkbox" data-opt="showMarkers" checked> แสดงจุด
        </label>
        <div id="mp-marker-options" class="mp-marker-options" style="display:flex;flex-direction:column;gap:6px;">
          <div style="display:flex;gap:10px;align-items:center;">
            <label>รูปร่าง
              <select data-opt="markerShape">
                <option value="circle" selected>กลม</option>
                <option value="square">เหลี่ยม</option>
              </select>
            </label>
            <label>สี
              <input type="color" data-opt="markerColor" value="#0000ff">
            </label>
          </div>
          <label class="mp-marker-size-label">
            ขนาด: <span id="mp-marker-size-val">8</span>px
            <input type="range" data-opt="markerSize" min="5" max="15" step="1" value="8">
          </label>
        </div>
      </div>
    </div>

    <div style="display:flex; width:100%; padding: 5px 3px;">
      <div class="mp-group-box">
        <span style="font-size: 12px; color: #555; text-align: center; font-weight: bold;">📤 Export</span>
        <div style="display: flex; gap: 5px; width: 100%;">
          <button data-export-format="geojson" class="mp-export-btn" style="flex: 1; background:#FEE2CD; padding: 4px 3px; font-size: 11px;">GeoJSON</button>
          <button data-export-format="kml" class="mp-export-btn" style="flex: 1; background:#FEE2CD; padding: 4px 4px; font-size: 11px;">KML</button>
        </div>
      </div>
      <div class="mp-group-box" style="margin-left:auto;">
        <span style="font-size: 12px; color: #555; text-align: center; font-weight: bold;">📥 Import </span>
        <div style="display: flex; width: 100%; flex: 1;">
          <input type="file" id="mp-import-file" accept=".geojson,.json,.kml" style="display:none">
          <button id="mp-import-btn" class="mp-export-btn" style="flex: 1; background: #E1FEF2; color: #333; padding: 4px 0; font-size: 11px; height: 100%;">นำเข้าไฟล์</button>
        </div>
      </div>
    </div>
  </details>

  <div class="mp-metrics" style="margin-bottom: 4px;">
    <div class="mp-metrics-title">Active measurement</div>
    <div class="mp-metrics-value">—</div>
  </div>

<div id="mp-polygon-tools-container" class="mp-group-box" style="display:none; border: 1px solid #2563eb; padding: 0 5px 5px 5px;">
  <div id="mp-adjust-area-container" style="display:none; padding: 4px; margin-bottom: 0px;">
    <button id="mp-adjust-area-btn" >✏️ ปรับขนาดพื้นที่ (Adjust Area)</button>
  </div>

  <div id="mp-adjust-area-modal" style="display:none; background: #f0f7ff; border: 1px solid #0055ff; box-shadow: 0 0 8px rgba(0, 85, 255, 0.3); padding: 4px; margin-bottom: 6px; border-radius: 4px;">
      <div id="mp-adjust-metric-inputs" style="display:none; flex-direction:column; gap:5px;">
          <label style="font-size:11px; color:#333;">ระบุพื้นที่ใหม่ (ตารางเมตร / m²)</label>
          <input type="number" id="mp-input-sqm" step="any" min="0" style="width:100%; padding:4px; font-size:11px;" />
      </div>
      <div id="mp-adjust-thai-inputs" style="display:none; flex-direction:column; gap:5px;">
          <label style="font-size:11px; color:#333;">ระบุพื้นที่ใหม่</label>
          <div style="display:flex; gap:5px;">
              <input type="number" id="mp-input-rai" placeholder="ไร่" min="0" style="width:33%; padding:4px 6px; font-size:11px;" />
              <input type="number" id="mp-input-ngan" placeholder="งาน" min="0" style="width:33%; padding:4px 6px; font-size:11px;" />
              <input type="number" id="mp-input-sqwa" placeholder="ตร.วา" min="0" step="any" style="width:33%; padding:4px 6px; font-size:11px;" />
          </div>
      </div>
      <div style="display:flex; gap:5px; margin-top:4px;">
          <button id="mp-apply-adjust-btn" style="flex:1; background:#28a745; color:white; border:none; padding:4px; border-radius:3px; cursor:pointer; font-size:11px;">ตกลง</button>
          <button id="mp-cancel-adjust-btn" style="flex:1; background:#dc3545; color:white; border:none; padding:4px; border-radius:3px; cursor:pointer; font-size:11px;">ยกเลิก</button>
      </div>
  </div>
  
  <div class="mp-cut-fill-container" >
    <div style="display:flex; flex-direction:column; margin-bottom: 4px;">
        <span style="font-size:11px; color:#222; font-weight: bold;">หาปริมาตร : </span>
        <span style="font-size:11px; color:#DA1C07; display:none;">(อยู่ระหว่างทดสอบระบบการคำนวณ)</span>
    </div>
    <div style="display: flex; gap: 8px; flex: 1;">
        <button id="mp-calc-excavation-btn" class="mp-btn-disabled" disabled>บ่อขุด</button>
        <button id="mp-calc-fill-btn" class="mp-btn-disabled" disabled>ดินถม</button>
    </div>
  </div>
</div>
      
  <div id="showDrawInstruction" class="instruction"> กด Esc/Spacebar/Enter/Dbl Click <br>เพื่อจบการวาด</div>
    `;
  }

  _deactivateAllButtons() {
    this._panel
      .querySelectorAll(".mp-btn")
      .forEach((btn) => btn.classList.remove("active"));
    this._map.getContainer().style.cursor = "";
  }

  _updateExcBtnState() {
    if (!this._panel) return;
    const excContainer = this._panel.querySelector(".mp-cut-fill-container");
    const excBtn = this._panel.querySelector("#mp-calc-excavation-btn");
    const fillBtn = this._panel.querySelector("#mp-calc-fill-btn"); 
    
    const adjustContainer = this._panel.querySelector("#mp-adjust-area-container");
    const adjustModal = this._panel.querySelector("#mp-adjust-area-modal");
    const polygonToolsContainer = this._panel.querySelector("#mp-polygon-tools-container");

    if (!excContainer || !excBtn || !fillBtn) return;

    const polys = this._features.filter(f => f.mode === 'polygon');
    const hasPolygon = polys.length > 0;

    if (hasPolygon || this._mode === 'polygon') {
        if (polygonToolsContainer) polygonToolsContainer.style.display = "block";
        
        excContainer.style.display = "block";
        if (hasPolygon) {
            excBtn.removeAttribute("disabled");
            excBtn.classList.remove("mp-btn-disabled");
            excBtn.classList.add("mp-btn-active");
            
            fillBtn.removeAttribute("disabled");
            fillBtn.classList.remove("mp-btn-disabled");
            fillBtn.classList.add("mp-btn-active");
            
            if (adjustContainer) adjustContainer.style.display = "block";

            const latestPoly = polys[polys.length - 1];
            if (latestPoly && latestPoly.shapeLayer) {
                window.lastDrawnLayer = latestPoly.shapeLayer;
            }
        } else {
            excBtn.setAttribute("disabled", "true");
            excBtn.classList.remove("mp-btn-active");
            excBtn.classList.add("mp-btn-disabled");
                      
            fillBtn.setAttribute("disabled", "true");
            fillBtn.classList.remove("mp-btn-active");
            fillBtn.classList.add("mp-btn-disabled");

            window.lastDrawnLayer = null;
            if (adjustContainer) adjustContainer.style.display = "none";
            if (adjustModal) adjustModal.style.display = "none";
        }
    } else {
        if (polygonToolsContainer) polygonToolsContainer.style.display = "none";
        
        excContainer.style.display = "none";
        window.lastDrawnLayer = null;
        if (adjustContainer) adjustContainer.style.display = "none";
        if (adjustModal) adjustModal.style.display = "none";
    }
  }

  _bindUI() {
    const panel = this._panel;

    window.uiActions = window.uiActions || {};
    window.uiActions.toggleMeasureTool = (ev) => {
      if (ev) L.DomEvent.stopPropagation(ev);
      const isOpen = panel.style.display === "block";
      panel.style.display = isOpen ? "none" : "block";

      if (!isOpen) {
        if(typeof window.logUserEvent === 'function') window.logUserEvent("Open Tools", "ผู้ใช้เปิดใช้ Measurement-Tools");
        this._deactivateAllButtons();
        this._setMode(null);
      }
    };

    window.initMeasureUIBtn = () => {
      if (typeof window.createStandardButton === 'function') {
          window.createStandardButton({
              id: 'measurePlusBtn',
              imageSrc: this.options.mainIconUrl,
              style: { top: 'var(--safe-top)', left: 'calc(var(--safe-left) + (var(--map-btn-size) * 2) + (var(--map-gap) * 2))' },
              title: 'วัดระยะ/พื้นที่',
              onClick: window.uiActions.toggleMeasureTool
          });
      }
    };

    panel.querySelector(".mp-close-btn").addEventListener("click", () => {
      this._clearAll();
      panel.style.display = "none";
      this._deactivateAllButtons();
      this._setMode(null);
    });

    panel.querySelectorAll(".mp-btn").forEach((btn) => {
      btn.addEventListener("click", (ev) => {
        L.DomEvent.stopPropagation(ev);
        const mode = btn.dataset.mode;
        const isSameMode = this._mode === mode;

        if (mode === "clear") {
          this._clearAll();
          this._deactivateAllButtons();
          this._setMode(null);
          return;
        }

        this._finishDrawing();
        
        if (isSameMode) {
            if(mode === 'deleteOBJ') {
                this._deletedFeatures = [];
                console.log("Deletions confirmed.");
            }
            this._deactivateAllButtons();
            this._setMode(null);
        } else {
            this._deactivateAllButtons();
            btn.classList.add("active");
            this._setMode(mode);
            if(typeof window.logUserEvent === 'function') window.logUserEvent("Tool Used", `ใช้เครื่องมือ Measurement: ${mode}`);
        }
        
        this._updateExcBtnState();
      });
    });

    const adjustBtn = panel.querySelector("#mp-adjust-area-btn");
    const adjustModal = panel.querySelector("#mp-adjust-area-modal");
    const cancelAdjustBtn = panel.querySelector("#mp-cancel-adjust-btn");
    const applyAdjustBtn = panel.querySelector("#mp-apply-adjust-btn");

    if (adjustBtn && adjustModal) {
        adjustBtn.addEventListener("click", (ev) => {
            L.DomEvent.stopPropagation(ev);
            adjustModal.style.display = "block";
            
            this._isAdjustingArea = true;
            
            if (window.lastDrawnLayer && window.lastDrawnLayer._path) {
                this._features.forEach(f => {
                    if (f.shapeLayer && f.shapeLayer._path) {
                        L.DomUtil.removeClass(f.shapeLayer._path, 'mp-shape-selected-blue');
                    }
                });
                L.DomUtil.addClass(window.lastDrawnLayer._path, 'mp-shape-selected-blue');
            }
            
            const metricInputs = panel.querySelector("#mp-adjust-metric-inputs");
            const thaiInputs = panel.querySelector("#mp-adjust-thai-inputs");
            
            if (this.options.units === "thai") {
                metricInputs.style.display = "none";
                thaiInputs.style.display = "flex";
            } else {
                thaiInputs.style.display = "none";
                metricInputs.style.display = "flex";
            }
        });
    }

    if (cancelAdjustBtn && adjustModal) {
        cancelAdjustBtn.addEventListener("click", (ev) => {
            L.DomEvent.stopPropagation(ev);
            adjustModal.style.display = "none";
            panel.querySelector("#mp-input-sqm").value = "";
            panel.querySelector("#mp-input-rai").value = "";
            panel.querySelector("#mp-input-ngan").value = "";
            panel.querySelector("#mp-input-sqwa").value = "";

            this._exitAdjustMode();
        });
    }

    if (applyAdjustBtn) {
        applyAdjustBtn.addEventListener("click", (ev) => {
            L.DomEvent.stopPropagation(ev);
            this._applyAreaAdjustment();
        });
    }

    const importBtn = panel.querySelector('#mp-import-btn');
    const importFile = panel.querySelector('#mp-import-file');
    if (importBtn && importFile) {
        importBtn.addEventListener('click', (ev) => {
            L.DomEvent.stopPropagation(ev);
            importFile.click();
        });
        
        importFile.addEventListener('change', (ev) => {
            const file = ev.target.files[0];
            if (file) {
                this._handleImportFile(file);
            }
            importFile.value = '';
        });
    }

    const excBtn = panel.querySelector("#mp-calc-excavation-btn");
    if (excBtn) {
        excBtn.addEventListener("click", async (ev) => {
            ev.preventDefault();
            L.DomEvent.stopPropagation(ev);
            if (excBtn.hasAttribute("disabled")) return;
            if (!(await window.ensureVolumeTools(this._map))) return;
            if (typeof window.hideEmbankmentPanel === 'function') window.hideEmbankmentPanel();
            if (typeof window.clearEmbankmentData === 'function') window.clearEmbankmentData();
            if (typeof window.collapseAllExcavationPanels === 'function') window.collapseAllExcavationPanels();
            if (typeof window.showPanel === 'function') window.showPanel();
            if (typeof window.calculateMultiOffset === 'function') {
                setTimeout(() => window.calculateMultiOffset(true), 50);
            } 
        });
    }

    const fillBtn = panel.querySelector("#mp-calc-fill-btn");
    if (fillBtn) {
        fillBtn.addEventListener("click", async (ev) => {
            ev.preventDefault();
            L.DomEvent.stopPropagation(ev);
            if (fillBtn.hasAttribute("disabled")) return;
            if (!(await window.ensureVolumeTools(this._map))) return;
            if (typeof window.hidePanel === 'function') window.hidePanel();
            if (typeof window.clearExcavationData === 'function') window.clearExcavationData();
            if (typeof window.collapseAllEmbankmentPanels === 'function') window.collapseAllEmbankmentPanels();
            if (typeof window.showEmbankmentPanel === 'function') window.showEmbankmentPanel();
            if (typeof window.calculateEmbankmentOffset === 'function') {
                setTimeout(() => {
                    const embResults = document.getElementById('emb-panel-results');
                    const embResultsHeader = document.getElementById('emb-header-results');
                    if (embResults) embResults.classList.remove('collapsed');
                    if (embResultsHeader) embResultsHeader.classList.add('active');
                    window.calculateEmbankmentOffset(false);
                }, 200); 
            }
        });
    }

    panel.querySelectorAll("[data-opt]").forEach((el) => {
      el.addEventListener("change", (ev) => {
        const opt = el.getAttribute("data-opt");
        const val = el.type === "checkbox" ? el.checked : el.value;
        this.options[opt] = val;

        this._redrawAllFeatures();

        if (opt === "showMarkers") {
          const markerOpts = panel.querySelector("#mp-marker-options");
          markerOpts.style.display = val ? "flex" : "none";
        }
      });
    });

    const sizeSlider = panel.querySelector('[data-opt="markerSize"]');
    const sizeLabel = panel.querySelector("#mp-marker-size-val");
    if (sizeSlider && sizeLabel) {
      sizeSlider.addEventListener("input", (e) => {
        sizeLabel.textContent = e.target.value;
        this.options.markerSize = parseInt(e.target.value, 10);
        this._redrawAllFeatures();
      });
    }

    panel.querySelectorAll('[data-export-format]').forEach(btn => {
      btn.addEventListener('click', (ev) => {
        L.DomEvent.stopPropagation(ev);
        const format = btn.dataset.exportFormat;
        this._exportData(format);
      });
    });

    this._map.on("click", this._onMapClick, this);
    this._map.on("mousemove", this._onMapMouseMove, this);
    this._map.on("dblclick", this._finishDrawing, this);
    this._map.on("mousedown", this._onMapMouseDown, this);
    this._map.on("mouseup", this._onMapMouseUp, this);

    this._keyHandler = (e) => {
        const targetTagName = e.target.tagName.toLowerCase();
        const isInput = targetTagName === 'input' || targetTagName === 'textarea';
        
        if (isInput && (e.key === "Backspace" || (e.ctrlKey && e.key.toLowerCase() === "z"))) {
            return;
        }
        
        if ( (e.key === "Escape" || e.key === "Enter" || e.code === "Space") && this._isDrawing ) {
            e.preventDefault();
            this._finishDrawing();
            return;
        }
        
        if ( e.key === "Backspace" || (e.ctrlKey && e.key.toLowerCase() === "z") ) {
            e.preventDefault();
            
            if (this._mode === 'deleteOBJ') {
                this._undoDelete();
            } else if (this._isDrawing && this._points && this._points.length > 0) {
                this._points.pop();
                this._redrawCurrent();
                
                this._tempVertexLayer.clearLayers();
                this._points.forEach((p, idx) => {
                    this._addVertexMarker(p, idx); 
                });
            }
        }
    };
    document.addEventListener("keydown", this._keyHandler);
  }

  _applyAreaAdjustment() {
      let targetAreaSqm = 0;
      if (this.options.units === "thai") {
          const rai = parseFloat(this._panel.querySelector("#mp-input-rai").value) || 0;
          const ngan = parseFloat(this._panel.querySelector("#mp-input-ngan").value) || 0;
          const sqwa = parseFloat(this._panel.querySelector("#mp-input-sqwa").value) || 0;
          targetAreaSqm = (rai * 1600) + (ngan * 400) + (sqwa * 4);
      } else {
          targetAreaSqm = parseFloat(this._panel.querySelector("#mp-input-sqm").value) || 0;
      }

      if (targetAreaSqm <= 0) {
          alert("กรุณาระบุพื้นที่ให้มากกว่า 0");
          return;
      }

      let poly = null;
      if (window.lastDrawnLayer && window.lastDrawnLayer._mp_feature_id !== undefined) {
          poly = this._features.find(f => f.id === window.lastDrawnLayer._mp_feature_id && f.mode === 'polygon');
      }

      if (!poly) {
          const polys = this._features.filter(f => f.mode === 'polygon');
          if (polys.length === 0) return;
          poly = polys[polys.length - 1];
      }

      const currentAreaSqm = this._calcArea(poly.points);
      if (currentAreaSqm === 0) return;

      const scaleArea = targetAreaSqm / currentAreaSqm;
      const scaleLinear = Math.sqrt(scaleArea);

      const centroid = this._getPolygonCentroid(poly.points);
      
      const centroidProj = this._map.project(centroid, 20); 
      
      poly.points = poly.points.map(p => {
          const ptProj = this._map.project(p, 20);
          const dx = ptProj.x - centroidProj.x;
          const dy = ptProj.y - centroidProj.y;
          return this._map.unproject(L.point(centroidProj.x + dx * scaleLinear, centroidProj.y + dy * scaleLinear), 20);
      });

      this._redrawFeature(poly);
      
      window.lastDrawnLayer = poly.shapeLayer;
      this._updateExcBtnState();

      const excPanel = document.getElementById('exc-main-panel');
      const embPanel = document.getElementById('emb-main-panel');
      const hasExcBuffer = excPanel && excPanel.classList.contains('visible');
      const hasEmbBuffer = embPanel && embPanel.classList.contains('visible');
      
      if (this._panel) {
          if (hasEmbBuffer) {
              const fillBtn = this._panel.querySelector("#mp-calc-fill-btn");
              if (fillBtn && !fillBtn.hasAttribute("disabled")) fillBtn.click();
          } else if (hasExcBuffer) {
              const excBtn = this._panel.querySelector("#mp-calc-excavation-btn");
              if (excBtn && !excBtn.hasAttribute("disabled")) excBtn.click();
          }
      }

      this._panel.querySelector("#mp-adjust-area-modal").style.display = "none";
      this._panel.querySelector("#mp-input-sqm").value = "";
      this._panel.querySelector("#mp-input-rai").value = "";
      this._panel.querySelector("#mp-input-ngan").value = "";
      this._panel.querySelector("#mp-input-sqwa").value = "";

      this._exitAdjustMode();

      if (typeof window.showStatus === 'function') window.showStatus('✅ ปรับขนาดพื้นที่สำเร็จ');
  }
  
  _handleImportFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    const reader = new FileReader();
    
    reader.onload = (e) => {
        const content = e.target.result;
        if (ext === 'kml') {
            this._parseKML(content);
        } else if (ext === 'geojson' || ext === 'json') {
            this._parseGeoJSON(content);
        } else {
            alert("ระบบรองรับเฉพาะไฟล์ .geojson หรือ .kml เท่านั้นครับ");
        }
    };
    reader.readAsText(file);
  }

  _parseGeoJSON(jsonText) {
    try {
        const data = JSON.parse(jsonText);
        const features = data.features ? data.features : (data.type === 'Feature' ? [data] : []);

        const allPoints = [];

        features.forEach(f => {
            if (f.geometry) {
                const type = f.geometry.type;
                const coords = f.geometry.coordinates;

                if (type === 'Polygon') {
                    let latlngs = coords[0].map(c => L.latLng(c[1], c[0]));
                    if (latlngs.length > 1 && latlngs[0].equals(latlngs[latlngs.length - 1])) {
                        latlngs.pop();
                    }
                    this._importCoordinatesAsFeature('polygon', latlngs);
                    allPoints.push(...latlngs);
                } else if (type === 'LineString') {
                    let latlngs = coords.map(c => L.latLng(c[1], c[0]));
                    this._importCoordinatesAsFeature('line', latlngs);
                    allPoints.push(...latlngs);
                }
            }
        });
        
        if (allPoints.length > 0) {
            this._flyToAndBlink(allPoints);
        } else {
            alert("ไม่พบข้อมูลรูปเปิด (LineString) หรือรูปปิด (Polygon) ในไฟล์ที่เลือกครับ");
        }
    } catch (e) {
        alert("ไฟล์ GeoJSON มีรูปแบบไม่ถูกต้องครับ");
        console.error("GeoJSON Parse Error:", e);
    }
  }

  _parseKML(kmlText) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(kmlText, "text/xml");
    const placemarks = xmlDoc.getElementsByTagName("Placemark");

    const allPoints = [];

    for (let i = 0; i < placemarks.length; i++) {
        const pm = placemarks[i];
        
        const polygons = pm.getElementsByTagName("Polygon");
        if (polygons.length > 0) {
            const coordsText = polygons[0].getElementsByTagName("coordinates")[0]?.textContent;
            if (coordsText) {
                let latlngs = this._parseKMLCoordsString(coordsText);
                if (latlngs.length > 1 && latlngs[0].equals(latlngs[latlngs.length - 1])) {
                    latlngs.pop();
                }
                this._importCoordinatesAsFeature('polygon', latlngs);
                allPoints.push(...latlngs);
            }
        }
        
        const lines = pm.getElementsByTagName("LineString");
        if (lines.length > 0) {
            const coordsText = lines[0].getElementsByTagName("coordinates")[0]?.textContent;
            if (coordsText) {
                let latlngs = this._parseKMLCoordsString(coordsText);
                this._importCoordinatesAsFeature('line', latlngs);
                allPoints.push(...latlngs);
            }
        }
    }

    if (allPoints.length > 0) {
        this._flyToAndBlink(allPoints);
    } else {
        alert("ไม่พบข้อมูล Polygon หรือ Line ในไฟล์ KML ที่เลือกครับ");
    }
  }

  _parseKMLCoordsString(text) {
      return text.trim().split(/\s+/)
          .map(pair => {
              const [lng, lat] = pair.split(',').map(Number);
              return L.latLng(lat, lng);
          })
          .filter(ll => !isNaN(ll.lat) && !isNaN(ll.lng));
  }

  _importCoordinatesAsFeature(mode, coordsArray) {
      if (coordsArray.length < 2) return;

      const feature = {
          id: this._featureIdCounter++,
          mode: mode,
          points: coordsArray,
          shapeLayer: null,
          vertexMarkers: [],
          labelLayers: []
      };

      this._createFeatureLayers(feature);
      this._features.push(feature);
      this._redrawCurrent();
      this._updateExcBtnState();
  }

  _flyToAndBlink(coordsArray) {
      const bounds = L.latLngBounds(coordsArray);
      const targetCenter = bounds.getCenter();
      const targetZoom = this._map.getBoundsZoom(bounds) - 2;

      this._map.flyTo(targetCenter, targetZoom, { duration: 1.0 });

      if (this._blinkInterval) {
          clearInterval(this._blinkInterval);
          this._blinkInterval = null;
      }
      if (this._blinkTempLayer) {
          this._map.removeLayer(this._blinkTempLayer);
      }

      this._blinkTempLayer = L.rectangle(bounds, {
          color: '#ff0000',
          weight: 3,
          fill: false,
          dashArray: '8,6',
          className: 'mp-blink-effect'
      }).addTo(this._map);

      let blinkCount = 0;
      this._blinkInterval = setInterval(() => {
          if (blinkCount >= 5) {
              clearInterval(this._blinkInterval);
              this._blinkInterval = null;
              if (this._blinkTempLayer) {
                  this._map.removeLayer(this._blinkTempLayer);
                  this._blinkTempLayer = null;
              }
          } else {
              const isVisible = (blinkCount % 2 === 0);
              if (this._blinkTempLayer) {
                  this._blinkTempLayer.setStyle({
                      opacity: isVisible ? 1 : 0
                  });
              }
              blinkCount++;
          }
      }, 500);
  }

  _destroy() {
    this._map.doubleClickZoom.enable();
    
    if (this._blinkInterval) {
        clearInterval(this._blinkInterval);
        this._blinkInterval = null;
    }
    if (this._blinkTempLayer) {
        this._map.removeLayer(this._blinkTempLayer);
        this._blinkTempLayer = null;
    }

    document.removeEventListener("keydown", this._keyHandler);
    this._map.off("click", this._onMapClick, this);
    this._map.off("mousemove", this._onMapMouseMove, this);
    this._map.off("dblclick", this._finishDrawing, this);
    this._map.off("mousedown", this._onMapMouseDown, this);
    this._map.off("mouseup", this._onMapMouseUp, this);

    if (this._panelWrapper) this._panelWrapper.remove();
  }

  remove() {
    this._destroy();
  }
  
  getMode() {
    return this._mode;
  }

  _setMode(mode) {
    if (mode === 'line' || mode === 'polygon' || mode === 'circle' || mode === 'deleteOBJ') {
        this._map.doubleClickZoom.disable();
    } else {
        this._map.doubleClickZoom.enable();
    }

    if (this._mode === 'deleteOBJ' && mode !== 'deleteOBJ') {
        this._deletedFeatures = [];
    }

    this._exitAdjustMode(); 

    this._mode = mode;
    this._isDrawing = (mode === 'line' || mode === 'polygon' || mode === 'circle');

    const mapContainer = this._map.getContainer();
    mapContainer.classList.toggle("mp-crosshair", this._isDrawing);
    mapContainer.classList.toggle("mp-delete-cursor", mode === 'deleteOBJ');
    
    this._points = [];
    this._vertexMarkers.forEach(m => this._vertexLayer.removeLayer(m));
    this._vertexMarkers = [];
    this._tempVertexLayer.clearLayers();

    this._redrawAllFeaturesVertexOnly();
    this._updateMetrics("—");
    
    this._updateExcBtnState();
  }

  _onMapMouseDown(e) {
    const mapContainer = this._map.getContainer();
    if (this._isDrawing || this._mode === 'deleteOBJ') {
      L.DomUtil.addClass(mapContainer, 'mp-grabbing-cursor');
    }
    
    if (!this._isDrawing || this._points.length < 1) return;
    this._longPressTimeout = setTimeout(() => {
      this._longPressFired = true;
      this._finishDrawing();
    }, 1000);
  }
  
  _onMapMouseUp(e) {
    L.DomUtil.removeClass(this._map.getContainer(), 'mp-grabbing-cursor');
    clearTimeout(this._longPressTimeout);
  }

  _onMapMouseMove(e) {
    if (!this._isDrawing || this._points.length === 0) {
      this._removeTemp();
      return;
    }
    const cur = e.latlng;
    const last = this._points[this._points.length - 1];

    if (!this._tempLine) {
      this._tempLine = L.polyline([last, cur], {
        color: this.options.lineColor,
        dashArray: "6,6",
        weight: this.options.lineWeight * 0.7,
      }).addTo(this._activeDrawLayer);
    } else {
      this._tempLine.setLatLngs([last, cur]);
      if (!this._activeDrawLayer.hasLayer(this._tempLine))
        this._tempLine.addTo(this._activeDrawLayer);
    }

    if (this.options.showLabels) {
      this._tempLabel = this._updateDynamicLabel(this._tempLabel, last, cur);
    } else {
      if (this._tempLabel) {
        this._activeLabelLayer.removeLayer(this._tempLabel);
        this._tempLabel = null;
      }
    }

    if (this._mode === "polygon" && this._points.length >= 2) {
      const first = this._points[0];

      if (!this._closingLine) {
        this._closingLine = L.polyline([cur, first], {
          color: this.options.lineColor,
          dashArray: "6,6",
          weight: this.options.lineWeight * 0.7,
        }).addTo(this._activeDrawLayer);
      } else {
        this._closingLine.setLatLngs([cur, first]);
        if (!this._activeDrawLayer.hasLayer(this._closingLine))
          this._closingLine.addTo(this._activeDrawLayer);
      }

      if (this.options.showLabels) {
        this._closingLabel = this._updateDynamicLabel(
          this._closingLabel,
          cur,
          first
        );
      } else {
        if (this._closingLabel) {
          this._activeLabelLayer.removeLayer(this._closingLabel);
          this._closingLabel = null;
        }
      }

      const tempPoints = [...this._points, cur];
      const area = this._calcArea(tempPoints);
      const perim = this._calcPerimeter(tempPoints);
      this._updateMetrics(
        this._formatArea(area) +
          "<br>ระยะรอบรูป ≈ " +
          this._formatDistance(perim)
      );
    } else if (this._mode === "line") {
      const total = this._calcDistance([...this._points, cur]);
      this._updateMetrics(this._formatDistance(total));
    } else if (this._mode === "circle") {
      const center = this._points[0];
      const r = this._getDistance(center, cur);
      this._updateMetrics(this._formatArea(Math.PI * r * r));
    }
  }

  _onMapClick(e) {
    if (this._isDrawing) {
      L.DomEvent.stop(e);

      if (this._longPressFired) {
        this._longPressFired = false;
        return;
      }
      if (!this._mode) return;

      const latlng = e.latlng;
      if (this._mode === "line" || this._mode === "polygon") {
        this._addVertex(latlng);
        this._redrawCurrent();
      } else if (this._mode === "circle") {
        this._addVertex(latlng);
        if (this._points.length === 2) {
          this._redrawCurrent();
          this._finishDrawing();
        } else {
          this._redrawCurrent();
        }
      }
    }
  }

  _onFeatureClick(e) {
    L.DomEvent.stop(e);
    const layer = e.target;
    const featureId = layer._mp_feature_id;

    if (this._mode === 'deleteOBJ') {
      if (featureId !== undefined) {
        this._deleteFeatureById(featureId);
      }
    } else if (this._isAdjustingArea) {
      const feature = this._features.find(f => f.id === featureId);
      if (feature && feature.mode === 'polygon') {
        this._features.forEach(f => {
          if (f.shapeLayer && f.shapeLayer._path) {
            L.DomUtil.removeClass(f.shapeLayer._path, 'mp-shape-selected-blue');
          }
        });
        if (layer._path) L.DomUtil.addClass(layer._path, 'mp-shape-selected-blue');
        window.lastDrawnLayer = layer;
      }
    }
  }
  
  _onFeatureMouseOver(e) {
    const layer = e.target;
    if (this._mode === 'deleteOBJ') {
      if (layer && layer._path) L.DomUtil.addClass(layer._path, 'mp-shape-hover-delete');
    } else if (this._isAdjustingArea) {
      const feature = this._features.find(f => f.id === layer._mp_feature_id);
      if (feature && feature.mode === 'polygon') {
        if (layer && layer._path) L.DomUtil.addClass(layer._path, 'mp-shape-hover-blue');
      }
    }
  }

  _onFeatureMouseOut(e) {
    const layer = e.target;
    if (layer && layer._path) {
      L.DomUtil.removeClass(layer._path, 'mp-shape-hover-delete');
      L.DomUtil.removeClass(layer._path, 'mp-shape-hover-blue');
    }
  }

  _deleteFeatureById(id) {
    const featureIndex = this._features.findIndex(f => f.id === id);
    if (featureIndex > -1) {
      const [deletedFeature] = this._features.splice(featureIndex, 1);
      this._deletedFeatures.push(deletedFeature);
      this._removeFeatureLayers(deletedFeature);
      console.log(`Feature ${id} moved to temp delete.`);
      this._updateExcBtnState(); 
    }
  }

  _undoDelete() {
    if (this._deletedFeatures.length > 0) {
      const featureToRestore = this._deletedFeatures.pop();
      this._features.push(featureToRestore);
      this._redrawFeature(featureToRestore);
      console.log(`Restored feature ${featureToRestore.id}.`);
      this._updateExcBtnState(); 
    } else {
      console.log("No deletions to undo.");
    }
  }

  _updateDynamicLabel(labelInstance, p1, p2) {
    const dist = this._getDistance(p1, p2);
    const mid = this._midpoint(p1, p2);

    if (!labelInstance) {
      labelInstance = this._createFloatingLabel(mid, dist, "distance");
      this._activeLabelLayer.addLayer(labelInstance);
    } else {
      labelInstance.setLatLng(mid);
      labelInstance._mp.value = dist;
      const el = labelInstance.getElement();
      if (el)
        el.innerHTML = `<div class="mp-distance-label">${this._formatDistance(
          dist
        )}</div>`;
    }
    return labelInstance;
  }

  _removeTemp() {
    if (this._tempLine) {
      this._activeDrawLayer.removeLayer(this._tempLine);
      this._tempLine = null;
    }
    if (this._tempLabel) {
      this._activeLabelLayer.removeLayer(this._tempLabel);
      this._tempLabel = null;
    }
    if (this._closingLine) {
      this._activeDrawLayer.removeLayer(this._closingLine);
      this._closingLine = null;
    }
    if (this._closingLabel) {
      this._activeLabelLayer.removeLayer(this._closingLabel);
      this._closingLabel = null;
    }
  }

  _addVertex(latlng) {
    const idx = this._points.push(latlng) - 1;
    this._addVertexMarker(latlng, idx);
  }

  _addVertexMarker(latlng, idx, feature) {
    if (!this.options.showMarkers) return null;

    const shape = this.options.markerShape;
    const color = this.options.markerColor;
    const size = parseInt(this.options.markerSize, 10);
    const rgbaColor = this._hexToRgba(color, 0.8);
    const borderColor = this._darkenHex(color, 20);

    const htmlShape =
      shape === "square"
        ? `<div class="mp-marker-shape square" style="width:${size}px;height:${size}px;background:${rgbaColor};border-color:${borderColor};"></div>`
        : `<div class="mp-marker-shape circle" style="width:${size}px;height:${size}px;background:${rgbaColor};border-color:${borderColor};border-radius:50%;"></div>`;

    const marker = L.marker(latlng, {
      draggable: true,
      icon: L.divIcon({
        className: "mp-vertex",
        html: htmlShape,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      }),
      riseOnHover: true,
    });

    if (feature) {
      marker.addTo(this._vertexLayer);
      marker.on("drag", (ev) => {
        feature.points[idx] = ev.target.getLatLng();
        this._updateFeatureLayers(feature);
      });
      marker.on("dragend", (ev) => {
          if (feature.mode === 'polygon') {
              window.lastDrawnLayer = feature.shapeLayer;
              const excPanel = document.getElementById('exc-main-panel');
              const embPanel = document.getElementById('emb-main-panel');
              const hasExcBuffer = excPanel && excPanel.classList.contains('visible');
              const hasEmbBuffer = embPanel && embPanel.classList.contains('visible');
              if (this._panel) {
                  if (hasEmbBuffer) {
                      const fillBtn = this._panel.querySelector("#mp-calc-fill-btn");
                      if (fillBtn && !fillBtn.hasAttribute("disabled")) fillBtn.click();
                  } else if (hasExcBuffer) {
                      const excBtn = this._panel.querySelector("#mp-calc-excavation-btn");
                      if (excBtn && !excBtn.hasAttribute("disabled")) excBtn.click();
                  }
              }
          }
      });
    } else {
      marker.addTo(this._tempVertexLayer);
    }

    return marker;
  }

  _updateFeatureLayers(feature) {
    if (feature.shapeLayer) {
      if (feature.mode === 'line' || feature.mode === 'polygon') {
          feature.shapeLayer.setLatLngs(feature.points);
      } else if (feature.mode === 'circle') {
          const center = feature.points[0];
          const r_draw = center.distanceTo(feature.points[1]);
          feature.shapeLayer.setLatLng(center);
          feature.shapeLayer.setRadius(r_draw);
      }
    }

    feature.labelLayers.forEach(l => l.remove());
    feature.labelLayers = [];
    this._createFeatureLabels(feature);
  }

  _hexToRgba(hex, alpha) {
    const c = hex.replace("#", "");
    const bigint = parseInt(c, 16);
    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  
  _darkenHex(hex, percent) {
    const c = hex.replace("#", "");
    const bigint = parseInt(c, 16);
    let r = (bigint >> 16) & 255;
    let g = (bigint >> 8) & 255;
    let b = bigint & 255;

    const factor = 1 - percent / 100;
    r = Math.max(Math.floor(r * factor), 0);
    g = Math.max(Math.floor(g * factor), 0);
    b = Math.max(Math.floor(b * factor), 0);

    return `rgb(${r}, ${g}, ${b})`;
  }

  _commitCurrentDrawing() {
    if (this._mode === 'line' && this._points.length < 2) return;
    if (this._mode === 'polygon' && this._points.length < 3) return;
    if (this._mode === 'circle' && this._points.length < 2) return;
    if (!this._isDrawing) return;

    const feature = {
        id: this._featureIdCounter++,
        mode: this._mode,
        points: [...this._points],
        shapeLayer: null,
        vertexMarkers: [],
        labelLayers: []
    };

    this._createFeatureLayers(feature);
    this._features.push(feature);

    this._updateExcBtnState();

    if (this._mode === 'polygon') {
        if (typeof window.hideHint === 'function') window.hideHint();
        if (typeof window.showStatus === 'function') window.showStatus('✅ วาดสำเร็จ — กดปุ่ม "ตรวจสอบปริมาตร" เพื่อตั้งค่า');
    }

    this._points = [];
    this._vertexMarkers = [];
    this._segmentLabels = [];
    this._circleLabels = [];
    this._updateMetrics('—');
  }

  _createFeatureLayers(feature) {
      if (feature.mode === 'line') {
          feature.shapeLayer = L.polyline(feature.points, { color: this.options.lineColor, weight: this.options.lineWeight });
      } else if (feature.mode === 'polygon') {
          feature.shapeLayer = L.polygon(feature.points, { color: this.options.lineColor, fillColor: this.options.fillColor, fillOpacity: 0.15 });
      } else if (feature.mode === 'circle') {
          const center = feature.points[0];
          const r_draw = center.distanceTo(feature.points[1]);
          feature.shapeLayer = L.circle(center, { radius: r_draw, color: this.options.lineColor, fillColor: this.options.fillColor, fillOpacity: 0.15 });
      }
   
      if (feature.shapeLayer) {
          feature.shapeLayer._mp_feature_id = feature.id;
          feature.shapeLayer.on('click', this._onFeatureClick, this);
          feature.shapeLayer.on('dblclick', this._onFeatureClick, this);
          feature.shapeLayer.on('mouseover', this._onFeatureMouseOver, this);
          feature.shapeLayer.on('mouseout', this._onFeatureMouseOut, this);
          feature.shapeLayer.addTo(this._completedDrawLayer);
      }
      
      feature.points.forEach((p, idx) => {
          const marker = this._addVertexMarker(p, idx, feature);
          if (marker) {
              feature.vertexMarkers.push(marker);
          }
      });
  
      this._createFeatureLabels(feature);
  }

  _createFeatureLabels(feature) {
    if (!this.options.showLabels) return;

    feature.labelLayers.forEach(l => l.remove());
    feature.labelLayers = [];

    let summaryValue = 0;
    
    if (feature.mode === 'line') {
        const totalDist = this._calcDistance(feature.points);
        summaryValue = totalDist;
        for (let i = 1; i < feature.points.length; i++) {
            feature.labelLayers.push(this._createSegmentLabel(feature.points[i-1], feature.points[i]));
        }
    } else if (feature.mode === 'polygon') {
        const area = this._calcArea(feature.points);
        summaryValue = area;
        for (let i = 0; i < feature.points.length; i++) {
            const p1 = feature.points[i];
            const p2 = feature.points[(i + 1) % feature.points.length];
            feature.labelLayers.push(this._createSegmentLabel(p1, p2));
        }
    } else if (feature.mode === 'circle') {
        const center = feature.points[0];
        const r_calc = this._getDistance(center, feature.points[1]);
        const area = Math.PI * r_calc * r_calc;
        summaryValue = area;
        const radiusLine = L.polyline([center, feature.points[1]], {
            color: this.options.lineColor,
            weight: this.options.lineWeight * 0.7,
            dashArray: "5,5"
        });
        feature.labelLayers.push(radiusLine);
        feature.labelLayers.push(this._createSegmentLabel(center, feature.points[1]));
    }
    
    const summaryLabel = this._createSummaryLabel(feature.mode, summaryValue, feature.points);
    if (summaryLabel) feature.labelLayers.push(summaryLabel);

    feature.labelLayers.forEach(l => l.addTo(this._completedLabelLayer));
  }

  _createSegmentLabel(p1, p2) {
    const mid = this._midpoint(p1, p2);
    const dist = this._getDistance(p1, p2);
    return this._createFloatingLabel(mid, dist, 'distance');
  }

  _createSummaryLabel(type, value, points) {
    let displayText = "";
    let position;
    let extraClass = "";
    let offsetY = 0;
    const size = parseInt(this.options.markerSize, 10);

    if (type === "line") {
        displayText = this._formatDistance(value);
        position = points[points.length - 1];
        extraClass = "measure-summary-label-line";
    } else if (type === "polygon") {
        displayText = this._formatArea(value);
        position = this._getPolygonCentroid(points);
        extraClass = "measure-summary-label-polygon";
    } else if (type === "circle") {
        displayText = this._formatArea(value);
        position = points[0];
        extraClass = "measure-summary-label-circle";
        
        const mapContainer = this._map.getContainer();
        const tempDiv = document.createElement("div");
        tempDiv.className = `measure-summary-label ${extraClass}`;
        tempDiv.style.position = "absolute";
        tempDiv.style.visibility = "hidden";
        tempDiv.style.zIndex = "-1000";
        tempDiv.innerHTML = displayText;
        mapContainer.appendChild(tempDiv);
        const divHeight = tempDiv.getBoundingClientRect().height;
        mapContainer.removeChild(tempDiv);
        offsetY = -(divHeight + size);
    }
    
    if (!position) return null;
    
    const icon = L.divIcon({
        className: "",
        html: `<div class="measure-summary-label ${extraClass}" style="--offsetY:${offsetY}px">${displayText}</div>`,
        iconAnchor: [0, 0],  
        iconSize: null,
    });
    
    return L.marker(position, { icon, interactive: false });
  }

  _redrawFeature(feature) {
    this._removeFeatureLayers(feature);
    feature.shapeLayer = null;
    feature.vertexMarkers = [];
    feature.labelLayers = [];
    this._createFeatureLayers(feature);
  }

  _redrawAllFeatures() {
    this._features.forEach(feature => this._redrawFeature(feature));
    this._updateExcBtnState();
  }
  
  _redrawAllFeaturesVertexOnly() {
    this._features.forEach(feature => {
        feature.vertexMarkers.forEach(m => m.remove());
        feature.vertexMarkers = [];
        feature.points.forEach((p, idx) => {
            const marker = this._addVertexMarker(p, idx, feature);
            if (marker) feature.vertexMarkers.push(marker);
        });
    });
  }

  _redrawCurrent() {
    this._activeDrawLayer.clearLayers();
    this._activeLabelLayer.clearLayers();

    if (this._mode === 'line') {
        if (this._points.length > 1) {
            L.polyline(this._points, { color: this.options.lineColor, weight: this.options.lineWeight }).addTo(this._activeDrawLayer);
            const totalDist = this._calcDistance(this._points);
            this._updateMetrics(this._formatDistance(totalDist));
            if (this.options.showLabels) {
                for (let i = 1; i < this._points.length; i++) {
                    this._createSegmentLabel(this._points[i-1], this._points[i]).addTo(this._activeLabelLayer);
                }
            }
        } else {
            this._updateMetrics('—');
        }
    } else if (this._mode === 'polygon') {
        if (this._points.length >= 3) {
            L.polygon(this._points, { color: this.options.lineColor, fillColor: this.options.fillColor, fillOpacity: 0.15 }).addTo(this._activeDrawLayer);
            const area = this._calcArea(this._points);
            const perim = this._calcPerimeter(this._points);
            this._updateMetrics(this._formatArea(area) + "<br>ระยะรอบรูป ≈ " + this._formatDistance(perim));
        } else if (this._points.length === 2) {
            L.polyline(this._points, { color: this.options.lineColor, weight: this.options.lineWeight }).addTo(this._activeDrawLayer);
            this._updateMetrics(this._formatDistance(this._calcDistance(this._points)));
        } else {
            this._updateMetrics('—');
        }
        if (this.options.showLabels && this._points.length > 1) {
            for (let i = 1; i < this._points.length; i++) {
                this._createSegmentLabel(this._points[i-1], this._points[i]).addTo(this._activeLabelLayer);
            }
        }
    } else if (this._mode === 'circle') {
        if (this._points.length >= 2) {
            const center = this._points[0];
            const r_draw = center.distanceTo(this._points[1]);
            const r_calc = this._getDistance(center, this._points[1]);
            const area = Math.PI * r_calc * r_calc;
            L.circle(center, { radius: r_draw, color: this.options.lineColor, fillColor: this.options.fillColor, fillOpacity: 0.15 }).addTo(this._activeDrawLayer);
            L.polyline([center, this._points[1]], { color: this.options.lineColor, weight: this.options.lineWeight * 0.7, dashArray: "5,5" }).addTo(this._activeDrawLayer);
            this._updateMetrics(this._formatArea(area));
            if (this.options.showLabels) {
                this._createSegmentLabel(center, this._points[1]).addTo(this._activeLabelLayer);
            }
        } else {
            this._updateMetrics('—');
        }
    }
    
    if (this._tempLine) this._activeDrawLayer.addLayer(this._tempLine);
    if (this._tempLabel && this.options.showLabels) this._activeLabelLayer.addLayer(this._tempLabel);
    if (this._closingLine) this._activeDrawLayer.addLayer(this._closingLine);
    if (this._closingLabel && this.options.showLabels) this._activeLabelLayer.addLayer(this._closingLabel);
  }

  _finishDrawing(e) {
    if (e) {
        L.DomEvent.stop(e);
    }
    
    if (!this._isDrawing) return;

    if (e && e.type === 'dblclick' && this._points.length > 0) {
        this._points.pop();
    }

    this._tempVertexLayer.clearLayers();
    this._vertexMarkers = [];
    
    this._commitCurrentDrawing();
    
    this._removeTemp();
    this._redrawCurrent();
  }

  _createFloatingLabel(latlng, numericValue, type = "distance") {
    const text =
      type === "area"
        ? this._formatArea(numericValue)
        : this._formatDistance(numericValue);
    const icon = L.divIcon({
      className: "mp-label",
      html: `<div class="mp-distance-label">${text}</div>`,
      iconSize: null,
    });
    const m = L.marker(latlng, { icon: icon, interactive: false });
    m._mp = { type, value: numericValue };
    return m;
  }

  _midpoint(a, b) {
    return L.latLng((a.lat + b.lat) / 2, (a.lng + b.lng) / 2);
  }

  _getDistance(p1, p2) {
    if (this.options.calcMethod === 'geodesic' && typeof turf !== 'undefined') {
        try {
            return turf.distance([p1.lng, p1.lat], [p2.lng, p2.lat], { units: 'meters' });
        } catch(e) {
            return p1.distanceTo(p2); 
        }
    } else {
        if (this._map && this._map.options.crs) {
            const pt1 = this._map.options.crs.project(p1);
            const pt2 = this._map.options.crs.project(p2);
            return pt1.distanceTo(pt2); 
        }
        return p1.distanceTo(p2); 
    }
  }

  _calcDistance(points) {
    if (!points || points.length < 2) return 0;
    let d = 0;
    for (let i = 1; i < points.length; i++)
      d += this._getDistance(points[i - 1], points[i]);
    return d;
  }

  _calcPerimeter(points) {
    if (!points || points.length < 2) return 0;
    let p = this._calcDistance(points);
    if (points.length >= 3)
      p += this._getDistance(points[points.length - 1], points[0]);
    return p;
  }

  _calcArea(latlngs) {
    if (this.options.calcMethod === 'geodesic' && typeof turf !== 'undefined') {
      try {
        const coords = latlngs.map(p => [p.lng, p.lat]);
        if (coords.length > 0) {
          const first = coords[0];
          const last = coords[coords.length - 1];
          if (first[0] !== last[0] || first[1] !== last[1]) {
            coords.push([first[0], first[1]]);
          }
        }
        if (coords.length >= 4) {
          const polygon = turf.polygon([coords]);
          return turf.area(polygon);
        }
        return 0;
      } catch (err) {
        console.warn("Turf.js geodesic calculation failed, fallback to planar", err);
      }
    }

    return MeasurePlusCalc.ringArea(latlngs);
  }

  _formatDistance(m) {
    return MeasurePlusCalc.defaultFormatDistance(m, this.options.units);
  }
  _formatArea(a) {
    return MeasurePlusCalc.defaultFormatArea(a, this.options.units);
  }

  _updateMetrics(val) {
    const el = this._panel.querySelector(".mp-metrics-value");
    if (el) el.innerHTML = val;
  }
  
  _removeFeatureLayers(feature) {
      if (feature.shapeLayer) feature.shapeLayer.remove();
      feature.vertexMarkers.forEach(m => m.remove());
      feature.labelLayers.forEach(l => l.remove());
  }

  _clearAll() {
    this._features.forEach(feature => this._removeFeatureLayers(feature));
    this._features = [];
    this._deletedFeatures = [];

    [
      this._completedDrawLayer,
      this._activeDrawLayer,
      this._vertexLayer,
      this._tempVertexLayer,
      this._completedLabelLayer,
      this._activeLabelLayer
    ].forEach((l) => l.clearLayers());

    this._points = [];
    this._vertexMarkers = [];
    this._removeTemp();
    this._segmentLabels = [];
    this._circleLabels = [];
    this._updateMetrics("—");
    
    this._updateExcBtnState();

    if (typeof window.clearExcavationData === 'function') {
        window.clearExcavationData();
    }
    if (typeof window.clearEmbankmentData === 'function') {
        window.clearEmbankmentData();
    }
  
    window.lastDrawnLayer = null;
  }

  _getPolygonCentroid(latlngs) {
    if (!latlngs || latlngs.length === 0) return null;

    let area = 0,
      x = 0,
      y = 0;
    for (let i = 0, j = latlngs.length - 1; i < latlngs.length; j = i++) {
      const xi = latlngs[i].lng,
        yi = latlngs[i].lat;
      const xj = latlngs[j].lng,
        yj = latlngs[j].lat;
      const f = xi * yj - xj * yi;
      area += f;
      x += (xi + xj) * f;
      y += (yi + yj) * f;
    }
    area *= 0.5;
    if (area === 0) return latlngs[0];

    x /= 6 * area;
    y /= 6 * area;
    return L.latLng(y, x);
  }

  _exportData(format) {
    if (this._features.length === 0) {
      alert("ยังไม่มีข้อมูลที่วาดไว้สำหรับ Export");
      return;
    }

    let content;
    let fileName;
    let mimeType;

    if (format === 'geojson') {
      content = this._exportToGeoJSON();
      fileName = `measure-plus-export-${Date.now()}.geojson`;
      mimeType = 'application/geo+json';
    } else if (format === 'kml') {
      content = this._exportToKML();
      fileName = `measure-plus-export-${Date.now()}.kml`;
      mimeType = 'application/vnd.google-earth.kml+xml';
    } else {
      console.error("Unknown export format:", format);
      return;
    }

    this._triggerDownload(content, fileName, mimeType);
  }

  _exportToGeoJSON() {
    const geojson = {
      type: "FeatureCollection",
      features: []
    };

    this._features.forEach(feature => {
      let geometry = null;
      let properties = { id: feature.id, mode: feature.mode };

      const coords = feature.points.map(p => [p.lng, p.lat]);

      if (feature.mode === 'line') {
        geometry = { type: 'LineString', coordinates: coords };
      } else if (feature.mode === 'polygon') {
        const closedCoords = [...coords, coords[0]];
        geometry = { type: 'Polygon', coordinates: [closedCoords] };
      } else if (feature.mode === 'circle') {
        geometry = { type: 'Point', coordinates: coords[0] };
        properties.radius_meters = this._getDistance(feature.points[0], feature.points[1]);
      }
      
      if (geometry) {
        geojson.features.push({
          type: "Feature",
          properties,
          geometry
        });
      }
    });

    return JSON.stringify(geojson, null, 2);
  }
  
  _exportToKML() {
      let kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
`;
      this._features.forEach((feature, index) => {
          const name = `${feature.mode.charAt(0).toUpperCase() + feature.mode.slice(1)} ${index + 1}`;
          const coords = feature.points.map(p => `${p.lng},${p.lat},0`).join(' ');

          kml += `    <Placemark>\n`;
          kml += `      <name>${name}</name>\n`;

          if (feature.mode === 'line') {
              kml += `      <LineString>\n`;
              kml += `        <coordinates>${coords}</coordinates>\n`;
              kml += `      </LineString>\n`;
          } else if (feature.mode === 'polygon') {
              const firstCoord = `${feature.points[0].lng},${feature.points[0].lat},0`;
              const closedCoords = `${coords} ${firstCoord}`;
              kml += `      <Polygon>\n`;
              kml += `        <outerBoundaryIs>\n`;
              kml += `          <LinearRing>\n`;
              kml += `            <coordinates>${closedCoords}</coordinates>\n`;
              kml += `          </LinearRing>\n`;
              kml += `        </outerBoundaryIs>\n`;
              kml += `      </Polygon>\n`;
          } else if (feature.mode === 'circle') {
              const centerCoord = `${feature.points[0].lng},${feature.points[0].lat},0`;
              kml += `      <Point>\n`;
              kml += `        <coordinates>${centerCoord}</coordinates>\n`;
              kml += `      </Point>\n`;
          }
          kml += `    </Placemark>\n`;
      });

      kml += `  </Document>\n</kml>`;
      return kml;
  }
  
  _triggerDownload(content, fileName, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

const MeasurePlusCalc = {
  formatNumber(value, minDecimals = 2, maxDecimals = 2) {
    return value.toLocaleString(undefined, {
      minimumFractionDigits: minDecimals,
      maximumFractionDigits: maxDecimals,
    });
  },

  defaultFormatDistance(m, unit) {
    if (unit === "thai") {
      if (m >= 1000) return this.formatNumber(m / 1000) + " กม.";
      return this.formatNumber(m) + " ม.";
    } else {
      if (m >= 1000) return this.formatNumber(m / 1000) + " km";
      return this.formatNumber(m) + " m";
    }
  },

  defaultFormatArea(a, unit) {
    let areaText;
    if (unit === "thai") {
      const rai = Math.floor(a / 1600);
      const ngan = Math.floor((a - rai * 1600) / 400);
      const wa = (a - rai * 1600 - ngan * 400) / 4;
      areaText = `${this.formatNumber(rai, 0, 0)} ไร่ ${this.formatNumber(
        ngan,
        0,
        0
      )} งาน ${this.formatNumber(wa, 1, 1)} ตร.วา`;
    } else {
      if (a >= 1000000) areaText = this.formatNumber(a / 1000000) + " km²";
      else areaText = this.formatNumber(a, 1, 1) + " m²";
    }

    return areaText;
  },

  ringArea(latlngs) {
    if (latlngs.length < 3) return 0;

    const avgLat = latlngs.reduce((sum, p) => sum + p.lat, 0) / latlngs.length;
    const cosLat = Math.cos(avgLat * Math.PI / 180);

    const mPerDegLat = 111319.9;           
    const mPerDegLng = 111319.9 * cosLat;  

    let area = 0;
    for (let i = 0; i < latlngs.length; i++) {
      const p1 = latlngs[i];
      const p2 = latlngs[(i + 1) % latlngs.length];

      const x1 = p1.lng * mPerDegLng,  y1 = p1.lat * mPerDegLat;
      const x2 = p2.lng * mPerDegLng,  y2 = p2.lat * mPerDegLat;

      area += x1 * y2 - x2 * y1;
    }
    return Math.abs(area / 2);
  }
};


// ── โหลดเครื่องมือคำนวณปริมาตร (บ่อขุด mpex.js / ดินถม mpem.js) เมื่อใช้งานครั้งแรก ──
// สองไฟล์รวม ~80 KB ไม่จำเป็นต้องโหลดตอนเปิดแอป
// เดิมโหลด mpex.js / mpem.js ตอนกดใช้ครั้งแรก — ตอนนี้โหลดมาพร้อมกัน จึงเรียก init ครั้งเดียว
window.ensureVolumeTools = function (leafletMap) {
  if (window._volumeToolsReady) return Promise.resolve(true);
  const targetMap = leafletMap || BPNP.tools.lcompat.map();
  const keepDrawn = window.lastDrawnLayer;
  try {
    if (typeof window.initExcavate === 'function')   window.initExcavate(targetMap);
    if (typeof window.initEmbankment === 'function') window.initEmbankment(targetMap);
    window.lastDrawnLayer = keepDrawn;
    window._volumeToolsReady = true;
    return Promise.resolve(true);
  } catch (err) {
    console.error('เตรียมเครื่องมือคำนวณปริมาตรไม่สำเร็จ:', err);
    if (typeof showAlert === 'function') showAlert('ไม่สามารถโหลดเครื่องมือคำนวณปริมาตรได้ กรุณาลองใหม่');
    return Promise.resolve(false);
  }
};

window.MeasurePlus = MeasurePlus;
window.MeasurePlusCalc = MeasurePlusCalc;
})(BPNP.tools.lcompat.L);
