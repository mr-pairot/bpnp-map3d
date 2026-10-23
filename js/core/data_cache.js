/* js/core/data_cache.js
 * ─────────────────────────────────────────────────────────────────────────
 * แคชไฟล์ข้อมูลเลเยอร์ (data/**) แบบมีเวอร์ชันรายไฟล์
 *
 * หลักการ
 *   - อ่านเวอร์ชันของแต่ละไฟล์จาก version.json → "dataVersions"
 *     (สร้างอัตโนมัติด้วย tools/build.js)
 *   - เวอร์ชันตรงกับที่แคชไว้  → ใช้ของในเครื่องทันที ไม่โหลดจากเซิร์ฟเวอร์
 *   - เวอร์ชันเปลี่ยน            → โหลดใหม่ แล้วลบเฉพาะแคชเก่าของไฟล์นั้น
 *   - ออฟไลน์/โหลดไม่สำเร็จ      → ใช้แคชเวอร์ชันล่าสุดที่มี (ถ้ามี)
 *   - คีย์เวอร์ชัน = path ใต้ data/ (เช่น kml/structure/underpass.kml) ตรงกับ tools/build.js
 *   - คำขอไฟล์เดียวกันที่เกิดพร้อมกันจะรวมเป็นคำขอเดียว
 *
 * การทำงานแบบ "ไม่ต้องแก้โค้ดเดิม"
 *   - ครอบ window.fetch: คำขอ GET ไปยัง /data/ ของโดเมนตัวเองจะผ่านแคชนี้
 *
 * ต้องโหลดไฟล์นี้ก่อนสคริปต์อื่นที่ดึงข้อมูลจาก data/ (auth.js โหลดให้ก่อนแอป)
 * ───────────────────────────────────────────────────────────────────────── */
