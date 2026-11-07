/* js/tools/drainage/drainage_render_test.js — รัน: node drainage_render_test.js
 * ใช้แผนที่/Marker/document จำลอง ตรวจพฤติกรรมของ DrainageRender (ไม่ได้ทดสอบกับ MapLibre จริง)
 */
'use strict';
const assert = require('assert');
const R = require('./drainage_render.js');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('✓ ' + name); }
  catch (e) { failed++; console.log('✗ ' + name + '\n    ' + e.message); }
}

class MockMap {
  constructor() { this.sources = new Map(); this.layers = []; this.styleLoaded = true; this.handlers = {}; this.bearing = 0; this.setDataCalls = 0; }
  getBearing() { return this.bearing; }
  moveLayer(id, before) {
    const i = this.layers.findIndex(l => l.id === id); if (i < 0) throw new Error('layer missing');
    const [l] = this.layers.splice(i, 1);
    const j = before ? this.layers.findIndex(x => x.id === before) : -1;
    if (j < 0) this.layers.push(l); else this.layers.splice(j, 0, l);
  }
  idx(id) { return this.layers.findIndex(l => l.id === id); }
  _need() { if (!this.styleLoaded) throw new Error('Style is not done loading'); }
  getSource(id) { return this.sources.get(id); }
  addSource(id, spec) {
    this._need();
    const s = { spec, data: spec.data, setData: d => { s.data = d; this.setDataCalls++; } };
    this.sources.set(id, s);
  }
  getLayer(id) { return this.layers.find(l => l.id === id); }
  addLayer(spec, before) {
    this._need();
    if (before) {
      const i = this.layers.findIndex(l => l.id === before);
      if (i < 0) throw new Error('before layer missing');
      this.layers.splice(i, 0, spec);
    } else this.layers.push(spec);
  }
  removeLayer(id) { this.layers = this.layers.filter(l => l.id !== id); }
  removeSource(id) { this.sources.delete(id); }
  on(ev, fn) { (this.handlers[ev] = this.handlers[ev] || []).push(fn); }
  off(ev, fn) { this.handlers[ev] = (this.handlers[ev] || []).filter(f => f !== fn); }
  once(ev, fn) { const w = () => { this.off(ev, w); fn(); }; this.on(ev, w); }
  fire(ev) { (this.handlers[ev] || []).slice().forEach(f => f()); }
  resetStyle() { this.sources.clear(); this.layers = []; }
}
class MockMarker {
  constructor(opts) { this.opts = opts; this.removed = false; MockMarker.all.push(this); }
  setLngLat(c) { this.lngLat = c; return this; }
  addTo() { return this; }
  remove() { this.removed = true; }
}
MockMarker.all = [];
global.document = { createElement: () => ({ style: {}, children: [], textContent: '', appendChild(c) { this.children.push(c); } }) };
const labelText = root => root.children[0].children.map(c => c.textContent).join(' ');
const arrowOf = root => root.children[0].children[0];
const lib = { Marker: MockMarker };

const line = coords => ({ type: 'Feature', properties: { accM2: 1, widthPx: 2 }, geometry: { type: 'LineString', coordinates: coords } });
const outlet = (id, a) => ({ type: 'Feature', properties: { id, areaM2: a, bearing: 180 }, geometry: { type: 'Point', coordinates: [100 + id, 15] } });

test('1 setStreams: สร้าง source และ 7 ชั้น พร้อม property kind', () => {
  const m = new MockMap();
  const r = R.create(m, { maplibregl: lib });
  r.setStreams({ type: 'FeatureCollection', features: [line([[100, 15], [100.1, 15.1]])] });
  assert.ok(m.getSource('src-drainage'));
  assert.strictEqual(m.layers.length, 7);
  const feats = m.getSource('src-drainage').data.features;
  assert.strictEqual(feats.length, 1);
  assert.strictEqual(feats[0].properties.kind, 'stream');
  assert.strictEqual(feats[0].properties.widthPx, 2);
});

test('2 beforeId: ชั้น drainage ถูกวางก่อน layer ที่กำหนด', () => {
  const m = new MockMap();
  m.addLayer({ id: 'tools-anchor' });
  const r = R.create(m, { maplibregl: lib, beforeId: () => 'tools-anchor' });
  r.setBasin({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] } });
  const anchor = m.layers.findIndex(l => l.id === 'tools-anchor');
  r.layerIds.forEach(id => assert.ok(m.layers.findIndex(l => l.id === id) < anchor, id + ' ต้องอยู่ก่อน anchor'));
});

