/* js/tools/measure/lcompat.js
 * ─────────────────────────────────────────────────────────────────────────
 * Leaflet ชุดย่อยบน MapLibre — ใช้เฉพาะภายในเครื่องมือวัด (mp / mpex / mpem) เท่านั้น
 * ไม่ประกาศ window.L · ไฟล์เครื่องมือแต่ละไฟล์ถูกห่อด้วย (function (L) { ... })(BPNP.tools.lcompat.L)
 *
 * รองรับเฉพาะที่เครื่องมือเดิมใช้จริง (นับจากโค้ด):
 *   L.latLng · L.point · L.latLngBounds · L.polyline · L.polygon · L.rectangle · L.circle
 *   L.marker + L.divIcon · L.layerGroup · L.FeatureGroup · L.geoJSON
 *   L.DomEvent (stop, stopPropagation, disableClickPropagation, disableScrollPropagation) · L.DomUtil (create, addClass, removeClass)
 *   แผนที่: on/off · getContainer · doubleClickZoom · dragging · options.crs.project · project/unproject
 *           getBoundsZoom · flyTo · fitBounds · getZoom · addLayer/removeLayer/hasLayer
 *   ซูมแบบ Leaflet (MapLibre = Leaflet − 1) · ระยะทาง/การฉายแบบเดียวกับ Leaflet (ผลวัดเท่าเดิม)
 *
 * การวาด: เส้น/รูปทั้งหมดอยู่ใน source เดียว (src-measure) ใน slot 'tools'
 *   ชั้น: mp-glow (เงาเรือง แทน drop-shadow ของ CSS) · mp-fill · mp-line · mp-line-dash
 * หมุด: maplibregl.Marker — element รากไม่มี class/position (กติกาหัวข้อ 19) ไอคอนอยู่ใน element ด้านใน
 * ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  const D2R = Math.PI / 180;
  const EARTH_R = 6371000;            // L.CRS.Earth.R (distanceTo)
  const MERC_R = 6378137;             // L.Projection.SphericalMercator.R
  const MAX_LAT = 85.0511287798;

  // ── จุด / พิกัด ──
  class Point {
    constructor(x, y) { this.x = x; this.y = y; }
    distanceTo(p) { return Math.hypot(p.x - this.x, p.y - this.y); }
    add(p) { return new Point(this.x + p.x, this.y + p.y); }
    subtract(p) { return new Point(this.x - p.x, this.y - p.y); }
  }
  class LatLng {
    constructor(lat, lng) { this.lat = +lat; this.lng = +lng; }
    distanceTo(o) {
      o = toLatLng(o);
      const la1 = this.lat * D2R, la2 = o.lat * D2R;
      const s1 = Math.sin((o.lat - this.lat) * D2R / 2), s2 = Math.sin((o.lng - this.lng) * D2R / 2);
      const a = s1 * s1 + Math.cos(la1) * Math.cos(la2) * s2 * s2;
      return EARTH_R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }
    equals(o, margin = 1e-9) { o = toLatLng(o); return !!o && Math.max(Math.abs(this.lat - o.lat), Math.abs(this.lng - o.lng)) <= margin; }
    toString() { return `LatLng(${this.lat}, ${this.lng})`; }
  }
  function toLatLng(a, b) {
    if (a instanceof LatLng) return a;
    if (Array.isArray(a)) return new LatLng(a[0], a[1]);
    if (a && typeof a === 'object' && 'lat' in a) return new LatLng(a.lat, a.lng !== undefined ? a.lng : a.lon);
    if (b !== undefined) return new LatLng(a, b);
    return null;
  }
  const isFlat = ll => !Array.isArray(ll) || !ll.length || !Array.isArray(ll[0]) || typeof ll[0][0] === 'number';
  const normLatLngs = ll => (isFlat(ll) ? (ll || []).map(p => toLatLng(p)) : ll.map(normLatLngs));

  class LatLngBounds {
    constructor(a, b) {
      this._sw = null; this._ne = null;
      if (!a) return;
      const pts = b ? [a, b] : a;
      (Array.isArray(pts) && !(typeof pts[0] === 'number') ? pts : [pts]).forEach(p => this.extend(p));
    }
    extend(o) {
      if (o instanceof LatLngBounds) { if (o.isValid()) { this.extend(o._sw); this.extend(o._ne); } return this; }
      const p = toLatLng(o);
      if (!p) return this;
      if (!this._sw) { this._sw = new LatLng(p.lat, p.lng); this._ne = new LatLng(p.lat, p.lng); }
      else {
        this._sw.lat = Math.min(p.lat, this._sw.lat); this._sw.lng = Math.min(p.lng, this._sw.lng);
        this._ne.lat = Math.max(p.lat, this._ne.lat); this._ne.lng = Math.max(p.lng, this._ne.lng);
      }
      return this;
    }
    isValid() { return !!(this._sw && this._ne); }
    getCenter() { return new LatLng((this._sw.lat + this._ne.lat) / 2, (this._sw.lng + this._ne.lng) / 2); }
    getSouthWest() { return this._sw; } getNorthEast() { return this._ne; }
    getNorthWest() { return new LatLng(this._ne.lat, this._sw.lng); } getSouthEast() { return new LatLng(this._sw.lat, this._ne.lng); }
    getNorth() { return this._ne.lat; } getSouth() { return this._sw.lat; } getEast() { return this._ne.lng; } getWest() { return this._sw.lng; }
    pad(r) {
      const h = Math.abs(this._sw.lat - this._ne.lat) * r, w = Math.abs(this._sw.lng - this._ne.lng) * r;
      return new LatLngBounds([this._sw.lat - h, this._sw.lng - w], [this._ne.lat + h, this._ne.lng + w]);
    }
    contains(o) { const p = toLatLng(o); return p.lat >= this._sw.lat && p.lat <= this._ne.lat && p.lng >= this._sw.lng && p.lng <= this._ne.lng; }
    toMapLibre() { return [[this._sw.lng, this._sw.lat], [this._ne.lng, this._ne.lat]]; }
  }

  // EPSG:3857 แบบ Leaflet
  function mercProject(ll) {
    ll = toLatLng(ll);
    const lat = Math.max(Math.min(MAX_LAT, ll.lat), -MAX_LAT), s = Math.sin(lat * D2R);
    return new Point(MERC_R * ll.lng * D2R, MERC_R * Math.log((1 + s) / (1 - s)) / 2);
  }
  function mercUnproject(p) {
    return new LatLng((2 * Math.atan(Math.exp(p.y / MERC_R)) - Math.PI / 2) / D2R, p.x / D2R / MERC_R);
  }
  const SCALE = z => 256 * Math.pow(2, z);
  const TF = 0.5 / (Math.PI * MERC_R);

  // ── เหตุการณ์แบบ Leaflet ──
  class Evented {
    on(types, fn, ctx) {
      if (typeof types === 'object') { Object.keys(types).forEach(t => this.on(t, types[t], fn)); return this; }
      this._ev = this._ev || {};
      types.split(/\s+/).forEach(t => { (this._ev[t] = this._ev[t] || []).push({ fn, ctx }); });
      return this;
    }
    off(types, fn, ctx) {
      if (!this._ev) return this;
      if (!types) { this._ev = {}; return this; }
      types.split(/\s+/).forEach(t => {
        if (!this._ev[t]) return;
        this._ev[t] = fn ? this._ev[t].filter(h => !(h.fn === fn && (ctx === undefined || h.ctx === ctx))) : [];
      });
      return this;
    }
    once(t, fn, ctx) { const w = e => { this.off(t, w); fn.call(ctx || this, e); }; return this.on(t, w); }
    fire(t, data) {
      const hs = this._ev && this._ev[t];
      if (!hs || !hs.length) return this;
      const e = Object.assign({ type: t, target: this, sourceTarget: this }, data || {});
      hs.slice().forEach(h => h.fn.call(h.ctx || this, e));
      return e;
    }
    listens(t) { return !!(this._ev && this._ev[t] && this._ev[t].length); }
  }

  // ── ชั้นพื้นฐาน (addTo กลุ่มหรือแผนที่) ──
  let uid = 0;
  class Layer extends Evented {
    constructor() { super(); this._leaflet_id = ++uid; this._map = null; }
    addTo(t) { if (t instanceof LayerGroup) t.addLayer(this); else if (t) t.addLayer(this); return this; }
    remove() { if (this._map) this._map.removeLayer(this); return this; }
    _add(map) { this._map = map; this.onAdd(map); }
    _rm() { if (!this._map) return; this.onRemove(this._map); this._map = null; }
    onAdd() {} onRemove() {}
  }

  // ── เส้น/รูป: ทุกชิ้นอยู่ใน VectorStore ของแผนที่ ──
  const PATH_DEFAULTS = { stroke: true, color: '#3388ff', weight: 3, opacity: 1, fill: false, fillColor: null, fillOpacity: 0.2, dashArray: null, interactive: true };
  // class ที่โค้ดเดิมใส่ให้ SVG path (drop-shadow) → เงาเรืองใต้เส้น
  const PATH_CLASS_GLOW = {
    'mp-shape-hover-delete':  { color: 'rgba(255, 0, 0, 0.9)', width: 10 },
    'mp-shape-hover-blue':    { color: 'rgba(0, 162, 255, 0.9)', width: 12 },
    'mp-shape-selected-blue': { color: 'rgba(0, 85, 255, 1)', width: 16 },
    'mp-blink-effect':        { color: 'rgba(255, 0, 0, 0.9)', width: 12 }
  };

  class Path extends Layer {
    constructor(latlngs, options, kind) {
      super();
      this._kind = kind;
      this.options = Object.assign({}, PATH_DEFAULTS, { fill: kind !== 'polyline' }, options || {});
      this._latlngs = normLatLngs(latlngs || []);
      const self = this, classes = new Set((this.options.className || '').split(/\s+/).filter(Boolean));
      // แทน SVG path ของ Leaflet: รองรับ L.DomUtil.addClass/removeClass(layer._path, ...)
      this._path = { classList: {
        add: c => { classes.add(c); self._touch(); }, remove: c => { classes.delete(c); self._touch(); },
        contains: c => classes.has(c), toggle: (c, on) => { (on ?? !classes.has(c)) ? classes.add(c) : classes.delete(c); self._touch(); }
      } };
      this._classes = classes;
    }
    _touch() { if (this._map) this._map._store.update(); }
    onAdd(map) { map._store.add(this); }
    onRemove(map) { map._store.remove(this); }
    setLatLngs(ll) { this._latlngs = normLatLngs(ll); this._touch(); return this; }
    getLatLngs() { return this._latlngs; }
    addLatLng(ll) { this._latlngs.push(toLatLng(ll)); this._touch(); return this; }
    setStyle(s) { Object.assign(this.options, s || {}); this._touch(); return this; }
    getBounds() { const b = new LatLngBounds(); (function w(a) { a.forEach(p => (p instanceof LatLng ? b.extend(p) : w(p))); })(this._latlngs); return b; }
    getCenter() { return this.getBounds().getCenter(); }
    bringToFront() { if (this._map) this._map._store.front(this); return this; }
    bringToBack() { if (this._map) this._map._store.back(this); return this; }
    _rings() {   // [[LatLng...], ...]
      const ll = this._latlngs;
      if (!ll.length) return [];
      return ll[0] instanceof LatLng ? [ll] : (ll[0][0] instanceof LatLng ? ll : ll.flat());
    }
    _geometry() {
      const rings = this._rings().map(r => r.map(p => [p.lng, p.lat])).filter(r => r.length >= 2);
      if (!rings.length) return null;
      if (this._kind === 'polyline') return rings.length === 1 ? { type: 'LineString', coordinates: rings[0] } : { type: 'MultiLineString', coordinates: rings };
      const closed = rings.filter(r => r.length >= 3).map(r => {
        const c = r.slice(); const a = c[0], z = c[c.length - 1];
        if (a[0] !== z[0] || a[1] !== z[1]) c.push(a);
        return c;
      });
      return closed.length ? { type: 'Polygon', coordinates: closed } : { type: 'LineString', coordinates: rings[0] };
    }
    toGeoJSON() { return { type: 'Feature', properties: {}, geometry: this._geometry() }; }
  }
  class Polyline extends Path { constructor(ll, o) { super(ll, o, 'polyline'); } }
  // Leaflet เก็บพิกัด polygon เป็นวงเสมอ ([[LatLng...]]) — โค้ดเดิมใช้ getLatLngs()[0]
  class Polygon extends Path {
    constructor(ll, o) { super(ll, o, 'polygon'); this._latlngs = Polygon._rings(this._latlngs); }
    static _rings(ll) { return ll.length && ll[0] instanceof LatLng ? [ll] : ll; }
    setLatLngs(ll) { this._latlngs = Polygon._rings(normLatLngs(ll)); this._touch(); return this; }
  }
  class Rectangle extends Polygon {
    constructor(b, o) { super([], o); this.setBounds(b); }
    setBounds(b) { b = b instanceof LatLngBounds ? b : new LatLngBounds(b); return this.setLatLngs([b.getSouthWest(), b.getNorthWest(), b.getNorthEast(), b.getSouthEast()]); }
  }
  class Circle extends Path {
    constructor(c, o) { super([], Object.assign({}, o), 'polygon'); this._center = toLatLng(c); this._radius = (o && o.radius) || 10; this._build(); }
    _build() {   // วงกลมรัศมีเป็นเมตร (64 จุด) — ภาพเท่า L.Circle
      const pts = [], n = 64, la = this._center.lat * D2R, lo = this._center.lng * D2R, d = this._radius / EARTH_R;
      for (let i = 0; i < n; i++) {
        const b = 2 * Math.PI * i / n;
        const lat2 = Math.asin(Math.sin(la) * Math.cos(d) + Math.cos(la) * Math.sin(d) * Math.cos(b));
        const lng2 = lo + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(la), Math.cos(d) - Math.sin(la) * Math.sin(lat2));
        pts.push(new LatLng(lat2 / D2R, lng2 / D2R));
      }
      this._latlngs = [pts]; this._touch();
    }
    setRadius(r) { this._radius = r; this._build(); return this; }
    getRadius() { return this._radius; }
    setLatLng(c) { this._center = toLatLng(c); this._build(); return this; }
    getLatLng() { return this._center; }
    toGeoJSON() { return { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [this._center.lng, this._center.lat] } }; }
  }

  class VectorStore {
    constructor(mlMap) {
      this.ml = mlMap; this.paths = []; this.pending = false;
      const before = BPNP.map.registry && BPNP.map.registry.beforeIdFor ? BPNP.map.registry.beforeIdFor('tools') : undefined;
      const b = before && mlMap.getLayer(before) ? before : undefined;
      mlMap.addSource('src-measure', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
      const sort = ['get', 'z'];
      mlMap.addLayer({ id: 'mp-glow', type: 'line', source: 'src-measure', filter: ['has', 'glow'],
        layout: { 'line-join': 'round', 'line-cap': 'round', 'line-sort-key': sort },
        paint: { 'line-color': ['get', 'glow'], 'line-width': ['get', 'glowW'], 'line-blur': 6, 'line-opacity': ['get', 'opacity'] } }, b);
      mlMap.addLayer({ id: 'mp-fill', type: 'fill', source: 'src-measure', filter: ['all', ['==', ['get', 'fill'], true], ['==', ['geometry-type'], 'Polygon']],
        layout: { 'fill-sort-key': sort }, paint: { 'fill-color': ['get', 'fillColor'], 'fill-opacity': ['get', 'fillOpacity'] } }, b);
      mlMap.addLayer({ id: 'mp-line', type: 'line', source: 'src-measure', filter: ['all', ['==', ['get', 'stroke'], true], ['==', ['get', 'dash'], false]],
        layout: { 'line-join': 'round', 'line-cap': 'round', 'line-sort-key': sort },
        paint: { 'line-color': ['get', 'color'], 'line-width': ['get', 'weight'], 'line-opacity': ['get', 'opacity'] } }, b);
      mlMap.addLayer({ id: 'mp-line-dash', type: 'line', source: 'src-measure', filter: ['all', ['==', ['get', 'stroke'], true], ['==', ['get', 'dash'], true]],
        layout: { 'line-join': 'round', 'line-sort-key': sort },
        paint: { 'line-color': ['get', 'color'], 'line-width': ['get', 'weight'], 'line-opacity': ['get', 'opacity'], 'line-dasharray': [2, 2] } }, b);
    }
    add(p) { if (!this.paths.includes(p)) this.paths.push(p); this.update(); }
    remove(p) { this.paths = this.paths.filter(x => x !== p); this.update(); }
    front(p) { this.remove(p); this.add(p); }
    back(p) { this.paths = [p].concat(this.paths.filter(x => x !== p)); this.update(); }
    update() {
      if (this.pending) return;
      this.pending = true;
      requestAnimationFrame(() => { this.pending = false; this.flush(); });
    }
    flush() {
      const features = [];
      this.paths.forEach((p, i) => {
        const g = p._geometry(); if (!g) return;
        const o = p.options;
        const props = { id: p._leaflet_id, z: i, stroke: o.stroke !== false, color: o.color, weight: o.weight, opacity: o.opacity ?? 1,
          fill: !!o.fill && g.type === 'Polygon', fillColor: o.fillColor || o.color, fillOpacity: o.fillOpacity ?? 0.2, dash: !!o.dashArray };
        p._classes.forEach(c => { const gl = PATH_CLASS_GLOW[c]; if (gl) { props.glow = gl.color; props.glowW = (o.weight || 3) + gl.width; } });
        features.push({ type: 'Feature', id: p._leaflet_id, properties: props, geometry: g });
      });
      const s = this.ml.getSource('src-measure');
      if (s) s.setData({ type: 'FeatureCollection', features });
    }
    // ชิ้นบนสุดที่ตำแหน่งคลิก (เฉพาะที่ interactive)
    hit(point) {
      const fs = this.ml.queryRenderedFeatures([[point.x - 4, point.y - 4], [point.x + 4, point.y + 4]], { layers: ['mp-fill', 'mp-line', 'mp-line-dash'] });
      let best = null;
      fs.forEach(f => {
        const p = this.paths.find(x => x._leaflet_id === f.properties.id);
        if (p && p.options.interactive !== false && (!best || this.paths.indexOf(p) > this.paths.indexOf(best))) best = p;
      });
      return best;
    }
  }

  // ── หมุด ──
  class DivIcon { constructor(o) { this.options = Object.assign({ className: 'leaflet-div-icon', html: false, iconSize: [12, 12] }, o || {}); } }
  class Marker extends Layer {
    constructor(ll, o) { super(); this._latlng = toLatLng(ll); this.options = Object.assign({ interactive: true, draggable: false }, o || {}); }
    _buildEl() {
      const io = (this.options.icon && this.options.icon.options) || {};
      const root = document.createElement('div');       // ราก: ไม่มี class/position
      const icon = document.createElement('div');
      if (io.className) icon.className = io.className;
      if (io.html instanceof Element) icon.appendChild(io.html); else if (io.html) icon.innerHTML = io.html;
      const size = io.iconSize;
      if (size) { const [w, h] = Array.isArray(size) ? size : [size.x, size.y]; root.style.width = w + 'px'; root.style.height = h + 'px'; icon.style.width = w + 'px'; icon.style.height = h + 'px'; }
      root.appendChild(icon);
      if (this.options.interactive === false && !this.options.draggable) root.style.pointerEvents = 'none';
      if (this.options.zIndexOffset) root.style.zIndex = String(this.options.zIndexOffset);
      this._root = root; this._icon = icon;
      let anchor = io.iconAnchor;
      if (!anchor && size) { const [w, h] = Array.isArray(size) ? size : [size.x, size.y]; anchor = [w / 2, h / 2]; }
      if (!anchor) anchor = [0, 0];
      const [ax, ay] = Array.isArray(anchor) ? anchor : [anchor.x, anchor.y];
      this._offset = [-ax, -ay];
      // กดค้างบนจอสัมผัส: ห้ามเมนู/การเลือกข้อความ/บันทึกรูปของระบบ เพื่อให้เริ่มลากจุดได้ทันที
      // (เดิม stopPropagation อย่างเดียว → ตัวกันเมนูระดับหน้าไม่เห็นเหตุการณ์ และไม่มีใคร preventDefault)
      Object.assign(root.style, { touchAction: 'none', userSelect: 'none', webkitUserSelect: 'none', webkitTouchCallout: 'none', webkitUserDrag: 'none' });
      ['contextmenu', 'selectstart', 'dragstart'].forEach(t => root.addEventListener(t, ev => { ev.preventDefault(); }));
      // คลิกที่หมุดไม่ส่งต่อไปเป็นคลิกแผนที่ (เหมือน Leaflet)
      ['click', 'contextmenu'].forEach(t => root.addEventListener(t, ev => {
        if (this.options.interactive === false) return;
        ev.stopPropagation();
        this.fire(t, { originalEvent: ev, latlng: this._latlng });
      }));
      // ดับเบิลคลิก: ถ้าหมุดไม่ได้ใช้เอง ส่งต่อให้แผนที่ (จบการวาดด้วยดับเบิลคลิกได้ แม้คลิกแรกสร้างหมุดใต้เคอร์เซอร์)
      root.addEventListener('dblclick', ev => {
        if (this.options.interactive === false) return;
        ev.stopPropagation();
        ev.preventDefault();
        const e = { originalEvent: ev, latlng: this._latlng };
        if (this.listens('dblclick')) this.fire('dblclick', e);
        // type 'dblclick-marker': คลิกที่สองตกที่หมุดจึงไม่มีจุดซ้ำ → mp.js ไม่ต้องตัดจุดสุดท้าย (เงื่อนไข e.type === 'dblclick')
        else if (this._map) this._map.fire('dblclick', Object.assign({}, e, { type: 'dblclick-marker', containerPoint: this._map.latLngToContainerPoint(this._latlng) }));
      });
      ['mouseover', 'mouseout', 'mousedown'].forEach(t => root.addEventListener(t, ev => this.fire(t, { originalEvent: ev, latlng: this._latlng })));
    }
    onAdd(map) {
      if (!this._root) this._buildEl();
      this._ml = new maplibregl.Marker({ element: this._root, anchor: 'top-left', offset: this._offset, draggable: !!this.options.draggable })
        .setLngLat([this._latlng.lng, this._latlng.lat]).addTo(map._ml);
      if (this.options.draggable) {
        const sync = () => { const p = this._ml.getLngLat(); this._latlng = new LatLng(p.lat, p.lng); };
        this._ml.on('dragstart', () => { sync(); this.fire('dragstart'); this.fire('movestart'); });
        this._ml.on('drag', () => { sync(); this.fire('drag', { latlng: this._latlng }); this.fire('move', { latlng: this._latlng }); });
        this._ml.on('dragend', () => { sync(); this.fire('dragend'); this.fire('moveend'); });
      }
    }
    onRemove() { if (this._ml) { this._ml.remove(); this._ml = null; } }
    setLatLng(ll) { this._latlng = toLatLng(ll); if (this._ml) this._ml.setLngLat([this._latlng.lng, this._latlng.lat]); return this.fire('move', { latlng: this._latlng }) || this; }
    getLatLng() { return this._latlng; }
    getElement() { if (!this._root) this._buildEl(); return this._icon; }
    setIcon(icon) { this.options.icon = icon; const m = this._map; if (m) { this._rm(); this._root = null; this._add(m); } else this._root = null; return this; }
    setOpacity(o) { if (this._root) this._root.style.opacity = o; return this; }
    setZIndexOffset(z) { this.options.zIndexOffset = z; if (this._root) this._root.style.zIndex = String(z); return this; }
    toGeoJSON() { return { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [this._latlng.lng, this._latlng.lat] } }; }
  }

  // ── กลุ่ม ──
  class LayerGroup extends Layer {
    constructor(layers) { super(); this._layers = new Map(); (layers || []).forEach(l => this.addLayer(l)); }
    addLayer(l) {
      if (!l || this._layers.has(l._leaflet_id)) return this;
      this._layers.set(l._leaflet_id, l);
      if (this._map && l._map !== this._map) this._map.addLayer(l);
      return this;
    }
    removeLayer(l) {
      const layer = typeof l === 'number' ? this._layers.get(l) : l;
      if (!layer) return this;
      this._layers.delete(layer._leaflet_id);
      if (this._map && layer._map) this._map.removeLayer(layer);
      return this;
    }
    hasLayer(l) { return !!l && this._layers.has(typeof l === 'number' ? l : l._leaflet_id); }
    clearLayers() { Array.from(this._layers.values()).forEach(l => this.removeLayer(l)); return this; }
    eachLayer(fn, ctx) { Array.from(this._layers.values()).forEach(l => fn.call(ctx, l)); return this; }
    getLayers() { return Array.from(this._layers.values()); }
    onAdd(map) { this._layers.forEach(l => map.addLayer(l)); }
    onRemove(map) { this._layers.forEach(l => map.removeLayer(l)); }
  }
  class FeatureGroup extends LayerGroup {
    getBounds() { const b = new LatLngBounds(); this._layers.forEach(l => { if (l.getBounds) b.extend(l.getBounds()); else if (l.getLatLng) b.extend(l.getLatLng()); }); return b; }
    setStyle(s) { this._layers.forEach(l => l.setStyle && l.setStyle(s)); return this; }
    bringToFront() { this._layers.forEach(l => l.bringToFront && l.bringToFront()); return this; }
  }

  function geoJSON(data, opts = {}) {
    const g = new FeatureGroup();
    const feats = data.type === 'FeatureCollection' ? data.features : [data.type === 'Feature' ? data : { type: 'Feature', properties: {}, geometry: data }];
    feats.forEach(f => {
      if (!f || !f.geometry) return;
      const st = typeof opts.style === 'function' ? opts.style(f) : (opts.style || {});
      const ll = c => toLatLng([c[1], c[0]]);
      const geom = f.geometry;
      let layers = [];
      if (geom.type === 'Polygon') layers = [new Polygon(geom.coordinates.map(r => r.map(ll)), st)];
      else if (geom.type === 'MultiPolygon') layers = geom.coordinates.map(p => new Polygon(p.map(r => r.map(ll)), st));
      else if (geom.type === 'LineString') layers = [new Polyline(geom.coordinates.map(ll), st)];
      else if (geom.type === 'MultiLineString') layers = geom.coordinates.map(l => new Polyline(l.map(ll), st));
      else if (geom.type === 'Point') layers = [new Marker(ll(geom.coordinates), {})];
      layers.forEach(l => { l.feature = f; if (opts.onEachFeature) opts.onEachFeature(f, l); g.addLayer(l); });
    });
    return g;
  }

  // ── แผนที่แบบ Leaflet ครอบ MapLibre ──
  class LMap extends Evented {
    constructor(ml) {
      super();
      this._ml = ml;
      this._store = new VectorStore(ml);
      this._hover = null;
      this.options = { crs: { project: ll => mercProject(ll), unproject: p => mercUnproject(p) } };
      this.doubleClickZoom = { enable: () => ml.doubleClickZoom.enable(), disable: () => ml.doubleClickZoom.disable(), enabled: () => ml.doubleClickZoom.isEnabled() };
      this.dragging = { enable: () => ml.dragPan.enable(), disable: () => ml.dragPan.disable(), enabled: () => ml.dragPan.isEnabled() };
      this._bound = {};
    }
    _wrap(e) {
      const ll = e.lngLat ? new LatLng(e.lngLat.lat, e.lngLat.lng) : null;
      const pt = e.point ? new Point(e.point.x, e.point.y) : null;
      return { latlng: ll, containerPoint: pt, layerPoint: pt, originalEvent: e.originalEvent };
    }
    _bind(t) {
      if (this._bound[t]) return;
      this._bound[t] = true;
      const ml = this._ml;
      const dispatch = (type, mle) => {
        const e = this._wrap(mle);
        // เส้น/รูปที่อยู่ใต้ตำแหน่งได้รับเหตุการณ์ก่อน (stopPropagation แล้วแผนที่ไม่ได้รับ)
        if ((type === 'click' || type === 'dblclick' || type === 'contextmenu') && e.containerPoint) {
          const p = this._store.hit(e.containerPoint);
          if (p && p.listens(type)) {
            const pe = p.fire(type, e);
            if (pe && pe._stopped) return;
            if (e._stopped) return;
          }
        }
        this.fire(type, e);
      };
      if (t === 'mousedown') { ml.on('mousedown', ev => dispatch('mousedown', ev)); ml.on('touchstart', ev => { if (ev.points && ev.points.length === 1) dispatch('mousedown', ev); }); return; }
      if (t === 'mouseup') { ml.on('mouseup', ev => dispatch('mouseup', ev)); ml.on('touchend', ev => dispatch('mouseup', ev)); return; }
      if (t === 'mousemove') {
        ml.on('mousemove', ev => {
          const e = this._wrap(ev);
          const p = this._store.hit(e.containerPoint);
          if (p !== this._hover) {
            if (this._hover) this._hover.fire('mouseout', e);
            this._hover = p;
            if (p) p.fire('mouseover', e);
            ml.getCanvas().style.cursor = p && p.listens('click') ? 'pointer' : '';
          }
          this.fire('mousemove', e);
        });
        return;
      }
      if (['click', 'dblclick', 'contextmenu'].includes(t)) { ml.on(t, ev => dispatch(t, ev)); return; }
      const map = { zoomend: 'zoomend', moveend: 'moveend', zoom: 'zoom', move: 'move', movestart: 'movestart', zoomstart: 'zoomstart' };
      if (map[t]) ml.on(map[t], () => this.fire(t, {}));
    }
    on(types, fn, ctx) {
      if (typeof types === 'string') types.split(/\s+/).forEach(t => this._bind(t));
      // เส้น/รูปต้องได้ mouseover/mouseout และคลิก แม้แผนที่จะยังไม่มีผู้ฟัง
      return super.on(types, fn, ctx);
    }
    addLayer(l) { if (l._map === this) return this; if (l._map) l._map.removeLayer(l); l._add(this); if (l instanceof Path || l instanceof LayerGroup) { this._bind('click'); this._bind('dblclick'); this._bind('mousemove'); } return this; }
    removeLayer(l) { if (l && l._map === this) l._rm(); return this; }
    hasLayer(l) { return !!l && l._map === this; }
    getContainer() { return this._ml.getContainer(); }
    getZoom() { return this._ml.getZoom() + 1; }
    getCenter() { const c = this._ml.getCenter(); return new LatLng(c.lat, c.lng); }
    getBounds() { const b = this._ml.getBounds(); return new LatLngBounds([b.getSouth(), b.getWest()], [b.getNorth(), b.getEast()]); }
    getSize() { const c = this._ml.getContainer(); return new Point(c.clientWidth, c.clientHeight); }
    project(ll, z) {
      z = z === undefined ? this.getZoom() : z;
      const m = mercProject(ll), s = SCALE(z);
      return new Point(s * (TF * m.x + 0.5), s * (-TF * m.y + 0.5));
    }
    unproject(p, z) {
      z = z === undefined ? this.getZoom() : z;
      const s = SCALE(z);
      return mercUnproject(new Point((p.x / s - 0.5) / TF, (p.y / s - 0.5) / -TF));
    }
    latLngToContainerPoint(ll) { ll = toLatLng(ll); const p = this._ml.project([ll.lng, ll.lat]); return new Point(p.x, p.y); }
    containerPointToLatLng(p) { const ll = this._ml.unproject([p.x, p.y]); return new LatLng(ll.lat, ll.lng); }
    getBoundsZoom(b, inside, padding) {
      b = b instanceof LatLngBounds ? b : new LatLngBounds(b);
      const pad = padding ? Math.max(padding.x || padding[0] || 0, padding.y || padding[1] || 0) : 0;
      const cam = this._ml.cameraForBounds(b.toMapLibre(), { padding: pad });
      return cam ? cam.zoom + 1 : this.getZoom();
    }
    flyTo(c, z, o = {}) {
      c = toLatLng(c);
      this._ml.flyTo({ center: [c.lng, c.lat], zoom: z === undefined ? this._ml.getZoom() : z - 1, duration: (o.duration ?? 1.2) * 1000 });
      return this;
    }
    setView(c, z) { c = toLatLng(c); this._ml.jumpTo({ center: [c.lng, c.lat], zoom: z === undefined ? this._ml.getZoom() : z - 1 }); return this; }
    panTo(c) { c = toLatLng(c); this._ml.panTo([c.lng, c.lat]); return this; }
    fitBounds(b, o = {}) {
      b = b instanceof LatLngBounds ? b : new LatLngBounds(b);
      const pad = Array.isArray(o.padding) ? Math.max(o.padding[0], o.padding[1]) : (o.padding || 0);
      const opt = { padding: pad, duration: o.animate === false ? 0 : 600 };
      if (o.maxZoom) opt.maxZoom = o.maxZoom - 1;
      this._ml.fitBounds(b.toMapLibre(), opt);
      return this;
    }
    flyToBounds(b, o = {}) { return this.fitBounds(b, Object.assign({}, o, { animate: true })); }
    invalidateSize() { this._ml.resize(); return this; }
  }

  // ── DomEvent / DomUtil ──
  const DomEvent = {
    stopPropagation(e) {
      if (!e) return DomEvent;
      e._stopped = true;
      const oe = e.originalEvent || (e instanceof Event ? e : null);
      if (oe && oe.stopPropagation) oe.stopPropagation();
      return DomEvent;
    },
    preventDefault(e) { const oe = e && (e.originalEvent || e); if (oe && oe.preventDefault) oe.preventDefault(); return DomEvent; },
    stop(e) { DomEvent.stopPropagation(e); return DomEvent.preventDefault(e); },
    disableClickPropagation(el) {
      ['click', 'dblclick', 'mousedown', 'touchstart'].forEach(t => el.addEventListener(t, ev => ev.stopPropagation(), { passive: t === 'touchstart' }));
      // แผงเครื่องมือ: กดค้างไม่ให้เมนูของระบบเด้ง (ช่องกรอกข้อความยังใช้เมนูคัดลอก/วางได้)
      el.addEventListener('contextmenu', ev => {
        ev.stopPropagation();
        if (!ev.target.closest('input, textarea, select, [contenteditable]')) ev.preventDefault();
      });
      return DomEvent;
    },
    disableScrollPropagation(el) { el.addEventListener('wheel', ev => ev.stopPropagation(), { passive: true }); return DomEvent; },
    on(el, t, fn, ctx) { t.split(/\s+/).forEach(x => el.addEventListener(x, ev => fn.call(ctx || el, ev))); return DomEvent; },
    off() { return DomEvent; }
  };
  const DomUtil = {
    create(tag, cls, parent) { const el = document.createElement(tag); if (cls) el.className = cls; if (parent) parent.appendChild(el); return el; },
    addClass(el, c) { if (el && el.classList) c.split(/\s+/).filter(Boolean).forEach(x => el.classList.add(x)); },
    removeClass(el, c) { if (el && el.classList) c.split(/\s+/).filter(Boolean).forEach(x => el.classList.remove(x)); },
    hasClass(el, c) { return !!(el && el.classList && el.classList.contains(c)); },
    remove(el) { if (el && el.parentNode) el.parentNode.removeChild(el); }
  };

  const L = {
    version: 'bpnp-lcompat',
    latLng: toLatLng, LatLng, point: (x, y) => new Point(x, y), Point,
    latLngBounds: (a, b) => (a instanceof LatLngBounds ? a : new LatLngBounds(a, b)), LatLngBounds,
    polyline: (ll, o) => new Polyline(ll, o), polygon: (ll, o) => new Polygon(ll, o),
    rectangle: (b, o) => new Rectangle(b, o), circle: (c, o) => new Circle(c, typeof o === 'number' ? { radius: o } : o),
    marker: (ll, o) => new Marker(ll, o), divIcon: o => new DivIcon(o), DivIcon,
    layerGroup: l => new LayerGroup(l), featureGroup: l => new FeatureGroup(l), LayerGroup, FeatureGroup,
    geoJSON, GeoJSON: { coordsToLatLng: c => toLatLng([c[1], c[0]]) },
    DomEvent, DomUtil, Polyline, Polygon, Circle, Marker
  };

  let wrapped = null;
  BPNP.tools.lcompat = {
    L,
    // แผนที่แบบ Leaflet ตัวเดียวต่อแอป (ใช้ร่วมกันทั้ง mp / mpex / mpem)
    map() { if (!wrapped) wrapped = new LMap(BPNP.map.instance); return wrapped; },
    mercProject
  };
})();
