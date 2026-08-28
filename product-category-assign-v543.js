
(function(){
'use strict';

const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const esc = s => String(s ?? '').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));

function dbReady(){
  if(typeof db==='undefined' || !db) return false;
  db.products = Array.isArray(db.products) ? db.products : [];
  db.categories = Array.isArray(db.categories) ? db.categories : [];
  return true;
}
function save(){
  try{ if(typeof saveDB==='function') saveDB(); }catch(e){ console.error(e); }
}
function cats(){
  if(!dbReady()) return [];
  return db.categories.filter(c=>c.active!==false)
    .sort((a,b)=>(a.sort??0)-(b.sort??0) || String(a.name).localeCompare(String(b.name),'th'));
}
function catOptions(selected){
  return '<option value="">ไม่ระบุหมวด</option>' +
    cats().map(c=>`<option value="${esc(c.id)}" ${String(c.id)===String(selected||'')?'selected':''}>${esc(c.name)}</option>`).join('');
}
function findProductFromRow(row){
  if(!dbReady() || !row) return null;

  const ids = [
    row.dataset.productId,
    row.dataset.id,
    row.getAttribute('data-product-id'),
    row.getAttribute('data-id')
  ].filter(Boolean);

  for(const id of ids){
    const p=db.products.find(x=>String(x.id)===String(id));
    if(p) return p;
  }

  const text=(row.textContent||'').trim();
  // Prefer longest matching product name to avoid partial-name collisions.
  return [...db.products]
    .filter(p=>p && p.name && text.includes(String(p.name)))
    .sort((a,b)=>String(b.name).length-String(a.name).length)[0] || null;
}

/* ---------- BACK OFFICE: category column for every existing product ---------- */
function getProductTable(){
  const panel = $('#tab-products') || $('[data-backpage-panel="products"]');
  if(!panel) return null;
  return panel.querySelector('table');
}
function enhanceProductTable(){
  const table=getProductTable();
  if(!table || !dbReady()) return;

  const headRow=table.querySelector('thead tr');
  if(headRow && !headRow.querySelector('.yak543-cat-head')){
    const th=document.createElement('th');
    th.className='yak543-cat-head';
    th.textContent='หมวดหมู่';
    // Put before the last two management-ish columns when possible.
    const cells=Array.from(headRow.children);
    const anchor=cells.find(c=>/สถานะ|จัดการ/.test(c.textContent||'')) || cells[cells.length-1];
    headRow.insertBefore(th, anchor || null);
  }

  table.querySelectorAll('tbody tr').forEach(row=>{
    const p=findProductFromRow(row);
    if(!p) return;

    let td=row.querySelector('.yak543-cat-cell');
    if(!td){
      td=document.createElement('td');
      td.className='yak543-cat-cell';
      const cells=Array.from(row.children);
      const anchor=cells.find(c=>/ใกล้หมด|ปกติ|สถานะ|แก้ไข|เติมสต๊อก/.test(c.textContent||'')) || cells[cells.length-1];
      row.insertBefore(td, anchor || null);
    }

    let sel=td.querySelector('.yak543-row-cat');
    if(!sel){
      sel=document.createElement('select');
      sel.className='yak543-row-cat';
      sel.dataset.productId=String(p.id);
      td.appendChild(sel);
    }

    const wanted=catOptions(p.categoryId||'');
    if(sel.dataset.options!==wanted){
      sel.innerHTML=wanted;
      sel.dataset.options=wanted;
    }
    sel.value=p.categoryId||'';
  });

  ensureAdminFilter();
  applyAdminFilter();
}

document.addEventListener('change',e=>{
  const sel=e.target.closest('.yak543-row-cat');
  if(!sel || !dbReady()) return;
  const p=db.products.find(x=>String(x.id)===String(sel.dataset.productId));
  if(!p) return;

  p.categoryId=sel.value||'';
  save();

  // Refresh manager count without rebuilding whole product table.
  try{ window.YAK_CATEGORY_MANAGER_542?.render?.(); }catch(e){}
  applyAdminFilter();
  renderFrontCategories();
}, true);

/* ---------- Admin filter ---------- */
let adminFilterValue='all';

function findExistingTopCategorySelect(){
  const panel = $('#tab-products') || $('[data-backpage-panel="products"]');
  if(!panel) return null;

  const selects=Array.from(panel.querySelectorAll('select')).filter(s=>!s.closest('#productForm'));
  return selects.find(s=>{
    const label = s.previousElementSibling?.textContent || s.closest('label')?.textContent || '';
    return /หมวดหมู่สินค้า/.test(label) || s.id==='yak542AdminCategoryFilter';
  }) || null;
}
function ensureAdminFilter(){
  let sel=$('#yak543AdminFilter') || findExistingTopCategorySelect();
  const table=getProductTable();
  if(!table) return;

  if(!sel){
    const wrap=document.createElement('div');
    wrap.className='yak543-filter-wrap';
    wrap.innerHTML='<label>กรองตามหมวดหมู่</label><select id="yak543AdminFilter"></select>';
    table.parentElement.insertBefore(wrap,table);
    sel=wrap.querySelector('select');
  }else{
    sel.id='yak543AdminFilter';
  }

  const current=adminFilterValue;
  sel.innerHTML='<option value="all">ทั้งหมด</option><option value="">ไม่ระบุหมวด</option>'+
    cats().map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');
  if([...sel.options].some(o=>o.value===current)) sel.value=current;
  else sel.value='all';
}
document.addEventListener('change',e=>{
  if(e.target.id!=='yak543AdminFilter') return;
  adminFilterValue=e.target.value;
  applyAdminFilter();
});
function applyAdminFilter(){
  const table=getProductTable();
  if(!table || !dbReady()) return;
  table.querySelectorAll('tbody tr').forEach(row=>{
    const p=findProductFromRow(row);
    if(!p) return;
    const cid=String(p.categoryId||'');
    const show=adminFilterValue==='all' || cid===String(adminFilterValue||'');
    row.style.display=show?'':'none';
  });
}

