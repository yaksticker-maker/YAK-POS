
(function(){
'use strict';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const say = t => { try{ if(typeof toast==='function') return toast(t); }catch(e){} alert(t); };

function readyDB(){
  if(typeof db==='undefined' || !db) return false;
  db.products = Array.isArray(db.products) ? db.products : [];
  db.categories = Array.isArray(db.categories) ? db.categories : [];
  return true;
}
function save(){
  try { if(typeof saveDB==='function') saveDB(); }
  catch(e){ console.error('saveDB',e); }
}
function categories(){
  if(!readyDB()) return [];
  return db.categories.filter(c=>c.active!==false)
    .sort((a,b)=>(a.sort??0)-(b.sort??0) || String(a.name).localeCompare(String(b.name),'th'));
}
function productCount(id){
  return db.products.filter(p=>String(p.categoryId||'')===String(id)).length;
}

function buildUI(){
  const panel = document.querySelector('#tab-products .panel');
  const head = panel?.querySelector('.panel-head');
  if(!panel || !head) return false;

  if(!$('#yak542ManageCatBtn')){
    const addBtn = $('#prod63AddBtn');
    const actions = document.createElement('div');
    actions.id='yak542ProductActions';
    actions.className='yak542-actions';

    const manage = document.createElement('button');
    manage.id='yak542ManageCatBtn';
    manage.type='button';
    manage.className='btn ghost yak542-manage-btn';
    manage.textContent='⚙️ จัดการหมวดหมู่';

    if(addBtn){
      addBtn.parentElement?.insertBefore(actions, addBtn);
      actions.appendChild(manage);
      actions.appendChild(addBtn);
    }else{
      actions.appendChild(manage);
      head.appendChild(actions);
    }
  }

  if(!$('#yak542CategoryModal')){
    const modal=document.createElement('div');
    modal.id='yak542CategoryModal';
    modal.className='yak542-modal hidden';
    modal.innerHTML=`
      <div class="yak542-dialog">
        <div class="yak542-dialog-head">
          <div>
            <h2>จัดการหมวดหมู่สินค้า</h2>
            <p>เพิ่ม แก้ชื่อ ลบ และจัดลำดับหมวดหมู่ได้เอง</p>
          </div>
          <button id="yak542Close" type="button" class="btn ghost">✕ ปิด</button>
        </div>

        <div class="yak542-addbox">
          <input id="yak542NewName" placeholder="ชื่อหมวดหมู่ เช่น งานป้าย / นามบัตร / งานด่วน">
          <button id="yak542Add" type="button" class="btn primary">+ เพิ่มหมวดหมู่</button>
        </div>

        <div id="yak542List" class="yak542-list"></div>
      </div>`;
    document.body.appendChild(modal);
  }

  ensureProductCategorySelect();
  render();
  return true;
}

function ensureProductCategorySelect(){
  const form=$('#productForm');
  if(!form) return;

  let wrap=$('#yak542ProductCategoryWrap');
  if(!wrap){
    wrap=document.createElement('div');
    wrap.id='yak542ProductCategoryWrap';
    wrap.className='yak542-product-cat';
    wrap.innerHTML=`
      <label for="yak542ProductCategory">หมวดหมู่สินค้า</label>
      <select id="yak542ProductCategory"></select>`;

    const name=$('#newProductName');
    const holder=name?.closest('label,.field,.form-group,div');
    if(holder?.parentElement) holder.parentElement.insertBefore(wrap, holder.nextSibling);
    else form.prepend(wrap);
  }
  updateProductSelect();
}

function updateProductSelect(){
  const sel=$('#yak542ProductCategory');
  if(!sel || !readyDB()) return;
  const current=sel.value;
  sel.innerHTML='<option value="">ไม่ระบุหมวด</option>' +
    categories().map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');
  if([...sel.options].some(o=>o.value===current)) sel.value=current;

  // Keep older hidden category controls synchronized.
  const legacy=$('#yak540ProductCat') || $('#yakProductCategory') || $('#yakProductCategory531');
  if(legacy && current) legacy.value=current;
}

function render(){
  const list=$('#yak542List');
  if(!list || !readyDB()) return;

  const cats=categories();
  if(!cats.length){
    list.innerHTML=`<div class="yak542-empty">
      ยังไม่มีหมวดหมู่<br><small>พิมพ์ชื่อด้านบน แล้วกด “+ เพิ่มหมวดหมู่”</small>
    </div>`;
  }else{
    list.innerHTML=cats.map((c,i)=>`
      <div class="yak542-row" data-id="${esc(c.id)}">
        <span class="yak542-index">${i+1}</span>
        <div class="yak542-name">
          <strong>${esc(c.name)}</strong>
          <small>${productCount(c.id)} สินค้า</small>
        </div>
        <button type="button" data-act="up" title="เลื่อนขึ้น">↑</button>
        <button type="button" data-act="down" title="เลื่อนลง">↓</button>
        <button type="button" data-act="edit">✏️ แก้ชื่อ</button>
        <button type="button" data-act="delete" class="danger">🗑 ลบ</button>
      </div>`).join('');
  }
  updateProductSelect();
  refreshProductFilter();
}

function openModal(){
  buildUI();
  const m=$('#yak542CategoryModal');
  if(m){
    m.classList.remove('hidden');
    m.style.setProperty('display','flex','important');
    setTimeout(()=>$('#yak542NewName')?.focus(),30);
  }
}
function closeModal(){
  const m=$('#yak542CategoryModal');
  if(m){
    m.classList.add('hidden');
    m.style.setProperty('display','none','important');
  }
}
function addCategory(){
  if(!readyDB()) return;
  const input=$('#yak542NewName');
  const name=(input?.value||'').trim();
  if(!name){ say('กรุณาพิมพ์ชื่อหมวดหมู่'); input?.focus(); return; }

  if(categories().some(c=>c.name.trim().toLowerCase()===name.toLowerCase())){
    say('มีหมวดหมู่นี้อยู่แล้ว'); return;
  }

  const maxSort=Math.max(0,...categories().map(c=>Number(c.sort)||0));
  db.categories.push({
    id:'cat_'+Date.now()+'_'+Math.random().toString(36).slice(2,6),
    name,
    active:true,
    sort:maxSort+10
  });
  if(input) input.value='';
  save(); render(); say('เพิ่มหมวดหมู่แล้ว');
}
function editCategory(id){
  const c=db.categories.find(x=>String(x.id)===String(id));
  if(!c) return;
  const name=prompt('แก้ชื่อหมวดหมู่',c.name);
  if(!name || !name.trim()) return;
  const n=name.trim();
  if(categories().some(x=>String(x.id)!==String(id) && x.name.trim().toLowerCase()===n.toLowerCase())){
    say('มีชื่อหมวดหมู่นี้อยู่แล้ว'); return;
  }
  c.name=n;
  save(); render(); say('แก้ชื่อเรียบร้อย');
}
function deleteCategory(id){
  const c=db.categories.find(x=>String(x.id)===String(id));
  if(!c) return;
  const count=productCount(id);
  if(!confirm(`ลบหมวด "${c.name}" ?\nสินค้าในหมวดนี้ ${count} รายการจะย้ายไป "ไม่ระบุหมวด"`)) return;

  db.products.forEach(p=>{
    if(String(p.categoryId||'')===String(id)) p.categoryId='';
  });
  c.active=false;
  save(); render(); say('ลบหมวดหมู่แล้ว');
}
function moveCategory(id,dir){
  const arr=categories();
  const i=arr.findIndex(c=>String(c.id)===String(id));
  if(i<0) return;
  const j=i+(dir==='up'?-1:1);
  if(j<0 || j>=arr.length) return;

  // Normalize, then swap.
  arr.forEach((c,k)=>c.sort=(k+1)*10);
  const temp=arr[i].sort;
  arr[i].sort=arr[j].sort;
  arr[j].sort=temp;
  save(); render();
}

function refreshProductFilter(){
  // Top filter visible in screenshot: choose category to filter admin product list.
  let filter=$('#yak542AdminCategoryFilter');
  const panel=document.querySelector('#tab-products .panel');
  const table=panel?.querySelector('#productsTable, #productTable, .products-table');
  if(!panel) return;

  if(!filter){
    // Reuse the existing category selector if one is already visible outside the product form.
    const existing = Array.from(panel.querySelectorAll('select')).find(s=>
      !s.closest('#productForm') &&
      (s.previousElementSibling?.textContent||'').includes('หมวดหมู่สินค้า')
    );
    if(existing){
      filter=existing;
      filter.id='yak542AdminCategoryFilter';
    }
  }
  if(!filter) return;

  const cur=filter.value || 'all';
  filter.innerHTML='<option value="all">ทั้งหมด</option>'+
    '<option value="">ไม่ระบุหมวด</option>'+
    categories().map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');
  if([...filter.options].some(o=>o.value===cur)) filter.value=cur;
}

function applyCategoryToSavedProduct(selected,beforeIds,editId){
  setTimeout(()=>{
    if(!readyDB()) return;
    let p=null;
    if(editId) p=db.products.find(x=>String(x.id)===String(editId));
    if(!p) p=[...db.products].reverse().find(x=>!beforeIds.has(String(x.id)));
    if(p){
      p.categoryId=selected||'';
      save();
      render();
      try{ if(typeof renderProductsAdmin==='function') renderProductsAdmin(); }catch(e){}
      try{ if(typeof renderProducts==='function') renderProducts(); }catch(e){}
    }
  },140);
}

document.addEventListener('click',e=>{
  const b=e.target.closest('button');
  if(!b) return;

  if(b.id==='yak542ManageCatBtn'){ e.preventDefault(); openModal(); return; }
  if(b.id==='yak542Close'){ e.preventDefault(); closeModal(); return; }
  if(b.id==='yak542Add'){ e.preventDefault(); addCategory(); return; }

  const row=b.closest('#yak542List [data-id]');
  if(row && b.dataset.act){
    const id=row.dataset.id;
    if(b.dataset.act==='edit') editCategory(id);
    if(b.dataset.act==='delete') deleteCategory(id);
    if(b.dataset.act==='up'||b.dataset.act==='down') moveCategory(id,b.dataset.act);
    return;
  }

  if(b.id==='prod63AddBtn'){
    setTimeout(()=>{
      buildUI();
      const s=$('#yak542ProductCategory');
      if(s) s.value='';
    },30);
    return;
  }

  if(b.id==='prod63SaveBtn'){
    const selected=$('#yak542ProductCategory')?.value || '';
    // Sync old controls before old save handlers run.
    ['#yak540ProductCat','#yakProductCategory','#yakProductCategory531'].forEach(id=>{
      const s=$(id); if(s) s.value=selected;
    });
    const before=new Set((db.products||[]).map(p=>String(p.id)));
    const editId=(typeof editProductId!=='undefined') ? editProductId : null;
    applyCategoryToSavedProduct(selected,before,editId);
    return;
  }

  const text=(b.textContent||'').trim();
  if(/แก้ไข|edit/i.test(text)){
    setTimeout(()=>{
      buildUI();
      let p=null;
      try{
        if(typeof editProductId!=='undefined' && editProductId)
          p=db.products.find(x=>String(x.id)===String(editProductId));
      }catch(e){}
      if(p && $('#yak542ProductCategory')) $('#yak542ProductCategory').value=p.categoryId||'';
    },100);
  }
},true);

document.addEventListener('keydown',e=>{
  if(e.key==='Escape' && !$('#yak542CategoryModal')?.classList.contains('hidden')) closeModal();
  if(e.key==='Enter' && document.activeElement?.id==='yak542NewName') addCategory();
});

function init(){
  if(!readyDB()) return;
  db.products.forEach(p=>{ if(typeof p.categoryId==='undefined') p.categoryId=''; });
  buildUI();

  // Bounded retry only, no MutationObserver loop.
  let tries=0;
  const t=setInterval(()=>{
    tries++;
    if(buildUI() || tries>=20) clearInterval(t);
  },300);

  window.YAK_CATEGORY_MANAGER_542={openModal,closeModal,render,addCategory};
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init);
else init();

})();
