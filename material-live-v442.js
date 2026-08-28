
(function(){
'use strict';

let liveTimer=null;
let lastSignature='';

function readyDb(){
  try{
    return typeof db!=='undefined' && db &&
      Array.isArray(db.products) &&
      Array.isArray(db.materials) &&
      Array.isArray(db.productMaterials);
  }catch(e){return false}
}
function E(v){
  return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
}
function dataSignature(){
  if(!readyDb())return 'not-ready';
  try{
    return JSON.stringify({
      p:db.products.map(x=>[x.id,x.name,x.active]),
      m:db.materials.map(x=>[x.id,x.name,x.unit,x.stock,x.minStock,x.active]),
      l:db.productMaterials.map(x=>[x.id,x.productId,x.materialId,x.qtyPerSale])
    });
  }catch(e){return String(Date.now())}
}
function renderOverview(){
  if(!readyDb())return false;
  const box=document.getElementById('m41ActiveList');
  const count=document.getElementById('m41ActiveCount');
  if(!box)return false;

  const links=db.productMaterials.map(l=>({
    link:l,
    product:db.products.find(p=>p.id===l.productId),
    material:db.materials.find(m=>m.id===l.materialId)
  })).filter(x=>x.product&&x.material);

  if(count)count.textContent=`${links.length} การเชื่อม`;

  if(!links.length){
    box.innerHTML='<div class="m42-empty">ยังไม่มีการเชื่อมสินค้า ↔ วัตถุดิบ</div>';
    return true;
  }

  box.innerHTML=links.map(x=>{
    const m=x.material;
    const low=Number(m.stock||0)<=Number(m.minStock||0);
    const working=x.product.active!==false && m.active!==false;
    const cls=!working?'off':low?'warn':'ok';
    const txt=!working?'หยุดใช้งาน':low?'ใกล้หมด':'กำลังทำงาน';

    return `<div class="m42-live-row">
      <div class="m42-flow">
        <div><small>สินค้า</small><b>${E(x.product.name)}</b></div>
        <span>→</span>
        <div><small>วัตถุดิบ</small><b>${E(m.name)}</b></div>
      </div>
      <div><small>ใช้ต่อขาย 1 หน่วย</small><b>${Number(x.link.qtyPerSale||0)} ${E(m.unit||'')}</b></div>
      <div><small>คงเหลือ</small><b>${Number(m.stock||0)} ${E(m.unit||'')}</b><em>เตือน ${Number(m.minStock||0)}</em></div>
      <div class="m42-status ${cls}">● ${txt}</div>
      <div class="m42-actions">
        <button type="button" onclick="m40EditLink('${x.link.id}')">✏️ แก้ไข</button>
        <button type="button" class="danger" onclick="m40DeleteLink('${x.link.id}')">ยกเลิก</button>
      </div>
    </div>`;
  }).join('');
  return true;
}
function renderMaterials(){
  if(!readyDb())return false;
  const box=document.getElementById('m40MaterialManager');
  if(!box)return false;

  if(!db.materials.length){
    box.innerHTML='<div class="m42-empty">ยังไม่มีวัตถุดิบ</div>';
    return true;
  }

  box.innerHTML='<div class="m42-material-grid">'+db.materials.map(m=>{
    const links=db.productMaterials.filter(l=>l.materialId===m.id);
    const products=links.map(l=>db.products.find(p=>p.id===l.productId)).filter(Boolean);
    const low=Number(m.stock||0)<=Number(m.minStock||0);
    return `<div class="m42-material-card">
      <div class="m42-mat-title">
        <b>${E(m.name)}</b>
        <span class="${!m.active?'off':low?'warn':'ok'}">${!m.active?'ปิดใช้':low?'ใกล้หมด':'ปกติ'}</span>
      </div>
      <div class="m42-mat-stats">
        <div><small>คงเหลือ</small><strong>${Number(m.stock||0)} ${E(m.unit||'')}</strong></div>
        <div><small>จุดเตือน</small><strong>${Number(m.minStock||0)} ${E(m.unit||'')}</strong></div>
        <div><small>เชื่อมสินค้า</small><strong>${products.length}</strong></div>
      </div>
      <div class="m42-connected">
        <small>กำลังใช้กับ:</small>
        ${products.length?products.map(p=>`<span>${E(p.name)}</span>`).join(''):'<em>ยังไม่เชื่อม</em>'}
      </div>
      <div class="m42-mat-actions">
        <button type="button" onclick="m40AddStock('${m.id}')">+ เติมสต๊อก</button>
        <button type="button" onclick="m40EditMaterial('${m.id}')">✏️ แก้ไข</button>
        <button type="button" class="danger" onclick="m40DeleteMaterial('${m.id}')">🗑 ลบ</button>
      </div>
    </div>`;
  }).join('')+'</div>';
  return true;
}
function renderLinkSummary(){
  if(!readyDb())return false;
  const box=document.getElementById('m40LinkSummary');
  if(!box)return false;

  const rows=db.productMaterials.map(l=>({
    l,
    p:db.products.find(p=>p.id===l.productId),
    m:db.materials.find(m=>m.id===l.materialId)
  })).filter(x=>x.p&&x.m);

  box.innerHTML=rows.length?`
    <div class="m42-summary-title">การเชื่อมที่ใช้งานอยู่ทั้งหมด</div>
    <div class="m42-link-summary">
      ${rows.map(x=>`<div>
        <b>${E(x.p.name)}</b>
        <span>→ ${E(x.m.name)}</span>
        <strong>${Number(x.l.qtyPerSale||0)} ${E(x.m.unit||'')} / 1 หน่วยขาย</strong>
        <button type="button" onclick="m40EditLink('${x.l.id}')">แก้ไข</button>
      </div>`).join('')}
    </div>`:'';
  return true;
}
function renderAll(force=false){
  if(!readyDb())return;
  const sig=dataSignature();
  if(!force && sig===lastSignature)return;
  lastSignature=sig;
  renderOverview();
  renderMaterials();
  renderLinkSummary();
}
function start(){
  // Render repeatedly during startup until DB is definitely available.
  let tries=0;
  const boot=setInterval(()=>{
    tries++;
    if(readyDb()){
      renderAll(true);
      if(tries>4)clearInterval(boot);
    }
    if(tries>30)clearInterval(boot);
  },300);

  // Keep the visible material status live.
  if(liveTimer)clearInterval(liveTimer);
  liveTimer=setInterval(()=>{
    const tab=document.getElementById('tab-products');
    if(tab && tab.classList.contains('active'))renderAll(false);
  },800);

  // Force refresh every time products tab is clicked/opened.
  document.addEventListener('click',e=>{
    const b=e.target.closest('.side-btn');
    if(b && (b.getAttribute('onclick')||'').includes("'products'")){
      setTimeout(()=>renderAll(true),80);
      setTimeout(()=>renderAll(true),400);
    }
  },true);

  // Refresh after any material/link action.
  document.addEventListener('click',e=>{
    if(e.target.closest('#tab-products button')){
      setTimeout(()=>renderAll(true),250);
      setTimeout(()=>renderAll(true),700);
    }
  });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);
else start();

window.YAK_MATERIAL_LIVE_442={render:()=>renderAll(true)};
})();