/* ---------- Product add/edit form synchronization ---------- */
function syncFormFromProduct(){
  const visible=$('#yak542ProductCategory');
  if(!visible || !dbReady()) return;
  try{
    if(typeof editProductId!=='undefined' && editProductId){
      const p=db.products.find(x=>String(x.id)===String(editProductId));
      if(p) visible.value=p.categoryId||'';
    }
  }catch(e){}
}
document.addEventListener('click',e=>{
  const b=e.target.closest('button');
  if(!b) return;

  if(b.id==='prod63AddBtn'){
    setTimeout(()=>{
      const s=$('#yak542ProductCategory');
      if(s) s.value='';
    },50);
  }

  const txt=(b.textContent||'').trim();
  if(/แก้ไข|edit/i.test(txt)){
    setTimeout(syncFormFromProduct,120);
  }

  if(b.id==='prod63SaveBtn'){
    // manager-v542 handles saving category; refresh the row shortly after.
    setTimeout(enhanceProductTable,220);
    setTimeout(renderFrontCategories,250);
  }
},true);

/* ---------- FRONT STORE: category buttons + sorting/filter ---------- */
let frontCategory='all';

function frontGrid(){
  return $('#productGrid') || $('#productsGrid') || $('.product-grid') || $('[data-product-grid]');
}
function frontProductFromCard(card){
  if(!dbReady()) return null;
  const ids=[
    card.dataset.productId,
    card.dataset.id,
    card.getAttribute('data-product-id'),
    card.getAttribute('data-id'),
    card.getAttribute('data-product')
  ].filter(Boolean);
  for(const id of ids){
    const p=db.products.find(x=>String(x.id)===String(id));
    if(p) return p;
  }
  const txt=(card.textContent||'').trim();
  return [...db.products]
    .filter(p=>p?.name && txt.includes(String(p.name)))
    .sort((a,b)=>String(b.name).length-String(a.name).length)[0] || null;
}
function ensureFrontCategories(){
  const g=frontGrid();
  if(!g || $('#yak543FrontCats')) return;
  const bar=document.createElement('div');
  bar.id='yak543FrontCats';
  bar.className='yak543-front-cats';
  g.parentElement.insertBefore(bar,g);
}
function renderFrontCategories(){
  ensureFrontCategories();
  const bar=$('#yak543FrontCats');
  if(!bar || !dbReady()) return;

  const available=cats().filter(c=>db.products.some(p=>String(p.categoryId||'')===String(c.id)));
  bar.innerHTML=
    `<button type="button" data-yak543-cat="all" class="${frontCategory==='all'?'active':''}">ทั้งหมด</button>`+
    available.map(c=>`<button type="button" data-yak543-cat="${esc(c.id)}" class="${frontCategory===String(c.id)?'active':''}">${esc(c.name)}</button>`).join('')+
    (db.products.some(p=>!p.categoryId)
      ? `<button type="button" data-yak543-cat="" class="${frontCategory===''?'active':''}">ไม่ระบุหมวด</button>`
      : '');

  applyFrontCategory();
}
function applyFrontCategory(){
  const g=frontGrid();
  if(!g || !dbReady()) return;

  Array.from(g.children).forEach(card=>{
    const p=frontProductFromCard(card);
    if(!p){ card.style.display=''; return; }
    const cid=String(p.categoryId||'');
    const show=frontCategory==='all' || cid===String(frontCategory||'');
    card.style.display=show?'':'none';
  });
}
document.addEventListener('click',e=>{
  const b=e.target.closest('[data-yak543-cat]');
  if(!b) return;
  frontCategory=b.dataset.yak543Cat;
  renderFrontCategories();
});

/* ---------- Refresh after category manager changes ---------- */
const oldRender = () => {
  try{ enhanceProductTable(); }catch(e){}
  try{ renderFrontCategories(); }catch(e){}
};

function init(){
  if(!dbReady()) return;
  db.products.forEach(p=>{ if(typeof p.categoryId==='undefined') p.categoryId=''; });

  oldRender();

  // Bounded startup retries only; no MutationObserver loop.
  let tries=0;
  const t=setInterval(()=>{
    tries++;
    oldRender();
    if(tries>=20) clearInterval(t);
  },350);

  // Light maintenance timer: only touches DOM if needed, stable and low-cost.
  setInterval(oldRender, 2500);

  window.YAK_PRODUCT_CATEGORY_543={
    enhanceProductTable,
    renderFrontCategories,
    applyAdminFilter
  };
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init);
else init();

})();