(function () {
    'use strict';
    if (window.DataCache) return;

    const CACHE_NAME      = 'bpnp3d-data-v1';            // sw.js ไม่ลบแคชที่ขึ้นต้นด้วย bpnp3d-data
    const LS_VERSIONS_KEY = BPNP.storage.key('data_versions');
    const LS_RELEASE_KEY  = BPNP.storage.key('release_info');   // { version, build } ล่าสุดจาก version.json
    const VERSION_TIMEOUT = 3000;   // รอ version.json ไม่เกิน 3 วินาที (กันเน็ตช้า/ออฟไลน์)

    const nativeFetch = window.fetch.bind(window);
    const hasCacheApi = ('caches' in window);
    const inflight    = new Map();
    const stats       = { hit: 0, miss: 0, stale: 0 };

    let versions = {};
    let releaseInfo = null;
    try { releaseInfo = JSON.parse(localStorage.getItem(LS_RELEASE_KEY) || 'null'); } catch (e) { releaseInfo = null; }
    try { versions = JSON.parse(localStorage.getItem(LS_VERSIONS_KEY) || '{}') || {}; } catch (e) { versions = {}; }

    // ── ขอให้เบราว์เซอร์ไม่ลบแคชเองเมื่อพื้นที่เหลือน้อย ──
    if (navigator.storage && navigator.storage.persist) {
        navigator.storage.persisted().then(p => { if (!p) navigator.storage.persist(); }).catch(() => {});
    }

    // ── โหลด dataVersions ล่าสุด (ไม่บล็อกเกิน VERSION_TIMEOUT) ──
    const versionPromise = nativeFetch('version.json?t=' + Date.now(), { cache: 'no-store' })
        .then(res => (res.ok ? res.json() : null))
        .then(json => {
            if (json && json.version) {
                releaseInfo = { version: String(json.version), build: json.build ? String(json.build) : '' };
                try { localStorage.setItem(LS_RELEASE_KEY, JSON.stringify(releaseInfo)); } catch (e) {}
            }
            if (json && json.dataVersions && typeof json.dataVersions === 'object') {
                const next = {};
                Object.keys(json.dataVersions).forEach(k => { next[k.toLowerCase()] = String(json.dataVersions[k]); });
                versions = next;
                try { localStorage.setItem(LS_VERSIONS_KEY, JSON.stringify(next)); } catch (e) {}
            }
        })
        .catch(() => { /* ออฟไลน์: ใช้เวอร์ชันที่จำไว้ล่าสุด */ })
        .then(() => releaseInfo);

    const ready = Promise.race([versionPromise, new Promise(r => setTimeout(r, VERSION_TIMEOUT))]);

    // ── Helpers ──
    // name = path ใต้ /data/ เช่น "kml/structure/underpass.kml" (ใช้เป็นคีย์เวอร์ชัน)
    function parseUrl(url) {
        const u    = new URL(url, location.href);
        const path = decodeURIComponent(u.pathname).toLowerCase();   // DATA/ กับ data/ ใช้แคชเดียวกัน
        const idx  = path.indexOf('/data/');
        const name = idx >= 0 ? path.slice(idx + 6) : path.split('/').pop();
        return { u, path, name };
    }

    function isDataUrl(url) {
        try {
            const u = new URL(url, location.href);
            return u.origin === location.origin && /\/data\//i.test(u.pathname);
        } catch (e) { return false; }
    }

    function versionOf(name) {
        return versions[name] || versions._default || '0';
    }

    function cacheKeyOf(path, ver, fmt) {
        return location.origin + path + '?dv=' + encodeURIComponent(ver) + '&fmt=' + fmt;
    }

    async function openCache() {
        if (!hasCacheApi) return null;
        try { return await caches.open(CACHE_NAME); } catch (e) { return null; }
    }

    async function findAnyVersion(cache, path, fmt) {
        const keys = await cache.keys();
        for (const req of keys) {
            const k = new URL(req.url);
            if (k.pathname.toLowerCase() === path && k.searchParams.get('fmt') === fmt) {
                return cache.match(req);
            }
        }
        return null;
    }

    async function pruneOldVersions(cache, path, fmt, keepKey) {
        const keys = await cache.keys();
        await Promise.all(keys.map(req => {
            const k = new URL(req.url);
            if (k.pathname.toLowerCase() === path && k.searchParams.get('fmt') === fmt && req.url !== keepKey) {
                return cache.delete(req);
            }
            return null;
        }));
    }

    async function fetchFromNetwork(u, ver) {
        const netUrl = new URL(u.href);
        netUrl.searchParams.set('dv', ver);   // URL เปลี่ยนตามเวอร์ชัน → ไม่ติดแคชเก่าของเบราว์เซอร์/CDN
        const res = await nativeFetch(netUrl.href);
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${u.pathname}`);
        return res.text();
    }

    /**
     * อ่านข้อมูลผ่านแคช
     * @param {string} url
     * @param {'text'|'geojson'} fmt   รูปแบบที่เก็บในแคช
     * @param {(text:string)=>string} [transform]  แปลงข้อความดิบก่อนเก็บ (เช่น KML → GeoJSON string)
     * @returns {Promise<string>}
     */
    function getCached(url, fmt, transform) {
        const { u, path, name } = parseUrl(url);

        const run = async () => {
            await ready;
            const ver = versionOf(name);
            const key = cacheKeyOf(path, ver, fmt);

            if (inflight.has(key)) return inflight.get(key);

            const job = (async () => {
                const cache = await openCache();

                if (cache) {
                    const hit = await cache.match(key);
                    if (hit) { stats.hit++; return hit.text(); }
                }

                let body;
                try {
                    const raw = await fetchFromNetwork(u, ver);
                    body = transform ? transform(raw) : raw;
                    stats.miss++;
                } catch (err) {
                    if (cache) {
                        const old = await findAnyVersion(cache, path, fmt);
                        if (old) {
                            stats.stale++;
                            console.warn(`[DataCache] ใช้แคชเดิมของ ${name} (โหลดใหม่ไม่สำเร็จ)`, err.message);
                            return old.text();
                        }
                    }
                    throw err;
                }

                if (cache) {
                    try {
                        await cache.put(key, new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } }));
                        await pruneOldVersions(cache, path, fmt, key);
                    } catch (e) {
                        console.warn(`[DataCache] บันทึกแคช ${name} ไม่สำเร็จ (พื้นที่อาจเต็ม)`, e);
                    }
                }
                return body;
            })();

            inflight.set(key, job);
            job.then(() => inflight.delete(key), () => inflight.delete(key));
            return job;
        };

        return run();
    }

    // ── ข้อความดิบ (ใช้กับ fetch ทั่วไป) ──
    function getText(url) {
        return getCached(url, 'text');
    }

    // ── JSON / GeoJSON ──
    async function getJSON(url) {
        return JSON.parse(await getText(url));
    }

    // ── ครอบ window.fetch สำหรับ /data/ ──
    function guessContentType(name) {
        if (name.endsWith('.json') || name.endsWith('.geojson')) return 'application/json; charset=utf-8';
        if (name.endsWith('.kml')) return 'application/vnd.google-earth.kml+xml; charset=utf-8';
        return 'text/plain; charset=utf-8';
    }

    window.fetch = function (input, init) {
        try {
            const url    = (typeof input === 'string' || input instanceof URL) ? String(input) : input.url;
            const method = ((init && init.method) || (input && input.method) || 'GET').toUpperCase();
            if (method === 'GET' && isDataUrl(url)) {
                const { name } = parseUrl(url);
                return getText(url).then(
                    text => new Response(text, { status: 200, headers: { 'Content-Type': guessContentType(name) } }),
                    err  => new Response(String(err && err.message || err), { status: 503, statusText: 'DataCache unavailable' })
                );
            }
        } catch (e) { /* ตกไปใช้ fetch ปกติ */ }
        return nativeFetch(input, init);
    };

    // ── API ──
    window.DataCache = BPNP.core.dataCache = {
        ready,
        versionInfo: versionPromise,                 // Promise → { version, build } | null
        get releaseInfo() { return releaseInfo; },   // ค่าล่าสุดที่รู้ (ใช้ได้ทันที / ออฟไลน์)
        getText,
        getJSON,
        isDataUrl,
        get versions() { return Object.assign({}, versions); },
        stats,
        async clear() {
            if (hasCacheApi) await caches.delete(CACHE_NAME);
            localStorage.removeItem(LS_VERSIONS_KEY);
        },
        async report() {
            const cache = await openCache();
            if (!cache) return [];
            const keys = await cache.keys();
            const rows = [];
            for (const req of keys) {
                const res  = await cache.match(req);
                const blob = res ? await res.blob() : null;
                const k    = new URL(req.url);
                rows.push({ file: k.pathname, version: k.searchParams.get('dv'), format: k.searchParams.get('fmt'), sizeKB: blob ? Math.round(blob.size / 1024) : 0 });
            }
            console.table(rows);
            return rows;
        }
    };
})();