test('3 เรียกซ้ำไม่ซ้อนชั้น (idempotent)', () => {
  const m = new MockMap();
  const r = R.create(m, { maplibregl: lib });
  r.setStreams({ features: [] }); r.refresh(); r.refresh(); r.setFlowPath(null);
  assert.strictEqual(m.layers.length, 7);
});

test('4 style ถูกโหลดใหม่ (setStyle): เติม source/ชั้นกลับพร้อมข้อมูลล่าสุด', () => {
  const m = new MockMap();
  const r = R.create(m, { maplibregl: lib });
  r.setStreams({ features: [line([[100, 15], [100.1, 15.1]])] });
  m.resetStyle();
  assert.strictEqual(m.layers.length, 0);
  m.fire('style.load');
  assert.strictEqual(m.layers.length, 7);
  assert.strictEqual(m.getSource('src-drainage').data.features.length, 1);
});

test('5 style ยังไม่พร้อมตอนสั่งวาด: ไม่พัง และวาดให้เมื่อ style.load', () => {
  const m = new MockMap();
  m.styleLoaded = false;
  const r = R.create(m, { maplibregl: lib });
  r.setStreams({ features: [line([[100, 15], [100.1, 15.1]])] });
  assert.strictEqual(m.layers.length, 0);
  m.styleLoaded = true;
  m.fire('style.load');
  assert.strictEqual(m.layers.length, 7);
  assert.strictEqual(m.getSource('src-drainage').data.features.length, 1);
});

test('6 ป้ายจุดออก: สร้างตามจำนวน ใช้ formatArea ที่ส่งมา รากไม่มี class/position และถูกแทนที่เมื่อตั้งใหม่', () => {
  MockMarker.all.length = 0;
  const m = new MockMap();
  const r = R.create(m, { maplibregl: lib, formatArea: a => 'A' + Math.round(a) });
  r.setOutlets({ features: [outlet(1, 1500), outlet(2, 2500)] });
  assert.strictEqual(MockMarker.all.length, 2);
  const root = MockMarker.all[0].opts.element;
  assert.ok(!root.className, 'รากต้องไม่มี class');
  assert.ok(!root.style.position, 'รากต้องไม่มี position');
  assert.ok(labelText(root).includes('A1500'));
  assert.strictEqual(MockMarker.all[0].opts.anchor, 'left');
  r.setOutlets({ features: [outlet(3, 10)] });
  assert.ok(MockMarker.all[0].removed && MockMarker.all[1].removed, 'ป้ายเก่าต้องถูกลบ');
  assert.strictEqual(MockMarker.all.filter(x => !x.removed).length, 1);
});

test('7 clear: ข้อมูลว่างและป้ายถูกลบ', () => {
  MockMarker.all.length = 0;
  const m = new MockMap();
  const r = R.create(m, { maplibregl: lib });
  r.setStreams({ features: [line([[0, 0], [1, 1]])] });
  r.setOutlets({ features: [outlet(1, 100)] });
  r.setPour({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [0, 0] } });
  assert.strictEqual(m.getSource('src-drainage').data.features.length, 3);
  r.clear();
  assert.strictEqual(m.getSource('src-drainage').data.features.length, 0);
  assert.ok(MockMarker.all.every(x => x.removed));
});

test('8 clearClickResults: ล้างเฉพาะผลโหมดคลิก (ลุ่มน้ำ/เส้นทาง/จุดปลายน้ำ)', () => {
  const m = new MockMap();
  const r = R.create(m, { maplibregl: lib });
  r.setStreams({ features: [line([[0, 0], [1, 1]])] });
  r.setFlowPath(line([[0, 0], [2, 2]]));
  r.setPour({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [0, 0] } });
  r.clearClickResults();
  const kinds = m.getSource('src-drainage').data.features.map(f => f.properties.kind);
  assert.deepStrictEqual(kinds, ['stream']);
});

test('9 destroy: ถอดชั้น/source/ป้าย และไม่ตอบสนอง style.load อีก', () => {
  MockMarker.all.length = 0;
  const m = new MockMap();
  const r = R.create(m, { maplibregl: lib });
  r.setOutlets({ features: [outlet(1, 100)] });
  r.destroy();
  assert.strictEqual(m.layers.length, 0);
  assert.ok(!m.getSource('src-drainage'));
  assert.ok(MockMarker.all.every(x => x.removed));
  m.fire('style.load');
  assert.strictEqual(m.layers.length, 0, 'หลัง destroy ต้องไม่เติมกลับ');
});

