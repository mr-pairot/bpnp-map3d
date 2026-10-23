/* js/core/geo_utils.js
 * ─────────────────────────────────────────────────────────────────────────
 * ฟังก์ชันพิกัดที่ใช้ร่วมกันทุกเฟส
 *
 * กติกา
 *   - ภายในแอปใช้ [lng, lat] (ลำดับของ GeoJSON / MapLibre)
 *   - ซูม MapLibre = ซูม Leaflet − 1 → ค่าที่ย้ายมาจากโค้ดเดิมให้ผ่าน fromLeafletZoom()
 *
 *   BPNP.geo.fromLeafletZoom(z)        ซูม Leaflet → MapLibre
 *   BPNP.geo.toLngLat(x)               รับ {lat,lng} | {lat,lon} | [lng,lat] | LngLat → [lng, lat]
 *   BPNP.geo.distance(a, b)            ระยะทาง (เมตร) ระหว่างจุด 2 จุด
 *   BPNP.geo.circlePolygon(c, r, n)    รูปวงกลมรัศมี r เมตร (GeoJSON Polygon)
 *   BPNP.geo.latLngToUTM(lat, lng)     → { zone, easting, northing }
 *   BPNP.geo.utmToLatLng(e, n, zone)   → { lat, lng }
 * ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  const R_EARTH = 6371008.8;
  const rad = d => d * Math.PI / 180;

  function fromLeafletZoom(z) { return z - 1; }

  function toLngLat(x) {
    if (!x) return null;
    if (Array.isArray(x)) return [Number(x[0]), Number(x[1])];
    if (typeof x.lng === 'number') return [x.lng, x.lat];
    if (typeof x.lon === 'number') return [x.lon, x.lat];
    return null;
  }

  function distance(a, b) {
    const [lng1, lat1] = toLngLat(a), [lng2, lat2] = toLngLat(b);
    const dLat = rad(lat2 - lat1), dLng = rad(lng2 - lng1);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * R_EARTH * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  function circlePolygon(center, radiusM, steps = 64) {
    const [lng, lat] = toLngLat(center);
    const coords = [];
    const dLat = radiusM / R_EARTH * 180 / Math.PI;
    const dLng = dLat / Math.cos(rad(lat));
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * 2 * Math.PI;
      coords.push([lng + dLng * Math.cos(t), lat + dLat * Math.sin(t)]);
    }
    return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [coords] } };
  }

  // ── UTM (WGS84) — ย้ายจาก convertFunction.js เดิมโดยไม่แก้สูตร ──
  function latLngToUTM(lat, lng) {
      const a = 6378137; // WGS84 semi-major axis
      const f = 1/298.257223563; // WGS84 flattening
      const k0 = 0.9996; // scale factor
    
      const latRad = lat * Math.PI / 180;
      const lngRad = lng * Math.PI / 180;
    
      // Calculate UTM zone
      const zone = Math.floor((lng + 180) / 6) + 1;
      const centralMeridian = (zone - 1) * 6 - 180 + 3;
      const centralMeridianRad = centralMeridian * Math.PI / 180;
    
      // Calculate ellipsoid parameters
      const e = Math.sqrt(2*f - f*f);
      const e2 = e*e;
      const e4 = e2*e2;
      const e6 = e4*e2;
    
      const n = f / (2 - f);
      const n2 = n*n;
      const n3 = n2*n;
      const n4 = n2*n2;
      const n5 = n4*n;
      const n6 = n3*n3;
    
      const A = a / (1 + n) * (1 + n2/4 + n4/64 + n6/256);
    
      const alpha = [
          0,
          1/2*n - 2/3*n2 + 5/16*n3 + 41/180*n4 - 127/288*n5,
          13/48*n2 - 3/5*n3 + 557/1440*n4 + 281/630*n5,
          61/240*n3 - 103/140*n4 + 15061/26880*n5,
          49561/161280*n4 - 179/168*n5,
          34729/80640*n5
      ];
    
      // Calculate coordinates
      const t = Math.sinh(Math.atanh(Math.sin(latRad)) - 2*Math.sqrt(n)/(1+n) * Math.atanh(2*Math.sqrt(n)/(1+n) * Math.sin(latRad)));
      const xi = Math.atan(t / Math.cos(lngRad - centralMeridianRad));
      const eta = Math.atanh(Math.sin(lngRad - centralMeridianRad) / Math.sqrt(1 + t*t));
    
      let x = xi;
      let y = eta;
    
      for (let j = 1; j <= 5; j++) {
          x += alpha[j] * Math.sin(2*j*xi) * Math.cosh(2*j*eta);
          y += alpha[j] * Math.cos(2*j*xi) * Math.sinh(2*j*eta);
      }
    
      const easting = k0 * A * y + 500000;
      const northing = k0 * A * x;
    
      return {
          zone: zone,
          easting: parseFloat(easting.toFixed(3)),   
          northing: parseFloat(northing.toFixed(3))
      };
  }

  function utmToLatLng(easting, northing, zone) {
      const a = 6378137; // WGS84 semi-major axis
      const f = 1/298.257223563; // WGS84 flattening
      const k0 = 0.9996; // scale factor
    
      const centralMeridian = (zone - 1) * 6 - 180 + 3;
      const centralMeridianRad = centralMeridian * Math.PI / 180;
    
      // Calculate ellipsoid parameters
      const e = Math.sqrt(2*f - f*f);
      const e2 = e*e;
      const e4 = e2*e2;
      const e6 = e4*e2;
      const e8 = e4*e4;
    
      const n = f / (2 - f);
      const n2 = n*n;
      const n3 = n2*n;
      const n4 = n2*n2;
      const n5 = n4*n;
      const n6 = n3*n3;
    
      const A = a / (1 + n) * (1 + n2/4 + n4/64 + n6/256);
    
      const beta = [
          0,
          1/2*n - 2/3*n2 + 37/96*n3 - 1/360*n4 - 81/512*n5,
          1/48*n2 + 1/15*n3 - 437/1440*n4 + 46/105*n5,
          17/480*n3 - 37/840*n4 - 209/4480*n5,
          4397/161280*n4 - 11/504*n5,
          4583/161280*n5
      ];
    
      // Calculate coordinates
      const x = (northing) / (k0 * A);
      const y = (easting - 500000) / (k0 * A);
    
      let xi = x;
      let eta = y;
    
      for (let j = 1; j <= 5; j++) {
          xi -= beta[j] * Math.sin(2*j*x) * Math.cosh(2*j*y);
          eta -= beta[j] * Math.cos(2*j*x) * Math.sinh(2*j*y);
      }
    
      const chi = Math.asin(Math.sin(xi) / Math.cosh(eta));
      const lat = chi + (e2/2 + 5*e4/24 + e6/12 + 13*e8/360) * Math.sin(2*chi) +
                 (7*e4/48 + 29*e6/240 + 811*e8/11520) * Math.sin(4*chi) +
                 (7*e6/120 + 81*e8/1120) * Math.sin(6*chi) +
                 (4279*e8/161280) * Math.sin(8*chi);
    
      const lng = centralMeridianRad + Math.atan(Math.sinh(eta) / Math.cos(xi));
    
      return {
          lat: lat * 180 / Math.PI,
          lng: lng * 180 / Math.PI
      };
  }

  BPNP.geo = { fromLeafletZoom, toLngLat, distance, circlePolygon, latLngToUTM, utmToLatLng };
  // ชื่อเดิม (เครื่องมือแปลง UTM ในเฟส 5 เรียกใช้)
  window.latLngToUTM = latLngToUTM;
  window.utmToLatLng = utmToLatLng;
})();
