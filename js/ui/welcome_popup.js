/* js/ui/welcome_popup.js
 * หน้าต่างต้อนรับ (ปิดเองใน 2.7 วินาที) แสดงเลขเวอร์ชันจาก version.json + build */

let welcomeCloseTimer = null; 

window.showWelcomePopup = function() {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const platformText = isMobile ? "Application" : "Website";

    createPopupUI(platformText, formatVersionText(getReleaseInfo()));

    // ถ้า version.json ยังโหลดไม่เสร็จ แสดงค่าที่จำไว้ก่อน แล้วอัปเดตเมื่อได้ค่าล่าสุด
    if (window.DataCache && DataCache.versionInfo) {
        DataCache.versionInfo.then(() => {
            const el = document.getElementById('welcomeVersionText');
            if (el) el.textContent = 'Version: ' + formatVersionText(getReleaseInfo());
        });
    }
};

// เลขที่ผู้ใช้เห็น = "version" ใน version.json / build = APP_VERSION (สร้างอัตโนมัติตอน deploy)
function getReleaseInfo() {
    return (window.DataCache && DataCache.releaseInfo) || null;
}

function formatVersionText(info) {
    const release = (info && info.version) ? info.version : '--';
    const build   = window.APP_VERSION || '';
    const buildLabel = build.indexOf('dev-') === 0 ? 'dev' : build;
    return buildLabel ? `${release} (build ${buildLabel})` : release;
}

function createPopupUI(platformText, version) {
    const oldOverlay = document.getElementById('welcomeOverlay');
    if (oldOverlay) oldOverlay.remove();

    const popupHTML = `
        <div class="welcome-content" id="welcomeContentBox">
            <button class="welcome-close-btn" id="btnWelcomeClose">&times;</button>
            <div class="welcome-title">ขอต้อนรับเข้าสู่ ${platformText}</div>
            
            <div class="welcome-subtitle">สำหรับงาน${BPNP.escapeHtml(BPNP.config.appSubtitle.replace(/^โครงการ/, "โครงการฯ "))}</div>
            <div class="welcome-update-msg" id="welcomeUpdateMsg">
                <i class="fas fa-sync fa-spin"></i> รอสักครู่ ! กำลังอัปเดทข้อมูล ...
            </div>

            <div class="welcome-dev-label">พัฒนาระบบและข้อมูลโดย</div>
            <div class="welcome-dev-name">นายไพโรจน์ หุ่ยปาน</div>
            <div class="welcome-dev-name">นายเนติพงษ์ สุวรรณรงค์</div>
            <div class="welcome-footer">สงวนสิทธิ์ใช้สำหรับในโครงการฯเท่านั้น</div>
            <div class="welcome-version" id="welcomeVersionText">Version: ${version}</div>
        </div>
    `;

    const overlay = document.createElement('div');
    overlay.className = 'welcome-overlay';
    overlay.id = 'welcomeOverlay';
    overlay.style.zIndex = "10002"; 
    
    overlay.innerHTML = popupHTML;
    document.body.appendChild(overlay);

    window.closeWelcomePopup = function() {
        const el = document.getElementById('welcomeOverlay');
        if (el && !el.classList.contains('fade-out')) {
            el.classList.add('fade-out');
            setTimeout(() => { if(el.parentNode) el.parentNode.removeChild(el); }, 500);
        }
    }

    const closeBtn = document.getElementById('btnWelcomeClose');
    if (closeBtn) closeBtn.addEventListener('click', window.closeWelcomePopup);

    welcomeCloseTimer = setTimeout(() => {
        const contentBox = document.getElementById('welcomeContentBox');
        if (contentBox && !contentBox.classList.contains('is-updating')) {
            window.closeWelcomePopup();
        }
    }, 2700);
}

window.setWelcomeUpdatingState = function(isUpdating) {
    const contentBox = document.getElementById('welcomeContentBox');
    if (!contentBox) return;

    if (isUpdating) {
        contentBox.classList.add('is-updating');
        if (welcomeCloseTimer) clearTimeout(welcomeCloseTimer);
        
    } else {
        setTimeout(() => {
            window.closeWelcomePopup();
        }, 500);
    }
};
