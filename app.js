
const THAI_MONTHS = {'ม.ค.':'01','ก.พ.':'02','มี.ค.':'03','เม.ย.':'04','พ.ค.':'05','มิ.ย.':'06','ก.ค.':'07','ส.ค.':'08','ก.ย.':'09','ต.ค.':'10','พ.ย.':'11','ธ.ค.':'12'};
const THAI_DIGITS = {'๐':'0','๑':'1','๒':'2','๓':'3','๔':'4','๕':'5','๖':'6','๗':'7','๘':'8','๙':'9'};

function toArabic(s){ return s.replace(/[๐-๙]/g, d=>THAI_DIGITS[d]||d); }

function parseDate(s){
  s=toArabic(s.trim());
  Object.entries(THAI_MONTHS).forEach(([t,n])=>{s=s.replace(t,n);});
  const p=s.split(' ');
  if(p.length===3){try{return `${+p[2]-543}-${p[1]}-${p[0].padStart(2,'0')}`;}catch(e){}}
  if(/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return '';
}

function parseCSV(text){
  const lines=text.replace(/\r/g,'').split('\n').filter(Boolean);
  const header=lines[0].replace(/^\uFEFF/,'').split(',').map(h=>h.trim());
  const toInt=(v,d=0)=>{const n=parseFloat(v);return isNaN(n)?d:Math.round(n);};
  return lines.slice(1).map(line=>{
    const cols=[];let cur='',inQ=false;
    for(const ch of line+','){
      if(ch==='"'){inQ=!inQ;continue;}
      if(ch===','&&!inQ){cols.push(cur.trim());cur='';continue;}
      cur+=ch;
    }
    const r={};header.forEach((h,i)=>r[h]=(cols[i]||'').trim());
    return {
      'ลำดับ':toInt(r['ลำดับ']),
      'วันที่':r['วันที่']||'',
      'เวลาเริ่ม':r['เวลาเริ่ม']||'',
      'เวลาสิ้นสุด':r['เวลาสิ้นสุด']||'',
      'ระยะเวลาดับ_นาที':Math.max(0, toInt(r['ระยะเวลาดับ_นาที'])),
      'สถานที่':r['สถานที่']||'',
      'รหัสอุปกรณ์':r['รหัสอุปกรณ์']||'',
      'จำนวนผชฟ_กระทบ':Math.max(0, toInt(r['จำนวนผชฟ_กระทบ'])),
      'สภาพอากาศ':r['สภาพอากาศ']||'',
      'สาเหตุ':r['สาเหตุ']||'',
      'ช่องทางการแจ้ง':r['ช่องทางการแจ้ง']||'',
      'เวลารับแจ้ง':r['เวลารับแจ้ง']||'',
      'เวลาออกปฏิบัติงาน':r['เวลาออกปฏิบัติงาน']||'',
      'เวลาเสร็จงาน':r['เวลาเสร็จงาน']||'',
      'เวลาแก้ไข_นาที':Math.max(0, toInt(r['เวลาแก้ไข_นาที'])),
      'ผู้ปฏิบัติงาน':r['ผู้ปฏิบัติงาน']||'',
      'ยานพาหนะ':r['ยานพาหนะ']||'',
      'อุปกรณ์_รายการ':r['อุปกรณ์_รายการ']||'',
      'อุปกรณ์_จำนวน':r['อุปกรณ์_จำนวน']||'',
      'หมายเหตุ':r['หมายเหตุ']||'',
      'date_iso': parseDate(r['date_iso']||r['วันที่']||''),
    };
  }).filter(r => r['ลำดับ'] > 0);
}

// ── Code type classifiers (global so all functions can use) ──
function isEquipCode(code) { return /[A-Za-z]/.test(code); }
function isMeterCode(code) { return /^\d+$/.test(code); }
function isTransCode(code) { return !!(code && !isEquipCode(code) && !isMeterCode(code)); }

const DATA = [];
let filtered = [];
let selectedMonth = null;

document.body.insertAdjacentHTML('beforeend',`
  <div id="loading" style="position:fixed;inset:0;background:#0f1117;display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:9999;gap:12px">
    <div style="font-size:32px">⚡</div>
    <div style="color:#e8eaf0;font-size:15px;font-weight:600">กำลังโหลดข้อมูล...</div>
    <div style="color:#8b90a8;font-size:12px">event_outage_data.csv</div>
  </div>`);

const base = location.pathname.replace(/\/[^/]*$/, '/');
const csvPaths = [
  base + 'event_outage_data.csv',
  './event_outage_data.csv',
  '/event_outage_data.csv'
];

function tryFetch(paths) {
  if(!paths.length) {
    document.getElementById('loading').innerHTML =
      `<div style="color:#ef5350;font-size:15px;font-weight:600">❌ ไม่พบไฟล์ event_outage_data.csv</div>
       <div style="color:#8b90a8;font-size:12px;margin-top:8px">ตรวจสอบว่าอัพโหลด event_outage_data.csv เข้า GitHub repo แล้ว</div>
       <div style="color:#8b90a8;font-size:11px;margin-top:4px">URL: ${location.href}</div>`;
    return;
  }
  const path = paths[0];
  fetch(path)
    .then(r => { if(!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); })
    .then(text => {
      if(text.trim().startsWith('<')) throw new Error('ได้รับ HTML แทน CSV');
      const records = parseCSV(text);
      if(!records.length) throw new Error('CSV ว่างเปล่า');
      records.forEach(r => DATA.push(r));
      document.getElementById('loading').remove();
      init();
    })
    .catch(() => tryFetch(paths.slice(1)));
}

tryFetch(csvPaths);

// ── Click-to-filter from bar charts ──
// selectId = 'equipSel' | 'transSel' | 'meterSel' | 'locationSel'
function clickBarFilter(selectId, value) {
  if(selectId === 'locationSel') {
    document.getElementById('locationSel').value = value;
    rebuildCodeSelects(value);
  } else {
    document.getElementById(selectId).value = value;
  }
  applyFilters();
}

function resetFilters() {
  selectedMonth = null;
  document.getElementById('locationSel').value = 'all';
  document.getElementById('dateFrom').value = window._minDate || '';
  document.getElementById('dateTo').value = window._maxDate || '';
  document.getElementById('equipSel').value = '';
  document.getElementById('transSel').value = '';
  document.getElementById('meterSel').value = '';
  rebuildCodeSelects('all');
  applyFilters();
}

function filterByMonth(monthKey) {
  selectedMonth = (selectedMonth === monthKey) ? null : monthKey; // toggle
  applyFilters();
}

function rebuildCodeSelects(locFilter, keepEq='', keepTr='', keepMt='') {
  const eFreq={}, tFreq={}, mFreq={};
  DATA.forEach(r => {
    if(locFilter && locFilter!=='all' && r['สถานที่']!==locFilter) return;
    const code = (r['รหัสอุปกรณ์']||'').trim();
    if(!code) return;
    if(isEquipCode(code))      eFreq[code] = (eFreq[code]||0)+1;
    else if(isMeterCode(code)) mFreq[code] = (mFreq[code]||0)+1;
    else                       tFreq[code] = (tFreq[code]||0)+1;
  });

  function fillSel(selId, freq, keep) {
    const sel = document.getElementById(selId);
    const prev = keep !== undefined ? keep : sel.value;
    sel.innerHTML = '<option value="">ทั้งหมด</option>';
    Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,60).forEach(([code,cnt])=>{
      const o = document.createElement('option');
      o.value = code;
      o.textContent = `${code} (${cnt})`;
      sel.appendChild(o);
    });
    if(prev && freq[prev]) sel.value = prev;
  }

  fillSel('equipSel', eFreq, keepEq);
  fillSel('transSel', tFreq, keepTr);
  fillSel('meterSel', mFreq, keepMt);
}

