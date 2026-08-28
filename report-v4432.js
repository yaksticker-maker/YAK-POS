
(function(){
'use strict';

const R = {
  mode:'day',
  toNow:false,
  sales:[],
  chart:null,
  pie:null,
  ready:false
};

function byId(id){ return document.getElementById(id); }
function iso(d){
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function parseDate(v,end){
  const d=new Date((v||iso(new Date()))+'T00:00:00');
  if(end)d.setHours(23,59,59,999);
  return d;
}
function baht(v){
  try{return new Intl.NumberFormat('th-TH',{style:'currency',currency:'THB'}).format(Number(v||0))}
  catch(e){return '฿'+Number(v||0).toFixed(2)}
}
function escapeHtml(s){
  return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
}
function toastSafe(msg){
  try{ if(typeof window.toast==='function'){window.toast(msg);return;} }catch(e){}
  const old=byId('r32Toast'); if(old)old.remove();
  const x=document.createElement('div'); x.id='r32Toast'; x.textContent=msg;
  x.style.cssText='position:fixed;right:24px;bottom:24px;z-index:99999;background:#222;color:#fff;padding:12px 16px;border:1px solid #555;border-radius:10px;font-family:Tahoma,Arial';
  document.body.appendChild(x); setTimeout(()=>x.remove(),1800);
}
function readDb(){
  for(const key of ['yak_pos_db_v2','yak_pos_db_v1']){
    try{
      const raw=localStorage.getItem(key);
      if(raw){
        const data=JSON.parse(raw);
        if(data && Array.isArray(data.sales)) return data;
      }
    }catch(e){}
  }
  try{
    if(window.db && Array.isArray(window.db.sales)) return window.db;
  }catch(e){}
  return {sales:[],expenses:[]};
}
function getSession(){
  const keys=['yak_pos_session','yak_session','yak_pos_current_session'];
  for(const k of keys){
    try{const x=JSON.parse(localStorage.getItem(k)||'null'); if(x)return x}catch(e){}
  }
  try{if(window.session)return window.session}catch(e){}
  return null;
}
function getEmployee(db,session){
  if(!session || !Array.isArray(db.employees)) return null;
  return db.employees.find(e=>e.id===session.employeeId)||null;
}
function visibleSales(){
  const db=readDb(), session=getSession(), emp=getEmployee(db,session);
  let arr=Array.isArray(db.sales)?db.sales.slice():[];
  if(emp && emp.role!=='owner' && session?.branchId){
    arr=arr.filter(s=>s.branchId===session.branchId);
  }
  return arr;
}
function bounds(){
  const now=new Date();
  if(R.toNow){
    const s=parseDate(byId('actualToNowStart')?.value);
    return {start:s,end:new Date(),label:`${s.toLocaleDateString('th-TH')} → ปัจจุบัน`};
  }
  if(R.mode==='month'){
    const v=byId('actualReportMonth')?.value || `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    const [y,m]=v.split('-').map(Number);
    const s=new Date(y,m-1,1), e=new Date(y,m,0,23,59,59,999);
    return {start:s,end:e,label:s.toLocaleDateString('th-TH',{month:'long',year:'numeric'})};
  }
  if(R.mode==='range'){
    let s=parseDate(byId('actualReportStart')?.value), e=parseDate(byId('actualReportEnd')?.value,true);
    if(s>e){
      const sv=byId('actualReportStart')?.value, ev=byId('actualReportEnd')?.value;
      s=parseDate(ev); e=parseDate(sv,true);
    }
    return {start:s,end:e,label:`${s.toLocaleDateString('th-TH')} → ${e.toLocaleDateString('th-TH')}`};
  }
  const v=byId('actualReportDay')?.value || iso(now);
  const s=parseDate(v),e=parseDate(v,true);
  return {start:s,end:e,label:s.toLocaleDateString('th-TH',{day:'numeric',month:'long',year:'numeric'})};
}
function setMode(mode){
  R.mode=mode; R.toNow=false;
  ['day','month','range'].forEach(x=>{
    const cap=x[0].toUpperCase()+x.slice(1);
    const tab=byId('actual'+cap+'Tab'), panel=byId('actual'+cap+'Panel');
    if(tab)tab.classList.toggle('active',x===mode);
    if(panel){
      panel.classList.toggle('hidden',x!==mode);
      panel.style.display=x===mode?'grid':'none';
    }
  });
  render();
}
function table(headers,rows){
  return `<div class="table-wrap"><table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows||`<tr><td colspan="${headers.length}" class="empty">ยังไม่มีข้อมูล</td></tr>`}</tbody></table></div>`;
}
function renderCanvasFallback(canvas, labels, values){
  if(!canvas)return;
  const ctx=canvas.getContext('2d');
  if(!ctx)return;
  const w=canvas.clientWidth||800,h=canvas.height||220;
  canvas.width=Math.max(600,w); canvas.height=Math.max(220,h);
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.font='12px Tahoma';ctx.fillStyle='#888';
  if(!values.length){ctx.fillText('ยังไม่มีข้อมูลยอดขายในช่วงนี้',20,35);return;}
  const max=Math.max(...values,1), pad=38, cw=canvas.width-pad*2, ch=canvas.height-pad*2;
  ctx.strokeStyle='#444';ctx.beginPath();ctx.moveTo(pad,pad);ctx.lineTo(pad,pad+ch);ctx.lineTo(pad+cw,pad+ch);ctx.stroke();
  ctx.strokeStyle='#ddd';ctx.lineWidth=2;ctx.beginPath();
  values.forEach((v,i)=>{
    const x=pad+(values.length===1?cw/2:(i*cw/(values.length-1)));
    const y=pad+ch-(v/max*ch);
    if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
  });ctx.stroke();
  ctx.fillStyle='#aaa'; labels.forEach((l,i)=>{
    if(i%Math.max(1,Math.ceil(labels.length/8))===0){
      const x=pad+(labels.length===1?cw/2:(i*cw/(labels.length-1)));
      ctx.fillText(l,x-12,pad+ch+20);
    }
  });
}
function renderCore(){
  if(!byId('actualReportDay'))return;
  try{
    const b=bounds();
    const sales=visibleSales().filter(s=>{
      const d=new Date(s.date);
      return !isNaN(d) && d>=b.start && d<=b.end;
    });
    R.sales=sales;

    const revenue=sales.reduce((a,s)=>a+Number(s.total||0),0);
    const cost=sales.reduce((a,s)=>a+Number(s.costTotal||0),0);
    const profit=revenue-cost, margin=revenue?profit/revenue*100:0;
    const put=(id,v)=>{const e=byId(id);if(e)e.textContent=v};
    put('reportRevenue',baht(revenue));
    put('reportCost',baht(cost));
    put('reportProfit',baht(profit));
    put('reportMargin',margin.toFixed(1)+'%');
    put('actualReportLabel',b.label);
    put('actualRealtimeText','อัปเดตล่าสุด '+new Date().toLocaleTimeString('th-TH'));

    const grouped={};
    sales.forEach(s=>{const d=new Date(s.date);const k=iso(d);grouped[k]=(grouped[k]||0)+Number(s.total||0)});
    const labels=Object.keys(grouped).sort(), vals=labels.map(k=>grouped[k]);

    const cv=byId('salesChart');
    try{
      if(window.Chart && cv){
        if(R.chart)R.chart.destroy();
        R.chart=new Chart(cv,{type:'line',data:{labels:labels.map(k=>new Date(k+'T12:00').toLocaleDateString('th-TH',{day:'2-digit',month:'2-digit'})),datasets:[{label:'ยอดขาย',data:vals,tension:.25}]},options:{responsive:true,animation:false,resizeDelay:150,maintainAspectRatio:false,scales:{y:{beginAtZero:true}}}});
      }else renderCanvasFallback(cv,labels,vals);
    }catch(e){renderCanvasFallback(cv,labels,vals)}

    const prod={};
    const prodQty={};
    sales.forEach(s=>(s.items||[]).forEach(i=>{
      const name=i.name||'สินค้า';
      const qty=Number(i.qty||0);
      prod[name]=(prod[name]||0)+Number(i.price||0)*qty;
      prodQty[name]=(prodQty[name]||0)+qty;
    }));
    const entries=Object.entries(prod).sort((a,b)=>(prodQty[b[0]]||0)-(prodQty[a[0]]||0) || b[1]-a[1]);
    const sum=entries.reduce((a,x)=>a+x[1],0);

    const topBox=byId('r48TopProducts');
    if(topBox){
      topBox.innerHTML=entries.length
        ? `<div class="r48-ranking">${entries.map(([n,v],idx)=>`
            <div class="r48-rank-row">
              <div class="r48-rank-no">${idx+1}</div>
              <div class="r48-rank-name">
                <b>${escapeHtml(n)}</b>
                <small>ขาย ${Number(prodQty[n]||0)} หน่วย</small>
              </div>
              <div class="r48-rank-sales">${baht(v)}</div>
            </div>`).join('')}</div>`
        : '<div class="empty">ยังไม่มีข้อมูลสินค้าในช่วงนี้</div>';
    }

    const soldBox=byId('r48SoldProducts');
    if(soldBox){
      soldBox.innerHTML=table(
        ['สินค้า','จำนวนที่ขาย','ยอดขายรวม','สัดส่วน'],
        entries.map(([n,v])=>`<tr>
          <td>${escapeHtml(n)}</td>
          <td><b>${Number(prodQty[n]||0)}</b></td>
          <td>${baht(v)}</td>
          <td>${sum?(v/sum*100).toFixed(1):0}%</td>
        </tr>`).join('')
      );
    }

    const pct=byId('productPercentTable');
    if(pct)pct.innerHTML=table(['สินค้า','ยอดขาย','สัดส่วน'],entries.map(([n,v])=>`<tr><td>${escapeHtml(n)}</td><td>${baht(v)}</td><td>${sum?(v/sum*100).toFixed(1):0}%</td></tr>`).join(''));

    const pc=byId('productPie');
    try{
      if(window.Chart && pc){
        if(R.pie)R.pie.destroy();
        R.pie=new Chart(pc,{type:'doughnut',data:{labels:entries.map(x=>x[0]),datasets:[{data:entries.map(x=>x[1])}]},options:{responsive:true,animation:false,resizeDelay:150,maintainAspectRatio:true,aspectRatio:1,plugins:{legend:{position:'bottom'}}}});
      }else if(pc){
        const ctx=pc.getContext('2d');ctx.clearRect(0,0,pc.width,pc.height);ctx.fillStyle='#888';ctx.font='12px Tahoma';ctx.fillText(entries.length?'ดูรายละเอียดสัดส่วนด้านข้าง':'ยังไม่มีข้อมูลสินค้า',15,30);
      }
    }catch(e){}

    const bills=byId('actualReportBills');
    if(bills)bills.innerHTML=table(['เลขบิล','วันเวลา','จำนวนสินค้า','ชำระ','ยอดรวม'],
      sales.slice().sort((a,b)=>new Date(b.date)-new Date(a.date)).map(s=>`<tr>
        <td>${escapeHtml(s.id||'-')}</td><td>${new Date(s.date).toLocaleString('th-TH')}</td>
        <td>${(s.items||[]).reduce((a,i)=>a+Number(i.qty||0),0)}</td>
        <td>${s.payMethod==='cash'?'เงินสด':s.payMethod==='qr'?'QR / โอน':s.payMethod==='card'?'บัตร':escapeHtml(s.payMethod||'-')}</td>
        <td>${baht(s.total)}</td></tr>`).join('')
    );

    R.last={bounds:b,sales,revenue,cost,profit,margin,prod,prodQty};
  }catch(err){
    console.error('YAK Report V4.4.32:',err);
    const t=byId('actualRealtimeText');if(t){t.textContent='เกิดข้อผิดพลาด: '+err.message;t.style.color='#ff7777'}
  }
}

function render(){
  // Keep user's exact reading position while real-time report updates.
  const sx=window.scrollX||0;
  const sy=window.scrollY||0;
  const active=document.activeElement;
  let activeId='';
  try{activeId=active?.id||''}catch(e){}

  const result=renderCore();

  // Restore after Chart.js / table DOM updates finish layout.
  requestAnimationFrame(()=>{
    window.scrollTo(sx,sy);
    requestAnimationFrame(()=>{
      window.scrollTo(sx,sy);
      // Do not steal focus from date/month inputs or other controls.
      if(activeId){
        const target=document.getElementById(activeId);
        if(target && document.activeElement!==target){
          try{target.focus({preventScroll:true})}catch(e){}
        }
      }
    });
  });

  return result;
}

function preset(type){
  const n=new Date(); let s=new Date(n.getFullYear(),n.getMonth(),n.getDate()),e=new Date(s);
  if(type==='today'){byId('actualReportDay').value=iso(s);setMode('day');return}
  if(type==='yesterday'){s.setDate(s.getDate()-1);byId('actualReportDay').value=iso(s);setMode('day');return}
  if(type==='month'){byId('actualReportMonth').value=`${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`;setMode('month');return}
  if(type==='7days')s.setDate(s.getDate()-6);
  if(type==='year')s=new Date(n.getFullYear(),0,1);
  byId('actualReportStart').value=iso(s);byId('actualReportEnd').value=iso(e);setMode('range');
}
function toNow(){
  if(!byId('actualToNowStart')?.value){toastSafe('กรุณาเลือกวันที่เริ่มต้น');return}
  R.mode='range';R.toNow=true;render();
}
function printable(){
  render(); const d=R.last;if(!d)return '';
  const rows=d.sales.map(s=>`<tr><td>${escapeHtml(s.id||'-')}</td><td>${new Date(s.date).toLocaleString('th-TH')}</td><td>${baht(s.total)}</td></tr>`).join('');
  const productRows=Object.entries(d.prod||{}).sort((a,b)=>(d.prodQty?.[b[0]]||0)-(d.prodQty?.[a[0]]||0)).map(([n,v],idx)=>`<tr><td>${idx+1}</td><td>${escapeHtml(n)}</td><td>${Number(d.prodQty?.[n]||0)}</td><td>${baht(v)}</td></tr>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><style>@page{size:A4;margin:12mm}body{font-family:Tahoma,Arial;color:#111}table{width:100%;border-collapse:collapse}th,td{border:1px solid #bbb;padding:6px}.stats{display:flex;gap:20px;margin:15px 0}</style></head><body><h2>รายงานยอดขายและกำไร</h2><p>${d.bounds.label}</p><div class="stats"><b>ยอดขาย ${baht(d.revenue)}</b><b>ต้นทุน ${baht(d.cost)}</b><b>กำไร ${baht(d.profit)}</b><b>กำไร ${d.margin.toFixed(1)}%</b></div><h3>อันดับสินค้าขายดี / สินค้าที่ขายไป</h3>
    <table><tr><th>อันดับ</th><th>สินค้า</th><th>จำนวน</th><th>ยอดขาย</th></tr>${productRows||'<tr><td colspan="4">ไม่มีข้อมูล</td></tr>'}</table>
    <h3>รายละเอียดบิล</h3>
    <table><tr><th>เลขบิล</th><th>วันเวลา</th><th>ยอดรวม</th></tr>${rows||'<tr><td colspan="3">ไม่มีข้อมูล</td></tr>'}</table></body></html>`;
}
async function doPdf(){
  const h=printable();
  try{
    if(window.yakDesktop?.saveReportPdf){const r=await window.yakDesktop.saveReportPdf({html:h});toastSafe(r?.ok?'บันทึก PDF แล้ว':'บันทึก PDF ไม่สำเร็จ');return}
  }catch(e){}
  const w=window.open('','yakpdf');if(w){w.document.write(h);w.document.close();toastSafe('เปิดตัวอย่างรายงานแล้ว')}
}
async function doPrint(){
  const h=printable();
  try{if(window.yakDesktop?.printReport){await window.yakDesktop.printReport({html:h});return}}catch(e){}
  const w=window.open('','yakprint');if(w){w.document.write(h);w.document.close();setTimeout(()=>w.print(),250)}
}
function bind(){
  if(!byId('actualReportDay'))return;
  document.querySelectorAll('[data-report-mode]').forEach(btn=>{
    btn.onclick=null;
    btn.addEventListener('click',e=>{e.preventDefault();setMode(btn.dataset.reportMode)});
  });
  document.querySelectorAll('[data-r32-action]').forEach(btn=>{
    btn.onclick=null;
    btn.addEventListener('click',e=>{
      e.preventDefault();
      const a=btn.dataset.r32Action;
      if(a==='render')render();
      else if(a==='range')setMode('range');
      else if(a==='preset-today')preset('today');
      else if(a==='preset-yesterday')preset('yesterday');
      else if(a==='preset-7days')preset('7days');
      else if(a==='preset-month')preset('month');
      else if(a==='preset-year')preset('year');
      else if(a==='to-now')toNow();
      else if(a==='pdf')doPdf();
      else if(a==='print')doPrint();
    });
  });
  byId('actualReportDay')?.addEventListener('change',()=>{R.mode='day';R.toNow=false;render()});
  byId('actualReportMonth')?.addEventListener('change',()=>{R.mode='month';R.toNow=false;render()});
}
function init(){
  const n=new Date(),d=iso(n),m=`${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`;
  if(byId('actualReportDay'))byId('actualReportDay').value=d;
  if(byId('actualReportMonth'))byId('actualReportMonth').value=m;
  if(byId('actualReportStart'))byId('actualReportStart').value=d;
  if(byId('actualReportEnd'))byId('actualReportEnd').value=d;
  if(byId('actualToNowStart'))byId('actualToNowStart').value=d;
  bind();setMode('day');R.ready=true;
  setInterval(()=>{
    const tab=byId('tab-reports');
    if(!tab?.classList.contains('active'))return;

    const ae=document.activeElement;
    const interacting=ae && (
      ae.matches?.('input,select,textarea,button') ||
      ae.closest?.('.actual-filter-card')
    );

    if(!interacting)render();
  },5000);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,50));
else setTimeout(init,50);

window.YAK_REPORT_4432={render,setMode,preset};
})();
