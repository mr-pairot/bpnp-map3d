/* js/ui/ui_manager.js
 * ─────────────────────────────────────────────────────────────────────────
 * โครง DOM ของหน้าแอป + ปุ่มมาตรฐาน + เมนูมุมล่าง (มีอะไรใหม่ / รีเซ็ตระบบ) + ข้อกำหนดการใช้งาน
 *
 *   BPNP.ui.buildMapDOM()              สร้าง #map และส่วนประกอบหน้าจอ
 *   BPNP.ui.createStandardButton(cfg)  ปุ่มสี่เหลี่ยมบนแผนที่ { id, imageSrc, html, style, title, onClick }
 *   BPNP.ui.registerButton(fn)         โมดูลลงทะเบียนฟังก์ชันสร้างปุ่ม → เรียกพร้อมกันใน initAllUI()
 *   BPNP.ui.initAllUI()
 *   BPNP.ui.checkTermsOfUse()
 *   BPNP.ui.showAlert(message, icon)
 *   BPNP.ui.resetApp()
 * ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  const TERMS_KEY = 'terms_accepted_v1';
  const buttonInits = [];

  function buildMapDOM() {
    if (document.getElementById('map')) return;
    const mapDiv = document.createElement('div');
    mapDiv.id = 'map';
    document.body.appendChild(mapDiv);
    document.body.insertAdjacentHTML('beforeend', `

  <div id="watermark-overlay" style="position: absolute; top: 0; left: 0; width: 100%; height: 100vh; pointer-events: none; z-index: 900; opacity: 0.0;">
      <svg width="100%" height="100%">
        <defs>
          <pattern id="wm-pattern" x="0" y="0" width="400" height="400" patternUnits="userSpaceOnUse">
            <image href="assets/ui/watermark.png" width="30" height="30" x="187.5" y="187.5"></image>
          </pattern>
        </defs>
        <rect x="0" y="0" width="100%" height="100%" fill="url(#wm-pattern)"></rect>
      </svg>
    </div>
    
  <div id="user-panel-wrapper" class="user-panel" style="display: none;">
      <div class="avatar-circle" id="avatar-trigger" tabindex="-1">
        <img id="user-avatar" src="" alt="avatar">
      </div>
      <div class="dropdown">
        <div id="user-display-name" class="d-name">Guest</div>
        <div class="d-status-line">
          <div class="d-dot" id="user-status-dot"></div>
          <span class="d-status" id="user-status-text">Status: Guest</span>
        </div>
        <div class="d-divider" style="display: none;"></div>
        <button class="d-action" id="user-action-btn" style="display: none;">
          <svg id="user-action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"></svg>
          <span id="user-action-label">Login</span>
        </button>
      </div>
    </div>

    <div id="spinner-overlay" class="spinner-overlay" style="display:none;">
       <div class="loading-content">
        <div class="mini-spinner"></div>
        <div class="loading-text-container">
          <p class="loading-text-overlay">กำลังโหลดข้อมูล...</p>
          <p id="loading-layer-name" class="loading-sub-text"></p>
        </div>
      </div>
    </div>

    <div id="terms-modal" class="terms-modal-overlay" style="display: none;">
      <div class="terms-modal-content">
        <h3>ข้อกำหนดและเงื่อนไขการใช้งาน</h3>
        <div class="terms-body">
          <ul>
            <li><strong>วัตถุประสงค์ข้อมูล:</strong> 
    			ข้อมูลในระบบนี้จัดทำขึ้นเพื่อใช้ภายในโครงการรถไฟทางคู่ ช่วงบ้านไผ่–มหาสารคาม–ร้อยเอ็ด (สัญญาที่ 1) เท่านั้น ไม่สามารถนำไปใช้อ้างอิงทางกฎหมาย หรือนำไปใช้ภายนอกโครงการโดยไม่ได้รับอนุญาต</li>
            <li><strong>ข้อจำกัดการใช้งาน:</strong> 
    			ห้ามใช้ระบบในลักษณะที่ผิดกฎหมาย รบกวนการทำงานของระบบ หรือใช้เครื่องมืออัตโนมัติใดๆ เพื่อคัดลอกข้อมูล</li>
            <li><strong>ทรัพย์สินทางปัญญา:</strong> 
    			ข้อมูล แผนที่ กราฟิก และซอฟต์แวร์ทั้งหมดในระบบนี้เป็นทรัพย์สินทางปัญญาของผู้พัฒนา ห้ามทำซ้ำ ดัดแปลง หรือเผยแพร่โดยไม่ได้รับอนุญาต</li>
            <li><strong>ความรับผิดชอบ:</strong> 
    			ผู้พัฒนาไม่รับผิดชอบต่อความเสียหายใด ๆ ที่เกิดจากการใช้งานระบบ ข้อมูลในระบบ หรือการเชื่อมโยงไปยังเว็บไซต์ภายนอก</li>
            <li><strong>สิทธิ์ในการระงับ:</strong> 
    			ผู้พัฒนาขอสงวนสิทธิ์ในการระงับหรือยกเลิกการใช้งานทันที หากพบว่าผู้ใช้ละเมิดข้อกำหนด โดยไม่จำเป็นต้องแจ้งให้ทราบล่วงหน้า</li>
          </ul>
        </div>
        <button id="accept-terms-btn" class="terms-btn">ยอมรับและเข้าใช้งาน</button>
      </div>
    </div>

    <div class="custom-button" id="stopRippleBtn" onclick="BPNP.tools.clickPoint && BPNP.tools.clickPoint.stop()" style="display: none;">
      📡 หยุดแสดงพิกัด (หรือกด Space/Esc)
    </div>

    <div class="dev-attribution" >
        <span class="attr-label">&copy; Mr.Pairot@gmail.com [2025-05]</span>
    </div>   
	<div class="custom-attribution" onclick="toggleAttributionMenu(event)" title="คลิกเพื่อดูข้อมูลการพัฒนา หรือรีเซ็ตระบบ">
	    <span class="attr-label">มีอะไรใหม่ & รีเซ็ตระบบ</span>
	    <div class="attr-avatar-wrap">
	        <img class="attr-avatar" src="assets/icons/map-icon.svg" alt="History" />
	    </div>
	    
	    <div id="attribution-dropdown" class="attr-dropdown-menu">
	        <div class="attr-dropdown-item" onclick="handleAboutClick(event)" title="">
	            <span class="attr-icon">ℹ️</span> มีอะไรใหม่ & ข้อมูลระบบ
	        </div>
	        <div class="attr-dropdown-item attr-danger" onclick="handleResetClick(event)" title="">
	            <span class="attr-icon">🔄</span> รีเซ็ตระบบ / ล็อกอินใหม่
	        </div>
	    </div>
	</div>
    <div id="debug-info" class="debug-info"></div>
    <div id="notification" class="notification"></div>
   
   <div class="layer-panel" id="layerPanel">
		  <div class="layer-panel-header">
			<div class="layer-panel-title">รายการชั้นข้อมูล</div>
			<button class="close-btn" id="closePanelBtn">&times;</button>
		  </div>
		  
		  <div class="layer-content">
			<div class="layer-section">
			  <div class="layer-header" onclick="toggleLayerSection('baseLayersList', this)">
				<span>แผนที่พื้นหลัง (Base Maps)</span>
				<i class="fas fa-chevron-down toggle-icon"></i>
			  </div>
			  <div id="baseLayersList" class="layer-list collapsed"></div>
			</div>
			
			<div class="layer-section">
			  <div class="layer-header" onclick="toggleLayerSection('overlayLayersList', this)">
				<span>ชั้นข้อมูลทั่วไป</span>
				<i class="fas fa-chevron-down toggle-icon"></i>
			  </div>
			  <div id="overlayLayersList" class="layer-list collapsed"></div>
			</div>
			
			<div class="layer-section">
			  <div class="layer-header" onclick="toggleLayerSection('structureLayersList', this)">
				<span>ชั้นข้อมูลงานโครงสร้าง</span>
				<i class="fas fa-chevron-down toggle-icon"></i>
			  </div>
			  <div id="structureLayersList" class="layer-list collapsed"></div>
			</div>

			<div class="layer-section">
              <div class="layer-header" onclick="toggleLayerSection('sw_tw_LayersList', this)">
                <span>ชั้นข้อมูลงาน Signalling and Track</span>
                <i class="fas fa-chevron-down toggle-icon"></i>
              </div>
              <div id="sw_tw_LayersList" class="layer-list collapsed"></div>
            </div>
			
		  </div>
    </div>
`);
  }

  function createStandardButton(config) {
    const btn = document.createElement('button');
    if (config.id) btn.id = config.id;
    btn.type = 'button';
    btn.className = 'standard-map-btn';
    if (config.title) { btn.title = config.title; btn.setAttribute('aria-label', config.title); }
    if (config.style) Object.assign(btn.style, config.style);
    if (config.imageSrc) btn.style.backgroundImage = `url('${config.imageSrc}')`;
    if (config.html) btn.innerHTML = config.html;
    if (config.onClick) {
      btn.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); config.onClick(e); });
    }
    // ไม่ให้การแตะปุ่มส่งต่อไปที่แผนที่ (กดค้างดูพิกัด / ลากแผนที่)
    ['mousedown', 'touchstart', 'dblclick'].forEach(ev =>
      btn.addEventListener(ev, e => e.stopPropagation(), { passive: true }));
    // กดค้าง/คลิกขวาที่ปุ่ม: ไม่ให้เมนูของระบบเด้งขึ้น
    btn.addEventListener('contextmenu', e => { e.preventDefault(); e.stopPropagation(); });
    document.body.appendChild(btn);
    return btn;
  }

  function registerButton(fn) { buttonInits.push(fn); }

  // ── คอลัมน์ซ้าย (ใต้ปุ่มชั้นข้อมูล): เรียงส่วนควบคุมที่แสดงอยู่ต่อกันลงมา ไม่ให้ทับกัน ──
  //   แถว 0 = ปุ่มค้นหา กม. (เฟส 5) · แถว 1 = ปุ่มชั้นข้อมูล · แถว 2+ = รายการที่ลงทะเบียน (ตาม order)
  const leftItems = [];
  function leftColumnAdd(el, order, apply) {
    leftItems.push({ el, order, apply: apply || (top => { el.style.top = top; }) });
    leftItems.sort((a, b) => a.order - b.order);
    leftColumnRefresh();
  }
  function leftColumnRefresh() {
    let row = 2;
    leftItems.forEach(it => {
      if (!it.el.isConnected || it.el.style.display === 'none') return;
      it.apply(`calc(var(--safe-top) + (var(--map-btn-size) + var(--map-gap)) * ${row})`);
      row++;
    });
  }

  function initAllUI() {
    buttonInits.forEach(fn => { try { fn(); } catch (err) { console.error('[UI] สร้างปุ่มไม่สำเร็จ:', err); } });
  }

  async function resetApp() {
      const confirmBox = document.createElement('div');
      confirmBox.id = 'custom-confirm-modal';
      confirmBox.style.cssText = `
          position: fixed; top: 0; left: 0; width: 100%; height: 100%;
          background: rgba(13, 43, 69, 0.7); backdrop-filter: blur(6px);
          -webkit-backdrop-filter: blur(6px);
          display: flex; justify-content: center; align-items: center;
          z-index: 99999; font-family: system-ui, -apple-system, sans-serif; 
          opacity: 0; transition: opacity 0.25s ease;
      `;
    
      confirmBox.innerHTML = `
          <div style="background: #ffffff; padding: 28px; border-radius: 20px; width: 85%; max-width: 350px; box-shadow: 0 15px 35px rgba(0,0,0,0.3); text-align: center; transform: scale(0.9); transition: transform 0.25s ease;" id="confirm-card">
              <div style="font-size: 44px; margin-bottom: 12px;">🔄</div>
              <h3 style="margin: 0 0 10px 0; color: #0d2b45; font-size: 18px; font-weight: bold;">ยืนยันการรีเซ็ตระบบ?</h3>
              <p style="margin: 0 0 24px 0; color: #555555; font-size: 14px; line-height: 1.6;">ระบบจะล้างข้อมูลการตั้งค่าแผนที่ <br>และออกจากระบบ LINE เดิม<br> เพื่อเริ่มเข้าใช้งานด้วยบัญชีใหม่ได้ทันที </p>
              <div style="display: flex; gap: 12px; justify-content: center;">
                  <button id="confirm-cancel-btn" style="flex: 1; padding: 12px; border-radius: 10px; border: 1px solid #dddddd; background: #ffffff; color: #333333; cursor: pointer; font-size: 14px; font-weight: 600;">ยกเลิก</button>
                  <button id="confirm-ok-btn" style="flex: 1; padding: 12px; border-radius: 10px; border: none; background: #e74c3c; color: #ffffff; cursor: pointer; font-size: 14px; font-weight: 600; box-shadow: 0 4px 12px rgba(231,76,60,0.2);">ยืนยันรีเซ็ต</button>
              </div>
          </div>
      `;
    
      document.body.appendChild(confirmBox);
      setTimeout(() => {
          confirmBox.style.opacity = '1';
          document.getElementById('confirm-card').style.transform = 'scale(1)';
      }, 20);
    
      return new Promise((resolve) => {
          document.getElementById('confirm-cancel-btn').onclick = () => {
              confirmBox.style.opacity = '0';
              document.getElementById('confirm-card').style.transform = 'scale(0.9)';
              setTimeout(() => { confirmBox.remove(); }, 250);
              resolve(false);
          };
        
          document.getElementById('confirm-ok-btn').onclick = async () => {
              const card = document.getElementById('confirm-card');
              card.innerHTML = `
                  <div style="padding: 20px 0;">
                      <div class="reset-spinner"></div>
                      <p style="margin: 15px 0 0 0; color: #0d2b45; font-size: 15px; font-weight: 600;">กำลังเคลียร์หน่วยความจำระบบ...</p>
                  </div>
                  <style>
                      .reset-spinner {
                          border: 4px solid #f3f3f3;
                          border-top: 4px solid #0d2b45;
                          border-radius: 50%; width: 45px; height: 45px;
                          animation: spinReset 1s linear infinite; margin: 0 auto;
                      }
                      @keyframes spinReset { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
                  </style>
              `;
            
              // LINE SDK โหลดแบบ lazy → ต้องโหลดก่อนจึงจะ logout ได้จริง
              if (BPNP.auth) await BPNP.auth.liffLogoutSafe();
            
              // แจ้ง GAS ให้เพิกถอน session ของเครื่องนี้ แล้วล้างทุกคีย์ของแอป (prefix จาก config)
              const token = BPNP.auth && BPNP.auth.getToken();
              if (token) BPNP.auth.api('logout', { sessionToken: token }, { keepalive: true, timeoutMs: 3000 }).catch(() => {});
              BPNP.storage.clearAll();

              if ('caches' in window) {
                  try {
                      const allCaches = await caches.keys();
                      await Promise.all(allCaches.map(cacheName => caches.delete(cacheName)));
                      console.log("📌 Cache Storage ถูกทำลายเรียบร้อยแล้ว");
                  } catch (cacheErr) {
                      console.error("เกิดข้อผิดพลาดระหว่างล้าง Cache Storage:", cacheErr);
                  }
              }
              setTimeout(() => {
                  window.location.reload(true);
                  resolve(true);
              }, 1000);
          };
      });
  }

  function closeAttrMenu() {
    const menu = document.getElementById('attribution-dropdown');
    if (menu) menu.classList.remove('show');
  }

  function toggleAttributionMenu(event) {
    event.stopPropagation();
    const menu = document.getElementById('attribution-dropdown');
    if (menu) menu.classList.toggle('show');
  }

  function handleAboutClick(event) {
    event.stopPropagation();
    closeAttrMenu();
    if (BPNP.ui.openAboutModal) BPNP.ui.openAboutModal();
  }

  function handleResetClick(event) {
    event.stopPropagation();
    closeAttrMenu();
    resetApp();
  }

  function checkTermsOfUse() {
    const modal = document.getElementById('terms-modal');
    const btn   = document.getElementById('accept-terms-btn');
    const next  = () => { if (typeof window.showWelcomePopup === 'function') window.showWelcomePopup(); };
    if (!modal || !btn) return next();

    if (!BPNP.storage.get(TERMS_KEY)) {
      modal.style.display = 'flex';
      btn.onclick = () => {
        BPNP.storage.set(TERMS_KEY, 'true');
        modal.style.display = 'none';
        next();
      };
    } else {
      modal.style.display = 'none';
      next();
    }
  }

  function showAlert(message, icon = 'warning') {
    const html = BPNP.escapeHtml(message).replace(/\n/g, '<br>');
    if (typeof Swal === 'undefined') { alert(message); return; }
    Swal.fire({ title: 'แจ้งเตือน', html, icon, confirmButtonText: 'ตกลง' });
  }

  document.addEventListener('click', closeAttrMenu);

  // กดค้าง/คลิกขวาบนส่วนควบคุมของแอป: ไม่ให้เมนูของระบบ (บันทึกรูป/คัดลอก) เด้งขึ้น
  const NO_SYSTEM_MENU = '.maplibregl-marker, .standard-map-btn, .layer-panel, .info.legend, .bp-bottom-panel, .parcel-search-box, .custom-standalone-scale';
  document.addEventListener('contextmenu', e => {
    if (e.target.closest && e.target.closest(NO_SYSTEM_MENU)) e.preventDefault();
  });

  // บันทึกการปิดหน้าต่าง (ส่งครั้งเดียวต่อการซ่อนหน้า)
  let sessionEndSent = false;
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && !sessionEndSent) {
      if (BPNP.auth) BPNP.auth.logUserEvent('Session Ended', 'ผู้ใช้ปิดหน้าต่าง');
      sessionEndSent = true;
      setTimeout(() => { sessionEndSent = false; }, 2000);
    }
  });

  Object.assign(BPNP.ui, { buildMapDOM, createStandardButton, registerButton, initAllUI, checkTermsOfUse, showAlert, resetApp, leftColumnAdd, leftColumnRefresh });

  // ชื่อเดิม: ใช้กับ onclick ใน HTML และโมดูลที่ย้ายมาในเฟสถัดไป
  window.createStandardButton  = createStandardButton;
  window.toggleAttributionMenu = toggleAttributionMenu;
  window.handleAboutClick      = handleAboutClick;
  window.handleResetClick      = handleResetClick;
  window.showAlert             = showAlert;
  window.reset_app             = resetApp;
})();
