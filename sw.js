/* sw.js — Service Worker ของ BPNP Map 3D
 * ─────────────────────────────────────────────────────────────────────────
 * เวอร์ชันมาจาก URL ที่ลงทะเบียน: sw.js?v=<APP_VERSION>  (ไม่ต้องแก้ไฟล์นี้เมื่อออกเวอร์ชันใหม่)
 *
 * กลยุทธ์
 *   index.html / หน้าเว็บ          → Network First (ออฟไลน์ใช้ฉบับล่าสุดที่เก็บไว้)
 *   version.json / history.json    → Network First
 *   JS/CSS ของแอปที่มี ?v=         → Cache First (URL เปลี่ยนตามเวอร์ชันอยู่แล้ว)
 *   JS/CSS/รูปที่ไม่มี ?v=          → Stale-While-Revalidate
 *   Library จาก CDN                → Stale-While-Revalidate (เฉพาะคำตอบแบบ CORS)
 *   data/*                         → ไม่ยุ่ง (ให้ js/core/data_cache.js จัดการแบบมีเวอร์ชันรายไฟล์)
 *   Tile แผนที่ / API / Google Apps Script → ไม่ยุ่ง (ผ่านเครือข่ายตามปกติ)
 * ───────────────────────────────────────────────────────────────────────── */
'use strict';

const SW_VERSION = new URL(self.location.href).searchParams.get('v') || 'dev';
const SHELL_CACHE = 'bpnp3d-shell';
const CDN_CACHE   = 'bpnp3d-cdn';
const IMG_CACHE   = 'bpnp3d-img';
const KEEP_CACHES = [SHELL_CACHE, CDN_CACHE, IMG_CACHE];
const DATA_CACHE_PREFIX = 'bpnp3d-data'; // ของ data_cache.js ห้ามลบ

const PRECACHE = [
  './index.html',
  './manifest.webmanifest',
  './css/base/splash.css',
  './assets/icons/favicon-96x96.png',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png'
];

const CDN_HOSTS = [
  'unpkg.com',
  'cdn.jsdelivr.net',
  'cdnjs.cloudflare.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'raw.githubusercontent.com'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(SHELL_CACHE).then(async cache => {
      for (const url of PRECACHE) {
        try { await cache.add(url); } catch (err) { console.warn('[SW] precache ไม่สำเร็จ:', url); }
      }
    })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    // 1) ลบแคชของ SW รุ่นเก่า (ชื่อแบบ v2.2.xxx) — ไม่แตะแคชข้อมูลเลเยอร์
    const names = await caches.keys();
    await Promise.all(names
      .filter(n => !KEEP_CACHES.includes(n) && !n.startsWith(DATA_CACHE_PREFIX))
      .map(n => caches.delete(n)));

    // 2) ลบ JS/CSS ของเวอร์ชันเก่าออกจาก shell cache (เก็บเฉพาะ ?v= ปัจจุบัน)
    const shell = await caches.open(SHELL_CACHE);
    const keys  = await shell.keys();
    await Promise.all(keys.map(req => {
      const v = new URL(req.url).searchParams.get('v');
      return (v && v !== SW_VERSION) ? shell.delete(req) : null;
    }));

    await self.clients.claim();
  })());
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

// ── กลยุทธ์ ──
async function networkFirst(request, cacheName, cacheKey) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(request, { cache: 'no-store' });
    if (res && res.ok) cache.put(cacheKey || request, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(cacheKey || request, { ignoreSearch: true });
    if (hit) return hit;
    throw err;
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res && res.ok) cache.put(request, res.clone());
  return res;
}

// เก็บเฉพาะคำตอบที่สำเร็จและไม่ใช่ opaque (opaque ใช้พื้นที่โควตาเกินจริงมาก)
async function staleWhileRevalidate(event, request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  const update = fetch(request).then(res => {
    if (res && res.ok && res.type !== 'opaque') cache.put(request, res.clone());
    return res;
  }).catch(() => null);
  if (hit) {
    event.waitUntil(update);
    return hit;
  }
  const res = await update;
  return res || Response.error();
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  if (url.origin === self.location.origin) {
    const path = url.pathname;

    // ข้อมูลเลเยอร์ → ให้ dataCache.js จัดการ
    if (/\/data\//i.test(path)) return;

    // หน้าเว็บ
    if (req.mode === 'navigate' || path.endsWith('/') || path.endsWith('.html')) {
      event.respondWith(networkFirst(req, SHELL_CACHE, new Request(new URL('./index.html', self.location.href).href)));
      return;
    }

    // ไฟล์ที่ต้องสดใหม่เสมอ
    if (path.endsWith('/version.json') || path.endsWith('/history.json')) {
      event.respondWith(networkFirst(req, SHELL_CACHE, new Request(url.origin + path)));
      return;
    }

    // ไฟล์ SW เอง → ไม่แคช
    if (path.endsWith('/sw.js')) return;

    // คำขอที่ตั้งใจให้สดเสมอ (?t=...) เช่น ตรวจโหมดปิดปรับปรุง → ผ่านเครือข่ายตรง
    if (url.searchParams.has('t')) return;

    // JS / CSS ของแอป
    if (/\.(js|css)$/i.test(path)) {
      if (url.searchParams.has('v')) event.respondWith(cacheFirst(req, SHELL_CACHE));
      else event.respondWith(staleWhileRevalidate(event, req, SHELL_CACHE));
      return;
    }

    // รูปภาพ / manifest
    if (/\.(png|jpe?g|gif|webp|svg|ico|json|webmanifest)$/i.test(path)) {
      event.respondWith(staleWhileRevalidate(event, req, IMG_CACHE));
      return;
    }
    return;
  }

  // Library จาก CDN
  if (CDN_HOSTS.includes(url.hostname)) {
    event.respondWith(staleWhileRevalidate(event, req, CDN_CACHE));
  }
});
