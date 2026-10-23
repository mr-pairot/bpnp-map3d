/* js/boot/check_update.js
 * ─────────────────────────────────────────────────────────────────────────
 * ตรวจเวอร์ชันใหม่จาก version.json ทุก 10 นาที / เมื่อกลับมาที่แอป
 * และลงทะเบียน Service Worker แบบผูกกับเวอร์ชัน (sw.js?v=APP_VERSION)
 * ───────────────────────────────────────────────────────────────────────── */
const LAST_SEEN_KEY = 'last_seen_version';

class CheckUpdateManager {
    constructor(currentVersion, versionUrl = 'version.json') {
        this.currentVersion = currentVersion; 
        this.versionUrl = versionUrl;
        this.newVersionFound = null;
        this.releaseNotes = [];
        this.checkIntervalMs = 10 * 60 * 1000;
        this.isButtonVisible = false;
        // ครั้งแรก (ผู้ใช้ใหม่ / หลังรีเซ็ตระบบ): ยังไม่จำเวอร์ชัน → รับค่าจาก version.json ใน checkForUpdate()
        // โดยไม่ reload (เดิมตั้งเป็น APP_VERSION ซึ่งไม่ตรงกับ version.json จึง reload ทันที 1 รอบ)
        this.lastSeenVersion = BPNP.storage.get(LAST_SEEN_KEY);

        this.init();
    }

    init() {
        this.createUpdateButton();
        this.checkForUpdate();
        
        setInterval(() => this.checkForUpdate(), this.checkIntervalMs);

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                this.checkForUpdate();
            }
        });

        setInterval(() => {
            if (this.newVersionFound && !this.isButtonVisible) {
                this.tryShowButton();
            }
        }, 2000);
    }

    createUpdateButton() {
        this.btn = document.createElement('div');
        this.btn.className = 'update-notify-btn';
        this.btn.title = 'แตะเพื่ออัปเดตเวอร์ชันใหม่';
        this.btn.innerHTML = `
            <svg class="update-notify-icon" viewBox="0 0 24 24">
                <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
            </svg>
            <div class="update-badge"></div>
        `;
        this.btn.addEventListener('click', () => this.performUpdate());
        if (document.body) {
            document.body.appendChild(this.btn);
        } else {
            document.addEventListener('DOMContentLoaded', () => {
                document.body.appendChild(this.btn);
            });
        }
    }

    async checkForUpdate() {
        try {
            const response = await fetch(`${this.versionUrl}?t=${Date.now()}`, {
                cache: 'no-store',
                headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache' }
            });
            if (!response.ok) return;

            const data = await response.json();
            const serverVersion = data.version;
            
            this.releaseNotes = data.changelog || [];
            console.log(`[CheckUpdate] lastSeen: ${this.lastSeenVersion} | server: ${serverVersion}`);

            if (!this.lastSeenVersion) {
                // ครั้งแรก: เพิ่งโหลดของล่าสุดอยู่แล้ว ไม่ต้องแจ้งเตือนหรือ reload
                if (serverVersion) {
                    this.lastSeenVersion = serverVersion;
                    BPNP.storage.set(LAST_SEEN_KEY, serverVersion);
                }
                return;
            }

            if (serverVersion && serverVersion !== this.lastSeenVersion) {
                console.log(`[CheckUpdate] พบเวอร์ชันใหม่! ${this.lastSeenVersion} → ${serverVersion}`);
                this.newVersionFound = serverVersion;
                const isMapDrawn = !!(BPNP.map && BPNP.map.instance);

                if (!isMapDrawn) {
                    console.log('[CheckUpdate] redirect เพื่อโหลดเวอร์ชันใหม่...');
                    BPNP.storage.set(LAST_SEEN_KEY, serverVersion);
                    const newUrl = new URL(window.location.href);
                    newUrl.searchParams.set('v', serverVersion);
                    window.location.replace(newUrl.toString());
                } else {
                    this.tryShowButton();
                }
            }
        } catch (error) {
            console.warn('[CheckUpdate] Error:', error);
        }
    }

    isUserBusy() {
        if (document.querySelector('.layer-panel.active')) return true;
        // เครื่องมือที่กำลังใช้งาน (วัด/วาด ฯลฯ) ลงทะเบียนผ่าน BPNP.tools.registerBusy()
        return !!(BPNP.tools.isBusy && BPNP.tools.isBusy());
    }

    tryShowButton() {
        if (!this.newVersionFound) return;
        if (this.isUserBusy()) return;

        if (!this.isButtonVisible) {
            this.btn.classList.add('show');
            this.isButtonVisible = true;
            if (navigator.vibrate) navigator.vibrate(200);
        }
    }

    performUpdate() {
        let notesHtml = '';
        if (this.releaseNotes && this.releaseNotes.length > 0) {
            notesHtml = `
                <div style="text-align: left; margin-top: 15px; background: #f9f9f9; padding: 10px; border-radius: 8px; border: 1px solid #eee;">
                    <strong style="color: #333; display: block; margin-bottom: 5px;">รายละเอียดการเปลี่ยนแปลง:</strong>
                    <ul style="margin: 0; padding-left: 20px; color: #555; text-align: left;">
                        ${this.releaseNotes.map(note => `<li style="margin-bottom: 4px;">${BPNP.escapeHtml(note)}</li>`).join('')}
                    </ul>
                </div>
            `;
        }

        const updateAction = () => {
            if (this.newVersionFound) {
                BPNP.storage.set(LAST_SEEN_KEY, this.newVersionFound);
            }
            if (typeof window.setWelcomeUpdatingState === 'function') {
                window.setWelcomeUpdatingState(true);
            }
            window.location.reload();
        };

        if (typeof Swal === 'undefined') {
            if (confirm(`พบเวอร์ชันใหม่ (${this.newVersionFound})\nต้องการอัปเดตทันทีหรือไม่?`)) updateAction();
            return;
        }

        Swal.fire({
            title: '🚀 พบเวอร์ชันใหม่!',
            html: `
                <div style="font-size: 1.1em; margin-bottom: 10px;">
                    เวอร์ชัน <b>${this.newVersionFound}</b> พร้อมใช้งาน
                </div>
                ${notesHtml} 
                <div style="margin-top: 15px; font-size: 0.9em; color: #888;">
                    ต้องการอัปเดตทันทีหรือไม่?
                </div>
            `,
            icon: 'info',
            showCancelButton: true,
            confirmButtonColor: '#007bff',
            cancelButtonColor: '#d33',
            confirmButtonText: 'อัปเดตทันที',
            cancelButtonText: 'ไว้ก่อน',
            reverseButtons: true,
            width: '400px',
            backdrop: `rgba(0,0,123,0.4)`,
            didOpen: () => {
                const container = Swal.getContainer();
                if (container) {
                    container.style.backdropFilter = 'blur(8px)';
                    container.style.webkitBackdropFilter = 'blur(8px)';
                }
            }
        }).then((result) => {
            if (result.isConfirmed) {
                Swal.fire({
                    title: 'กำลังอัปเดตระบบ...',
                    html: 'กรุณารอสักครู่ ระบบกำลังโหลดข้อมูลใหม่',
                    timer: 5000, 
                    timerProgressBar: true,
                    allowOutsideClick: false,
                    backdrop: `rgba(0, 0, 123, 0.4)`,
                    didOpen: () => {
                        Swal.showLoading();
                        updateAction();
                        const container = Swal.getContainer();
                        if (container) {
                            container.style.backdropFilter = 'blur(8px)';
                            container.style.webkitBackdropFilter = 'blur(8px)';
                        }
                    }
                });
            }
        });
    }
}

