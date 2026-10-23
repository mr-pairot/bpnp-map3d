/* js/boot/auth.js
 * ─────────────────────────────────────────────────────────────────────────
 * ยืนยันตัวตนด้วย LINE LIFF + session token ที่ GAS ออกให้
 *
 * ลำดับ
 *   1) มี session token ในเครื่อง
 *        strictMode = true  → check_session (รอผล) → ผ่าน: เข้าแอป
 *        strictMode = false → เข้าแอปทันที + check_session เบื้องหลัง
 *        ออฟไลน์ + มีข้อมูลผู้ใช้เดิม → เข้าแอปได้ (โหมดออฟไลน์)
 *   2) ไม่มี token / token ใช้ไม่ได้ → LIFF → ส่ง ID Token ไป action "login"
 *        GAS ตรวจกับ LINE แล้วออก session token ใหม่
 *
 * DeviceID ใช้เพื่อสถิติเท่านั้น ไม่ใช้ยืนยันตัวตน
 * ส่ง request เป็น text/plain เพื่อเลี่ยง CORS preflight (GAS ไม่รองรับ)
 * ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  const CFG = BPNP.config;
  const S   = BPNP.storage;
  const esc = BPNP.escapeHtml;

  const KEY = { session: 'session', user: 'user', device: 'device_id', relogin: 'relogin_once' };
  const EXPECTED_API_VERSION = 1;
  const API_TIMEOUT_MS = 15000;

  const GUEST_IMAGE = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='32' fill='%23d1d5db'/%3E%3Ccircle cx='32' cy='24' r='12' fill='%23fff' opacity='.75'/%3E%3Cellipse cx='32' cy='54' rx='18' ry='11' fill='%23fff' opacity='.55'/%3E%3C/svg%3E`;
  const ICON_LOGOUT = `<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>`;
  const ICON_LOGIN  = `<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/>`;
  const PAGE_BG = 'linear-gradient(160deg, #0d2b45 0%, #1a5276 60%, #148f77 100%)';

  // ── ทำ URL ให้สั้น: ลบพารามิเตอร์ที่ใช้งานเสร็จแล้ว (ห้ามลบของ LINE ก่อน liff.init() เสร็จ) ──
  const LINE_URL_PARAMS = ['code', 'state', 'liffClientId', 'liffRedirectUri', 'liff.state', 'error', 'error_description'];
  const PAGE_URL_PARAMS = ['v'];

  function cleanUrlParams(keys) {
    try {
      const url = new URL(location.href);
      let changed = false;
      keys.forEach(k => { if (url.searchParams.has(k)) { url.searchParams.delete(k); changed = true; } });
      if (!changed) return;
      const q = url.searchParams.toString();
      history.replaceState(history.state, '', url.pathname + (q ? '?' + q : '') + url.hash);
    } catch (e) { /* คง URL เดิม */ }
  }

  // ── LIFF SDK: โหลดเฉพาะเมื่อจำเป็น ──
  const LIFF_SDK_URL = 'https://static.line-scdn.net/liff/edge/2/sdk.js';
  let liffReady = null;

  function ensureLiff() {
    if (liffReady) return liffReady;
    liffReady = new Promise((resolve, reject) => {
      if (typeof liff !== 'undefined') return resolve();
      const s = document.createElement('script');
      s.src = LIFF_SDK_URL;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('โหลด LINE SDK ไม่สำเร็จ'));
      document.head.appendChild(s);
    })
      .then(() => liff.init({ liffId: CFG.liffId }))
      .then(() => cleanUrlParams(LINE_URL_PARAMS))
      .catch(err => { liffReady = null; throw err; });
    return liffReady;
  }

  async function liffLogoutSafe() {
    try {
      await ensureLiff();
      if (liff.isLoggedIn()) liff.logout();
    } catch (err) { console.warn('LIFF logout skipped:', err.message); }
  }

  // ── ข้อมูลเครื่อง ──
  function getDeviceId() {
    let id = S.get(KEY.device) || S.getCookie(KEY.device);
    if (!id) {
      id = (crypto.randomUUID ? crypto.randomUUID() : 'dev-' + Date.now() + '-' + Math.random().toString(36).slice(2));
    }
    S.set(KEY.device, id);
    S.setCookie(KEY.device, id);
    return id;
  }

  function getDeviceInfo() {
    const ua = navigator.userAgent;
    const os = /iPhone|iPad|iPod/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : 'PC';
    const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
    const inLine = /Line\//i.test(ua);
    return `${os}-${inLine ? 'LINE' : standalone ? 'PWA' : 'Browser'}`;
  }

  // ── session ในเครื่อง ──
  function getToken() { return S.get(KEY.session) || S.getCookie(KEY.session); }

  function saveSession(token, user) {
    if (token) { S.set(KEY.session, token); S.setCookie(KEY.session, token); }
    if (user)  S.setJSON(KEY.user, user);
  }

  function clearSession() {
    S.remove(KEY.session); S.removeCookie(KEY.session);
    S.remove(KEY.user);
  }

  // ── เรียก GAS ──
  async function api(action, payload = {}, opts = {}) {
    const ctrl  = ('AbortController' in window) ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), opts.timeoutMs || API_TIMEOUT_MS) : null;
    let res;
    try {
      res = await fetch(CFG.gasUrl, {
        method:    'POST',
        redirect:  'follow',
        headers:   { 'Content-Type': 'text/plain;charset=utf-8' },
        body:      JSON.stringify(Object.assign({ action }, payload)),
        keepalive: !!opts.keepalive,
        signal:    ctrl ? ctrl.signal : undefined
      });
    } catch (err) {
      const e = new Error('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้'); e.network = true; throw e;
    } finally {
      if (timer) clearTimeout(timer);
    }
    let json;
    try { json = await res.json(); } catch (err) { throw new Error('เซิร์ฟเวอร์ตอบกลับไม่ถูกต้อง'); }
    if (json && json.apiVersion && json.apiVersion !== EXPECTED_API_VERSION) {
      console.warn(`[Auth] apiVersion ของ GAS (${json.apiVersion}) ไม่ตรงกับหน้าเว็บ (${EXPECTED_API_VERSION}) — ตรวจว่า deploy GAS เวอร์ชันล่าสุดแล้ว`);
    }
    return json || {};
  }

  // ── ผู้ใช้ปัจจุบัน ──
  window.currentUser = { isLoggedIn: false, displayName: 'Guest', pictureUrl: GUEST_IMAGE, status: 'Viewer', role: 'viewer' };

  function setUser(user, extra = {}) {
    window.currentUser = Object.assign({
      isLoggedIn:  true,
      userId:      user.userId || '',
      displayName: user.displayName || 'User',
      pictureUrl:  user.pictureUrl  || GUEST_IMAGE,
      status:      user.status      || 'approved',
      role:        user.role        || 'viewer'
    }, extra);
    BPNP.events.emit('auth:user', window.currentUser);
  }

  // ── redirect ที่ GAS สั่ง (เฉพาะโดเมนที่อนุญาต) ──
  function followServerRedirect(result) {
    if (!result || !result.redirect) return false;
    let target;
    try { target = new URL(result.redirect); } catch (e) { return false; }
    const allowed = (CFG.auth && CFG.auth.redirectHosts) || [];
    if (target.protocol !== 'https:' || allowed.indexOf(target.hostname) === -1) {
      console.warn('ไม่อนุญาตให้ redirect ไปยัง:', target.hostname);
      return false;
    }
    clearSession();
    updateLoadingText(esc(result.reason || 'บัญชีนี้ไม่มีสิทธิ์ใช้งานเว็บนี้ กำลังไปยังเว็บหลัก...'));
    setTimeout(() => location.replace(target.href), 1500);
    return true;
  }

  // ── จัดการผลจาก login / check_session ──
  function handleAuthResult(r, currentToken) {
    if (followServerRedirect(r)) return;

    switch (r.code) {
      case 'OK':
        sessionStorage.removeItem(S.key(KEY.relogin));
        saveSession(r.sessionToken || currentToken, r.user);
        setUser(r.user);
        enterApp();
        return;

      case 'PENDING':
        saveSession(r.sessionToken || currentToken, r.user);
        showPendingPage(r);
        return;

      case 'SESSION_EXPIRED':
      case 'SESSION_INVALID':
        clearSession();
        initializeLIFF();
        return;

      case 'TOKEN_INVALID':
        // ID Token หมดอายุ → ล็อกอิน LINE ใหม่ 1 ครั้ง (กันวนด้วย sessionStorage)
        if (!sessionStorage.getItem(S.key(KEY.relogin))) {
          sessionStorage.setItem(S.key(KEY.relogin), '1');
          liff.logout();
          liff.login();
          return;
        }
        sessionStorage.removeItem(S.key(KEY.relogin));
        showErrorPage(r.reason || 'ยืนยันตัวตนกับ LINE ไม่สำเร็จ', true);
        return;

      case 'BLOCKED':
      case 'NOT_ALLOWED':
        clearSession();
        showErrorPage(r.reason || 'ไม่ได้รับสิทธิ์เข้าใช้งาน', false);
        return;

      default:
        showErrorPage(r.reason || 'ตรวจสอบสิทธิ์ไม่สำเร็จ', true);
    }
  }

  // ── เริ่มทำงาน ──
  async function start() {
    if (BPNP.boot.isMaintenance) return;

    const hosts = (CFG.auth && CFG.auth.devBypassHosts) || [];
    if (hosts.indexOf(location.hostname) !== -1) {
      console.warn('[Auth] โหมดพัฒนา (localhost): ข้ามการล็อกอิน');
      setUser({ userId: 'dev', displayName: 'Developer', status: 'approved', role: 'admin' }, { isDev: true });
      enterApp();
      return;
    }

    const token      = getToken();
    const cachedUser = S.getJSON(KEY.user);

    if (!token) { initializeLIFF(); return; }

    if (!CFG.auth.strictMode && cachedUser) {
      setUser(cachedUser);
      enterApp();
      verifyInBackground(token);
      return;
    }

    updateLoadingText('กำลังตรวจสอบสิทธิ์ ...');
    let r;
    try {
      r = await api('check_session', { sessionToken: token, deviceId: getDeviceId(), deviceInfo: getDeviceInfo() });
    } catch (err) {
      if (err.network && cachedUser) {
        console.warn('[Auth] ออฟไลน์: ใช้ข้อมูลผู้ใช้เดิมในเครื่อง');
        setUser(cachedUser, { offline: true });
        enterApp();
        return;
      }
      showErrorPage(err.message || 'ตรวจสอบสิทธิ์ล้มเหลว', true);
      return;
    }
    handleAuthResult(r, token);
  }

  async function verifyInBackground(token) {
    try {
      const r = await api('check_session', { sessionToken: token, deviceId: getDeviceId(), deviceInfo: getDeviceInfo() });
      if (followServerRedirect(r)) return;
      if (r.code === 'OK') {
        saveSession(null, r.user);
        setUser(r.user);
        updateUserPanelUI();
        return;
      }
      console.warn('[Auth] session ใช้ไม่ได้แล้ว (' + r.code + ') — ล้างข้อมูลแล้วโหลดใหม่');
      clearSession();
      location.reload();
    } catch (err) {
      console.warn('[Auth] ตรวจเบื้องหลังไม่สำเร็จ (อาจออฟไลน์) — ใช้ session เดิมต่อ');
    }
  }

  async function initializeLIFF() {
    updateLoadingText('กำลังเชื่อมต่อ LINE...');
    try {
      await ensureLiff();
      if (!liff.isLoggedIn()) showLandingPage();
      else await loginWithLine();
    } catch (err) {
      console.error(err);
      showErrorPage('ไม่สามารถเชื่อมต่อ LINE ได้', true);
    }
  }

  async function loginWithLine() {
    updateLoadingText('กำลังตรวจสอบสิทธิ์ ...');
    const idToken = (typeof liff.getIDToken === 'function') ? liff.getIDToken() : null;
    if (!idToken) {
      showErrorPage('ไม่พบ ID Token (ตรวจว่า LIFF เปิด scope "openid")', false);
      return;
    }
    try {
      const r = await api('login', { idToken, deviceId: getDeviceId(), deviceInfo: getDeviceInfo() });
      handleAuthResult(r, null);
    } catch (err) {
      showErrorPage(err.message || 'ตรวจสอบสิทธิ์ล้มเหลว', true);
    }
  }

  async function logout() {
    const token = getToken();
    if (token) api('logout', { sessionToken: token }, { keepalive: true, timeoutMs: 3000 }).catch(() => {});
    await liffLogoutSafe();
    clearSession();
    location.reload();
  }

  async function login() {
    try {
      await ensureLiff();
      if (!liff.isLoggedIn()) liff.login();
      else await loginWithLine();
    } catch (err) { alert('ไม่สามารถเชื่อมต่อระบบ LINE ได้ในขณะนี้'); }
  }

  // ── บันทึกเหตุการณ์ (userId หาจาก session ที่ฝั่ง GAS) ──
  function logUserEvent(eventName, details = '') {
    const token = getToken();
    if (!token || window.currentUser.isDev) return;
    api('track_event', { sessionToken: token, eventName, eventDetails: String(details) }, { keepalive: true, timeoutMs: 5000 })
      .catch(() => {});
  }

  // ── เข้าแอป ──
  let entered = false;
  function enterApp() {
    if (entered) return;
    entered = true;
    cleanUrlParams(PAGE_URL_PARAMS.concat(LINE_URL_PARAMS));
    const name = window.currentUser.displayName;
    updateLoadingText(`<b>ยินดีต้อนรับคุณ ${esc(name)}</b>`);

    setTimeout(() => {
      Promise.all([
        BPNP.loader.script('js/ui/ui_manager.js'),
        BPNP.loader.script('js/ui/welcome_popup.js'),
        BPNP.loader.script('js/core/data_cache.js')
      ])
        .then(() => {
          BPNP.ui.buildMapDOM();
          updateUserPanelUI();
          return loadMainScripts(name);
        })
        .catch(err => { console.error(err); showErrorPage('เกิดข้อผิดพลาดในการโหลดแผนที่', true); });
    }, 300);
  }

  async function loadMainScripts(name) {
    const status = t => `<b>ยินดีต้อนรับคุณ ${esc(name)}</b><br><span style="font-size:0.8em;color:#A0AEC0;line-height:1.4;display:inline-block;">${t}</span>`;
    updateLoadingText(status('ขณะนี้กำลังเตรียมส่วนแสดงผล...'));

    try {
      await BPNP.loader.script('js/boot/app_manifest.js');
      BPNP.boot.APP_SCRIPTS.forEach(BPNP.loader.preload);
      await Promise.all(BPNP.boot.APP_CSS.map(h => BPNP.loader.css(h).catch(err => console.warn(err.message))));
      await BPNP.loader.waitForGlobal('maplibregl');
      await Promise.all(BPNP.boot.APP_SCRIPTS.map(src => BPNP.loader.script(src)));

      updateLoadingText(status('กำลังเปิดแผนที่...'));
      await BPNP.app.start();
      hideSplash();
      BPNP.ui.initAllUI();
      if (window.currentUser.offline && BPNP.core.toast) BPNP.core.toast.show('โหมดออฟไลน์: ใช้ข้อมูลที่เก็บไว้ในเครื่อง', false, 4000);

      setTimeout(() => {
        if (typeof BPNP.ui.checkTermsOfUse === 'function') BPNP.ui.checkTermsOfUse();
        else if (typeof window.showWelcomePopup === 'function') window.showWelcomePopup();
      }, 600);
      logUserEvent('Open App', getDeviceInfo());
    } catch (err) {
      console.error(err);
      showErrorPage('เกิดข้อผิดพลาดในการโหลดระบบแผนที่ กรุณารีเฟรชหน้า', true);
    }
  }

  // ── แผงผู้ใช้ ──
  function updateUserPanelUI() {
    const wrapper = document.getElementById('user-panel-wrapper');
    if (!wrapper) return;
    const u = window.currentUser;
    const $ = id => document.getElementById(id);

    wrapper.style.display = (CFG.ui && CFG.ui.showUserPanel) ? '' : 'none';
    wrapper.classList.toggle('logged-out', !u.isLoggedIn);
    if ($('user-avatar'))       $('user-avatar').src = u.isLoggedIn ? u.pictureUrl : GUEST_IMAGE;
    if ($('user-display-name')) $('user-display-name').textContent = u.isLoggedIn ? u.displayName : 'Guest';
    if ($('user-status-text'))  $('user-status-text').textContent  = `Status: ${u.isLoggedIn ? u.status : 'Viewer'}${u.offline ? ' (ออฟไลน์)' : ''}`;
    if ($('user-action-label')) $('user-action-label').textContent = u.isLoggedIn ? 'Logout' : 'Login';
    if ($('user-action-icon'))  $('user-action-icon').innerHTML    = u.isLoggedIn ? ICON_LOGOUT : ICON_LOGIN;

    const btn = $('user-action-btn');
    if (btn) {
      btn.style.display = '';
      btn.onclick = () => (u.isLoggedIn ? logout() : login());
    }
  }

  // ── หน้าจอสถานะ ──
  function pageShell(id, inner) {
    ['landing-page', 'exit-page', 'error-page', 'pending-page'].forEach(x => { const el = document.getElementById(x); if (el) el.remove(); });
    document.body.insertAdjacentHTML('beforeend', `
      <div id="${id}" class="bg-aurora" style="position:fixed;inset:0;background:${PAGE_BG};display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:9999;font-family:'Sarabun',sans-serif;color:white;text-align:center;padding:24px;box-sizing:border-box;">
        ${inner}
      </div>`);
  }

  const BTN = "border:none;border-radius:12px;padding:12px 32px;font-size:15px;font-family:'Sarabun',sans-serif;cursor:pointer;width:240px;margin-top:12px;";
  const CLOSE_JS = "(typeof liff !== 'undefined' && liff.closeWindow) ? liff.closeWindow() : window.close()";

  function showLandingPage() {
    hideSplash();
    pageShell('landing-page', `
      <img src="assets/icons/map-icon.svg" alt="BPNP Map" style="width:90px;height:90px;filter:drop-shadow(0 4px 8px rgba(0,0,0,0.3));margin-bottom:20px;" />
      <h1 style="margin:0 0 6px;font-size:28px;font-weight:bold;letter-spacing:1px;">${esc(CFG.appName)}</h1>
      <p style="margin:0 0 8px;font-size:16px;opacity:0.85;">${esc(CFG.appSubtitle)}</p>
      <p style="margin:16px;font-size:12px;opacity:0.6;">กรุณาเข้าสู่ระบบเพื่อใช้งานแผนที่</p>
      <button onclick="liff.login()" style="${BTN}background:#06C755;color:white;font-weight:bold;box-shadow:0 4px 16px rgba(6,199,85,0.4);display:flex;align-items:center;justify-content:center;gap:8px;">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="white"><path d="M10 1C5 1 1 4.5 1 8.8c0 3.8 3.4 7 8 7.8v2.4c0 .2.3.4.5.2l4-3.2c3.1-1.3 5.5-4 5.5-7.2C19 4.5 15 1 10 1z"/></svg>
        เข้าสู่ระบบด้วย LINE
      </button>
      <button onclick="BPNP.auth.showExitPage()" style="${BTN}background:transparent;color:rgba(255,255,255,0.6);border:1px solid rgba(255,255,255,0.3);">ยกเลิกการใช้งาน</button>
    `);
  }

  function showExitPage() {
    pageShell('exit-page', `
      <div style="font-size:56px;margin-bottom:20px;">🗺️</div>
      <h2 style="margin:0 0 12px;">ขอบคุณที่แวะมาเยี่ยมชม</h2>
      <p style="margin:0 0 20px;opacity:0.7;font-size:14px;">คุณสามารถปิดหน้าต่างนี้ได้เลย</p>
      <button onclick="${CLOSE_JS}" style="${BTN}background:#2c3e50;color:white;">ปิดหน้าต่าง</button>
    `);
  }

  function showPendingPage(r) {
    hideSplash();
    const name = (r.user && r.user.displayName) ? esc(r.user.displayName) : '';
    pageShell('pending-page', `
      <div style="font-size:56px;margin-bottom:20px;">⏳</div>
      <h2 style="margin:0 0 12px;">รอการอนุมัติสิทธิ์</h2>
      <p style="margin:0 0 8px;opacity:0.85;font-size:15px;">${name ? 'คุณ ' + name + ' ' : ''}ลงทะเบียนเรียบร้อยแล้ว</p>
      <p style="margin:0;opacity:0.6;font-size:13px;">${esc(r.reason || 'กรุณารอผู้ดูแลระบบอนุมัติ แล้วกดตรวจสอบอีกครั้ง')}</p>
      <button onclick="location.reload()" style="${BTN}background:#06C755;color:white;margin-top:24px;">ตรวจสอบอีกครั้ง</button>
      <button onclick="BPNP.auth.logout()" style="${BTN}background:transparent;color:rgba(255,255,255,0.6);border:1px solid rgba(255,255,255,0.3);">ออกจากระบบ</button>
    `);
  }

  function showErrorPage(reason, showRetry = false) {
    hideSplash();
    const btn = showRetry
      ? `<button onclick="location.reload()" style="${BTN}background:#e74c3c;color:white;">ลองใหม่อีกครั้ง</button>`
      : `<button onclick="${CLOSE_JS}" style="${BTN}background:#2c3e50;color:white;">ปิดหน้าต่าง</button>`;
    pageShell('error-page', `
      <div style="font-size:56px;margin-bottom:20px;">🚫</div>
      <h2 style="margin:0 0 12px;">ไม่สามารถเข้าใช้งานได้</h2>
      <p style="margin:0 0 8px;opacity:0.85;font-size:15px;">${esc(reason)}</p>
      <p style="margin:0;opacity:0.5;font-size:12px;">กรุณาติดต่อผู้ดูแลระบบหากคิดว่าเป็นข้อผิดพลาด</p>
      ${btn}
    `);
  }

  function updateLoadingText(html) {
    const el = document.getElementById('loadingText');
    if (el) el.innerHTML = html;
  }

  function hideSplash() {
    const splash = document.getElementById('splash-screen');
    if (splash && splash.style.display !== 'none') {
      splash.classList.add('hide-splash');
      setTimeout(() => { splash.style.display = 'none'; }, 700);
    }
  }

  // ── API ──
  BPNP.auth = {
    api, login, logout, ensureLiff, liffLogoutSafe, logUserEvent, updateUserPanelUI,
    showExitPage, showErrorPage, getToken, clearSession,
    get user() { return window.currentUser; }
  };
  // ชื่อเดิม (โมดูลที่ย้ายมาจากเวอร์ชัน Leaflet เรียกใช้)
  window.logUserEvent  = logUserEvent;
  window.ensureLiff    = ensureLiff;
  window.liffLogoutSafe = liffLogoutSafe;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
