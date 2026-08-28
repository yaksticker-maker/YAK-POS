
(function(){
'use strict';

/* YAK POS V5.2.2 Stability Controller
   Loaded last. Owns only the critical Add Product / Add Material actions.
   It deliberately avoids replacing the rest of the POS. */
const $ = id => document.getElementById(id);
const msg = t => { try { if(typeof toast==='function') return toast(t); } catch(e){} alert(t); };
const n = v => { const x=Number(v||0); return Number.isFinite(x)?x:0; };

function ensure(){
  if(typeof db==='undefined' || !db){ msg('ฐานข้อมูลในเครื่องยังไม่พร้อม'); return false; }
  db.products = Array.isArray(db.products) ? db.products : [];
  db.materials = Array.isArray(db.materials) ? db.materials : [];
  db.productMaterials = Array.isArray(db.productMaterials) ? db.productMaterials : [];
  return true;
}
function persist(){
  try { if(typeof saveDB==='function') saveDB(); }
  catch(e){ console.error('saveDB',e); msg('บันทึกในเครื่องไม่สำเร็จ'); throw e; }
}
function refresh(){
  ['renderProductsAdmin','renderProducts','m33RenderAll','m40Refresh','renderBackoffice'].forEach(fn=>{
    try { if(typeof window[fn]==='function') window[fn](); } catch(e){ console.warn(fn,e); }
  });
  try { window.YAK_MATERIAL_LIVE_442?.render?.(); } catch(e){}
}

/* ---------- PRODUCT ---------- */
let editProductId = null;
let oldProductImage = '';

function openProductAdd(){
  if(!ensure()) return;
  editProductId=null; oldProductImage='';
  const f=$('productForm'); if(!f){msg('ไม่พบฟอร์มสินค้า'); return;}
  if($('prod63FormTitle')) $('prod63FormTitle').textContent='เพิ่มสินค้าใหม่';
  ['newProductName','newProductPrice','newProductCost','newProductStock','newProductMinStock'].forEach(id=>{if($(id)) $(id).value='';});
  if($('newProductTrackStock')) $('newProductTrackStock').value='yes';
  if($('newProductImage')) $('newProductImage').value='';
  if($('prod63ImageInfo')) $('prod63ImageInfo').textContent='ยังไม่ได้เลือกรูป';
  if($('prod63SaveBtn')) $('prod63SaveBtn').textContent='บันทึก';
  f.classList.remove('hidden'); f.style.setProperty('display','grid','important');
  setTimeout(()=>$('newProductName')?.focus(),20);
}
function closeProduct(){
  const f=$('productForm'); if(f){f.classList.add('hidden'); f.style.setProperty('display','none','important');}
  editProductId=null; oldProductImage='';
}
function readImage(file){
  return new Promise((resolve,reject)=>{
    if(!file) return resolve(oldProductImage||'');
    if(file.size>4*1024*1024) return reject(new Error('รูปใหญ่เกิน 4 MB'));
    const r=new FileReader(); r.onload=()=>resolve(r.result); r.onerror=()=>reject(new Error('อ่านรูปไม่สำเร็จ')); r.readAsDataURL(file);
  });
}
async function saveProductStable(){
  if(!ensure()) return;
  const name=($('newProductName')?.value||'').trim();
  const price=n($('newProductPrice')?.value), cost=n($('newProductCost')?.value);
  const stock=n($('newProductStock')?.value), minStock=n($('newProductMinStock')?.value);
  const trackStock=$('newProductTrackStock')?.value==='yes';
  if(!name){msg('กรุณากรอกชื่อสินค้า'); return;}
  if([price,cost,stock,minStock].some(v=>v<0)){msg('ตัวเลขต้องเป็น 0 หรือมากกว่า'); return;}
  let image='';
  try{ image=await readImage($('newProductImage')?.files?.[0]); }catch(e){msg(e.message);return;}
  if(editProductId){
    const p=db.products.find(x=>String(x.id)===String(editProductId));
    if(!p){msg('ไม่พบสินค้า');return;}
    Object.assign(p,{name,price,cost,stock,minStock,trackStock,image});
  }else{
    db.products.push({id:'p'+Date.now()+'_'+Math.random().toString(36).slice(2,6),name,price,cost,stock,minStock,trackStock,image,active:true});
  }
  persist(); closeProduct(); refresh(); msg(editProductId?'แก้ไขสินค้าเรียบร้อย':'เพิ่มสินค้าเรียบร้อย');
}

/* ---------- MATERIAL ---------- */
function openMaterialAdd(){
  if(!ensure()) return;
  const f=$('m33AddForm'); if(!f){msg('ไม่พบฟอร์มวัตถุดิบ');return;}
  ['m33Name','m33Unit','m33Stock','m33Min'].forEach(id=>{if($(id)) $(id).value='';});
  f.classList.remove('hidden'); f.style.setProperty('display','grid','important');
  setTimeout(()=>$('m33Name')?.focus(),20);
}
function closeMaterial(){
  const f=$('m33AddForm'); if(f){f.classList.add('hidden'); f.style.setProperty('display','none','important');}
}
function saveMaterialStable(){
  if(!ensure()) return;
  const name=($('m33Name')?.value||'').trim(), unit=($('m33Unit')?.value||'').trim()||'ชิ้น';
  const stock=Math.max(0,n($('m33Stock')?.value)), minStock=Math.max(0,n($('m33Min')?.value));
  if(!name){msg('กรุณากรอกชื่อวัตถุดิบ');return;}
  db.materials.push({id:'mat'+Date.now()+'_'+Math.random().toString(36).slice(2,6),name,unit,stock,minStock,active:true});
  persist(); closeMaterial(); refresh(); msg('เพิ่มวัตถุดิบเรียบร้อย');
}

/* Expose stable functions for inline onclick and old callers. */
window.prod63OpenAdd=openProductAdd;
window.prod63Save=saveProductStable;
window.prod63Close=closeProduct;
window.showProductForm=openProductAdd;
window.saveProduct=saveProductStable;
window.hideProductForm=closeProduct;
window.m33ShowAdd=openMaterialAdd;
window.m33SaveMaterial=saveMaterialStable;
window.m33HideAdd=closeMaterial;

/* Capture critical buttons so later/older handlers cannot steal the click. */
document.addEventListener('click',function(e){
  const b=e.target.closest('button'); if(!b) return;
  if(b.id==='prod63AddBtn'){ e.preventDefault(); e.stopImmediatePropagation(); openProductAdd(); return; }
  if(b.id==='prod63SaveBtn'){ e.preventDefault(); e.stopImmediatePropagation(); saveProductStable(); return; }
  if(b.id==='prod63CancelBtn'){ e.preventDefault(); e.stopImmediatePropagation(); closeProduct(); return; }
  const txt=(b.textContent||'').trim();
  if(txt.includes('เพิ่มวัตถุดิบ') && b.closest('.material33-panel') && !b.closest('#m33AddForm')){
    e.preventDefault(); e.stopImmediatePropagation(); openMaterialAdd(); return;
  }
  if(b.closest('#m33AddForm') && txt.includes('บันทึกวัตถุดิบ')){
    e.preventDefault(); e.stopImmediatePropagation(); saveMaterialStable(); return;
  }
},true);

window.YAK_STABLE_522={openProductAdd,saveProductStable,openMaterialAdd,saveMaterialStable};
})();
