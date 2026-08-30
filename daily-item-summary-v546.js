
(function(){
'use strict';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const money = n => '฿' + Number(n||0).toFixed(2);

function ready(){ return typeof db!=='undefined' && db && Array.isArray(db.sales); }
function dayKey(d){
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function saleDay(s){
  const raw=s.date || s.createdAt || s.created_at || s.time || s.timestamp;
  const d=raw ? new Date(raw) : null;
  return (!d || isNaN(d)) ? '' : dayKey(d);
}
function todaySales(){
  if(!ready()) return [];
  const k=dayKey(new Date());
  return db.sales.filter(s=>saleDay(s)===k);
}
function itemsOf(s){
  const arr=s.items || s.cart || s.lines || s.products || [];
  return Array.isArray(arr)?arr:[];
}
function nameOf(i){ return i.name || i.productName || i.title || i.label || 'สินค้า'; }
function qtyOf(i){
  const q=Number(i.qty ?? i.quantity ?? i.count ?? 1);
  return Number.isFinite(q)?q:0;
}
function totalOf(i){
  const t=Number(i.total ?? i.lineTotal ?? i.subtotal);
  if(Number.isFinite(t) && t>=0) return t;
  return Number(i.price ?? i.unitPrice ?? 0) * qtyOf(i);
}
function unitOf(i){ return i.unit || i.stockUnit || i.measureUnit || 'ชิ้น'; }

function aggregate(){
  const map=new Map();
  for(const s of todaySales()){
    for(const i of itemsOf(s)){
      const name=nameOf(i), unit=unitOf(i), key=name+'__'+unit;
      if(!map.has(key)) map.set(key,{name,unit,qty:0,revenue:0});
      const x=map.get(key);
      x.qty += qtyOf(i);
      x.revenue += totalOf(i);
    }
  }
  return [...map.values()].sort((a,b)=>b.revenue-a.revenue || b.qty-a.qty || a.name.localeCompare(b.name,'th'));
}

function blockHtml(){
  const rows=aggregate();
  if(!rows.length) return '<div class="yak546-empty">ยังไม่มีรายการขายวันนี้</div>';
  return `<div class="yak546-title">รายการขายวันนี้</div>
    <div class="yak546-items">${
      rows.map(x=>`<div class="yak546-row">
        <div class="yak546-name">${esc(x.name)}</div>
        <div class="yak546-qty">${x.qty} ${esc(x.unit)}</div>
        <div class="yak546-amt">${money(x.revenue)}</div>
      </div>`).join('')
    }</div>`;
}

function findReceiptPreview(){
  const nodes=[...document.querySelectorAll('div,section')];
  return nodes
    .filter(el=>{
      const t=el.textContent||'';
      return t.includes('สรุปรายรับประจำวัน') && t.includes('รายรับรวม');
    })
    .sort((a,b)=>a.querySelectorAll('*').length-b.querySelectorAll('*').length)[0] || null;
}
function injectPreview(){
  const preview=findReceiptPreview();
  if(!preview) return false;
  let box=preview.querySelector('#yak546ItemSummary');
  if(!box){
    box=document.createElement('div');
    box.id='yak546ItemSummary';

    const els=[...preview.querySelectorAll('*')];
    const amountAnchor=els.find(el=>(el.textContent||'').trim()==='จำนวนบิล');
    const row=amountAnchor?.parentElement;
    if(row?.parentElement) row.parentElement.insertBefore(box,row);
    else preview.appendChild(box);
  }
  box.innerHTML=blockHtml();
  return true;
}

function patchHtmlBuilders(){
  for(const fn of ['buildDailySummaryHtml','buildDailySummaryReceipt','makeDailySummaryHtml','dailySummaryHtml','getDailySummaryHtml']){
    if(typeof window[fn] !== 'function' || window[fn].__yak546) continue;
    const old=window[fn];
    const wrapped=function(...args){
      let html=old.apply(this,args);
      if(typeof html==='string'){
        const rows=aggregate();
        const block=`<div id="yak546ItemSummary" class="yak546-print-block"><b>รายการขายวันนี้</b><br>`+
          (rows.length ? rows.map(x=>`${esc(x.name)} — ${x.qty} ${esc(x.unit)} — ${money(x.revenue)}`).join('<br>') : 'ยังไม่มีรายการขายวันนี้')+
          `</div>`;
        const marker='จำนวนบิล';
        const pos=html.indexOf(marker);
        html = pos>=0 ? html.slice(0,pos)+block+html.slice(pos) : html+block;
      }
      return html;
    };
    wrapped.__yak546=true;
    window[fn]=wrapped;
  }
}

document.addEventListener('click',e=>{
  const b=e.target.closest('button');
  if(!b) return;
  const t=(b.textContent||'').trim();
  if(t.includes('สรุปรายรับ') || t.includes('ยืนยันการพิมพ์')){
    setTimeout(()=>{ patchHtmlBuilders(); injectPreview(); },100);
  }
},true);

function init(){
  patchHtmlBuilders();
  let n=0;
  const t=setInterval(()=>{
    n++;
    injectPreview();
    if(n>=20) clearInterval(t);
  },400);
  window.YAK_DAILY_ITEMS_546={aggregate,injectPreview};
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init);
else init();

})();