function applyFilters() {
  const loc = document.getElementById('locationSel').value;
  const eq  = document.getElementById('equipSel').value;
  const tr  = document.getElementById('transSel').value;
  const mt  = document.getElementById('meterSel').value;

  let from, to;
  if(selectedMonth) {
    const [y,m] = selectedMonth.split('-').map(Number);
    from = `${selectedMonth}-01`;
    to   = `${selectedMonth}-${String(new Date(y,m,0).getDate()).padStart(2,'0')}`;
    document.getElementById('dateFrom').value = from;
    document.getElementById('dateTo').value = to;
  } else {
    from = document.getElementById('dateFrom').value;
    to   = document.getElementById('dateTo').value;
  }

  // Validate code vs location consistency
  if(loc !== 'all' && (eq || tr || mt)) {
    const codesInLoc = new Set(DATA.filter(r=>r['สถานที่']===loc).map(r=>(r['รหัสอุปกรณ์']||'').trim()));
    let invalid = false;
    if(eq && !codesInLoc.has(eq)) { document.getElementById('equipSel').value=''; invalid=true; }
    if(tr && !codesInLoc.has(tr)) { document.getElementById('transSel').value=''; invalid=true; }
    if(mt && !codesInLoc.has(mt)) { document.getElementById('meterSel').value=''; invalid=true; }
    if(invalid) showFilterErrorModal();
  }

  const eq2 = document.getElementById('equipSel').value;
  const tr2 = document.getElementById('transSel').value;
  const mt2 = document.getElementById('meterSel').value;

  filtered = DATA.filter(r => {
    if(loc !== 'all' && r['สถานที่'] !== loc) return false;
    if(from && r.date_iso && r.date_iso < from) return false;
    if(to   && r.date_iso && r.date_iso > to)   return false;
    // รหัสอุปกรณ์ filter — eq2/tr2/mt2 ใช้ field เดียวกัน ต้อง OR
    const code = (r['รหัสอุปกรณ์']||'').trim();
    if(eq2 && code !== eq2) return false;
    if(tr2 && code !== tr2) return false;
    if(mt2 && code !== mt2) return false;
    return true;
  });

  render();
}

