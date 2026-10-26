/* js/tools/tool_utils.js
 * ─────────────────────────────────────────────────────────────────────────
 * ตัวช่วยร่วมของเครื่องมือเฟส 5 — แทนคำสั่ง Leaflet ที่เครื่องมือเดิมใช้
 *   T.marker(lat, lng, { url, size, html, anchor, draggable, title })  → maplibregl.Marker (ยังไม่ addTo)
 *   T.add(m) / T.remove(m)                         เพิ่ม/ลบหมุด (เดิม addTo(map) / map.removeLayer)
 *   T.flyTo(lat, lng, leafletZoom = 14)            บิน 1.5 วินาที (เดิม map.flyTo([lat,lng], z))
 *   T.fitPoints([[lat,lng],...], { padding, maxLeafletZoom })   (เดิม fitBounds / flyToBounds)
 *   T.ripple(lat, lng, delayMs = 2000) / T.stopRipple()          วงกระเพื่อม (click_point.js)
 *   T.bindPopup(marker, html)                      คลิกหมุดเปิด popup
 *   T.download(content, fileName, mime)            ดาวน์โหลดไฟล์ (KML ฯลฯ)
 *   T.blockMap(el)                                 กันการคลิก/เลื่อนในแผงไม่ให้ส่งต่อไปที่แผนที่
 *
 * กติกา HTML marker: element รากไม่มี position/transform (MIGRATION_GUIDE หัวข้อ 19)
 * ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  const map = () => BPNP.map.instance;

  function marker(lat, lng, opts = {}) {
    let el;
    if (opts.html) {
      el = document.createElement('div');
      el.innerHTML = opts.html;
    } else {
      el = document.createElement('img');
      el.src = opts.url || 'assets/markers/route-start.png';
      el.alt = '';
      el.draggable = false;
    }
    const [w, h] = opts.size || [26, 26];
    el.style.width = w + 'px';
    el.style.height = h + 'px';
    el.style.display = 'block';
    if (opts.className) el.className = opts.className;
    if (opts.title) el.title = opts.title;
    return new maplibregl.Marker({ element: el, anchor: opts.anchor || 'bottom', draggable: !!opts.draggable })
      .setLngLat([lng, lat]);
  }

  const add = m => (m ? m.addTo(map()) : m);
  const remove = m => { if (m) m.remove(); return null; };

  function flyTo(lat, lng, leafletZoom = 14) {
    map().flyTo({ center: [lng, lat], zoom: BPNP.geo.fromLeafletZoom(leafletZoom), duration: 1500 });
  }

  function fitPoints(points, opts = {}) {
    const pts = (points || []).filter(p => p && isFinite(p[0]) && isFinite(p[1]));
    if (!pts.length) return;
    const b = new maplibregl.LngLatBounds([pts[0][1], pts[0][0]], [pts[0][1], pts[0][0]]);
    pts.forEach(p => b.extend([p[1], p[0]]));
    const o = { padding: opts.padding ?? 50, duration: opts.duration ?? 1500 };
    if (opts.maxLeafletZoom) o.maxZoom = BPNP.geo.fromLeafletZoom(opts.maxLeafletZoom);
    map().fitBounds(b, o);
  }

  function stopRipple() { if (BPNP.tools.clickPoint) BPNP.tools.clickPoint.stop(); }
  let rippleTimer = null;
  function ripple(lat, lng, delayMs = 2000) {
    stopRipple();
    clearTimeout(rippleTimer);
    rippleTimer = setTimeout(() => { if (BPNP.tools.clickPoint) BPNP.tools.clickPoint.start([lng, lat], 1000); }, delayMs);
  }

  function bindPopup(m, html, opts = {}) {
    const el = m.getElement();
    el.style.cursor = 'pointer';
    const open = () => { const p = m.getLngLat(); BPNP.map.popup.open([p.lng, p.lat], html, Object.assign({ offset: [0, -26] }, opts)); };
    el.addEventListener('click', e => { e.stopPropagation(); open(); });
    return open;
  }

  function download(content, fileName, mime = 'application/vnd.google-earth.kml+xml') {
    const blob = new Blob([content], { type: mime });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  function blockMap(el) {
    ['mousedown', 'touchstart', 'wheel', 'dblclick', 'click'].forEach(ev =>
      el.addEventListener(ev, e => e.stopPropagation(), { passive: ev !== 'click' }));
    el.addEventListener('contextmenu', e => { if (!e.target.closest('input, textarea')) e.preventDefault(); });
  }

  BPNP.tools.utils = { marker, add, remove, flyTo, fitPoints, ripple, stopRipple, bindPopup, download, blockMap };
})();