function initCheckUpdate() {
    const currentVer = window.APP_VERSION || 'dev';
    new CheckUpdateManager(currentVer);
    registerServiceWorker(currentVer);
}

// ลงทะเบียน Service Worker แบบผูกกับเวอร์ชัน (sw.js?v=APP_VERSION)
// เมื่อ APP_VERSION เปลี่ยน → URL ของ SW เปลี่ยน → เบราว์เซอร์ติดตั้ง SW ตัวใหม่
// และ SW ตัวใหม่จะลบเฉพาะ JS/CSS ของเวอร์ชันเก่า (ไม่ลบแคชข้อมูลเลเยอร์)
// หมายเหตุ: เลิกใช้การ unregister + ลบแคชทั้งหมดทุกครั้งที่เปิดแอป
//          (เดิมทำให้ต้อง reload ซ้ำ 1 รอบ และต้องโหลดข้อมูลใหม่ทั้งหมดทุกครั้ง)
function registerServiceWorker(version) {
    if (!('serviceWorker' in navigator)) return;
    const register = () => {
        navigator.serviceWorker
            .register('sw.js?v=' + encodeURIComponent(version))
            .then(reg => console.log('[SW] ลงทะเบียนแล้ว:', version, reg.scope))
            .catch(err => console.warn('[SW] ลงทะเบียนไม่สำเร็จ:', err));
    };
    // รอให้หน้าโหลดเสร็จก่อน เพื่อไม่แย่งแบนด์วิดท์ช่วงเปิดแอป
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCheckUpdate);
} else {
    initCheckUpdate();
}