function showFilterErrorModal() {
  if(document.getElementById('filterErrorModal')) return;
  document.body.insertAdjacentHTML('beforeend', `
    <div id="filterErrorModal" style="position:fixed;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:10000">
      <div style="background:var(--card);border:1px solid var(--accent4);border-radius:12px;padding:28px 32px;max-width:340px;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,0.5)">
        <div style="font-size:32px;margin-bottom:10px">⚠️</div>
        <div style="color:var(--text);font-size:15px;font-weight:700;margin-bottom:6px">ฟิลเตอร์ไม่ถูกต้อง</div>
        <div style="color:var(--muted);font-size:12.5px;margin-bottom:18px">รหัสที่เลือกไม่ตรงกับสถานที่ที่เลือก — ล้างค่าอัตโนมัติแล้ว</div>
        <button onclick="document.getElementById('filterErrorModal').remove()" style="background:var(--accent4);color:#fff;border:none;border-radius:6px;padding:8px 20px;font-family:'Sarabun',sans-serif;font-size:13px;font-weight:600;cursor:pointer">ตกลง</button>
      </div>
    </div>`);
}

// ── Utilities ──
function fmt(n) {
  if(n===null||n===undefined||isNaN(n)) return '—';
  return n.toLocaleString('th-TH');
}

function topN(arr, key, n=10) {
  const freq={};
  arr.forEach(r=>{ const k=(r[key]||'').trim(); if(k) freq[k]=(freq[k]||0)+1; });
  return Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,n);
}

// ── Bar chart renderer ──
// selectId: id ของ <select> ที่จะตั้งค่าเมื่อคลิก (หรือ null ถ้าคลิกไม่ได้)
function renderBars(containerId, data, color='var(--accent)', selectId=null) {
  const el = document.getElementById(containerId);
  if(!data.length){ el.innerHTML='<div style="color:var(--muted);font-size:12px">ไม่มีข้อมูล</div>'; return; }
  const max = data[0][1];
  el.innerHTML = data.map(([label, cnt]) => {
    const safeLabel = label.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
    const clickAttr = selectId
      ? `style="cursor:pointer" onclick="clickBarFilter('${selectId}','${safeLabel}')"`
      : '';
    return `
    <div class="bar-row" ${clickAttr}>
      <div class="bar-label" title="${label}">${label}</div>
      <div class="bar-track">
        <div class="bar-fill" style="width:${(cnt/max*100).toFixed(1)}%;background:${color}"></div>
      </div>
      <div class="bar-count">${cnt}</div>
    </div>`;
  }).join('');
}

