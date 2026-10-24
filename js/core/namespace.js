/* js/core/namespace.js
 * ─────────────────────────────────────────────────────────────────────────
 * สร้าง namespace กลาง window.BPNP — ทุกโมดูลประกาศตัวเองใต้ BPNP.<กลุ่ม>.<ชื่อ>
 *   BPNP.config     ค่าจาก js/config.js
 *   BPNP.storage    localStorage + cookie ที่ใส่ prefix ให้อัตโนมัติ
 *   BPNP.events     ตัวกระจายอีเวนต์ระดับแอป (on / off / emit)
 *   BPNP.log        console.log เฉพาะเมื่อ config.debug = true
 * ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  if (window.BPNP) return;

  const config = window.BPNP_CONFIG || {};
  const prefix = config.storagePrefix || 'bpnp3d_';

  // ── storage ──
  const storage = {
    key(name) { return prefix + name; },

    get(name, fallback = null) {
      try {
        const v = localStorage.getItem(prefix + name);
        return v === null ? fallback : v;
      } catch (e) { return fallback; }
    },
    set(name, value) {
      try { localStorage.setItem(prefix + name, String(value)); } catch (e) { /* โหมดส่วนตัว/พื้นที่เต็ม */ }
    },
    remove(name) {
      try { localStorage.removeItem(prefix + name); } catch (e) {}
    },
    getJSON(name, fallback = null) {
      const raw = storage.get(name);
      if (raw === null) return fallback;
      try { return JSON.parse(raw); } catch (e) { return fallback; }
    },
    setJSON(name, obj) { storage.set(name, JSON.stringify(obj)); },

    // cookie: ใช้สำรองคู่กับ localStorage (บางเบราว์เซอร์/PWA ล้าง localStorage แยกกัน)
    getCookie(name) {
      const k = prefix + name + '=';
      const part = document.cookie.split('; ').find(p => p.indexOf(k) === 0);
      return part ? decodeURIComponent(part.slice(k.length)) : null;
    },
    setCookie(name, value, days = 365) {
      const expires = new Date(Date.now() + days * 864e5).toUTCString();
      const secure  = location.protocol === 'https:' ? '; Secure' : '';
      document.cookie = `${prefix}${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax${secure}`;
    },
    removeCookie(name) {
      document.cookie = `${prefix}${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
    },

    // ลบทุกคีย์ของแอปนี้ (ใช้กับปุ่มรีเซ็ตระบบ)
    clearAll() {
      try {
        Object.keys(localStorage).filter(k => k.indexOf(prefix) === 0).forEach(k => localStorage.removeItem(k));
      } catch (e) {}
      document.cookie.split('; ').forEach(p => {
        const name = p.split('=')[0];
        if (name.indexOf(prefix) === 0) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
      });
      try { sessionStorage.clear(); } catch (e) {}
    }
  };

  // ── events ──
  const handlers = {};
  const events = {
    on(name, fn)  { (handlers[name] = handlers[name] || []).push(fn); return () => events.off(name, fn); },
    off(name, fn) { handlers[name] = (handlers[name] || []).filter(h => h !== fn); },
    once(name, fn) { const off = events.on(name, (...a) => { off(); fn(...a); }); return off; },
    emit(name, ...args) {
      (handlers[name] || []).slice().forEach(fn => {
        try { fn(...args); } catch (err) { console.error(`[BPNP] handler error (${name}):`, err); }
      });
    }
  };

  // ── HTML escape: ใช้ก่อนใส่ข้อความจากผู้ใช้/Sheet ลง innerHTML ──
  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // ข้อความจากข้อมูลโครงการที่มีแท็กจัดรูปแบบ (เช่น Status "<b>ทำสัญญาแล้ว</b><br>...")
  // → อนุญาตเฉพาะ b / strong / i / em / u / br ที่ไม่มี attribute ส่วนอื่น escape ทั้งหมด
  function safeHtml(str) {
    return escapeHtml(str).replace(/&lt;(\/?)(b|strong|i|em|u|br)\s*\/?&gt;/gi, '<$1$2>');
  }

  window.BPNP = {
    config,
    storage,
    events,
    escapeHtml,
    safeHtml,
    log: (...a) => { if (config.debug) console.log('[BPNP]', ...a); },
    core:   {},
    boot:   {},
    map:    {},
    layers: {},
    ui:     {},
    tools:  {
      // เครื่องมือที่ "กำลังใช้งาน" (วัด/วาด/เลือกจุด) ลงทะเบียนตัวตรวจไว้ที่นี่
      // ระบบอื่น (คลิกค้างดูพิกัด, แจ้งอัปเดต) จะไม่รบกวนขณะเครื่องมือทำงาน
      _busy: [],
      registerBusy(fn) { this._busy.push(fn); },
      isBusy() { return this._busy.some(fn => { try { return !!fn(); } catch (e) { return false; } }); }
    }
  };
})();
