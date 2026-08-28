(function(){
'use strict';

function byId(id){ return document.getElementById(id); }
function ensureData(){
  if(typeof db==='undefined' || !db) return false;
  db.materials = Array.isArray(db.materials) ? db.materials : [];
  db.productMaterials = Array.isArray(db.productMaterials) ? db.productMaterials : [];
  db.products = Array.isArray(db.products) ? db.products : [];
  return true;
}
function num(v){ const n=Number(v); return Number.isFinite(n)?n:0; }
function say(msg){ try{ if(typeof toast==='function') toast(msg); else alert(msg); }catch(e){ alert(msg); } }
function persist(){ try{ if(typeof saveDB==='function') saveDB(); }catch(e){ console.error('[V5.2.1 material save]',e); } }
function refresh(){
  const fns=['m40Refresh','m33RenderAll','m33RenderMaterials','m33RenderSelectors','m33RenderProductRecipe','renderMaterialsAdmin','renderMaterialLinks','renderProductsAdmin','renderProducts'];
  fns.forEach(n=>{ try{ if(typeof window[n]==='function') window[n](); }catch(e){ console.warn('[V5.2.1 material refresh]',n,e); } });
  try{ window.YAK_MATERIAL_LIVE_442?.render?.(); }catch(e){}
}
function setFormVisible(visible){
  const f=byId('m33AddForm'); if(!f) return false;
  f.classList.toggle('hidden',!visible);
  // Guard against accumulated legacy CSS/overrides.
  if(visible){ f.style.setProperty('display','grid','important'); }
  else { f.style.removeProperty('display'); }
  return true;
}
function clearForm(){ ['m33Name','m33Unit','m33Stock','m33Min'].forEach(id=>{ const e=byId(id); if(e)e.value=''; }); }
let editingId=null;

function openAdd(){
  editingId=null;
  if(!setFormVisible(true)) return;
  clearForm();
  const f=byId('m33AddForm');
  const s=f?.querySelector('.btn.success');
  if(s){ s.textContent='บันทึกวัตถุดิบ'; s.onclick=saveMaterial; }
  const c=f?.querySelector('.btn.ghost');
  if(c){ c.onclick=closeForm; }
  setTimeout(()=>byId('m33Name')?.focus(),20);
}
function closeForm(){ editingId=null; setFormVisible(false); }
function saveMaterial(){
  if(!ensureData()) return say('ระบบข้อมูลยังไม่พร้อม กรุณาลองอีกครั้ง');
  const name=(byId('m33Name')?.value||'').trim();
  const unit=(byId('m33Unit')?.value||'').trim()||'ชิ้น';
  const stock=num(byId('m33Stock')?.value||0);
  const minStock=num(byId('m33Min')?.value||0);
  if(!name) return say('กรุณากรอกชื่อวัตถุดิบ');
  if(stock<0 || minStock<0) return say('จำนวนต้องไม่ติดลบ');
  const wasEditing=!!editingId;
  if(wasEditing){
    const m=db.materials.find(x=>x.id===editingId);
    if(!m) return say('ไม่พบวัตถุดิบที่ต้องการแก้ไข');
    m.name=name; m.unit=unit; m.stock=stock; m.minStock=minStock;
  }else{
    db.materials.push({ id:'mat'+Date.now(), name, unit, stock, minStock, active:true });
  }
  persist();
  closeForm();
  refresh();
  say(wasEditing?'แก้ไขวัตถุดิบแล้ว':'เพิ่มวัตถุดิบแล้ว');
}
function editMaterial(id){
  if(!ensureData()) return;
  const m=db.materials.find(x=>x.id===id); if(!m) return;
  editingId=id;
  setFormVisible(true);
  if(byId('m33Name')) byId('m33Name').value=m.name||'';
  if(byId('m33Unit')) byId('m33Unit').value=m.unit||'ชิ้น';
  if(byId('m33Stock')) byId('m33Stock').value=num(m.stock);
  if(byId('m33Min')) byId('m33Min').value=num(m.minStock);
  const f=byId('m33AddForm');
  const s=f?.querySelector('.btn.success'); if(s){ s.textContent='บันทึกการแก้ไข'; s.onclick=saveMaterial; }
  const c=f?.querySelector('.btn.ghost'); if(c)c.onclick=closeForm;
  try{ f?.scrollIntoView({behavior:'smooth',block:'center'}); }catch(e){}
}
function addStock(id){
  if(!ensureData()) return;
  const m=db.materials.find(x=>x.id===id); if(!m)return;
  const v=prompt(`เติมสต๊อก ${m.name}\nคงเหลือ ${num(m.stock)} ${m.unit||''}\nจำนวนที่เพิ่ม:`);
  if(v===null)return;
  const n=Number(v); if(!Number.isFinite(n)||n<=0)return say('กรุณากรอกจำนวนมากกว่า 0');
  m.stock=Math.round((num(m.stock)+n)*10000)/10000;
  persist(); refresh(); say('เติมสต๊อกแล้ว');
}
function deleteMaterial(id){
  if(!ensureData()) return;
  const m=db.materials.find(x=>x.id===id); if(!m)return;
  const links=db.productMaterials.filter(x=>x.materialId===id);
  if(!confirm(`ลบวัตถุดิบ "${m.name}" หรือไม่?\nการเชื่อมกับสินค้า ${links.length} รายการจะถูกยกเลิกด้วย`))return;
  db.materials=db.materials.filter(x=>x.id!==id);
  db.productMaterials=db.productMaterials.filter(x=>x.materialId!==id);
  persist(); refresh(); say('ลบวัตถุดิบแล้ว');
}

// Export stable functions after all legacy scripts so old overrides cannot steal the buttons.
window.m33ShowAdd=openAdd;
window.m33SaveMaterial=saveMaterial;
window.m33HideAdd=closeForm;
window.m40OpenForm=openAdd;
window.m40SaveMaterial=saveMaterial;
window.m40Cancel=closeForm;
window.m40EditMaterial=editMaterial;
window.m40AddStock=addStock;
window.m40DeleteMaterial=deleteMaterial;
window.m39StartEditMaterial=editMaterial;
window.m39DeleteMaterial=deleteMaterial;

// Direct capture binding: even if inline onclick is overwritten later, the visible Add button still works.
document.addEventListener('click',function(e){
  const b=e.target.closest('button'); if(!b)return;
  if((b.getAttribute('onclick')||'').trim()==='m33ShowAdd()'){
    e.preventDefault(); e.stopImmediatePropagation(); openAdd();
  }
},true);

function boot(){ ensureData(); refresh(); }
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,200));
else setTimeout(boot,200);
})();
