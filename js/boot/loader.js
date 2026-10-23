/* js/boot/loader.js
 * ─────────────────────────────────────────────────────────────────────────
 * โหลด JS/CSS ของแอป โดยต่อท้าย ?v=APP_VERSION ให้อัตโนมัติ
 * (APP_VERSION สร้างโดย tools/build.js ตอน deploy → Service Worker แคชตามเวอร์ชัน)
 *
 *   BPNP.loader.script(src)  → Promise (เรียกซ้ำไฟล์เดิมได้ Promise เดิม ไม่โหลดซ้ำ)
 *   BPNP.loader.css(href)    → Promise
 *   BPNP.loader.preload(src) → ดาวน์โหลดล่วงหน้า (ยังไม่รัน)
 *   window.loadScript        → ชื่อเดิม ใช้กับโมดูลที่ย้ายมาจากเวอร์ชัน Leaflet
 * ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  function withVersion(src) {
    try {
      const u = new URL(src, location.href);
      if (u.origin !== location.origin) return src;
      if (window.APP_VERSION) u.searchParams.set('v', window.APP_VERSION);
      return u.href;
    } catch (e) { return src; }
  }

  const loaded = new Map();

  // async = false → ดาวน์โหลดพร้อมกันได้ แต่รันตามลำดับที่เพิ่มเข้าไป
  function script(src) {
    const url = withVersion(src);
    if (loaded.has(url)) return loaded.get(url);
    const p = new Promise((resolve, reject) => {
      const el   = document.createElement('script');
      el.src     = url;
      el.async   = false;
      el.onload  = resolve;
      el.onerror = () => { loaded.delete(url); reject(new Error('โหลดสคริปต์ไม่สำเร็จ: ' + src)); };
      (document.body || document.head).appendChild(el);
    });
    loaded.set(url, p);
    return p;
  }

  function css(href) {
    const url = withVersion(href);
    if (loaded.has(url)) return loaded.get(url);
    const p = new Promise((resolve, reject) => {
      const el   = document.createElement('link');
      el.rel     = 'stylesheet';
      el.href    = url;
      el.onload  = resolve;
      el.onerror = () => { loaded.delete(url); reject(new Error('โหลด CSS ไม่สำเร็จ: ' + href)); };
      document.head.appendChild(el);
    });
    loaded.set(url, p);
    return p;
  }

  function preload(src) {
    const el = document.createElement('link');
    el.rel   = 'preload';
    el.as    = 'script';
    el.href  = withVersion(src);
    document.head.appendChild(el);
  }

  // รอให้ไลบรารีจาก CDN (โหลดแบบ defer ใน index.html) พร้อมใช้งาน
  function waitForGlobal(name, timeoutMs = 15000) {
    return new Promise((resolve, reject) => {
      const start = Date.now();
      (function check() {
        if (typeof window[name] !== 'undefined') return resolve(window[name]);
        if (Date.now() - start > timeoutMs) return reject(new Error('ไลบรารี ' + name + ' โหลดไม่สำเร็จ'));
        setTimeout(check, 50);
      })();
    });
  }

  BPNP.loader = { script, css, preload, withVersion, waitForGlobal };
  window.loadScript = script;
})();
