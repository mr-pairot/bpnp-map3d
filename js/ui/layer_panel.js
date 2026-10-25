/* js/ui/layer_panel.js
 * ─────────────────────────────────────────────────────────────────────────
 * แผงรายการชั้นข้อมูล (แทน CustomLayerControl ใน main.js เดิม)
 * ใช้ DOM #layerPanel จาก ui_manager.js และ CSS เดิม (css/ui/layer_panel.css)
 *
 *   - แผนที่พื้นหลัง: BPNP.map.basemaps
 *   - ชั้นข้อมูล: BPNP.layers.CONFIG + BPNP.map.registry
 *   - เลเยอร์ที่ยังไม่ถึงเฟส (phase > supportedPhase) แสดงเป็นรายการปิดใช้งาน
 *   - บันทึกการตั้งค่า: BPNP.storage 'map_settings'
 * ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  const SETTINGS_KEY = 'map_settings';
  const SETTINGS_VERSION = '3.0';
  const LISTS = { general: 'overlayLayersList', structure: 'structureLayersList', progress: 'sw_tw_LayersList' };
  const esc = BPNP.escapeHtml;

  let panel;

  // ปุ่ม "Pier" ของ Footing VBxx → เลเยอร์ป้าย pierNameVBxx
  const pierLayerOf = id => id.replace('layoutFooting', 'pierName');
  // ปุ่ม "ป้าย" (ป้ายความสูง) → กลุ่มใน height_signs.js
  const HS_GROUP = { layer_underpass: 'underpass', layer_bridge: 'bridge' };
  const hsAvailable = c => !!(c.hasHeightSignToggle && BPNP.layers.heightSigns && BPNP.layers.heightSigns.has(HS_GROUP[c.id]));

  // ── settings ──
  function loadSettings() {
    const s = BPNP.storage.getJSON(SETTINGS_KEY);
    if (!s || s.version !== SETTINGS_VERSION) return null;
    return s;
  }

  function saveSettings() {
    const prev = loadSettings() || {};
    const overlays = Object.assign({}, prev.overlays);   // เก็บค่าของเลเยอร์ที่ยังไม่รองรับไว้ด้วย
    BPNP.layers.CONFIG.forEach(c => {
      // ชั้นที่ยังไม่รองรับ/โมดูลโหลดไม่สำเร็จ → คงค่าที่บันทึกไว้เดิม
      // ชั้นที่ไม่อยู่ในรายการ (เช่น หลัก กม. ทล. ที่เปิดจากปุ่มของตัวเอง) ไม่บันทึกสถานะ — เหมือนเดิม
      if (!BPNP.layers.isSupported(c) || !BPNP.map.registry.has(c.id) || c.isControlVisible === false) return;
      overlays[c.id] = {
        isActive: BPNP.map.registry.isVisible(c.id),
        opacity:  Math.round(BPNP.map.registry.getOpacity(c.id) * 100)
      };
      if (c.hasPierToggle) overlays[c.id].showPierToggle = BPNP.map.registry.isVisible(pierLayerOf(c.id));
      if (hsAvailable(c))  overlays[c.id].showHeightSign = BPNP.layers.heightSigns.isEnabled(HS_GROUP[c.id]);
    });
    const order = Array.from(document.querySelectorAll(`#${LISTS.general} .layer-item[data-layer-id]`)).map(el => el.dataset.layerId);
    BPNP.storage.setJSON(SETTINGS_KEY, {
      version: SETTINGS_VERSION,
      timestamp: Date.now(),
      baseLayer: BPNP.map.basemaps.active,
      overlays,
      generalLayerOrder: order
    });
  }

  // ── แผนที่พื้นหลัง ──
  function renderBaseLayers() {
    const box = document.getElementById('baseLayersList');
    if (!box) return;
    box.innerHTML = '';
    BPNP.map.basemaps.list.forEach((b, i) => {
      const item = document.createElement('div');
      item.className = 'layer-item' + (b.available ? '' : ' is-pending');
      const checked = b.id === BPNP.map.basemaps.active ? 'checked' : '';
      const disabled = b.available ? '' : 'disabled';
      item.innerHTML = `<input type="radio" name="baseLayer" id="base_${i}" value="${b.id}" ${checked} ${disabled}>` +
        `<label for="base_${i}">${esc(b.name)}${b.available ? '' : ' <span class="layer-phase-tag">ออฟไลน์</span>'}</label>`;
      box.appendChild(item);
    });
    box.querySelectorAll('input[type="radio"]').forEach(r => r.addEventListener('change', e => {
      if (BPNP.map.basemaps.setActive(e.target.value)) saveSettings();
    }));
  }

  // ── ชั้นข้อมูล ──
  function renderOverlays(settings) {
    Object.values(LISTS).forEach(id => { const el = document.getElementById(id); if (el) el.innerHTML = ''; });

    let configs = BPNP.layers.CONFIG.filter(c => c.isControlVisible !== false);
    const order = (settings && settings.generalLayerOrder) || [];
    if (order.length) {
      const rank = id => { const i = order.indexOf(id); return i === -1 ? 999 : i; };
      const general = configs.filter(c => c.category === 'general').sort((a, b) => rank(a.id) - rank(b.id));
      configs = general.concat(configs.filter(c => c.category !== 'general'));
    }

    configs.forEach(c => {
      const box = document.getElementById(LISTS[c.category] || LISTS.general);
      if (!box) return;
      if (c.hasSeparatorAbove) {
        const sep = document.createElement('div');
        sep.style.cssText = 'border-top:1px solid #ccc;margin:4px 0;';
        box.appendChild(sep);
      }
      const inPhase   = BPNP.layers.isSupported(c);
      const missing   = inPhase && !BPNP.map.registry.has(c.id);   // โมดูลของชั้นนี้โหลดไม่สำเร็จ
      const supported = inPhase && !missing;
      const tag = !inPhase ? `เฟส ${c.phaseLabel || c.phase}` : (missing ? 'ไม่พร้อมใช้งาน' : '');
      const item = document.createElement('div');
      item.className = 'layer-item' + (c.hasOpacityControl && supported ? ' has-slider' : '') + (supported ? '' : ' is-pending');
      item.dataset.layerId = c.id;

      let html = `<input type="checkbox" id="ov_${c.id}" value="${c.id}" ${supported ? '' : 'disabled'}>` +
                 `<label for="ov_${c.id}">${esc(c.name)}${tag ? ` <span class="layer-phase-tag">${tag}</span>` : ''}</label>`;
      if (supported && (c.hasOpacityControl || c.hasPierToggle || hsAvailable(c))) {
        // ลำดับเดิม: แถบความทึบ → ปุ่มป้าย → ปุ่ม Pier
        html += `<div style="display:flex;align-items:center;gap:6px;">`;
        if (c.hasOpacityControl) {
          html += `<div class="opacity-slider-container" style="width:55px;">` +
                  `<input type="range" min="0" max="100" value="100" class="opacity-slider" data-layer-id="${c.id}"></div>`;
        }
        if (hsAvailable(c)) {
          html += `<label class="hs-toggle-label" title="เปิด/ปิดป้ายความสูง"><input type="checkbox" class="hs-toggle-cb height-toggle-cb" data-layer-id="${c.id}"><span class="hs-toggle-btn">ป้าย</span></label>`;
        }
        if (c.hasPierToggle) {
          html += `<label class="hs-toggle-label" title="เปิด/ปิด Pier No."><input type="checkbox" class="hs-toggle-cb pier-toggle-cb" data-layer-id="${c.id}"><span class="hs-toggle-btn">Pier</span></label>`;
        }
        html += `</div>`;
      }
      item.innerHTML = html;
      box.appendChild(item);

      if (!supported) return;
      const cb = item.querySelector('input[type="checkbox"]:not(.hs-toggle-cb)');
      cb.addEventListener('change', () => toggleOverlay(c, cb.checked));

      const hsCb = item.querySelector('.height-toggle-cb');
      if (hsCb) {
        hsCb.addEventListener('change', async () => {
          if (hsCb.checked) BPNP.core.toast.show('กำลังโหลดป้ายความสูง...', true);
          const ok = await BPNP.layers.heightSigns.setEnabled(HS_GROUP[c.id], hsCb.checked);
          BPNP.core.toast.hide();
          if (!ok && hsCb.checked) { hsCb.checked = false; BPNP.ui.showAlert('โหลดป้ายความสูงไม่สำเร็จ'); }
          saveSettings();
        });
      }

      const pierCb = item.querySelector('.pier-toggle-cb');
      if (pierCb) {
        pierCb.addEventListener('change', async () => {
          const pid = pierLayerOf(c.id);
          if (pierCb.checked) BPNP.core.toast.show('กำลังโหลด Pier No....', true);
          await BPNP.map.registry.setVisible(pid, pierCb.checked);
          BPNP.core.toast.hide();
          saveSettings();
        });
      }

      const slider = item.querySelector('.opacity-slider');
      if (slider) {
        slider.addEventListener('input', () => { syncSliderTrack(slider); BPNP.map.registry.setOpacity(c.id, slider.value / 100); });
        slider.addEventListener('change', saveSettings);
        syncSliderTrack(slider);
      }
      if (c.category === 'general') enableReorder(item, box);
    });
  }

  async function toggleOverlay(c, visible) {
    if (!BPNP.map.registry.has(c.id)) { console.warn('[LayerPanel] ยังไม่มีเลเยอร์ในระบบ:', c.id); return; }
    if (visible) BPNP.core.toast.show(`กำลังโหลด ${c.nameLoaded || c.name}...`, true);
    const ok = await BPNP.map.registry.setVisible(c.id, visible);
    if (visible) {
      BPNP.core.toast.hide();
      if (!ok) {
        const err = BPNP.map.registry.lastError(c.id);
        const msg = err ? String(err.message || err) : '';
        const noData = /HTTP 404/.test(msg) && /\/data\/geojson\//.test(msg);
        BPNP.ui.showAlert(noData
          ? `โหลด ${c.name} ไม่สำเร็จ\nไม่พบไฟล์ข้อมูลบนเซิร์ฟเวอร์ (ขั้นตอนแปลงข้อมูลตอน deploy อาจไม่ได้ทำงาน)\nกรุณาแจ้งผู้ดูแลระบบ`
          : `โหลด ${c.name} ไม่สำเร็จ${msg ? '\n(' + msg + ')' : ''}`);
        if (BPNP.auth) BPNP.auth.logUserEvent('App Warning', `เลเยอร์ ${c.id}: ${msg || 'unknown'} | v${window.APP_VERSION}`);
        const cb = document.getElementById('ov_' + c.id);
        if (cb) cb.checked = false;
      } else {
        applyGeneralOrder();
      }
    }
    updateSectionCounts();
    saveSettings();
  }

  function syncSliderTrack(slider) {
    const min = parseFloat(slider.min) || 0, max = parseFloat(slider.max) || 100;
    slider.style.setProperty('--slider-pct', (((parseFloat(slider.value) - min) / (max - min)) * 100).toFixed(2) + '%');
  }

  function updateSectionCounts() {
    Object.values(LISTS).forEach(listId => {
      const list = document.getElementById(listId);
      if (!list) return;
      const count = list.querySelectorAll('input[type="checkbox"]:not(.hs-toggle-cb):checked').length;
      const title = list.closest('.layer-section')?.querySelector('.layer-header span:first-child');
      if (!title) return;
      let badge = title.querySelector('.layer-count-badge');
      if (count > 0) {
        if (!badge) { badge = document.createElement('span'); badge.className = 'layer-count-badge'; title.appendChild(badge); }
        badge.textContent = count;
      } else if (badge) badge.remove();
    });
  }

  // ── ลากเรียงลำดับชั้นข้อมูลทั่วไป (Pointer Events: เมาส์ / นิ้ว / ปากกา) ──
  //   - ที่จับ ⋮ หน้าแต่ละแถว: ลากได้ทันทีทุกอุปกรณ์ (touch-action: none → เบราว์เซอร์ไม่แย่งไปเลื่อนหน้า)
  //   - เมาส์: กดที่แถวแล้วลากเกิน 5 px
  //   - นิ้ว/ปากกา: กดค้างที่แถว 0.45 วินาทีแล้วลาก (ขยับก่อนครบเวลา = เลื่อนรายการตามปกติ)
  //   - ไม่ใช้ HTML5 drag-and-drop (draggable) เพราะบน Android การกดค้างจะเริ่ม drag ของระบบแทนและยกเลิกการลากของเรา
  //   - ลากเสร็จ: ไม่เปิด/ปิดชั้นนั้น (กัน click ที่ตามมา) · กดที่แถบความทึบ/ปุ่มป้าย/Pier ไม่เริ่มลาก
  const HOLD_MS = 450, MOVE_CANCEL_PX = 8, MOUSE_START_PX = 5;
  let suppressClickUntil = 0;

  function placeAt(box, dragging, clientY) {
    const after = Array.from(box.querySelectorAll('.layer-item.reorderable:not(.dragging)')).reduce((closest, child) => {
      const r = child.getBoundingClientRect();
      const offset = clientY - r.top - r.height / 2;
      return (offset < 0 && offset > closest.offset) ? { offset, el: child } : closest;
    }, { offset: Number.NEGATIVE_INFINITY }).el;
    if (after) { if (after !== dragging.nextSibling) box.insertBefore(dragging, after); }
    else if (box.lastElementChild !== dragging) box.appendChild(dragging);
  }

  function enableReorder(item, box) {
    item.classList.add('reorderable');
    const grip = document.createElement('span');
    grip.className = 'layer-grip';
    grip.title = 'ลากเพื่อเรียงลำดับการทับซ้อน';
    grip.setAttribute('aria-hidden', 'true');
    grip.textContent = '⋮';
    item.prepend(grip);

    let st = null;   // { id, type, x, y, timer, dragging }
    const scroller = () => item.closest('.layer-content') || box;

    function start() {
      if (!st || st.dragging) return;
      clearTimeout(st.timer);
      st.dragging = true;
      suppressClickUntil = Date.now() + 100000;          // กันการติ๊กจนกว่าจะปล่อย
      item.classList.add('dragging', 'touch-dragging');
      try { item.setPointerCapture(st.id); } catch (e) { /* บางเบราว์เซอร์ไม่รองรับ */ }
      if (st.type !== 'mouse' && navigator.vibrate) { try { navigator.vibrate(25); } catch (e) {} }
    }

    function end(commit) {
      if (!st) return;
      clearTimeout(st.timer);
      const was = st.dragging, id = st.id;
      st = null;
      unlisten();
      if (!was) return;
      try { item.releasePointerCapture(id); } catch (e) {}
      item.classList.remove('dragging', 'touch-dragging');
      suppressClickUntil = Date.now() + 500;             // click ที่ตามมาหลังปล่อยไม่นับ
      if (commit) { applyGeneralOrder(); saveSettings(); }
    }

    // ติดตาม pointer ทั้งหน้า ตั้งแต่กดจนปล่อย (แถวสูงไม่กี่ px — เมาส์/นิ้วหลุดออกจากแถวเร็วมาก)
    function onMove(e) {
      if (!st || e.pointerId !== st.id) return;
      if (!st.dragging) {
        const d = Math.hypot(e.clientX - st.x, e.clientY - st.y);
        if (st.type === 'mouse') { if (d > MOUSE_START_PX) start(); else return; }
        else { if (d > MOVE_CANCEL_PX) { clearTimeout(st.timer); st = null; unlisten(); } return; }
      }
      e.preventDefault();
      placeAt(box, item, e.clientY);
      const sc = scroller(), r = sc.getBoundingClientRect();
      if (e.clientY < r.top + 30) sc.scrollTop -= 12;
      else if (e.clientY > r.bottom - 30) sc.scrollTop += 12;
    }
    function onUp(e) { if (st && e.pointerId === st.id) end(true); }
    function listen() {
      document.addEventListener('pointermove', onMove, { passive: false });
      document.addEventListener('pointerup', onUp);
      document.addEventListener('pointercancel', onUp);
    }
    function unlisten() {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onUp);
    }

    item.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (e.target.closest('.opacity-slider-container, .hs-toggle-label')) return;
      const viaGrip = !!e.target.closest('.layer-grip');
      if (!viaGrip && e.pointerType === 'mouse' && e.target.closest('input')) return;   // คลิกเช็กบ็อกซ์ด้วยเมาส์ = ติ๊กตามปกติ
      if (st) end(false);
      st = { id: e.pointerId, type: e.pointerType, x: e.clientX, y: e.clientY, timer: null, dragging: false };
      listen();
      if (viaGrip) { e.preventDefault(); start(); }
      else if (e.pointerType !== 'mouse') st.timer = setTimeout(start, HOLD_MS);
    });

    // นิ้ว: กันหน้าเลื่อนระหว่างลาก (Pointer Events ยกเลิกการเลื่อนเองไม่ได้)
    item.addEventListener('touchmove', e => { if (st && st.dragging) e.preventDefault(); }, { passive: false });
    // ไม่ให้เบราว์เซอร์เริ่ม drag-and-drop ของระบบ (เช่น ลากข้อความ/รูป)
    item.addEventListener('dragstart', e => e.preventDefault());
    // กันการติ๊ก/ยกเลิกชั้นจากการลาก
    item.addEventListener('click', e => {
      if (Date.now() < suppressClickUntil) { e.preventDefault(); e.stopPropagation(); }
    }, true);
  }

  // ลำดับการทับซ้อน = ลำดับในรายการ (บนสุดของรายการ = วาดบนสุด) เหมือน _updateGeneralZIndex เดิม
  //   - ชั้นที่ไม่แสดงในรายการ (isControlVisible: false) อยู่ใต้ชั้นในรายการทั้งหมด
  //   - ใช้กับทุกหมวด (ทั่วไป / โครงสร้าง / Signalling) แต่ละหมวดเรียงภายในกลุ่มของตัวเอง
  // ข้อจำกัด: หมุด HTML (รายชื่อสถานี) อยู่เหนือแผนที่เสมอ ไม่ร่วมการเรียงนี้
  function applyGeneralOrder() {
    const R = BPNP.map.registry;
    Object.keys(LISTS).forEach(cat => {
      const hidden = BPNP.layers.CONFIG.filter(c => c.category === cat && c.isControlVisible === false).map(c => c.id);
      const listed = Array.from(document.querySelectorAll(`#${LISTS[cat]} .layer-item[data-layer-id]`)).map(el => el.dataset.layerId);
      R.order(hidden.concat(listed.slice().reverse()).filter(id => R.has(id)));
    });
  }

  // ── เปิด/ปิดแผง ──
  function togglePanel(e) {
    if (e) e.preventDefault();
    panel.classList.toggle('active');
  }

  function bindPanel() {
    panel = document.getElementById('layerPanel');
    const closeBtn = document.getElementById('closePanelBtn');
    if (closeBtn) closeBtn.addEventListener('click', () => panel.classList.remove('active'));
    document.addEventListener('click', e => {
      const btn = document.getElementById('layerControlBtn');
      if (panel.classList.contains('active') && !panel.contains(e.target) && !(btn && btn.contains(e.target))) {
        panel.classList.remove('active');
      }
    });
    // ไม่ให้การเลื่อน/แตะในแผงส่งต่อไปที่แผนที่
    ['mousedown', 'touchstart', 'wheel', 'dblclick'].forEach(ev =>
      panel.addEventListener(ev, e => e.stopPropagation(), { passive: true }));
    // กดค้าง/คลิกขวาในแผง: ไม่ให้เมนูของระบบเด้งขึ้น
    panel.addEventListener('contextmenu', e => { e.preventDefault(); e.stopPropagation(); });
  }

  // ── เปิดเลเยอร์ตามที่บันทึกไว้ (ทยอยทีละชั้น ไม่ให้ค้างตอนเปิดแอป) ──
  function restoreOverlays(settings) {
    const queue = [];
    BPNP.layers.CONFIG.forEach(c => {
      if (!BPNP.layers.isSupported(c) || !BPNP.map.registry.has(c.id) || c.isControlVisible === false) return;
      const s = settings && settings.overlays && settings.overlays[c.id];
      const active = s ? !!s.isActive : !!c.isDefault;
      const opacity = s && typeof s.opacity === 'number' ? s.opacity : 100;
      const slider = document.querySelector(`.opacity-slider[data-layer-id="${c.id}"]`);
      if (slider) { slider.value = opacity; syncSliderTrack(slider); }
      BPNP.map.registry.setOpacity(c.id, opacity / 100);
      if (active) queue.push(c);
      if (hsAvailable(c) && s && s.showHeightSign) {
        const hsCb = document.querySelector(`.height-toggle-cb[data-layer-id="${c.id}"]`);
        if (hsCb) hsCb.checked = true;
        BPNP.layers.heightSigns.setEnabled(HS_GROUP[c.id], true);
      }
      if (c.hasPierToggle && s && s.showPierToggle) {
        const pierCb = document.querySelector(`.pier-toggle-cb[data-layer-id="${c.id}"]`);
        if (pierCb) pierCb.checked = true;
        BPNP.map.registry.setVisible(pierLayerOf(c.id), true);
      }
    });
    queue.forEach((c, i) => setTimeout(() => {
      const cb = document.getElementById('ov_' + c.id);
      if (cb) cb.checked = true;
      BPNP.map.registry.setVisible(c.id, true).then(() => { applyGeneralOrder(); updateSectionCounts(); });
    }, 100 + i * 250));
    updateSectionCounts();
  }

  function init() {
    const settings = loadSettings();
    bindPanel();
    renderBaseLayers();
    renderOverlays(settings);
    restoreOverlays(settings);

    BPNP.ui.registerButton(() => {
      BPNP.ui.createStandardButton({
        id: 'layerControlBtn',
        imageSrc: 'assets/ui/layers.svg',
        style: { top: 'calc(var(--safe-top) + var(--map-btn-size) + var(--map-gap))', left: 'var(--safe-left)' },
        title: 'แสดงชั้นข้อมูล',
        onClick: togglePanel
      });
    });
  }

  function toggleLayerSection(listId, header) {
    const list = document.getElementById(listId);
    if (!list) return;
    const collapsed = list.classList.toggle('collapsed');
    header.classList.toggle('active', !collapsed);
  }

  BPNP.ui.layerPanel = { init, saveSettings, loadSettings, togglePanel, updateSectionCounts };
  window.toggleLayerSection = toggleLayerSection;   // onclick ใน HTML
})();
