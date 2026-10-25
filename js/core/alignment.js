/* js/core/alignment.js
 * ─────────────────────────────────────────────────────────────────────────
 * แนวศูนย์กลางทางรถไฟทุก 20 ม. → คำนวณ Sta / O/S ของจุดใด ๆ
 * (ส่วนคำนวณจาก findStaAndOS.js เดิม — ส่วนวาดเส้นย้ายไปเลเยอร์ในเฟส 2)
 *
 *   BPNP.alignment.load()                       → Promise<points[]>  (โหลดครั้งเดียว)
 *   BPNP.alignment.findStationOffset(pt, opts)  → { station, offset } | null
 *   BPNP.alignment.formatStation(m)             → "245+500"
 *   BPNP.alignment.pointAt(sta, offset)         → { lat, lng, heading } (ต้อง load() ก่อน)
 *   BPNP.alignment.isLoaded / .points
 *
 * pt รับได้ทั้ง {lat, lng} และ [lng, lat]
 * ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  const LIMIT_OFFSET = 100;   // ม. เกินนี้ให้เตือน "ห่างเกินไป"
  const SEG_MAX_LEN  = 200;   // ม. ข้ามช่วงที่ยาวเกินค่านี้ (ช่องว่างของข้อมูล)

  const state = { points: [], loaded: false, promise: null };

  function parseKml(text) {
    const kml = new DOMParser().parseFromString(text, 'application/xml');
    const err = kml.getElementsByTagName('parsererror');
    if (err.length) throw new Error('KML parsing error: ' + err[0].textContent);

    const rows = [];
    const pms = kml.getElementsByTagName('Placemark');
    for (let i = 0; i < pms.length; i++) {
      const data = pms[i].getElementsByTagName('SimpleData');
      let sta = NaN, lat = NaN, lng = NaN;
      for (let j = 0; j < data.length; j++) {
        const name = data[j].getAttribute('name');
        const val  = data[j].textContent.trim();
        if (name === 'STA.') sta = parseFloat(val);
        else if (name === 'Latitude') lat = parseFloat(val);
        else if (name === 'Longitude') lng = parseFloat(val);
      }
      if (!isNaN(sta) && !isNaN(lat) && !isNaN(lng)) rows.push({ station: sta, lat, lng });
    }
    rows.sort((a, b) => a.station - b.station);
    return rows;
  }

  function parseGeoJSON(fc) {
    const rows = (fc.features || []).map(f => {
      const p = f.properties || {};
      const c = f.geometry && f.geometry.coordinates;
      const sta = parseFloat(p['STA.']);
      return (c && !isNaN(sta)) ? { station: sta, lat: c[1], lng: c[0] } : null;
    }).filter(Boolean);
    rows.sort((a, b) => a.station - b.station);
    return rows;
  }

  function load() {
    if (state.loaded) return Promise.resolve(state.points);
    if (state.promise) return state.promise;

    const D = BPNP.config.data;
    state.promise = fetch(D.alignment)
      .then(res => { if (!res.ok) throw new Error('HTTP ' + res.status); return res.json(); })
      .then(parseGeoJSON)
      .catch(err => {
        if (!D.alignmentKml) throw err;
        console.warn('[Alignment] ไม่พบ GeoJSON (ยังไม่ได้รัน build?) ใช้ KML แทน');
        return fetch(D.alignmentKml)
          .then(res => { if (!res.ok) throw new Error('HTTP ' + res.status); return res.text(); })
          .then(parseKml);
      })
      .then(points => {
        state.points = points;
        state.loaded = true;
        // ชื่อเดิม (โมดูลที่ย้ายมาในเฟสถัดไปใช้)
        window.alignment = state.points;
        window.alignmentLoaded = true;
        BPNP.events.emit('alignment:loaded', state.points);
        return state.points;
      })
      .catch(err => { state.promise = null; console.error('[Alignment] โหลดไม่สำเร็จ:', err); throw err; });

    return state.promise;
  }

  function formatStation(m) {
    const km = Math.floor(m / 1000);
    const r  = Math.round(m % 1000);
    return `${km}+${String(r).padStart(3, '0')}`;
  }

  // ใช้ Turf.js (โหลดจาก CDN ใน index.html)
  function findStationOffset(point, options = {}, alnOverride) {
    // รองรับลำดับอาร์กิวเมนต์เดิม: findStationOffset(alignment, point, options)
    if (Array.isArray(point) && point.length && typeof point[0] === 'object') {
      const aln = point; point = options; options = alnOverride || {}; alnOverride = aln;
    }
    const aln = alnOverride || state.points;
    const segMax = options.segmentMaxLen ?? SEG_MAX_LEN;
    if (!aln || aln.length < 2 || typeof turf === 'undefined') return null;

    const [lng, lat] = BPNP.geo.toLngLat(point);
    const pt = turf.point([lng, lat]);
    let best = null;

    for (let i = 0; i < aln.length - 1; i++) {
      const A = aln[i], B = aln[i + 1];
      const pA = turf.point([A.lng, A.lat]);
      const pB = turf.point([B.lng, B.lat]);
      const segLen = turf.distance(pA, pB, { units: 'meters' });
      if (segMax && segLen > segMax) continue;

      const snapped = turf.nearestPointOnLine(turf.lineString([[A.lng, A.lat], [B.lng, B.lat]]), pt, { units: 'meters' });
      const offset  = snapped.properties.dist;
      if (!best || Math.abs(offset) < Math.abs(best.offset)) {
        best = { station: A.station + turf.distance(pA, snapped, { units: 'meters' }), offset };
      }
    }
    return best;
  }

  // ── ตำแหน่งจาก STA + ระยะตั้งฉาก (offset > 0 = ขวาของทิศทางเดินรถ, < 0 = ซ้าย) ──
  // สูตรเดียวกับ mark_Sign.js / sw_loc_manager.js เดิม: เทียบสัดส่วนระหว่างจุด 20 ม. + bearing + ระยะบนทรงกลม
  function pointAt(sta, offset = 0) {
    const data = state.points;
    let lower = null, upper = null;
    for (let i = 0; i < data.length; i++) {
      if (data[i].station === sta) { lower = data[i]; upper = data[i + 1] || data[i]; break; }
      if (data[i].station < sta) lower = data[i];
      else if (data[i].station > sta) { upper = data[i]; break; }
    }
    if (!lower || !upper) return null;
    let lat = lower.lat, lng = lower.lng, heading = 0;
    if (lower.station !== upper.station) {
      const ratio = (sta - lower.station) / (upper.station - lower.station);
      lat = lower.lat + ratio * (upper.lat - lower.lat);
      lng = lower.lng + ratio * (upper.lng - lower.lng);
      heading = bearing(lower.lat, lower.lng, upper.lat, upper.lng);
    }
    if (!offset) return { lat, lng, heading };
    const R = 6378137, toRad = d => d * Math.PI / 180, toDeg = r => r * 180 / Math.PI;
    const brng = toRad((heading + (offset > 0 ? 90 : -90)) % 360);
    const la = toRad(lat), lo = toRad(lng), ad = Math.abs(offset) / R;
    const nla = Math.asin(Math.sin(la) * Math.cos(ad) + Math.cos(la) * Math.sin(ad) * Math.cos(brng));
    const nlo = lo + Math.atan2(Math.sin(brng) * Math.sin(ad) * Math.cos(la), Math.cos(ad) - Math.sin(la) * Math.sin(nla));
    return { lat: toDeg(nla), lng: toDeg(nlo), heading };
  }
  function bearing(lat1, lng1, lat2, lng2) {
    const toRad = d => d * Math.PI / 180, toDeg = r => r * 180 / Math.PI;
    const dLng = toRad(lng2 - lng1);
    const y = Math.sin(dLng) * Math.cos(toRad(lat2));
    const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) - Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng);
    return (toDeg(Math.atan2(y, x)) + 360) % 360;
  }

  BPNP.alignment = {
    LIMIT_OFFSET, SEG_MAX_LEN, load, findStationOffset, formatStation, pointAt,
    get isLoaded() { return state.loaded; },
    get points()   { return state.points; }
  };

  // ชื่อเดิม
  window.LIMIT_OFFSET      = LIMIT_OFFSET;
  window.SEG_MAX_LEN       = SEG_MAX_LEN;
  window.loadAlignment     = load;
  window.formatStation     = formatStation;
  window.findStationOffset = findStationOffset;
})();