test('10 ลำดับชั้น: อยู่เหนือ mp-fill แต่ใต้ mp-line / mp-line-dash (ขอบ polygon บนสุด)', () => {
  const m = new MockMap();
  ['mp-glow', 'mp-fill', 'mp-line', 'mp-line-dash', 'slot-labels'].forEach(id => m.addLayer({ id }));
  const r = R.create(m, { maplibregl: lib });
  r.setStreams({ features: [] });
  r.layerIds.forEach(id => {
    assert.ok(m.idx(id) > m.idx('mp-fill'), id + ' ต้องอยู่เหนือ mp-fill');
    assert.ok(m.idx(id) < m.idx('mp-line'), id + ' ต้องอยู่ใต้ mp-line');
  });
});

test('11 เครื่องมือวัดสร้างชั้นทีหลัง: อัปเดตครั้งถัดไปย้าย drainage ลงใต้ mp-line', () => {
  const m = new MockMap();
  m.addLayer({ id: 'slot-labels' });
  global.BPNP = { map: { registry: { beforeIdFor: s => (s === 'tools' ? 'slot-labels' : undefined) } } };
  try {
  const r = R.create(m, { maplibregl: lib });
  r.setStreams({ features: [] });
  assert.ok(m.idx('dr-streams') < m.idx('slot-labels'), 'ยังไม่มี mp-line → วางก่อน slot ของ tools');
  const i = m.idx('slot-labels');
  m.layers.splice(i, 0, { id: 'mp-fill' }, { id: 'mp-line' });   // เครื่องมือวัดวางชั้นของตัวเองก่อน slot-labels
  assert.ok(m.idx('dr-streams') < m.idx('mp-fill'));
  r.setFlowPath(null);
  r.layerIds.forEach(id => assert.ok(m.idx(id) < m.idx('mp-line') && m.idx(id) > m.idx('mp-fill'), id));
  assert.strictEqual(m.layers.length, 7 + 3);
  } finally { delete global.BPNP; }
});

test('12 ลูกศรจุดออกหักมุม bearing ของแผนที่ และอัปเดตเมื่อหมุน', () => {
  MockMarker.all.length = 0;
  const m = new MockMap();
  m.bearing = 30;
  const r = R.create(m, { maplibregl: lib });
  r.setOutlets({ features: [outlet(1, 100)] });                 // bearing ของจุดออก = 180 (ใต้)
  const a = arrowOf(MockMarker.all[0].opts.element);
  assert.strictEqual(a.style.transform, 'rotate(60deg)');       // 180 − 90 − 30
  m.bearing = -45; m.fire('rotate');
  assert.strictEqual(a.style.transform, 'rotate(135deg)');      // 180 − 90 + 45
  r.destroy(); m.bearing = 0; m.fire('rotate');
  assert.strictEqual(a.style.transform, 'rotate(135deg)', 'หลัง destroy ต้องไม่อัปเดต');
});

test('13 error อื่นที่ไม่ใช่ style ยังไม่พร้อม: แจ้งเตือน ไม่รอ style.load', () => {
  const m = new MockMap();
  m.addSource = () => { throw new Error('bad spec'); };
  const warns = []; const ow = console.warn; console.warn = (...a) => warns.push(a.join(' '));
  try {
    const r = R.create(m, { maplibregl: lib });
    r.setStreams({ features: [] });
  } finally { console.warn = ow; }
  assert.strictEqual(warns.length, 1);
  assert.strictEqual((m.handlers['style.load'] || []).length, 1, 'มีเฉพาะตัวฟังหลัก ไม่มีตัวรอเพิ่ม');
});

test('14 สร้าง source ครั้งแรกไม่ setData ซ้ำ', () => {
  const m = new MockMap();
  const r = R.create(m, { maplibregl: lib });
  r.setStreams({ features: [line([[0, 0], [1, 1]])] });
  assert.strictEqual(m.setDataCalls, 0);
  r.setBasin(null);
  assert.strictEqual(m.setDataCalls, 1);
});

test('15 ความหนาเส้นใช้ coalesce กัน widthPx ว่าง', () => {
  const s = JSON.stringify(R.LAYERS.find(l => l.id === 'dr-streams').paint['line-width']);
  assert.ok(s.includes('"coalesce",["get","widthPx"],1'));
});

console.log('\nผ่าน ' + passed + ' / ไม่ผ่าน ' + failed);
process.exit(failed ? 1 : 0);
