/* js/tools/search/utm_multi.js
 * ─────────────────────────────────────────────────────────────────────────
 * เฟส 5B: แปลงค่า UTM / LatLng หลายแถว (เดิม convertUTM_MultiRow.js) — เปิดจากแผงค้นหา/พิกัด
 *   ตาราง 2 แท็บ · เพิ่มแถวได้ · วางข้อมูลจาก Excel หลายแถว/หลายคอลัมน์ได้ · หมุดลำดับต่อแถว · ปุ่มซูมให้เห็นทุกจุด
 *   คัดลอกจากต้นฉบับ แก้เฉพาะคำสั่งแผนที่ (หมุด/ซูม) และสูตรแปลงผ่าน BPNP.geo
 * แก้จากเดิม: ต้นฉบับเรียก createTxtMarker() ซึ่งไม่มีอยู่ในโค้ด → กรอกข้อมูลถูกต้องแล้วเกิด error ไม่มีหมุด
 *            และปุ่มซูมแท็บ UTM ไม่ทำงาน → เพิ่มหมุดลำดับ (วงกลมน้ำเงินเลขแถว)
 * CSS: css/tools/utm_multi.css (+ .utm-row-marker ใน search_hub.css)
 * ───────────────────────────────────────────────────────────────────────── */
'use strict';
(function () {
let multi_Markers = [];

// หมุดเลขแถว (ราก = .utm-row-marker ไม่มี position/transform — กติกาหัวข้อ 19)
function createTxtMarker(lat, lng, n) {
    const el = document.createElement('div');
    el.className = 'utm-row-marker';
    el.textContent = String(n);
    return new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([lng, lat]).addTo(BPNP.map.instance);
}

function createConvertPanel_MultiRow() {
    const oldPanel = document.getElementById('convertPanel');
    const oldPanelMulti = document.getElementById('multiConvertPanel');
    if (oldPanel) oldPanel.remove();
    if (oldPanelMulti) oldPanelMulti.remove();

    const panel = document.createElement('div');
    panel.id = 'multiConvertPanel';
    panel.className = 'multi-convert-panel';
    panel.innerHTML = `
        <div class="multi-convert-header">
            <h3>แปลงค่า UTM / LatLng (Multi Row)</h3>
            <button id="multiCloseBtn">✖</button>
        </div>
        <div class="multi-convert-tabs">
            <button class="multi-tab-btn active" data-tab="multi-latlng">Lat/Lng → UTM</button>
            <button class="multi-tab-btn" data-tab="multi-utm">UTM → Lat/Lng</button>
        </div>
        <div class="multi-convert-body">
            <div id="multi-latlng" class="multi-tab-content active">
                <table class="multi-convert-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Latitude, Longitude :</th>
                            <th>N (คำนวณ)</th>
                            <th>E (คำนวณ)</th>
                        </tr>
                    </thead>
                    <tbody id="latlngTbody"></tbody>
                </table>
                <button id="addLatLngRowBtn">+ เพิ่มแถว</button>
                <div class="multi-btn-row">
                    <button id="multiConvertToUTMBtn">ซูม🔎</button>
                    <button id="multiResetLatLngBtn">รีเซ็ต</button>
                </div>
            </div>

            <div id="multi-utm" class="multi-tab-content">
                <table class="multi-convert-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Northing (N):</th>
                            <th>Easting (E):</th>
                            <th>Lat,Lng (คำนวณ)</th>
                        </tr>
                    </thead>
                    <tbody id="utmTbody"></tbody>
                </table>
                <button id="addUTMRowBtn">+ เพิ่มแถว</button>
                <div class="multi-radio-group">
                    <label><input type="radio" name="multiZone" value="47"> Zone 47N</label>
                    <label><input type="radio" name="multiZone" value="48" checked> Zone 48N</label>
                </div>
                <div class="multi-btn-row">
                    <button id="multiConvertToLatLngBtn">🔍ซูม</button>
                    <button id="multiResetUTMBtn">รีเซ็ต</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(panel);
    BPNP.tools.utils.blockMap(panel);
    panel.addEventListener('keydown', e => e.stopPropagation());

    // ปิด panel
    document.getElementById('multiCloseBtn').addEventListener('click', () => {
        multi_Markers.forEach(m => { if (m) m.remove(); });
        multi_Markers = [];
        panel.remove();
    });

    // Tab
    panel.querySelectorAll(".multi-tab-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const tabName = btn.getAttribute("data-tab");
            panel.querySelectorAll(".multi-tab-btn").forEach(b => b.classList.remove("active"));
            panel.querySelectorAll(".multi-tab-content").forEach(tc => tc.classList.remove("active"));
            btn.classList.add("active");
            panel.querySelector(`#${tabName}`).classList.add("active");

            // ✅ รีเฟรช marker ให้ตรงกับ tab ที่เลือก
            refreshMarkers(tabName);
        });
    });

    // =======================
    // Helper: Add Row
    // =======================
    function addLatLngRow(val="") {
        const tbody = document.getElementById("latlngTbody");
        const idx = tbody.rows.length + 1;
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${idx}</td>
            <td><input type="text" id="multiLatlngInput_${idx}" value="${val}" placeholder="กรอกละติจูด,ลองจิจูด"></td>
            <td id="multiUtmN_${idx}"></td>
            <td id="multiUtmE_${idx}"></td>
        `;
        tbody.appendChild(tr);
        multi_Markers[idx-1] = null;

        const input = tr.querySelector("input");
        input.addEventListener("input", () => updateUTM(idx));
        return input;
    }

    function addUTMRow(NVal="",EVal="") {
        const tbody = document.getElementById("utmTbody");
        const idx = tbody.rows.length + 1;
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${idx}</td>
            <td><input type="text" id="multiUtmNInput_${idx}" value="${NVal}" placeholder="N"></td>
            <td><input type="text" id="multiUtmEInput_${idx}" value="${EVal}" placeholder="E"></td>
            <td id="multiLatlngResult_${idx}"></td>
        `;
        tbody.appendChild(tr);
        multi_Markers[idx-1] = null;

        const inputN = tr.querySelector(`#multiUtmNInput_${idx}`);
        const inputE = tr.querySelector(`#multiUtmEInput_${idx}`);
        inputN.addEventListener("input", ()=> updateLatLng(idx));
        inputE.addEventListener("input", ()=> updateLatLng(idx));
        return [inputN,inputE];
    }

    // =======================
    // Init 3 rows
    for(let i=0;i<3;i++) addLatLngRow();
    for(let i=0;i<3;i++) addUTMRow();

    document.getElementById("addLatLngRowBtn").addEventListener("click", ()=> addLatLngRow());
    document.getElementById("addUTMRowBtn").addEventListener("click", ()=> addUTMRow());

    // =======================
    // Paste Support (fixed)
    // =======================
    document.getElementById("latlngTbody").addEventListener("paste", function(e){
        const target = e.target;
        if(target.tagName!=="INPUT") return;
        e.preventDefault();
        const text = (e.clipboardData || window.clipboardData).getData("text");
        const rows = text.split(/\r?\n/).filter(r=>r.trim()!=="");

        let startRow = target.closest("tr").sectionRowIndex;

        rows.forEach((rowText,r)=>{
            const val=rowText.split("\t")[0]; 
            const rowIdx=startRow+r+1;
            let input=document.getElementById(`multiLatlngInput_${rowIdx}`);
            if(!input) input=addLatLngRow(val);
            else input.value=val;
            input.dispatchEvent(new Event("input"));
        });
    });

    document.getElementById("utmTbody").addEventListener("paste", function(e){
        const target = e.target;
        if(target.tagName!=="INPUT") return;
        e.preventDefault();
        
        const text = (e.clipboardData || window.clipboardData).getData("text");
        const rows = text.split(/\r?\n/).filter(r=>r.trim()!=="");
        
        const currentRow = target.closest("tr");
        const tbody = document.getElementById("utmTbody");
        const allRows = Array.from(tbody.querySelectorAll("tr"));
        const startRowIndex = allRows.indexOf(currentRow);
        
        const isEastingField = target.id.includes("multiUtmEInput");
        const isNorthingField = target.id.includes("multiUtmNInput");
        
        rows.forEach((rowText, r) => {
            const cols = rowText.split("\t");
            const targetIdx = startRowIndex + r + 1;
            
            let inputN = document.getElementById(`multiUtmNInput_${targetIdx}`);
            let inputE = document.getElementById(`multiUtmEInput_${targetIdx}`);
            
            if (!inputN || !inputE) {
                if (isNorthingField) {
                    addUTMRow(cols[0] ? cols[0].trim() : "", "");
                } else if (isEastingField) {
                    addUTMRow("", cols[0] ? cols[0].trim() : "");
                } else {
                    const N = cols[0] ? cols[0].trim() : "";
                    const E = cols[1] ? cols[1].trim() : "";
                    addUTMRow(N, E);
                }
            } else {
                if (isNorthingField) {
                    inputN.value = cols[0] ? cols[0].trim() : "";
                } else if (isEastingField) {
                    inputE.value = cols[0] ? cols[0].trim() : "";
                } else {
                    inputN.value = cols[0] ? cols[0].trim() : "";
                    inputE.value = cols[1] ? cols[1].trim() : "";
                }
                inputN.dispatchEvent(new Event("input"));
            }
        });
    });

    // =======================
    // Conversion Functions
    // =======================
    function updateUTM(i){
        const input=document.getElementById(`multiLatlngInput_${i}`);
        const cellN=document.getElementById(`multiUtmN_${i}`);
        const cellE=document.getElementById(`multiUtmE_${i}`);
        cellN.style.color=""; cellE.style.color="";
        const val=input.value.trim();
        if(!val){ 
            cellN.innerText=""; 
            cellE.innerText=""; 
            if(multi_Markers[i-1]) multi_Markers[i-1].remove(); 
            multi_Markers[i-1]=null; 
            return; 
        }
        const parts=val.split(",");
        if(parts.length===2){
            const lat=parseFloat(parts[0].trim()), lng=parseFloat(parts[1].trim());
            if(!isNaN(lat)&&!isNaN(lng)&&lat>=-90&&lat<=90&&lng>=-180&&lng<=180){
                const result=BPNP.geo.latLngToUTM(lat,lng);
                if(result){
                    cellN.innerText=result.northing.toFixed(3);
                    cellE.innerText=result.easting.toFixed(3);
                    if(multi_Markers[i-1]) multi_Markers[i-1].remove();
                    multi_Markers[i-1]=createTxtMarker(lat,lng,i);
                    return;
                }
            }
        }
        cellN.innerText="ข้อมูลไม่ถูกต้อง"; 
        cellE.innerText=""; 
        cellN.style.color="red";
    }

    function updateLatLng(i){
        const inputN=document.getElementById(`multiUtmNInput_${i}`);
        const inputE=document.getElementById(`multiUtmEInput_${i}`);
        const cell=document.getElementById(`multiLatlngResult_${i}`);
        cell.style.color="";
        const valN=inputN.value.trim(), valE=inputE.value.trim();
        if(!valN||!valE){ 
            cell.innerText=""; 
            if(multi_Markers[i-1]) multi_Markers[i-1].remove(); 
            multi_Markers[i-1]=null; 
            return; 
        }
        const N=parseFloat(valN), E=parseFloat(valE);
        const zone=document.querySelector('input[name="multiZone"]:checked').value;
        if(!isNaN(N)&&!isNaN(E)){
            const result=BPNP.geo.utmToLatLng(E,N,parseInt(zone,10));
            if(result){
                const {lat,lng}=result;
                cell.innerText=`${lat.toFixed(6)}, ${lng.toFixed(6)}`;
                if(multi_Markers[i-1]) multi_Markers[i-1].remove();
                multi_Markers[i-1]=createTxtMarker(lat,lng,i);
                return;
            }
        }
        cell.innerText="ข้อมูลไม่ถูกต้อง"; 
        cell.style.color="red";
    }

    // =======================
    // Buttons
    // =======================
    document.getElementById("multiConvertToUTMBtn").addEventListener("click", ()=>{
        document.querySelectorAll("#latlngTbody input").forEach(input=>input.dispatchEvent(new Event("input")));
        zoomToValidMarkers('latlng');
    });

    document.getElementById("multiResetLatLngBtn").addEventListener("click", ()=>{
        document.querySelectorAll("#latlngTbody input").forEach(input=>input.value="");
        document.querySelectorAll("#latlngTbody td[id^='multiUtm']").forEach(td=>{td.innerText=""; td.style.color="";});
        multi_Markers.forEach(m=>{if(m) m.remove();});
        multi_Markers=[];
    });

    document.getElementById("multiConvertToLatLngBtn").addEventListener("click", ()=>{
        document.querySelectorAll("#utmTbody input").forEach(input=>input.dispatchEvent(new Event("input")));
        zoomToValidMarkers('utm');
    });

    document.getElementById("multiResetUTMBtn").addEventListener("click", ()=>{
        document.querySelectorAll("#utmTbody input").forEach(input=>input.value="");
        document.querySelectorAll("#utmTbody td[id^='multiLatlngResult']").forEach(td=>{td.innerText=""; td.style.color="";});
        multi_Markers.forEach(m=>{if(m) m.remove();});
        multi_Markers=[];
    });

    // =======================
    // Zoom helper
    // =======================
    function zoomToValidMarkers(tab){
        const pts=[];
        if(tab==='latlng'){
            document.querySelectorAll("#latlngTbody input").forEach(input=>{
                const parts=input.value.trim().split(",");
                if(parts.length===2){
                    const lat=parseFloat(parts[0]), lng=parseFloat(parts[1]);
                    if(!isNaN(lat)&&!isNaN(lng)) pts.push([lat,lng]);
                }
            });
        } else if(tab==='utm'){
            multi_Markers.forEach(m=>{ if(m){ const p=m.getLngLat(); pts.push([p.lat,p.lng]); } });
        }
        if(pts.length) BPNP.tools.utils.fitPoints(pts,{padding:50,duration:1500});
    }

    // =======================
    // Refresh markers by tab
    // =======================
    function refreshMarkers(tabName){
        // clear markers ก่อน
        multi_Markers.forEach(m => { if (m) m.remove(); });
        multi_Markers = [];

        if(tabName==="multi-latlng"){
            document.querySelectorAll("#latlngTbody input").forEach((input,i)=>{
                if(input.value.trim()) updateUTM(i+1);
            });
        } else if(tabName==="multi-utm"){
            document.querySelectorAll("#utmTbody tr").forEach((tr,i)=>{
                const N=tr.querySelector(`#multiUtmNInput_${i+1}`);
                const E=tr.querySelector(`#multiUtmEInput_${i+1}`);
                if(N && E && (N.value.trim() || E.value.trim())) updateLatLng(i+1);
            });
        }
    }
}

function closeMultiPanel() {
    multi_Markers.forEach(m => { if (m) m.remove(); });
    multi_Markers = [];
    const p = document.getElementById('multiConvertPanel');
    if (p) p.remove();
}

BPNP.tools.utmMulti = { open: createConvertPanel_MultiRow, close: closeMultiPanel };
window.createConvertPanel_MultiRow = createConvertPanel_MultiRow;   // ชื่อเดิม
})();