// ── Donut chart ──
function drawDonut(ctx, data) {
  const W=ctx.canvas.width, H=ctx.canvas.height;
  ctx.clearRect(0,0,W,H);
  const cx=W/2, cy=H/2, r=Math.min(W,H)/2-16, ri=r*0.58;
  const total=data.reduce((s,d)=>s+d.v,0);
  if(!total){ ctx.canvas._donutSlices=[]; return; }
  let angle=-Math.PI/2;
  const slices=[];
  data.forEach(d=>{
    const sweep=(d.v/total)*Math.PI*2;
    ctx.beginPath();
    ctx.moveTo(cx,cy);
    ctx.arc(cx,cy,r,angle,angle+sweep);
    ctx.closePath();
    ctx.fillStyle=d.c;
    ctx.fill();
    slices.push({start:angle, end:angle+sweep, loc:d.locValue});
    angle+=sweep;
  });
  // hole
  ctx.beginPath();
  ctx.arc(cx,cy,ri,0,Math.PI*2);
  ctx.fillStyle=getComputedStyle(document.documentElement).getPropertyValue('--card').trim()||'#1c2030';
  ctx.fill();
  // center text
  ctx.fillStyle='#e8eaf0';
  ctx.font='bold 18px Sarabun, sans-serif';
  ctx.textAlign='center';
  ctx.textBaseline='middle';
  ctx.fillText(total, cx, cy-8);
  ctx.font='11px Sarabun, sans-serif';
  ctx.fillStyle='#8b90a8';
  ctx.fillText('ครั้ง', cx, cy+12);
  ctx.canvas._donutSlices=slices;
  ctx.canvas._donutCenter={cx,cy,r,ri};
}

function setupDonutClick(canvas) {
  if(canvas._clickBound) return;
  canvas._clickBound=true;
  canvas.style.cursor='pointer';
  canvas.addEventListener('click', e=>{
    const slices=canvas._donutSlices, center=canvas._donutCenter;
    if(!slices||!center||!slices.length) return;
    const rect=canvas.getBoundingClientRect();
    const scaleX=canvas.width/rect.width, scaleY=canvas.height/rect.height;
    const x=(e.clientX-rect.left)*scaleX-center.cx;
    const y=(e.clientY-rect.top)*scaleY-center.cy;
    const dist=Math.sqrt(x*x+y*y);
    if(dist<center.ri||dist>center.r) return;
    // normalize angle to same range as slices [-PI/2 … 3PI/2]
    let a=Math.atan2(y,x);
    if(a<-Math.PI/2) a+=Math.PI*2;
    const slice=slices.find(s=>a>=s.start&&a<s.end);
    if(slice&&slice.loc){
      document.getElementById('locationSel').value=slice.loc;
      rebuildCodeSelects(slice.loc);
      applyFilters();
    }
  });
}

