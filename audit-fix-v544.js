
(function(){
'use strict';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));

function okdb(){
  if(typeof db==='undefined' || !db) return false;
  db.products = Array.isArray(db.products) ? db.products : [];
  db.categories = Array.isArray(db.categories) ? db.categories : [];
  return true;
}
function save(){
  try{ if(typeof saveDB==='function') saveDB(); }catch(e){ console.error(e); }
}
function cats(){
  if(!okdb()) return [];
  return db.categories.filter(c=>c.active!==false)
    .sort((a,b)=>(a.sort??0)-(b.sort??0)||String(a.name).localeCompare(String(b.name),'th'));
}
function options(selected){
  return '<option value="">ไม่ระบุหมวด</option>'+
    cats().map(c=>`<option value="${esc(c.id)}" ${String(c.id)===String(selected||'')?'selected':''}>${esc(c.name)}</option>`).join('');
}

/* Remove only the original factory categories. User-created categories with same names but new IDs are kept. */
function removeFactoryDefaults(){
  if(!okdb()) return false;
  const defs = new Map([
    ['cat_sticker','สติ๊กเกอร์'],
    ['cat_print','งานพิมพ์'],
    ['cat_copy','ถ่ายเอกสาร'],
    ['cat_3d','3D Print'],
    ['cat_other','อื่นๆ']
  ]);
  const removedIds = new Set();
  db.categories = db.categories.filter(c=>{
    const original = defs.has(String(c.id)) && defs.get(String(c.id))===String(c.name);
    if(original) removedIds.add(String(c.id));
    return !original;
  });
  if(!removedIds.size) return false;
  db.products.forEach(p=>{
    if(removedIds.has(String(p.categoryId||''))) p.categoryId='';
  });
  save();
  return true;
}

/* Exact product ID from each admin row via its edit button. */
function rowProduct(row){
  const edit=row?.querySelector('[data-prod65-edit]');
  const id=edit?.getAttribute('data-prod65-edit');
  return id && okdb() ? db.products.find(p=>String(p.id)===String(id)) : null;
}

/* Fix category table column alignment deterministically. */
function alignAdminCategoryColumn(){
  const table=($('#tab-products')||document).querySelector('#productsTable table');
  if(!table || !okdb()) return;

  const hr=table.querySelector('thead tr');
  if(hr){
    let th=hr.querySelector('.yak543-cat-head');
    if(!th){
      th=document.createElement('th');
      th.className='yak543-cat-head';
      th.textContent='หมวดหมู่';
      const statusIndex=7; // original table: รูป,สินค้า,ขาย,ต้นทุน,คงเหลือ,จุดเตือน,กำไร,สถานะ,จัดการ
      hr.insertBefore(th, hr.children[statusIndex] || null);
    }
  }

  table.querySelectorAll('tbody tr').forEach(row=>{
    const p=rowProduct(row);
    if(!p) return;
    let td=row.querySelector('.yak543-cat-cell');
    if(!td){
      td=document.createElement('td');
      td.className='yak543-cat-cell';
      const statusIndex=7;
      row.insertBefore(td,row.children[statusIndex]||null);
    }
    let sel=td.querySelector('.yak543-row-cat');
    if(!sel){
      sel=document.createElement('select');
      sel.className='yak543-row-cat';
      td.appendChild(sel);
    }
    sel.dataset.productId=String(p.id);
    const html=options(p.categoryId||'');
    if(sel.dataset.html!==html){
      sel.innerHTML=html;
      sel.dataset.html=html;
    }
    sel.value=p.categoryId||'';
  });
}

/* Add category field to the REAL existing-product editor modal (prod65). */
let currentEditId=null;
function ensureEditCategoryField(){
  const modal=$('#prod65Modal');
  if(!modal || $('#yak544EditCategoryWrap')) return;
  const wrap=document.createElement('div');
  wrap.id='yak544EditCategoryWrap';
  wrap.className='yak544-edit-cat';
  wrap.innerHTML='<label for="yak544EditCategory">หมวดหมู่สินค้า</label><select id="yak544EditCategory"></select>';

  const track=$('#prod65TrackStock');
  const holder=track?.closest('label,.field,.form-group,div');
  if(holder?.parentElement) holder.parentElement.insertBefore(wrap,holder.nextSibling);
  else {
    const saveBtn=$('#prod65Save');
    saveBtn?.parentElement?.insertBefore(wrap,saveBtn);
  }
}
function loadEditCategory(id){
  currentEditId=id;
  ensureEditCategoryField();
  const p=okdb()?db.products.find(x=>String(x.id)===String(id)):null;
  const sel=$('#yak544EditCategory');
  if(sel){
    sel.innerHTML=options(p?.categoryId||'');
    sel.value=p?.categoryId||'';
  }
}
function saveEditCategory(){
  if(!currentEditId || !okdb()) return;
  const p=db.products.find(x=>String(x.id)===String(currentEditId));
  const sel=$('#yak544EditCategory');
  if(p && sel){
    p.categoryId=sel.value||'';
    save();
  }
}

/* Keep the add-product category field current. */
function refreshAddField(){
  const sel=$('#yak542ProductCategory');
  if(!sel) return;
  const old=sel.value;
  sel.innerHTML=options(old);
  if([...sel.options].some(o=>o.value===old)) sel.value=old;
}

document.addEventListener('click',e=>{
  const edit=e.target.closest('[data-prod65-edit]');
  if(edit){
    const id=edit.getAttribute('data-prod65-edit');
    setTimeout(()=>loadEditCategory(id),40);
  }

  const saveBtn=e.target.closest('#prod65Save');
  if(saveBtn){
    // Save category before the legacy editor closes and refreshes.
    saveEditCategory();
    setTimeout(refreshAll,160);
  }
},true);

document.addEventListener('change',e=>{
  if(e.target.matches('.yak543-row-cat')){
    const p=db.products.find(x=>String(x.id)===String(e.target.dataset.productId));
    if(p){
      p.categoryId=e.target.value||'';
      save();
      setTimeout(refreshAll,50);
    }
  }
},true);

function refreshAll(){
  removeFactoryDefaults();
  refreshAddField();
  ensureEditCategoryField();
  alignAdminCategoryColumn();
  try{ window.YAK_CATEGORY_MANAGER_542?.render?.(); }catch(e){}
  try{ window.YAK_PRODUCT_CATEGORY_543?.renderFrontCategories?.(); }catch(e){}
}

function init(){
  if(!okdb()) return;
  db.products.forEach(p=>{ if(typeof p.categoryId==='undefined') p.categoryId=''; });
  refreshAll();

  // bounded retries for initial render + one slow heartbeat for cloud-render changes.
  let n=0;
  const t=setInterval(()=>{
    n++;
    refreshAll();
    if(n>=20) clearInterval(t);
  },300);
  setInterval(refreshAll,3000);

  window.YAK_AUDIT_544={refreshAll,alignAdminCategoryColumn,removeFactoryDefaults};
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init);
else init();

})();
