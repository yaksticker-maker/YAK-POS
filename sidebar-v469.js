
(function(){
'use strict';

function clearReceipt(){
  const receipt=document.getElementById('receiptDesignerPanel');
  if(receipt){
    receipt.classList.remove('active','yak-page-active');
    receipt.classList.add('hidden');
    receipt.style.display='none';
  }
}

function clearBackpagePanels(){
  document.querySelectorAll('[data-backpage-panel]').forEach(el=>{
    el.classList.remove('active','yak-page-active');
    el.classList.add('hidden');
    el.style.display='none';
  });
}

function setSidebarActive(btn){
  document.querySelectorAll('#yakSidebar69 .side-btn').forEach(x=>x.classList.remove('active'));
  if(btn)btn.classList.add('active');
}

function showNativeTab(name,btn){
  // Remove receipt/backpage visibility first so it cannot cover native tabs.
  clearBackpagePanels();

  // Native backoffice tabs.
  document.querySelectorAll(
    '#tab-dashboard,#tab-branches,#tab-employees,#tab-products,#tab-sales,#tab-reports,#tab-settings'
  ).forEach(el=>{
    el.classList.remove('active');
  });

  const target=document.getElementById('tab-'+name);
  if(!target){
    console.error('Missing tab:',name);
    return;
  }

  target.classList.remove('hidden');
  target.classList.add('active');
  target.style.display='';

  setSidebarActive(btn);

  // Refresh only the selected page.
  try{
    if(name==='dashboard' && typeof renderDashboard==='function')renderDashboard();
    else if(name==='branches' && typeof renderBranches==='function')renderBranches();
    else if(name==='employees' && typeof renderEmployees==='function')renderEmployees();
    else if(name==='products'){
      if(typeof renderProductsAdmin==='function')renderProductsAdmin();
      if(typeof m40Refresh==='function')m40Refresh();
      window.YAK_MATERIAL_LIVE_442?.render?.();
    }
    else if(name==='sales' && typeof renderSales==='function')renderSales();
    else if(name==='reports'){
      if(typeof renderReports==='function')renderReports();
      window.YAK_REPORTS?.render?.();
    }
  }catch(err){
    console.error('sidebar render',name,err);
  }

  // Sync bottom nav, without depending on its click handlers.
  const map={products:'products',reports:'reports',branches:'people',employees:'people'};
  const bottom=map[name];
  document.querySelectorAll('#yakBackNav .yak-back-tab').forEach(x=>{
    x.classList.toggle('active',!!bottom && x.dataset.backpage===bottom);
  });

  try{localStorage.setItem('yak_sidebar_page_469',name)}catch(e){}
}

function showReceipt(btn){
  // Hide all native tabs.
  document.querySelectorAll(
    '#tab-dashboard,#tab-branches,#tab-employees,#tab-products,#tab-sales,#tab-reports,#tab-settings'
  ).forEach(el=>el.classList.remove('active'));

  clearBackpagePanels();

  const receipt=document.getElementById('receiptDesignerPanel');
  if(!receipt){
    alert('ไม่พบหน้าตกแต่งสลิป');
    return;
  }

  receipt.classList.remove('hidden');
  receipt.classList.add('active','yak-page-active');
  receipt.style.display='block';

  setSidebarActive(btn);

  document.querySelectorAll('#yakBackNav .yak-back-tab').forEach(x=>{
    x.classList.toggle('active',x.dataset.backpage==='receipt');
  });

  try{
    if(typeof loadReceiptDesignForm==='function')loadReceiptDesignForm();
  }catch(err){
    console.error('receipt load',err);
  }

  try{localStorage.setItem('yak_sidebar_page_469','receipt')}catch(e){}
}

function open(page,btn){
  if(page==='receipt')showReceipt(btn);
  else showNativeTab(page,btn);
}

function restore(){
  if(!document.body.classList.contains('yak-backoffice'))return;

  let page='dashboard';
  try{page=localStorage.getItem('yak_sidebar_page_469')||'dashboard'}catch(e){}

  const btn=[...document.querySelectorAll('#yakSidebar69 .side-btn')].find(b=>{
    const text=b.textContent||'';
    return (page==='dashboard'&&text.includes('Dashboard')) ||
           (page==='branches'&&text.includes('สาขา')) ||
           (page==='employees'&&text.includes('พนักงาน')) ||
           (page==='products'&&text.includes('สินค้า')) ||
           (page==='sales'&&text.includes('ยอดขาย')) ||
           (page==='reports'&&text.includes('รายงาน')) ||
           (page==='receipt'&&text.includes('ตกแต่งสลิป'));
  });

  open(page,btn);
}

window.YAK_SIDEBAR_469={open,restore};

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',()=>setTimeout(restore,500));
}else{
  setTimeout(restore,500);
}
})();
