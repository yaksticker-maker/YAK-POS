
(function(){
'use strict';

let editingId=null;
let oldImage='';
let bound=false;

function el(id){ return document.getElementById(id); }
function notify(msg){
  try{
    if(typeof toast==='function'){ toast(msg); return; }
  }catch(e){}
  alert(msg);
}
function productById(id){
  try{
    return (db.products||[]).find(p=>String(p.id)===String(id));
  }catch(e){
    console.error('productById',e);
    return null;
  }
}
function materialByLink(link){
  try{
    return (db.materials||[]).find(m=>String(m.id)===String(link.materialId));
  }catch(e){ return null; }
}

function openEditor(id){
  const p=productById(id);
  if(!p){
    notify('ไม่พบสินค้าที่ต้องการแก้ไข');
    return;
  }

  editingId=p.id;
  oldImage=p.image||'';

  const modal=el('prod65Modal');
  if(!modal){
    notify('ไม่พบหน้าต่างแก้ไขสินค้า');
    return;
  }

  el('prod65Subtitle').textContent=`${p.name} • รหัส ${p.id}`;
  el('prod65Name').value=p.name||'';
  el('prod65Price').value=Number(p.price||0);
  el('prod65Cost').value=Number(p.cost||0);
  el('prod65Stock').value=Number(p.stock||0);
  el('prod65MinStock').value=Number(p.minStock||0);
  el('prod65TrackStock').value=p.trackStock?'yes':'no';
  el('prod65Image').value='';
  el('prod65ImageNote').textContent=p.image
    ? 'มีรูปเดิมอยู่ • ถ้าไม่เลือกรูปใหม่จะใช้รูปเดิม'
    : 'สินค้านี้ยังไม่มีรูป';

  let links=[];
  try{
    links=(db.productMaterials||[]).filter(l=>String(l.productId)===String(p.id));
  }catch(e){}
  const names=links.map(materialByLink).filter(Boolean).map(m=>m.name);

  el('prod65MaterialNote').innerHTML=links.length
    ? `🔗 เชื่อมวัตถุดิบอยู่ ${links.length} รายการ: <b>${names.join(', ')||'-'}</b><br><small>การแก้ไขนี้จะไม่ลบการเชื่อมวัตถุดิบ</small>`
    : 'ยังไม่ได้เชื่อมวัตถุดิบ';

  modal.classList.remove('hidden');
  modal.setAttribute('aria-hidden','false');
  modal.style.display='flex';
  document.body.classList.add('prod65-modal-open');

  setTimeout(()=>el('prod65Name')?.focus(),30);
}

function closeEditor(){
  editingId=null;
  oldImage='';
  const modal=el('prod65Modal');
  if(modal){
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden','true');
    modal.style.display='none';
  }
  document.body.classList.remove('prod65-modal-open');
}

function readImage(file){
  return new Promise((resolve,reject)=>{
    if(!file){ resolve(oldImage||''); return; }
    if(file.size>4*1024*1024){
      reject(new Error('รูปใหญ่เกิน 4 MB'));
      return;
    }
    const r=new FileReader();
    r.onload=()=>resolve(r.result);
    r.onerror=()=>reject(new Error('อ่านรูปไม่สำเร็จ'));
    r.readAsDataURL(file);
  });
}

async function saveEditor(){
  const p=productById(editingId);
  if(!p){
    notify('ไม่พบสินค้าที่ต้องการบันทึก');
    return;
  }

  const name=(el('prod65Name')?.value||'').trim();
  const price=Number(el('prod65Price')?.value||0);
  const cost=Number(el('prod65Cost')?.value||0);
  const stock=Number(el('prod65Stock')?.value||0);
  const minStock=Number(el('prod65MinStock')?.value||0);
  const trackStock=el('prod65TrackStock')?.value==='yes';
  const file=el('prod65Image')?.files?.[0];

  if(!name){
    notify('กรุณากรอกชื่อสินค้า');
    return;
  }
  if([price,cost,stock,minStock].some(v=>!Number.isFinite(v)||v<0)){
    notify('ราคา ต้นทุน สต๊อก และจุดเตือนต้องเป็น 0 หรือมากกว่า');
    return;
  }

  let image='';
  try{
    image=await readImage(file);
  }catch(err){
    notify(err.message);
    return;
  }

  // Update same object/id, preserving all material links.
  p.name=name;
  p.price=price;
  p.cost=cost;
  p.stock=stock;
  p.minStock=minStock;
  p.trackStock=trackStock;
  p.image=image;

  try{
    saveDB();
  }catch(e){
    console.error('saveDB failed',e);
    notify('บันทึกข้อมูลไม่สำเร็จ');
    return;
  }

  closeEditor();

  // Refresh only what is available. One failure won't block the rest.
  try{ if(typeof renderProductsAdmin==='function') renderProductsAdmin(); }catch(e){console.error(e)}
  try{ if(typeof renderProducts==='function') renderProducts(); }catch(e){console.error(e)}
  try{ if(typeof m33RenderAll==='function') m33RenderAll(); }catch(e){console.error(e)}
  try{ if(typeof m40Refresh==='function') m40Refresh(); }catch(e){console.error(e)}
  try{ window.YAK_MATERIAL_LIVE_442?.render?.(); }catch(e){console.error(e)}

  notify('บันทึกการแก้ไขสินค้าแล้ว');
}

function bind(){
  if(bound)return;
  bound=true;

  // Capture phase catches clicks even when another older handler exists.
  document.addEventListener('click',function(e){
    const edit=e.target.closest('[data-prod65-edit]');
    if(edit){
      e.preventDefault();
      e.stopImmediatePropagation();
      openEditor(edit.getAttribute('data-prod65-edit'));
      return;
    }

    if(e.target===el('prod65Modal')){
      closeEditor();
    }
  },true);

  el('prod65CloseX')?.addEventListener('click',closeEditor);
  el('prod65Cancel')?.addEventListener('click',closeEditor);
  el('prod65Save')?.addEventListener('click',saveEditor);

  document.addEventListener('keydown',function(e){
    if(e.key==='Escape' && !el('prod65Modal')?.classList.contains('hidden')){
      closeEditor();
    }
  });

  console.log('[YAK POS V4.4.65] Product editor ready');
}

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',bind);
}else{
  bind();
}

window.YAK_PRODUCT_EDITOR_465={
  open:openEditor,
  save:saveEditor,
  close:closeEditor
};
})();