// ── Monthly bar chart ──
const MONTHS_TH=['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];

function renderMonthBars(containerId, data) {
  const el=document.getElementById(containerId);
  if(!data.length){ el.innerHTML='<div style="color:var(--muted);font-size:12px;margin:auto">ไม่มีข้อมูล</div>'; return; }
  const max=Math.max(...data.map(d=>d.v),1);
  el.innerHTML=data.map(d=>{
    const hPct=Math.max((d.v/max*100),3);
    const grad=d.active?'linear-gradient(180deg,#ffd180,#ffb74d)':'linear-gradient(180deg,#5ccfff,#3aa8e0)';
    const ring=d.active?'outline:2px solid #ffb74d;outline-offset:2px;':'';
    return `
    <div onclick="filterByMonth('${d.key}')" style="flex:1;max-width:60px;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;cursor:pointer;gap:5px" title="${d.active?'คลิกเพื่อยกเลิก':'คลิกเพื่อดูเฉพาะ'} ${d.label}">
      <div style="font-size:12.5px;font-weight:700;color:${d.active?'#ffb74d':'var(--text)'}">${d.v}</div>
      <div class="month-bar-fill" style="width:80%;max-width:36px;height:${hPct}%;background:${grad};border-radius:5px 5px 0 0;${ring};transition:filter .15s,transform .15s"></div>
      <div style="font-size:11px;font-weight:600;color:${d.active?'#ffb74d':'#c8cee0'};white-space:nowrap">${d.label}</div>
    </div>`;
  }).join('');
}

// ── Main render ──
function render() {
  const f=filtered;

  // KPIs
  document.getElementById('kpiTotal').textContent=f.length;
  const totalOut=f.reduce((s,r)=>s+(r['ระยะเวลาดับ_นาที']||0),0);
  const avgOut=f.length?Math.round(totalOut/f.length):0;
  document.getElementById('kpiAvgOut').textContent=avgOut;
  document.getElementById('kpiUsers').textContent=fmt(f.reduce((s,r)=>s+(r['จำนวนผชฟ_กระทบ']||0),0));
  const totalFix=f.reduce((s,r)=>s+(r['เวลาแก้ไข_นาที']||0),0);
  const avgFix=f.length?Math.round(totalFix/f.length):0;
  document.getElementById('kpiAvgFix').textContent=avgFix;

  // Cause bars (ไม่ filter ตาม click)
  renderBars('causeBars', topN(f,'สาเหตุ',8), 'var(--accent4)');

  // Donut by location
  const PALETTE=['#f5a623','#4fc3f7','#81c784','#ef5350','#a78bfa','#4dd0e1','#ffb74d','#f06292','#9ccc65','#64b5f6','#ba68c8'];
  const locFreq={};
  f.forEach(r=>{ const loc=(r['สถานที่']||'').trim(); if(loc) locFreq[loc]=(locFreq[loc]||0)+1; });
  const sortedLocs=Object.entries(locFreq).sort((a,b)=>b[1]-a[1]);
  const cvs=document.getElementById('donutChart');
  const ctx=cvs.getContext('2d');
  const donutData=sortedLocs.map(([loc,cnt],i)=>({
    v:cnt, c:PALETTE[i%PALETTE.length],
    label:loc.replace(/\s*\([A-Z]+\)$/,''),
    locValue:loc
  }));
  drawDonut(ctx, donutData);
  setupDonutClick(cvs);
  document.getElementById('donutLegend').innerHTML=donutData.map(d=>`
    <span onclick="clickBarFilter('locationSel','${d.locValue.replace(/'/g,"\\'")}')" style="display:flex;align-items:center;gap:4px;cursor:pointer;padding:2px 4px;border-radius:4px;transition:background .15s" onmouseover="this.style.background='rgba(255,255,255,0.06)'" onmouseout="this.style.background='transparent'">
      <span style="width:8px;height:8px;border-radius:50%;background:${d.c};flex-shrink:0"></span>
      <span style="color:var(--muted)">${d.label}: <b style="color:var(--text)">${d.v}</b></span>
    </span>`).join('');

  // Monthly bar — คำนวณจาก data ที่กรองด้วย สถานที่+รหัส แต่ไม่ติด selectedMonth
  const locNow=document.getElementById('locationSel').value;
  const eqNow =document.getElementById('equipSel').value;
  const trNow =document.getElementById('transSel').value;
  const mtNow =document.getElementById('meterSel').value;
  const baseForMonths=DATA.filter(r=>{
    if(locNow!=='all'&&r['สถานที่']!==locNow) return false;
    const code=(r['รหัสอุปกรณ์']||'').trim();
    if(eqNow&&code!==eqNow) return false;
    if(trNow&&code!==trNow) return false;
    if(mtNow&&code!==mtNow) return false;
    return true;
  });
  const monthFreq={};
  baseForMonths.forEach(r=>{
    if(r.date_iso&&/^\d{4}-\d{2}-\d{2}$/.test(r.date_iso)){
      const m=r.date_iso.substring(0,7);
      monthFreq[m]=(monthFreq[m]||0)+1;
    }
  });
  const monthKeys=Object.keys(monthFreq).sort();
  renderMonthBars('monthBar', monthKeys.map(k=>{
    const [yy,mm]=k.split('-');
    return {key:k, label:`${MONTHS_TH[parseInt(mm)-1]} ${(+yy+543).toString().slice(-2)}`, v:monthFreq[k], active:k===selectedMonth};
  }));

  // Equipment bars (codes with letters)
  const equipOnly=f.filter(r=>isEquipCode((r['รหัสอุปกรณ์']||'').trim()));
  renderBars('equipBars', topN(equipOnly,'รหัสอุปกรณ์',10), 'var(--accent)', 'equipSel');

  // Transformer bars (มี - ไม่มีตัวอักษร)
  const transOnly=f.filter(r=>isTransCode((r['รหัสอุปกรณ์']||'').trim()));
  renderBars('transBars', topN(transOnly,'รหัสอุปกรณ์',10), '#a78bfa', 'transSel');

  // Meter bars (ตัวเลขล้วน)
  const meterOnly=f.filter(r=>isMeterCode((r['รหัสอุปกรณ์']||'').trim()));
  renderBars('meterBars', topN(meterOnly,'รหัสอุปกรณ์',10), '#4dd0e1', 'meterSel');

  // Weather bars
  renderBars('weatherBars', topN(f,'สภาพอากาศ',8), 'var(--accent2)');

  // Table
  document.getElementById('tableCount').textContent=`แสดง ${Math.min(f.length,200)} จาก ${f.length} รายการ`;
  const tbody=document.getElementById('tableBody');
  tbody.innerHTML=f.slice(0,200).map((r,i)=>{
    const locFull=(r['สถานที่']||'').trim();
    const shortCode=locFull.match(/^(กฟ[จส]\.[^\s(]+)/)?.[1]||locFull;
    const sizeTag=locFull.match(/\(([A-Z]+)\)/)?.[1]||'';
    const badgeColor=sizeTag==='L'?'var(--gfj)':sizeTag==='S'?'#81c784':'var(--gfs)';
    const dur=r['ระยะเวลาดับ_นาที']||0;
    const durColor=dur>120?'var(--accent4)':dur>60?'var(--accent)':'var(--text)';
    const fix=r['เวลาแก้ไข_นาที']||0;
    return `<tr>
      <td style="color:var(--muted)">${r['ลำดับ']}</td>
      <td>${r['วันที่']}</td>
      <td>${r['เวลาเริ่ม']}${r['เวลาสิ้นสุด']?' – '+r['เวลาสิ้นสุด']:''}</td>
      <td style="color:${durColor};font-weight:600">${dur>0?dur:'—'}</td>
      <td><span class="badge" style="background:${badgeColor}22;color:${badgeColor}">${shortCode}</span></td>
      <td style="font-family:monospace;font-size:11px">${r['รหัสอุปกรณ์']||'—'}</td>
      <td style="text-align:right">${fmt(r['จำนวนผชฟ_กระทบ'])}</td>
      <td>${r['สาเหตุ']||'—'}</td>
      <td>${r['สภาพอากาศ']||'—'}</td>
      <td style="text-align:right">${fix>0?fix:'—'}</td>
    </tr>`;
  }).join('');
}

// ── Init ──
function init() {
  filtered=[...DATA];

  const dates=DATA.map(d=>d.date_iso).filter(d=>d&&/^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  const minDate=dates[0]||'2020-01-01';
  const maxDate=dates[dates.length-1]||new Date().toISOString().slice(0,10);
  window._minDate=minDate;
  window._maxDate=maxDate;
  document.getElementById('dateFrom').value=minDate;
  document.getElementById('dateTo').value=maxDate;

  // Build location dropdown
  const locFreq={};
  DATA.forEach(r=>{ const loc=(r['สถานที่']||'').trim(); if(loc) locFreq[loc]=(locFreq[loc]||0)+1; });
  const sel=document.getElementById('locationSel');
  Object.entries(locFreq).sort((a,b)=>b[1]-a[1]).forEach(([loc,cnt])=>{
    const o=document.createElement('option');
    o.value=loc; o.textContent=`${loc} (${cnt})`;
    sel.appendChild(o);
  });

  rebuildCodeSelects('all');

  document.getElementById('locationSel').addEventListener('change', ()=>{
    const loc=document.getElementById('locationSel').value;
    rebuildCodeSelects(loc);
    applyFilters();
  });

  // date inputs ล้าง selectedMonth
  document.getElementById('dateFrom').addEventListener('change', ()=>{ selectedMonth=null; applyFilters(); });
  document.getElementById('dateTo').addEventListener('change', ()=>{ selectedMonth=null; applyFilters(); });

  applyFilters();
}
