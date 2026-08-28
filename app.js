let cashHardwareAuthorized=false;

const defaultData = {
  branches:[{id:'b1',code:'YAK-001',name:'สาขาหลัก',active:true}],
  employees:[
    {id:'e1',code:'EMP001',name:'เจ้าของร้าน',pin:'1234',role:'owner',branchId:'b1',active:true},
    {id:'e2',code:'EMP002',name:'พนักงานหน้าร้าน',pin:'2222',role:'staff',branchId:'b1',active:true}
  ],
  products:[
    {id:'p1',name:'ถ่ายเอกสาร A4',price:2,cost:0.5,stock:500,minStock:100,trackStock:true,image:'',active:true},
    {id:'p2',name:'ปริ้นสี A4',price:10,cost:3,stock:200,minStock:50,trackStock:true,image:'',active:true},
    {id:'p3',name:'เคลือบบัตร A4',price:30,cost:10,stock:50,minStock:10,trackStock:true,image:'',active:true},
    {id:'p4',name:'สติ๊กเกอร์ A3',price:90,cost:35,stock:30,minStock:8,trackStock:true,image:'',active:true},
    {id:'p5',name:'ออกแบบกราฟิก',price:150,cost:20,stock:0,minStock:0,trackStock:false,image:'',active:true},
    {id:'p6',name:'งาน 3D Print',price:100,cost:35,stock:0,minStock:0,trackStock:false,image:'',active:true}
  ],
  sales:[]
};

let db = migrate(loadDB());
let loginMode='front', session=null, cart=[], payMethod='cash';
let salesChartObj=null, pieChartObj=null;

function loadDB(){
  try{
    const raw=localStorage.getItem('yak_pos_db_v2')||localStorage.getItem('yak_pos_db_v1');
    if(raw)return JSON.parse(raw);
  }catch(e){}
  return JSON.parse(JSON.stringify(defaultData));
}
function migrate(data){
  data.products=(data.products||[]).map(p=>({
    ...p,
    cost:Number(p.cost||0), stock:Number(p.stock||0), minStock:Number(p.minStock||0),
    trackStock:p.trackStock!==undefined?p.trackStock:true, image:p.image||''
  }));
  data.sales=(data.sales||[]).map(s=>({
    ...s,
    costTotal:Number(s.costTotal||((s.items||[]).reduce((a,i)=>a+Number(i.cost||0)*Number(i.qty||0),0)))
  }));
  localStorage.setItem('yak_pos_db_v2',JSON.stringify(data));
  return data;
}
function saveDB(){localStorage.setItem('yak_pos_db_v2',JSON.stringify(db))}
function money(v){return new Intl.NumberFormat('th-TH',{style:'currency',currency:'THB'}).format(Number(v||0))}
function showView(id){document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));document.getElementById(id).classList.add('active')}
function toast(msg){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),1800)}
function activeBranches(){return db.branches.filter(b=>b.active)}
function branchById(id){return db.branches.find(b=>b.id===id)}
function refreshBranchSelects(){
  const opts=activeBranches().map(b=>`<option value="${b.id}">${b.code} — ${b.name}</option>`).join('');
  loginBranch.innerHTML=opts; empBranch.innerHTML=opts;
}
function openLogin(mode){loginMode=mode;
function loadPrinterCheck(){
  const saved = JSON.parse(localStorage.getItem('yak_pos_printer_check') || 'null');
  const badge = document.getElementById('printerStatusBadge');
  const text = document.getElementById('printerStatusText');
  const last = document.getElementById('printerLastTest');
  if(!badge || !text || !last) return;
  if(!saved){
    badge.className='printer-status not-tested';
    badge.textContent='● ยังไม่ได้ตรวจสอบ';
    text.textContent='ยังไม่ได้ทดสอบเครื่องพิมพ์บิล';
    last.textContent='กด “ทดสอบพิมพ์” เพื่อเปิดหน้าพิมพ์ทดสอบ';
    return;
  }
  if(saved.status==='ready'){
    badge.className='printer-status ready';
    badge.textContent='● พร้อมใช้งาน';
    text.textContent='เครื่องพิมพ์บิลผ่านการทดสอบล่าสุด';
  }else{
    badge.className='printer-status problem';
    badge.textContent='● ต้องตรวจสอบ';
    text.textContent='การทดสอบล่าสุดแจ้งว่าพิมพ์ไม่ออก';
  }
  last.textContent='ตรวจล่าสุด: '+new Date(saved.time).toLocaleString('th-TH')+(saved.paper?' • '+saved.paper+' มม.':'');
}
function savePrinterCheck(status){
  const paper=document.getElementById('receiptPaperSize')?.value || '80';
  localStorage.setItem('yak_pos_printer_check', JSON.stringify({status,time:new Date().toISOString(),paper}));
  loadPrinterCheck();
updateCashPaymentVisibility();
updateDrawerAvailability();
}
function confirmPrinterReady(){savePrinterCheck('ready');toast('บันทึกว่าเครื่องพิมพ์พร้อมใช้งานแล้ว')}
function markPrinterProblem(){savePrinterCheck('problem');toast('บันทึกปัญหาเครื่องพิมพ์แล้ว')}
function testReceiptPrinter(){
  const paper=document.getElementById('receiptPaperSize')?.value || '80';
  const w=window.open('','YAK_POS_PRINT_TEST','width=420,height=650');
  if(!w){toast('เบราว์เซอร์บล็อกหน้าต่างพิมพ์ กรุณาอนุญาต Pop-up');return}
  const html=`<!doctype html><html><head><meta charset="utf-8"><title>YAK POS Print Test</title>
  <style>
    @page{size:${paper}mm auto;margin:3mm}
    body{font-family:Arial,Tahoma,sans-serif;width:${paper==='58'?'52':'72'}mm;margin:0 auto;color:#000}
    .c{text-align:center}.line{border-top:1px dashed #000;margin:8px 0}
    h2{font-size:18px;margin:5px 0}p{font-size:18px;margin:4px 0}.big{font-size:16px;font-weight:bold}
  </style></head><body>
    <div class="c"><h2>YAK POS</h2><p>ทดสอบเครื่องพิมพ์บิล</p></div>
    <div class="line"></div>
    <p>วันที่: ${new Date().toLocaleString('th-TH')}</p>
    <p>กระดาษ: ${paper} มม.</p>
    <p>รายการทดสอบ ........ 1 x 10.00</p>
    <div class="line"></div>
    <p class="big c">TOTAL 10.00 THB</p>
    <div class="line"></div>
    <p class="c">ถ้าใบนี้พิมพ์ออก ให้กลับไปกด “พิมพ์สำเร็จ”</p>
    <script>window.onload=()=>setTimeout(()=>window.print(),250);<\/script>
  </body></html>`;
  w.document.open();w.document.write(html);w.document.close();
}

refreshBranchSelects();
loadPrinterCheck();
updateCashPaymentVisibility();loginTitle.textContent=mode==='front'?'เข้าสู่หน้าร้าน':'เข้าสู่หลังร้าน';loginSubtitle.textContent=mode==='front'?'ใช้รหัสพนักงานเพื่อเปิดหน้าขาย':'สำหรับ Owner / Manager ที่ได้รับสิทธิ์';loginError.textContent='';loginEmp.value='';loginPin.value='';showView('loginView')}
function attemptLogin(){
  const branchId=loginBranch.value, code=loginEmp.value.trim().toUpperCase(), pin=loginPin.value.trim();
  const emp=db.employees.find(e=>e.code.toUpperCase()===code&&e.pin===pin&&e.active);
  if(!emp){loginError.textContent='รหัสพนักงานหรือ PIN ไม่ถูกต้อง';return}
  if(emp.role!=='owner'&&emp.branchId!==branchId){loginError.textContent='พนักงานนี้ไม่ได้อยู่ในสาขาที่เลือก';return}
  if(loginMode==='back'&&!['owner','manager'].includes(emp.role)){loginError.textContent='บัญชีนี้ไม่มีสิทธิ์เข้าหลังร้าน';return}
  session={employeeId:emp.id,branchId,mode:loginMode};updateSessionUI();
  if(loginMode==='front'){
    cart=[];
    document.body.classList.remove('yak-intro','yak-backoffice','yak-back-locked');
    document.body.classList.add('yak-front');
    showView('frontView');

    // Render after frontView is already visible, so a render error cannot block entry.
    setTimeout(()=>{
      try{renderProducts()}catch(e){console.error('front renderProducts',e)}
      try{renderCart()}catch(e){console.error('front renderCart',e)}
      try{renderStockAlerts()}catch(e){console.error('front stock alerts',e)}
      try{renderFrontDailySummary()}catch(e){console.error('front daily summary',e)}
      try{renderTodayVsYesterday()}catch(e){console.error('front comparison',e)}
      try{updateDrawerAvailability()}catch(e){console.error('front drawer status',e)}
    },0);
  }
  else{
    document.body.classList.remove('yak-intro','yak-front','yak-back-locked');
    document.body.classList.add('yak-backoffice');
    showView('backView');

    setTimeout(()=>{
      try{renderBackoffice()}catch(e){console.error('renderBackoffice',e)}
      try{
        const productBtn=document.querySelector('[data-tab="products"]');
        openBackTab('products',productBtn);
      }catch(e){console.error('openBackTab products',e)}
      try{if(typeof m40Refresh==='function')m40Refresh()}catch(e){}
      try{if(window.YAK_MATERIAL_LIVE_442?.render)window.YAK_MATERIAL_LIVE_442.render()}catch(e){}
    },0);
  }
}
function updateSessionUI(){const box=sessionBox;if(!session){box.classList.add('hidden');return}const emp=db.employees.find(e=>e.id===session.employeeId),br=branchById(session.branchId);sessionText.textContent=`${emp.name} • ${br?br.name:''}`;box.classList.remove('hidden');branchLabel.textContent=br?`${br.code} — ${br.name}`:'YAK POS'}
function logout(){session=null;cart=[];sessionBox.classList.add('hidden');branchLabel.textContent='ระบบหน้าร้านและหลังร้าน';showView('homeView')}
function goHome(){logout()}

function lowStockProducts(){return db.products.filter(p=>p.active&&p.trackStock&&Number(p.stock)<=Number(p.minStock))}


function yakProductUsesMaterials(productId){
  return (db.productMaterials||[]).some(l=>l.productId===productId);
}
function yakCheckLinkedMaterialAvailability(items){
  const required={};

  for(const item of (items||[])){
    const productId=item.productId||item.id;
    const saleQty=Number(item.qty||0);
    const links=(db.productMaterials||[]).filter(l=>l.productId===productId);

    for(const l of links){
      const m=(db.materials||[]).find(x=>x.id===l.materialId);
      if(!m || !m.active){
        return {ok:false,message:`วัตถุดิบของสินค้า ${item.name||''} ถูกปิดใช้งานหรือไม่พบข้อมูล`};
      }
      const need=Number(l.qtyPerSale||0)*saleQty;
      required[m.id]=(required[m.id]||0)+need;
    }
  }

  for(const [id,need] of Object.entries(required)){
    const m=(db.materials||[]).find(x=>x.id===id);
    if(!m)continue;
    if(Number(m.stock||0)<need){
      return {
        ok:false,
        message:`วัตถุดิบ ${m.name} ไม่พอ • ต้องใช้ ${need} ${m.unit||''} • เหลือ ${m.stock} ${m.unit||''}`
      };
    }
  }
  return {ok:true,required};
}

function renderStockAlerts(){
  const box=document.getElementById('stockAlert');
  if(!box)return;

  db.materials=Array.isArray(db.materials)?db.materials:[];
  db.productMaterials=Array.isArray(db.productMaterials)?db.productMaterials:[];

  const alerts=[];

  // Products without linked materials: use product stock as before.
  for(const p of (db.products||[])){
    if(!p.active)continue;
    const links=db.productMaterials.filter(l=>l.productId===p.id);

    if(links.length){
      // Material-managed product: never warn from p.stock.
      for(const l of links){
        const m=db.materials.find(x=>x.id===l.materialId);
        if(!m || !m.active)continue;
        if(Number(m.stock||0)<=Number(m.minStock||0)){
          alerts.push({
            key:'m:'+m.id,
            name:m.name,
            stock:Number(m.stock||0),
            min:Number(m.minStock||0),
            unit:m.unit||'',
            type:'material'
          });
        }
      }
    }else if(p.trackStock && Number(p.stock||0)<=Number(p.minStock||0)){
      alerts.push({
        key:'p:'+p.id,
        name:p.name,
        stock:Number(p.stock||0),
        min:Number(p.minStock||0),
        unit:'',
        type:'product'
      });
    }
  }

  // Remove duplicates where one material is linked to several products.
  const unique=[...new Map(alerts.map(a=>[a.key,a])).values()];

  if(!unique.length){
    box.classList.add('hidden');
    box.innerHTML='';
    return;
  }

  box.classList.remove('hidden');
  box.innerHTML=`
    <b>⚠️ แจ้งเตือนสต๊อกใกล้หมด ${unique.length} รายการ</b>
    <div class="stock-alert-items">
      ${unique.map(a=>`
        <span>${a.type==='material'?'วัตถุดิบ: ':''}${a.name}
        • เหลือ ${a.stock}${a.unit?' '+a.unit:''}
        / จุดเตือน ${a.min}${a.unit?' '+a.unit:''}</span>
      `).join('')}
    </div>`;
}

function renderProducts(){
  const q=(document.getElementById('productSearch')?.value||'').trim().toLowerCase();
  const list=db.products.filter(p=>p.active && (!q || p.name.toLowerCase().includes(q)));

  const frontGrid=document.getElementById('productGrid');
  if(!frontGrid)return;
  frontGrid.innerHTML=list.map(p=>{
    const links=(db.productMaterials||[]).filter(l=>l.productId===p.id);
    const materialManaged=links.length>0;

    let stockLine='';
    let blocked=false;

    if(materialManaged){
      const materials=links.map(l=>{
        const m=(db.materials||[]).find(x=>x.id===l.materialId);
        return {link:l,material:m};
      }).filter(x=>x.material);

      const inactive=materials.filter(x=>!x.material.active);
      const low=materials.filter(x=>x.material.active && Number(x.material.stock||0)<=Number(x.material.minStock||0));
      const empty=materials.filter(x=>x.material.active && Number(x.material.stock||0)<=0);

      blocked=inactive.length>0 || empty.length>0;

      const remainText=materials.length
        ? materials.map(x=>`${x.material.name} ${Number(x.material.stock||0)} ${x.material.unit||''}`).join(' • ')
        : 'ไม่พบวัตถุดิบ';
      if(inactive.length){
        stockLine=`<div class="product-stock material-warning">วัตถุดิบปิดใช้งาน • ${remainText}</div>`;
      }else if(empty.length){
        stockLine=`<div class="product-stock material-danger">วัตถุดิบหมด • ${remainText}</div>`;
      }else if(low.length){
        stockLine=`<div class="product-stock material-warning">วัตถุดิบใกล้หมด • เหลือ ${remainText}</div>`;
      }else{
        stockLine=`<div class="product-stock material-ok">วัตถุดิบพร้อม • เหลือ ${remainText}</div>`;
      }
    }else if(p.trackStock){
      blocked=Number(p.stock||0)<=0;
      stockLine=`<div class="product-stock ${Number(p.stock||0)<=Number(p.minStock||0)?'low':''}">
        สต๊อก ${Number(p.stock||0)}${Number(p.stock||0)<=Number(p.minStock||0)?' • ใกล้หมด':''}
      </div>`;
    }else{
      stockLine=`<div class="product-stock service">บริการ</div>`;
    }

    return `<button class="product-card ${blocked?'disabled':''}" ${blocked?'disabled':''} onclick="addToCart('${p.id}')">
      <div class="product-img">${p.image?`<img src="${p.image}" alt="">`:'📦'}</div>
      <div class="product-name">${p.name}</div>
      <div class="product-price">${money(p.price)}</div>
      ${stockLine}
    </button>`;
  }).join('') || '<div class="empty">ไม่พบสินค้า</div>';
}

function addToCart(id){
  const p=db.products.find(x=>x.id===id);if(!p)return;
  const inCart=cart.find(x=>x.productId===id), qty=(inCart?.qty||0)+1;
  if(p.trackStock&&!yakProductUsesMaterials(p.id)&&qty>p.stock){toast('สต๊อกไม่พอ');return}
  if(inCart)inCart.qty++;else cart.push({productId:id,name:p.name,price:p.price,cost:p.cost||0,qty:1});
  renderCart()
}
function changeQty(id,delta){
  const i=cart.findIndex(x=>x.productId===id);if(i<0)return;
  const p=db.products.find(x=>x.id===id);
  if(delta>0&&p?.trackStock&&!yakProductUsesMaterials(p.id)&&cart[i].qty+1>p.stock){toast('สต๊อกไม่พอ');return}
  cart[i].qty+=delta;if(cart[i].qty<=0)cart.splice(i,1);renderCart()
}
function clearCart(){cart=[];renderCart()}
function renderCart(){
  if(!cartItems)return;cartBranch.textContent=branchById(session?.branchId)?.name||'';
  cartItems.innerHTML=cart.length?cart.map(x=>`<div class="cart-row"><div><div class="name">${x.name}</div><div class="price">${money(x.price)} × ${x.qty}</div></div><div class="qty"><button onclick="changeQty('${x.productId}',-1)">−</button><strong>${x.qty}</strong><button onclick="changeQty('${x.productId}',1)">+</button></div></div>`).join(''):'<div class="empty">ยังไม่มีสินค้าในบิล</div>';
  const subtotal=cart.reduce((s,x)=>s+x.price*x.qty,0),discount=Math.max(0,Number(discountInput?.value||0)),total=Math.max(0,subtotal-discount);
  document.getElementById('subtotal').textContent=money(subtotal);grandTotal.textContent=money(total);calculateChange()
}
function selectPay(btn){document.querySelectorAll('.pay').forEach(x=>x.classList.remove('active'));btn.classList.add('active');payMethod=btn.dataset.pay;updateCashPaymentVisibility();updateDrawerAvailability();calculateChange()}


function isSameLocalDay(dateValue, now=new Date()){
  const d=new Date(dateValue);
  return d.getFullYear()===now.getFullYear() &&
         d.getMonth()===now.getMonth() &&
         d.getDate()===now.getDate();
}

function getTodayBranchSales(){
  return db.sales.filter(s=>s.branchId===session?.branchId && isSameLocalDay(s.date));
}
function dailyIncomeData(){
  const sales=getTodayBranchSales();
  const total=sales.reduce((a,s)=>a+Number(s.total||0),0);
  const cash=sales.filter(s=>s.payMethod==='cash').reduce((a,s)=>a+Number(s.total||0),0);
  const qr=sales.filter(s=>s.payMethod==='qr').reduce((a,s)=>a+Number(s.total||0),0);
  const card=sales.filter(s=>s.payMethod==='card').reduce((a,s)=>a+Number(s.total||0),0);
  const discount=sales.reduce((a,s)=>a+Number(s.discount||0),0);
  const cost=sales.reduce((a,s)=>a+Number(s.costTotal||0),0);
  const profit=total-cost;
  return {sales,total,cash,qr,card,discount,cost,profit};
}
function buildDailyIncomeReceiptHTML(forPrint=false){
  const d=dailyIncomeData();
  const br=branchById(session?.branchId);
  const emp=currentEmployee();
  const now=new Date();
  const paymentRows=`
    <div class="r"><span>เงินสด</span><span>${money(d.cash)}</span></div>
    <div class="r"><span>QR / โอน</span><span>${money(d.qr)}</span></div>
    <div class="r"><span>บัตร</span><span>${money(d.card)}</span></div>`;
  return `
    <h3>YAK POS</h3>
    <div class="c">สรุปรายรับประจำวัน</div>
    <div class="c small">${br?br.code+' '+br.name:''}</div>
    <div class="line"></div>
    <div class="r"><span>วันที่</span><span>${now.toLocaleDateString('th-TH')}</span></div>
    <div class="r"><span>เวลาพิมพ์</span><span>${now.toLocaleTimeString('th-TH')}</span></div>
    <div class="r"><span>ผู้พิมพ์</span><span>${emp?emp.name:''}</span></div>
    <div class="line"></div>
    <div class="r"><span>จำนวนบิล</span><span>${d.sales.length}</span></div>
    <div class="r"><span>ส่วนลดรวม</span><span>${money(d.discount)}</span></div>
    <div class="line"></div>
    ${paymentRows}
    <div class="line"></div>
    <div class="r big"><span>รายรับรวม</span><span>${money(d.total)}</span></div>
    <div class="line"></div>
    <div class="c small">เอกสารสรุปจากระบบ YAK POS</div>`;
}
function showDailyIncomePreview(){
  const modal=document.getElementById('dailyIncomeModal');
  const preview=document.getElementById('dailyIncomePreview');
  if(!modal||!preview)return;
  preview.innerHTML=buildDailyIncomeReceiptHTML(false);
  modal.classList.remove('hidden');
}
function closeDailyIncomePreview(){
  document.getElementById('dailyIncomeModal')?.classList.add('hidden');
}
function confirmPrintDailyIncome(){
  const paper=document.getElementById('receiptPaperSize')?.value || JSON.parse(localStorage.getItem('yak_pos_printer_check')||'{}')?.paper || '80';
  const content=buildDailyIncomeReceiptHTML(true);
  const w=window.open('','YAK_POS_DAILY_SUMMARY','width=420,height=720');
  if(!w){toast('เบราว์เซอร์บล็อกหน้าต่างพิมพ์ กรุณาอนุญาต Pop-up');return}
  w.document.open();
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Daily Summary</title>
    <style>
      @page{size:${paper}mm auto;margin:3mm}
      body{font-family:Arial,Tahoma,sans-serif;width:${paper==='58'?'52':'72'}mm;margin:0 auto;color:#000;font-size:18px}
      h3{text-align:center;margin:3px 0 5px}.c{text-align:center}.line{border-top:1px dashed #000;margin:8px 0}
      .r{display:flex;justify-content:space-between;gap:10px;margin:5px 0}.big{font-size:16px;font-weight:800}.small{font-size:10px}
    </style></head><body>${content}
    <script>window.onload=()=>setTimeout(()=>window.print(),250);<\/script>
  </body></html>`);
  w.document.close();
  closeDailyIncomePreview();
  toast('ส่งสรุปรายรับไปยังเครื่องพิมพ์แล้ว');
}

function renderFrontDailySummary(){
  const sales = db.sales.filter(s => s.branchId===session?.branchId && isSameLocalDay(s.date));
  const total = sales.reduce((a,s)=>a+Number(s.total||0),0);
  const cash = sales.filter(s=>s.payMethod==='cash').reduce((a,s)=>a+Number(s.total||0),0);
  const nonCash = sales.filter(s=>s.payMethod!=='cash').reduce((a,s)=>a+Number(s.total||0),0);
  const set=(id,val)=>{const el=document.getElementById(id);if(el)el.textContent=val};
  set('frontTodaySales',money(total));
  set('frontTodayBills',String(sales.length));
  set('frontTodayCash',money(cash));
  set('frontTodayNonCash',money(nonCash));
}
function updateDrawerAvailability(){
  const btn=document.getElementById('manualDrawerButton');
  if(btn) btn.disabled = payMethod!=='cash';
}


function receiptDesignDefaults(){
  return {
    shopName:'YAK POS',
    headerText:'',
    phone:'',
    footerText:'ขอบคุณที่ใช้บริการ',
    headerImage:'',
    logoSize:80,
    shopFontSize:22,
    headerAlign:'center',
    showPhone:true,
    showQr:false,
    qrImage:'',
    showBillNo:true,
    showEmployee:true
  };
}
function receiptDesignSettings(){
  const d=receiptDesignDefaults();
  try{
    return {...d,...JSON.parse(localStorage.getItem('yak_receipt_design')||'{}')};
  }catch(e){
    return d;
  }
}
function rd60FormSettings(){
  const g=id=>document.getElementById(id);
  return {
    shopName:g('rdShopName')?.value||'YAK POS',
    headerText:g('rdHeaderText')?.value||'',
    phone:g('rdPhone')?.value||'',
    footerText:g('rdFooterText')?.value||'ขอบคุณที่ใช้บริการ',
    headerImage:g('rdHeaderImage')?.value||'',
    logoSize:Number(g('rdLogoSize')?.value||80),
    shopFontSize:Number(g('rdShopFontSize')?.value||22),
    headerAlign:g('rdHeaderAlign')?.value||'center',
    showPhone:!!g('rdShowPhone')?.checked,
    showQr:!!g('rdShowQr')?.checked,
    qrImage:g('rdQrImage')?.value||'',
    showBillNo:!!g('rdShowBillNo')?.checked,
    showEmployee:!!g('rdShowEmployee')?.checked
  };
}
function saveReceiptDesign(){
  const s=rd60FormSettings();
  localStorage.setItem('yak_receipt_design',JSON.stringify(s));
  toast('บันทึกการตกแต่งสลิปแล้ว');
  renderReceiptDesignPreview();
}
function loadReceiptDesignForm(){
  const s=receiptDesignSettings();
  const set=(id,v)=>{const e=document.getElementById(id);if(e)e.value=v??''};
  const chk=(id,v)=>{const e=document.getElementById(id);if(e)e.checked=!!v};

  set('rdShopName',s.shopName);
  set('rdHeaderText',s.headerText);
  set('rdPhone',s.phone);
  set('rdFooterText',s.footerText);
  set('rdQrImage',s.qrImage);
  set('rdHeaderImage',s.headerImage);
  set('rdLogoSize',s.logoSize);
  set('rdShopFontSize',s.shopFontSize);
  set('rdHeaderAlign',s.headerAlign);

  chk('rdShowPhone',s.showPhone);
  chk('rdShowQr',s.showQr);
  chk('rdShowBillNo',s.showBillNo);
  chk('rdShowEmployee',s.showEmployee);

  const sizeText=document.getElementById('rd60LogoSizeText');
  if(sizeText)sizeText.textContent=`${s.logoSize}%`;

  renderReceiptDesignPreview();
}
function renderReceiptDesignPreview(){
  const box=document.getElementById('receiptDesignPreview');
  if(!box)return;

  const s=rd60FormSettings();
  const align=['left','center','right'].includes(s.headerAlign)?s.headerAlign:'center';

  box.innerHTML=`
    <div class="receipt60-paper">
      <div style="text-align:${align}">
        ${s.headerImage?`
          <div style="margin-bottom:7px;text-align:${align}">
            <img src="${s.headerImage}"
              style="display:inline-block;width:${s.logoSize}%;max-height:105px;object-fit:contain">
          </div>`:''}

        <div style="font-weight:900;font-size:${s.shopFontSize}px;line-height:1.15">
          ${s.shopName||'YAK POS'}
        </div>

        ${s.headerText?`<div style="margin-top:3px">${s.headerText}</div>`:''}
        ${s.showPhone&&s.phone?`<div style="margin-top:2px">โทร ${s.phone}</div>`:''}
      </div>

      <div class="receipt60-dash"></div>

      ${s.showBillNo?'<div>เลขบิล: TEST-001</div>':''}
      <div>วันที่: 28/08/2569 13:30</div>
      ${s.showEmployee?'<div>พนักงาน: พนักงานหน้าร้าน</div>':''}

      <div class="receipt60-dash"></div>
      <div class="receipt60-line"><span>ถ่ายเอกสาร x5</span><span>10.00</span></div>
      <div class="receipt60-line"><span>QR x1</span><span>25.00</span></div>
      <div class="receipt60-dash"></div>

      <div class="receipt60-line receipt60-total"><span>สุทธิ</span><span>35.00</span></div>
      <div class="receipt60-line"><span>ชำระ</span><span>เงินสด</span></div>

      ${s.showQr&&s.qrImage?`
        <div style="text-align:center;margin:10px 0 5px">
          <img src="${s.qrImage}" style="width:105px;height:105px;object-fit:contain">
        </div>`:''}

      ${s.footerText?`<div style="text-align:center;font-weight:700;margin-top:10px">${s.footerText}</div>`:''}
    </div>`;
}
function rd60ReadImageTo(id){
  const input=document.createElement('input');
  input.type='file';
  input.accept='image/png,image/jpeg,image/webp';
  input.onchange=()=>{
    const file=input.files?.[0];
    if(!file)return;
    if(file.size>3*1024*1024){
      toast('รูปใหญ่เกิน 3 MB กรุณาเลือกรูปที่เล็กลง');
      return;
    }
    const reader=new FileReader();
    reader.onload=()=>{
      const target=document.getElementById(id);
      if(target)target.value=reader.result;
      renderReceiptDesignPreview();
    };
    reader.readAsDataURL(file);
  };
  input.click();
}
function chooseReceiptHeaderImage(){rd60ReadImageTo('rdHeaderImage')}
function clearReceiptHeaderImage(){
  const e=document.getElementById('rdHeaderImage');
  if(e)e.value='';
  renderReceiptDesignPreview();
}
function chooseReceiptQr(){rd60ReadImageTo('rdQrImage')}
function clearReceiptQr(){
  const e=document.getElementById('rdQrImage');
  if(e)e.value='';
  const check=document.getElementById('rdShowQr');
  if(check)check.checked=false;
  renderReceiptDesignPreview();
}
function rd60Reset(){
  localStorage.removeItem('yak_receipt_design');
  const d=receiptDesignDefaults();
  localStorage.setItem('yak_receipt_design',JSON.stringify(d));
  loadReceiptDesignForm();
  toast('คืนค่าตกแต่งสลิปเริ่มต้นแล้ว');
}
function rd60Bind(){
  const ids=[
    'rdShopName','rdHeaderText','rdPhone','rdFooterText',
    'rdLogoSize','rdShopFontSize','rdHeaderAlign',
    'rdShowPhone','rdShowBillNo','rdShowEmployee','rdShowQr'
  ];
  ids.forEach(id=>{
    const e=document.getElementById(id);
    if(!e)return;
    e.addEventListener(e.type==='checkbox'?'change':'input',renderReceiptDesignPreview);
    e.addEventListener('change',renderReceiptDesignPreview);
  });

  document.getElementById('rdLogoSize')?.addEventListener('input',e=>{
    const t=document.getElementById('rd60LogoSizeText');
    if(t)t.textContent=`${e.target.value}%`;
  });

  document.getElementById('rd60ChooseHeader')?.addEventListener('click',chooseReceiptHeaderImage);
  document.getElementById('rd60ClearHeader')?.addEventListener('click',clearReceiptHeaderImage);
  document.getElementById('rd60ChooseQr')?.addEventListener('click',chooseReceiptQr);
  document.getElementById('rd60ClearQr')?.addEventListener('click',clearReceiptQr);
  document.getElementById('rd60SaveBtn')?.addEventListener('click',saveReceiptDesign);
  document.getElementById('rd60SaveBtnBottom')?.addEventListener('click',saveReceiptDesign);
  document.getElementById('rd60ResetBtn')?.addEventListener('click',rd60Reset);

  loadReceiptDesignForm();
}
window.addEventListener('DOMContentLoaded',()=>setTimeout(rd60Bind,500));

function printReceipt(sale){
  const p=desktopPrinterProfile();
  const paper=p?.paper||document.getElementById('receiptPaperSize')?.value||'58';
  const emp=db.employees.find(e=>e.id===sale.employeeId);
  const br=branchById(sale.branchId);
  const pay=sale.payMethod==='cash'?'เงินสด':sale.payMethod==='qr'?'QR / โอน':'บัตร';
  const rd=receiptDesignSettings();

  const items=(sale.items||[]).map(i=>`
    <div style="display:flex;justify-content:space-between;gap:8px;margin:3px 0">
      <span style="flex:1;min-width:0;overflow-wrap:anywhere">${i.name} x${i.qty}</span>
      <span style="white-space:nowrap">${money(i.price*i.qty)}</span>
    </div>`).join('');

  const html=`
    <div style="${RECEIPT_MASTER_STYLE}">
      <div style="text-align:${rd.headerAlign||'center'}">
        ${rd.headerImage?`<div style="margin-bottom:6px;text-align:${rd.headerAlign||'center'}"><img src="${rd.headerImage}" style="width:${Number(rd.logoSize||80)}%;max-height:110px;object-fit:contain"></div>`:''}
        <div style="margin:0 0 2px;font-weight:900;font-size:${Number(rd.shopFontSize||22)}px;line-height:1.15">${rd.shopName||'YAK POS'}</div>
        <div style="font-weight:700">${br?br.name:''}</div>
        ${rd.headerText?`<div>${rd.headerText}</div>`:''}
        ${rd.showPhone&&rd.phone?`<div>โทร ${rd.phone}</div>`:''}
      </div>
      <hr>
      ${rd.showBillNo?`<div>เลขบิล: ${sale.id}</div>`:''}
      <div>วันที่: ${new Date(sale.date).toLocaleString('th-TH')}</div>
      ${rd.showEmployee?`<div>พนักงาน: ${emp?emp.name:''}</div>`:''}
      <hr>
      ${items}
      <hr>
      <div style="display:flex;justify-content:space-between;gap:8px;font-weight:800;font-size:1.15em">
        <span>สุทธิ</span>
        <span style="white-space:nowrap">${money(sale.total)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;gap:8px">
        <span>ชำระ</span><span>${pay}</span>
      </div>
      ${sale.payMethod==='cash'?`
        <div style="display:flex;justify-content:space-between;gap:8px">
          <span>รับเงิน</span><span>${money(sale.cashReceived)}</span>
        </div>
        <div style="display:flex;justify-content:space-between;gap:8px;font-weight:700">
          <span>เงินทอน</span><span>${money(sale.change)}</span>
        </div>`:''}
      <hr>
      ${rd.showQr&&rd.qrImage?`<div style="text-align:center;margin:8px 0"><img src="${rd.qrImage}" style="max-width:42%;height:auto"></div>`:''}
      <div style="text-align:center;font-weight:700">${rd.footerText||''}</div>
    </div>`;

  if(window.yakDesktop&&p){
    window.yakDesktop.printReceipt({
      deviceName:p.name,
      paper:p.paper||'58',
      html
    }).then(r=>{
      if(!r?.ok)toast('พิมพ์สลิปไม่สำเร็จ');
    });
    return true;
  }

  const w=window.open('','YAK_POS_RECEIPT_'+sale.id,'width=420,height=700');
  if(!w)return false;
  w.document.write(`<meta charset="utf-8">${html}<script>window.onload=()=>setTimeout(()=>window.print(),200);<\/script>`);
  w.document.close();
  return true;
}


function sanitizeCashInput(){
  const el=document.getElementById('cashReceived');
  if(!el)return;
  let v=String(el.value||'').replace(/[^0-9.]/g,'');
  const parts=v.split('.');
  if(parts.length>2)v=parts.shift()+'.'+parts.join('');
  if(parts.length>=2){
    const p=v.split('.');
    v=p[0]+'.'+p[1].slice(0,2);
  }
  el.value=v;
}
function cashKey(key){
  const el=document.getElementById('cashReceived');if(!el)return;
  let v=String(el.value||'');
  if(key==='.' && v.includes('.'))return;
  if(key==='.' && !v)v='0';
  if(v==='0' && key!=='.' && key!=='00')v='';
  v+=key;
  el.value=v;
  sanitizeCashInput();
  calculateChange();
}
function cashBackspace(){
  const el=document.getElementById('cashReceived');if(!el)return;
  el.value=String(el.value||'').slice(0,-1);
  calculateChange();
}
function cashClear(){
  const el=document.getElementById('cashReceived');if(!el)return;
  el.value='';
  calculateChange();
}

function currentGrandTotal(){
  const subtotal=cart.reduce((s,x)=>s+x.price*x.qty,0);
  const discount=Math.max(0,Number(document.getElementById('discountInput')?.value||0));
  return Math.max(0,subtotal-discount);
}
function calculateChange(){
  const box=document.getElementById('cashPaymentBox');
  if(!box)return;
  const total=currentGrandTotal();
  const received=Number(document.getElementById('cashReceived')?.value||0);
  const change=Math.max(0,received-total);
  document.getElementById('changeAmount').textContent=money(change);
}
function setCashReceived(v){
  const el=document.getElementById('cashReceived'); if(!el)return;
  el.value=v; calculateChange();
}
function setExactCash(){
  const el=document.getElementById('cashReceived'); if(!el)return;
  el.value=currentGrandTotal().toFixed(2); calculateChange();
}
function updateCashPaymentVisibility(){
  const box=document.getElementById('cashPaymentBox');
  if(!box)return;
  box.style.display=payMethod==='cash'?'block':'none';
}
function openCashDrawer(){
  if(!cashHardwareAuthorized || payMethod!=='cash'){
    toast('ลิ้นชักเปิดได้เฉพาะหลังชำระเงินสดสำเร็จ');
    return false;
  }

  const p = desktopPrinterProfile ? desktopPrinterProfile() : null;

  if(window.yakDesktop && p && window.yakDesktop.openDrawer){
    window.yakDesktop.openDrawer({deviceName:p.name}).then(r=>{
      if(!r?.ok) toast('เปิดลิ้นชักไม่สำเร็จ');
    });
    localStorage.setItem('yak_pos_last_drawer_command', new Date().toISOString());
    return true;
  }

  toast('ไม่พบเครื่องพิมพ์หลักสำหรับสั่งลิ้นชัก');
  return false;
}

function checkout(){
  if(!cart.length){toast('ยังไม่มีสินค้าในบิล');return}
  for(const x of cart){
    const p=db.products.find(pp=>pp.id===x.productId);
    if(p?.trackStock && !yakProductUsesMaterials(p.id) &&x.qty>p.stock){toast(`สต๊อก ${p.name} ไม่พอ`);return}
  }

  const subtotal=cart.reduce((s,x)=>s+x.price*x.qty,0);
  const discount=Math.max(0,Number(discountInput.value||0));
  const total=Math.max(0,subtotal-discount);
  const costTotal=cart.reduce((s,x)=>s+Number(x.cost||0)*x.qty,0);

  let cashReceivedValue=0, changeValue=0;
  if(payMethod==='cash'){
    cashReceivedValue=Number(document.getElementById('cashReceived')?.value||0);
    if(cashReceivedValue<total){
      toast(`เงินสดไม่พอ ขาด ${money(total-cashReceivedValue)}`);
      return;
    }
    changeValue=Math.max(0,cashReceivedValue-total);
  }

  const materialCheck=yakCheckLinkedMaterialAvailability(cart);
  if(!materialCheck.ok){
    toast(materialCheck.message);
    return;
  }

  const materialResult=deductLinkedMaterialsForSale(cart);
  if(!materialResult.ok){
    toast(materialResult.errors[0]);
    return;
  }

  cart.forEach(x=>{
    const p=db.products.find(pp=>pp.id===x.productId);
    const materialManaged=(db.productMaterials||[]).some(l=>l.productId===x.productId);
    // If a product uses linked materials, material stock is the source of truth.
    if(p?.trackStock && !yakProductUsesMaterials(p.id) && !materialManaged)p.stock=Math.max(0,p.stock-x.qty)
  });

  const sale={
    id:'S'+Date.now(),
    date:new Date().toISOString(),
    branchId:session.branchId,
    employeeId:session.employeeId,
    items:JSON.parse(JSON.stringify(cart)),
    subtotal,discount,total,costTotal,payMethod,
    cashReceived:cashReceivedValue,
    change:changeValue
  };

  db.sales.unshift(sale);
  saveDB();

  // ทุกวิธีชำระเงิน: พิมพ์สลิปแบบ RAW ESC/POS
  // สลิปนี้ไม่มีคำสั่งเปิดลิ้นชัก
  printReceipt(sale);

  // เฉพาะเงินสดเท่านั้นที่ส่งคำสั่งเปิดลิ้นชักแยกต่างหาก
  if(payMethod==='cash'){
    cashHardwareAuthorized=true;
    openCashDrawer();
    cashHardwareAuthorized=false;
  }

  cart=[];
  discountInput.value=0;
  if(document.getElementById('cashReceived'))document.getElementById('cashReceived').value='';
  renderCart();
  renderProducts();
  renderStockAlerts();
  renderFrontDailySummary();renderTodayVsYesterday();

  if(payMethod==='cash'){
    toast(`ชำระเงินสดสำเร็จ • พิมพ์สลิปและเปิดลิ้นชัก • ทอน ${money(changeValue)}`);
  }else{
    toast(`ชำระเงินสำเร็จ ${money(total)} • กำลังพิมพ์สลิป`);
  }
}

function openBackTab(name,btn){document.querySelectorAll('.back-tab').forEach(x=>x.classList.remove('active'));document.getElementById('tab-'+name).classList.add('active');document.querySelectorAll('.side-btn').forEach(x=>x.classList.remove('active'));if(btn)btn.classList.add('active');renderBackoffice();if(name==='reports')setTimeout(renderReports,50)}
function currentEmployee(){return db.employees.find(e=>e.id===session?.employeeId)}
function visibleBranches(){const emp=currentEmployee();return emp?.role==='owner'?db.branches:db.branches.filter(b=>b.id===session.branchId)}
function visibleSales(){const emp=currentEmployee();return emp?.role==='owner'?db.sales:db.sales.filter(s=>s.branchId===session.branchId)}
function renderBackoffice(){
function loadPrinterCheck(){
  const saved = JSON.parse(localStorage.getItem('yak_pos_printer_check') || 'null');
  const badge = document.getElementById('printerStatusBadge');
  const text = document.getElementById('printerStatusText');
  const last = document.getElementById('printerLastTest');
  if(!badge || !text || !last) return;
  if(!saved){
    badge.className='printer-status not-tested';
    badge.textContent='● ยังไม่ได้ตรวจสอบ';
    text.textContent='ยังไม่ได้ทดสอบเครื่องพิมพ์บิล';
    last.textContent='กด “ทดสอบพิมพ์” เพื่อเปิดหน้าพิมพ์ทดสอบ';
    return;
  }
  if(saved.status==='ready'){
    badge.className='printer-status ready';
    badge.textContent='● พร้อมใช้งาน';
    text.textContent='เครื่องพิมพ์บิลผ่านการทดสอบล่าสุด';
  }else{
    badge.className='printer-status problem';
    badge.textContent='● ต้องตรวจสอบ';
    text.textContent='การทดสอบล่าสุดแจ้งว่าพิมพ์ไม่ออก';
  }
  last.textContent='ตรวจล่าสุด: '+new Date(saved.time).toLocaleString('th-TH')+(saved.paper?' • '+saved.paper+' มม.':'');
}
function savePrinterCheck(status){
  const paper=document.getElementById('receiptPaperSize')?.value || '80';
  localStorage.setItem('yak_pos_printer_check', JSON.stringify({status,time:new Date().toISOString(),paper}));
  loadPrinterCheck();
updateCashPaymentVisibility();
}
function confirmPrinterReady(){savePrinterCheck('ready');toast('บันทึกว่าเครื่องพิมพ์พร้อมใช้งานแล้ว')}
function markPrinterProblem(){savePrinterCheck('problem');toast('บันทึกปัญหาเครื่องพิมพ์แล้ว')}
function testReceiptPrinter(){
  const paper=document.getElementById('receiptPaperSize')?.value || '80';
  const w=window.open('','YAK_POS_PRINT_TEST','width=420,height=650');
  if(!w){toast('เบราว์เซอร์บล็อกหน้าต่างพิมพ์ กรุณาอนุญาต Pop-up');return}
  const html=`<!doctype html><html><head><meta charset="utf-8"><title>YAK POS Print Test</title>
  <style>
    @page{size:${paper}mm auto;margin:3mm}
    body{font-family:Arial,Tahoma,sans-serif;width:${paper==='58'?'52':'72'}mm;margin:0 auto;color:#000}
    .c{text-align:center}.line{border-top:1px dashed #000;margin:8px 0}
    h2{font-size:18px;margin:5px 0}p{font-size:18px;margin:4px 0}.big{font-size:16px;font-weight:bold}
  </style></head><body>
    <div class="c"><h2>YAK POS</h2><p>ทดสอบเครื่องพิมพ์บิล</p></div>
    <div class="line"></div>
    <p>วันที่: ${new Date().toLocaleString('th-TH')}</p>
    <p>กระดาษ: ${paper} มม.</p>
    <p>รายการทดสอบ ........ 1 x 10.00</p>
    <div class="line"></div>
    <p class="big c">TOTAL 10.00 THB</p>
    <div class="line"></div>
    <p class="c">ถ้าใบนี้พิมพ์ออก ให้กลับไปกด “พิมพ์สำเร็จ”</p>
    <script>window.onload=()=>setTimeout(()=>window.print(),250);<\/script>
  </body></html>`;
  w.document.open();w.document.write(html);w.document.close();
}

refreshBranchSelects();
loadPrinterCheck();
updateCashPaymentVisibility();renderDashboard();renderBranches();renderEmployees();renderProductsAdmin();renderSales();renderStockAlerts()}
function renderDashboard(){
  const sales=visibleSales(),today=new Date().toISOString().slice(0,10),ts=sales.filter(s=>s.date.slice(0,10)===today);
  todaySales.textContent=money(ts.reduce((a,b)=>a+b.total,0));todayProfit.textContent=money(ts.reduce((a,b)=>a+(b.total-b.costTotal),0));todayBills.textContent=ts.length;
  empCount.textContent=(currentEmployee()?.role==='owner'?db.employees:db.employees.filter(e=>e.branchId===session.branchId)).length;lowStockCount.textContent=lowStockProducts().length;branchCount.textContent=visibleBranches().length;
  const rows=visibleBranches().map(b=>`<tr><td>${b.code}</td><td>${b.name}</td><td>${money(sales.filter(s=>s.branchId===b.id).reduce((a,s)=>a+s.total,0))}</td></tr>`).join('');
  branchSalesTable.innerHTML=table(['รหัส','สาขา','ยอดขายสะสม'],rows)
}


const BR59={mode:'add',editingId:null,bound:false};

function br59CurrentEmployee(){
  return db.employees.find(e=>e.id===session?.employeeId);
}
function br59CanManage(){
  return br59CurrentEmployee()?.role==='owner';
}
function br59OpenAdd(){
  if(!br59CanManage()){toast('เฉพาะ Owner เท่านั้นที่จัดการสาขาได้');return}
  BR59.mode='add';
  BR59.editingId=null;
  const form=document.getElementById('branchForm');
  if(!form)return;

  document.getElementById('branchCode').value='';
  document.getElementById('branchName').value='';

  let title=document.getElementById('br59FormTitle');
  if(!title){
    title=document.createElement('div');
    title.id='br59FormTitle';
    title.className='br59-form-title';
    form.prepend(title);
  }
  title.textContent='เพิ่มสาขาใหม่';

  document.getElementById('br59SaveBtn').textContent='บันทึก';
  form.classList.remove('hidden');
  setTimeout(()=>document.getElementById('branchCode')?.focus(),20);
}
function br59OpenEdit(id){
  if(!br59CanManage()){toast('เฉพาะ Owner เท่านั้นที่แก้ไขสาขาได้');return}
  const b=(db.branches||[]).find(x=>x.id===id);
  if(!b){toast('ไม่พบข้อมูลสาขา');return}

  BR59.mode='edit';
  BR59.editingId=id;

  const form=document.getElementById('branchForm');
  if(!form)return;

  document.getElementById('branchCode').value=b.code||'';
  document.getElementById('branchName').value=b.name||'';

  let title=document.getElementById('br59FormTitle');
  if(!title){
    title=document.createElement('div');
    title.id='br59FormTitle';
    title.className='br59-form-title';
    form.prepend(title);
  }
  title.textContent=`แก้ไขสาขา: ${b.name} (${b.code})`;

  document.getElementById('br59SaveBtn').textContent='บันทึกการแก้ไข';
  form.classList.remove('hidden');

  setTimeout(()=>{
    try{form.scrollIntoView({behavior:'smooth',block:'center'})}catch(e){}
    try{document.getElementById('branchName')?.focus({preventScroll:true})}catch(e){}
  },30);
}
function br59Close(){
  BR59.mode='add';
  BR59.editingId=null;
  document.getElementById('br59FormTitle')?.remove();
  document.getElementById('branchForm')?.classList.add('hidden');
}
function br59Save(){
  if(!br59CanManage()){toast('เฉพาะ Owner เท่านั้นที่จัดการสาขาได้');return}

  const code=(document.getElementById('branchCode')?.value||'').trim().toUpperCase();
  const name=(document.getElementById('branchName')?.value||'').trim();

  if(!code||!name){toast('กรอกรหัสสาขาและชื่อสาขาให้ครบ');return}

  const dup=(db.branches||[]).find(b=>
    b.id!==BR59.editingId &&
    String(b.code||'').toUpperCase()===code
  );
  if(dup){toast('รหัสสาขานี้ถูกใช้แล้ว');return}

  if(BR59.mode==='edit'){
    const b=db.branches.find(x=>x.id===BR59.editingId);
    if(!b){toast('ไม่พบข้อมูลสาขา');return}
    b.code=code;
    b.name=name;
    saveDB();
    br59Close();
    renderBranches();
    try{refreshBranchSelects()}catch(e){}
    toast('แก้ไขสาขาแล้ว');
  }else{
    db.branches.push({
      id:'b'+Date.now(),
      code,name,active:true
    });
    saveDB();
    br59Close();
    renderBranches();
    try{refreshBranchSelects()}catch(e){}
    toast('เพิ่มสาขาแล้ว');
  }
}
function br59Toggle(id){
  if(!br59CanManage()){toast('เฉพาะ Owner เท่านั้นที่จัดการสาขาได้');return}
  const b=db.branches.find(x=>x.id===id);
  if(!b)return;

  if(b.active!==false){
    const others=db.branches.filter(x=>x.id!==id && x.active!==false);
    if(!others.length){toast('ต้องมีสาขาที่ใช้งานอย่างน้อย 1 สาขา');return}
  }

  b.active=b.active===false;
  saveDB();
  renderBranches();
  try{refreshBranchSelects()}catch(e){}
}
function br59Delete(id){
  if(!br59CanManage()){toast('เฉพาะ Owner เท่านั้นที่จัดการสาขาได้');return}
  const b=db.branches.find(x=>x.id===id);
  if(!b)return;

  const employees=(db.employees||[]).filter(e=>e.branchId===id);
  const sales=(db.sales||[]).filter(s=>s.branchId===id);

  if(employees.length){
    alert(`สาขา "${b.name}" ยังมีพนักงาน ${employees.length} คน\nกรุณาย้ายพนักงานไปสาขาอื่นก่อนลบ`);
    return;
  }

  const others=db.branches.filter(x=>x.id!==id && x.active!==false);
  if(!others.length){toast('ไม่สามารถลบสาขาที่ใช้งานเป็นสาขาสุดท้ายได้');return}

  let msg=`ต้องการลบสาขา "${b.name}" (${b.code}) หรือไม่?`;
  if(sales.length){
    msg+=`\n\nมีประวัติขาย ${sales.length} บิล`;
    msg+=`\nประวัติยอดขายเดิมจะยังคงอยู่`;
  }
  if(!confirm(msg))return;

  db.branches=db.branches.filter(x=>x.id!==id);
  saveDB();
  renderBranches();
  try{refreshBranchSelects()}catch(e){}
  toast('ลบสาขาแล้ว');
}
function renderBranches(){
  const box=document.getElementById('branchesTable');
  if(!box)return;

  const canEdit=br59CanManage();
  const list=canEdit
    ? (db.branches||[])
    : visibleBranches();

  const rows=list.map(b=>{
    const employeeCount=(db.employees||[]).filter(e=>e.branchId===b.id).length;
    const salesCount=(db.sales||[]).filter(s=>s.branchId===b.id).length;

    return `<tr>
      <td>${b.code||''}</td>
      <td>${b.name||''}</td>
      <td>${employeeCount}</td>
      <td>${salesCount}</td>
      <td><span class="badge ${b.active!==false?'green':'red'}">${b.active!==false?'ใช้งาน':'ปิดใช้'}</span></td>
      <td class="br59-actions">
        ${canEdit?`
          <button type="button" class="action br59-edit" data-br59="edit" data-id="${b.id}">✏️ แก้ไข</button>
          <button type="button" class="action" data-br59="toggle" data-id="${b.id}">${b.active!==false?'ปิดใช้':'เปิดใช้'}</button>
          <button type="button" class="action danger br59-delete" data-br59="delete" data-id="${b.id}">🗑 ลบ</button>
        `:''}
      </td>
    </tr>`;
  }).join('');

  box.innerHTML=table(
    ['รหัส','ชื่อสาขา','พนักงาน','บิลขาย','สถานะ','จัดการ'],
    rows||'<tr><td colspan="6" class="empty">ยังไม่มีสาขา</td></tr>'
  );

  const add=document.getElementById('br59AddBtn');
  if(add)add.style.display=canEdit?'':'none';
}
function br59Bind(){
  if(BR59.bound)return;
  BR59.bound=true;

  document.getElementById('br59AddBtn')?.addEventListener('click',br59OpenAdd);
  document.getElementById('br59SaveBtn')?.addEventListener('click',br59Save);
  document.getElementById('br59CancelBtn')?.addEventListener('click',br59Close);

  document.addEventListener('click',e=>{
    const btn=e.target.closest('[data-br59]');
    if(!btn)return;
    e.preventDefault();
    e.stopPropagation();

    const id=btn.dataset.id;
    if(btn.dataset.br59==='edit')br59OpenEdit(id);
    else if(btn.dataset.br59==='toggle')br59Toggle(id);
    else if(btn.dataset.br59==='delete')br59Delete(id);
  });
}

// Compatibility for any old callers.
function showBranchForm(){br59OpenAdd()}
function hideBranchForm(){br59Close()}
function saveBranch(){br59Save()}
function toggleBranch(id){br59Toggle(id)}

window.addEventListener('DOMContentLoaded',()=>{
  setTimeout(()=>{
    br59Bind();
    renderBranches();
  },400);
});

let emp54EditingId=null;

function emp54CurrentEmployee(){
  return db.employees.find(e=>e.id===session?.employeeId);
}
function emp54CanManage(){
  const me=emp54CurrentEmployee();
  return !!me && ['owner','manager'].includes(me.role);
}
function emp54RefreshBranches(selected=''){
  const select=document.getElementById('empBranch');
  if(!select)return;
  const me=emp54CurrentEmployee();
  const branches=me?.role==='owner'
    ? db.branches
    : db.branches.filter(b=>b.id===session?.branchId);

  select.innerHTML=branches.filter(b=>b.active!==false)
    .map(b=>`<option value="${b.id}">${b.code} — ${b.name}</option>`).join('');
  if(selected)select.value=selected;
}
function emp54OpenAdd(){
  emp54EditingId=null;
  const form=document.getElementById('employeeForm');
  if(!form)return;

  document.getElementById('emp54FormTitle').textContent='เพิ่มพนักงานใหม่';
  document.getElementById('empCode').value='';
  document.getElementById('empName').value='';
  document.getElementById('empPin').value='';
  document.getElementById('empRole').value='staff';
  emp54RefreshBranches();

  document.getElementById('emp54SaveBtn').textContent='บันทึก';
  form.classList.remove('hidden');
  setTimeout(()=>document.getElementById('empCode')?.focus(),20);
}
function emp54OpenEdit(id){
  const e=db.employees.find(x=>x.id===id);
  if(!e)return;

  emp54EditingId=id;
  const form=document.getElementById('employeeForm');
  if(!form)return;

  document.getElementById('emp54FormTitle').textContent=`แก้ไขพนักงาน: ${e.name} (${e.code})`;
  document.getElementById('empCode').value=e.code||'';
  document.getElementById('empName').value=e.name||'';
  document.getElementById('empPin').value=e.pin||'';
  document.getElementById('empRole').value=e.role||'staff';
  emp54RefreshBranches(e.branchId);

  document.getElementById('emp54SaveBtn').textContent='บันทึกการแก้ไข';
  form.classList.remove('hidden');
  try{form.scrollIntoView({behavior:'smooth',block:'center'})}catch(err){}
}
function emp54CloseForm(){
  emp54EditingId=null;
  document.getElementById('employeeForm')?.classList.add('hidden');
}
function emp54Save(){
  if(!emp54CanManage()){
    toast('บัญชีนี้ไม่มีสิทธิ์จัดการพนักงาน');
    return;
  }

  const code=document.getElementById('empCode').value.trim().toUpperCase();
  const name=document.getElementById('empName').value.trim();
  const pin=document.getElementById('empPin').value.trim();
  const role=document.getElementById('empRole').value;
  const branchId=document.getElementById('empBranch').value;

  if(!code||!name||!pin){
    toast('กรอกรหัส ชื่อ และ PIN ให้ครบ');
    return;
  }
  if(db.employees.some(e=>e.id!==emp54EditingId && String(e.code).toUpperCase()===code)){
    toast('รหัสพนักงานซ้ำ');
    return;
  }

  const me=emp54CurrentEmployee();
  if(me?.role!=='owner' && role==='owner'){
    toast('Manager ไม่สามารถกำหนดสิทธิ์ Owner');
    return;
  }

  if(emp54EditingId){
    const e=db.employees.find(x=>x.id===emp54EditingId);
    if(!e)return;

    if(e.role==='owner' && role!=='owner'){
      const otherOwners=db.employees.filter(x=>x.id!==e.id && x.role==='owner' && x.active!==false);
      if(!otherOwners.length){
        toast('ต้องมี Owner อย่างน้อย 1 คน');
        return;
      }
    }

    e.code=code;
    e.name=name;
    e.pin=pin;
    e.role=role;
    e.branchId=branchId;
    saveDB();
    emp54CloseForm();
    renderEmployees();
    toast('แก้ไขข้อมูลพนักงานแล้ว');
  }else{
    db.employees.push({
      id:'e'+Date.now(),
      code,name,pin,role,branchId,active:true
    });
    saveDB();
    emp54CloseForm();
    renderEmployees();
    toast('เพิ่มพนักงานแล้ว');
  }
}
function emp54Toggle(id){
  const e=db.employees.find(x=>x.id===id);
  if(!e)return;
  if(e.id===session?.employeeId){
    toast('ไม่สามารถระงับบัญชีที่กำลังใช้งาน');
    return;
  }
  if(e.role==='owner' && e.active!==false){
    const owners=db.employees.filter(x=>x.id!==e.id && x.role==='owner' && x.active!==false);
    if(!owners.length){
      toast('ไม่สามารถระงับ Owner คนสุดท้ายได้');
      return;
    }
  }
  e.active=!e.active;
  saveDB();
  renderEmployees();
}
function emp54Delete(id){
  const e=db.employees.find(x=>x.id===id);
  if(!e)return;

  if(e.id===session?.employeeId){
    toast('ไม่สามารถลบบัญชีที่กำลังใช้งาน');
    return;
  }
  if(e.role==='owner'){
    const owners=db.employees.filter(x=>x.id!==e.id && x.role==='owner' && x.active!==false);
    if(!owners.length){
      toast('ไม่สามารถลบ Owner คนสุดท้ายได้');
      return;
    }
  }

  const salesCount=(db.sales||[]).filter(s=>s.employeeId===id).length;
  let msg=`ต้องการลบพนักงาน "${e.name}" (${e.code}) หรือไม่?`;
  if(salesCount){
    msg+=`\n\nมีประวัติขาย ${salesCount} บิล\nประวัติยอดขายเดิมจะยังคงอยู่`;
  }
  if(!confirm(msg))return;

  db.employees=db.employees.filter(x=>x.id!==id);
  saveDB();
  renderEmployees();
  toast('ลบพนักงานแล้ว');
}
function renderEmployees(){
  const box=document.getElementById('employeesTable');
  if(!box)return;

  const me=emp54CurrentEmployee();
  const list=me?.role==='owner'
    ? db.employees
    : db.employees.filter(e=>e.branchId===session?.branchId);

  const rows=list.map(e=>{
    const b=branchById(e.branchId);
    return `<tr>
      <td>${e.code}</td>
      <td>${e.name}</td>
      <td>${e.role}</td>
      <td>${b?b.name:'ทุกสาขา'}</td>
      <td><span class="badge ${e.active?'green':'red'}">${e.active?'ใช้งาน':'ระงับ'}</span></td>
      <td class="emp54-actions">
        <button type="button" class="action emp54-edit" onclick="emp54OpenEdit('${e.id}')">✏️ แก้ไข</button>
        <button type="button" class="action" onclick="emp54Toggle('${e.id}')">${e.active?'ระงับ':'เปิดใช้'}</button>
        <button type="button" class="action danger emp54-delete" onclick="emp54Delete('${e.id}')">🗑 ลบ</button>
      </td>
    </tr>`;
  }).join('');

  box.innerHTML=table(
    ['รหัส','ชื่อ','สิทธิ์','สาขา','สถานะ','จัดการ'],
    rows||'<tr><td colspan="6" class="empty">ยังไม่มีพนักงาน</td></tr>'
  );
}

function showEmployeeForm(){emp54OpenAdd()}
function hideEmployeeForm(){emp54CloseForm()}
function saveEmployee(){emp54Save()}
function toggleEmployee(id){emp54Toggle(id)}

window.addEventListener('DOMContentLoaded',()=>{
  document.getElementById('emp54AddBtn')?.addEventListener('click',emp54OpenAdd);
  document.getElementById('emp54SaveBtn')?.addEventListener('click',emp54Save);
  document.getElementById('emp54CancelBtn')?.addEventListener('click',emp54CloseForm);
});


function ensureSharedStockData(){
  db.materials = db.materials || [];
  db.productMaterials = db.productMaterials || [];
  db.expenses = db.expenses || [];
  saveDB();
}

function materialById(id){ return (db.materials||[]).find(m=>m.id===id); }
function linkedMaterialsForProduct(productId){
  return (db.productMaterials||[]).filter(x=>x.productId===productId);
}

function deductLinkedMaterialsForSale(items){
  const required={};

  for(const item of (items||[])){
    const productId=item.productId||item.id;
    const saleQty=Number(item.qty||0);
    const links=linkedMaterialsForProduct(productId);

    for(const link of links){
      const m=materialById(link.materialId);
      if(!m || !m.active) continue;
      const need=Number(link.qtyPerSale||0)*saleQty;
      required[m.id]=(required[m.id]||0)+need;
    }
  }

  const errors=[];
  for(const [materialId,need] of Object.entries(required)){
    const m=materialById(materialId);
    if(!m)continue;
    if(Number(m.stock||0)<need){
      errors.push(`${m.name} ไม่พอ (ต้องใช้ ${need} ${m.unit}, เหลือ ${m.stock})`);
    }
  }

  if(errors.length)return {ok:false,errors};

  // Deduct only after all linked materials are confirmed sufficient.
  for(const [materialId,need] of Object.entries(required)){
    const m=materialById(materialId);
    if(!m)continue;
    m.stock=Math.max(0,Number(m.stock||0)-need);
  }

  return {ok:true,required};
}

function sharedLowStockMaterials(){
  return (db.materials||[]).filter(m=>m.active && Number(m.stock||0)<=Number(m.minStock||0));
}

function renderMaterialsAdmin(){
  const box=document.getElementById('materialsTable'); if(!box)return;
  const rows=(db.materials||[]).map(m=>`
    <tr>
      <td>${m.name}</td>
      <td>${m.unit}</td>
      <td>${m.stock}</td>
      <td>${m.minStock}</td>
      <td><span class="badge ${Number(m.stock)<=Number(m.minStock)?'red':'green'}">${Number(m.stock)<=Number(m.minStock)?'ใกล้หมด':'ปกติ'}</span></td>
      <td>
        <button class="action stock-plus" onclick="adjustMaterialStock('${m.id}',1)">+1</button>
        <button class="action stock-plus" onclick="adjustMaterialStock('${m.id}',10)">+10</button>
        <button class="action stock-minus" onclick="adjustMaterialStock('${m.id}',-1)">−1</button>
        <button class="action" onclick="restockMaterial('${m.id}')">เติมจำนวน</button>
        <button class="action" onclick="setMaterialStock('${m.id}')">กำหนดจำนวน</button>
        <button class="action" onclick="editMaterial('${m.id}')">ตั้งค่าจุดเตือน</button>
      </td>
    </tr>`).join('');
  box.innerHTML=table(['วัตถุดิบ','หน่วย','คงเหลือ','จุดเตือน','สถานะ','จัดการ'], rows||'<tr><td colspan="6">ยังไม่มีวัตถุดิบ</td></tr>');
}

function showMaterialForm(){
  document.getElementById('materialForm')?.classList.remove('hidden');
}
function hideMaterialForm(){
  document.getElementById('materialForm')?.classList.add('hidden');
}
function saveMaterial(){
  const name=document.getElementById('materialName').value.trim();
  const unit=document.getElementById('materialUnit').value.trim()||'ชิ้น';
  const stock=Number(document.getElementById('materialStock').value||0);
  const minStock=Number(document.getElementById('materialMinStock').value||0);
  if(!name){toast('กรอกชื่อวัตถุดิบ');return}
  db.materials.push({id:'m'+Date.now(),name,unit,stock,minStock,active:true});
  saveDB();hideMaterialForm();renderMaterialsAdmin();renderMaterialLinks();toast('เพิ่มวัตถุดิบแล้ว');
}
function restockMaterial(id){
  const m=materialById(id);if(!m)return;
  const q=Number(prompt(`เติม ${m.name}\nปัจจุบัน ${m.stock} ${m.unit}\nจำนวนที่เพิ่ม:`));
  if(!q||q<=0)return;
  m.stock=Number(m.stock||0)+q; saveDB();renderMaterialsAdmin();renderMaterialLinks();toast('เติมสต๊อกแล้ว');
}
function editMaterial(id){
  const m=materialById(id);if(!m)return;
  const stock=prompt(`จำนวนคงเหลือ ${m.name}`,m.stock); if(stock===null)return;
  const min=prompt('แจ้งเตือนเมื่อเหลือ',m.minStock); if(min===null)return;
  m.stock=Math.max(0,Number(stock||0));m.minStock=Math.max(0,Number(min||0));
  saveDB();renderMaterialsAdmin();renderMaterialLinks();
}

function renderMaterialLinks(){
  const psel=document.getElementById('linkProduct');
  const msel=document.getElementById('linkMaterial');
  if(psel) psel.innerHTML='<option value="">-- เลือกสินค้าที่คุณต้องการ --</option>'+
    (db.products||[]).map(p=>`<option value="${p.id}">${p.name}</option>`).join('');
  if(msel) msel.innerHTML='<option value="">-- เลือกวัตถุดิบที่จะเชื่อม --</option>'+
    (db.materials||[]).filter(m=>m.active).map(m=>`<option value="${m.id}">${m.name} (${m.unit})</option>`).join('');

  const box=document.getElementById('materialLinksTable');if(!box)return;
  const grouped={};
  for(const l of (db.productMaterials||[])){
    (grouped[l.productId] ||= []).push(l);
  }

  const cards=Object.entries(grouped).map(([productId,links])=>{
    const p=(db.products||[]).find(x=>x.id===productId);
    const rows=links.map(l=>{
      const m=materialById(l.materialId);
      return `<tr>
        <td>${m?.name||'-'}</td>
        <td>${l.qtyPerSale} ${m?.unit||''}</td>
        <td>
          <button class="action" onclick="editMaterialLink('${l.id}')">แก้จำนวน</button>
          <button class="action danger" onclick="deleteMaterialLink('${l.id}')">ยกเลิกเชื่อม</button>
        </td>
      </tr>`;
    }).join('');
    return `<div class="recipe-card">
      <div class="recipe-head">
        <div><b>${p?.name||'ไม่พบสินค้า'}</b><small>สูตรวัตถุดิบที่คุณกำหนดเอง</small></div>
        <button class="action" onclick="duplicateMaterialLink('${productId}')">คัดลอกสูตร</button>
      </div>
      ${table(['วัตถุดิบ','ใช้ต่อขาย 1 หน่วย','จัดการ'],rows)}
    </div>`;
  }).join('');

  box.innerHTML=cards||'<div class="empty-recipe">ยังไม่ได้เชื่อมสินค้าใดกับวัตถุดิบ — เลือกสินค้าและวัตถุดิบด้านบนเพื่อเริ่มกำหนดเอง</div>';
}

function saveMaterialLink(){
  const productId=document.getElementById('linkProduct').value;
  const materialId=document.getElementById('linkMaterial').value;
  const qtyPerSale=Number(document.getElementById('linkQty').value||0);
  if(!productId){toast('เลือกสินค้าที่ต้องการเชื่อม');return}
  if(!materialId){toast('เลือกวัตถุดิบที่ต้องการใช้');return}
  if(!Number.isFinite(qtyPerSale)||qtyPerSale<=0){toast('กำหนดจำนวนวัตถุดิบที่ใช้ต่อสินค้า 1 หน่วย');return}
  const old=(db.productMaterials||[]).find(x=>x.productId===productId&&x.materialId===materialId);
  if(old) old.qtyPerSale=qtyPerSale;
  else db.productMaterials.push({id:'pm'+Date.now(),productId,materialId,qtyPerSale});
  saveDB();
  document.getElementById('linkQty').value='';
  renderMaterialLinks();
  toast('เชื่อมตามที่คุณกำหนดแล้ว');
}
function deleteMaterialLink(id){
  db.productMaterials=(db.productMaterials||[]).filter(x=>x.id!==id);
  saveDB();renderMaterialLinks();
}

function editMaterialLink(id){
  const l=(db.productMaterials||[]).find(x=>x.id===id);if(!l)return;
  const p=(db.products||[]).find(x=>x.id===l.productId);
  const m=materialById(l.materialId);
  const q=prompt(`กำหนดจำนวนวัตถุดิบที่ใช้ต่อสินค้า 1 หน่วย\nสินค้า: ${p?.name||'-'}\nวัตถุดิบ: ${m?.name||'-'}`,l.qtyPerSale);
  if(q===null)return;
  const n=Number(q);
  if(!Number.isFinite(n)||n<=0){toast('จำนวนต้องมากกว่า 0');return}
  l.qtyPerSale=n;saveDB();renderMaterialLinks();toast('แก้สูตรการใช้แล้ว');
}

function duplicateMaterialLink(productId){
  const links=linkedMaterialsForProduct(productId);
  if(!links.length){toast('สินค้านี้ยังไม่มีสูตรวัตถุดิบ');return}
  const target=prompt('กรอกชื่อสินค้าที่ต้องการคัดลอกสูตรไปใช้');
  if(!target)return;
  const p=(db.products||[]).find(x=>x.name.trim().toLowerCase()===target.trim().toLowerCase());
  if(!p){toast('ไม่พบสินค้านี้');return}
  for(const l of links){
    const old=(db.productMaterials||[]).find(x=>x.productId===p.id&&x.materialId===l.materialId);
    if(old) old.qtyPerSale=l.qtyPerSale;
    else db.productMaterials.push({id:'pm'+Date.now()+Math.random(),productId:p.id,materialId:l.materialId,qtyPerSale:l.qtyPerSale});
  }
  saveDB();renderMaterialLinks();toast('คัดลอกสูตรวัตถุดิบแล้ว');
}




function renderProductsAdmin(){
  const rows=db.products.map(p=>{
    const links=(db.productMaterials||[]).filter(x=>x.productId===p.id);
    const materialManaged=links.length>0;
    const linkedMaterials=links.map(l=>materialById(l.materialId)).filter(Boolean);
    const anyLow=linkedMaterials.some(m=>m.active && Number(m.stock||0)<=Number(m.minStock||0));
    const anyInactive=linkedMaterials.some(m=>!m.active);

    const stockText=materialManaged
      ? '<span class="m37-material-managed">ใช้วัตถุดิบ</span>'
      : (p.trackStock?p.stock:'—');

    const minText=materialManaged
      ? '—'
      : (p.trackStock?p.minStock:'—');

    let statusClass='green',statusText='ขาย';
    if(!p.active){statusClass='orange';statusText='ซ่อน';}
    else if(materialManaged && anyInactive){statusClass='orange';statusText='วัตถุดิบปิดใช้';}
    else if(materialManaged && anyLow){statusClass='red';statusText='วัตถุดิบใกล้หมด';}
    else if(!materialManaged && p.trackStock && p.stock<=p.minStock){statusClass='red';statusText='ใกล้หมด';}

    return `<tr>
      <td>${p.image?`<img class="product-thumb" src="${p.image}">`:'📦'}</td>
      <td>${p.name}${materialManaged?'<small class="m37-sub"> • เชื่อมวัตถุดิบ '+links.length+' รายการ</small>':''}</td>
      <td>${money(p.price)}</td>
      <td>${money(p.cost)}</td>
      <td>${stockText}</td>
      <td>${minText}</td>
      <td>${money(p.price-p.cost)}</td>
      <td><span class="badge ${statusClass}">${statusText}</span></td>
      <td class="prod62-actions">
        <button type="button" class="action prod65-edit" data-prod65-edit="${p.id}">✏️ แก้ไข</button>
        ${materialManaged?'':`<button class="action" onclick="restockProduct('${p.id}')">เติมสต๊อก</button>`}
        <button class="action" onclick="toggleProduct('${p.id}')">${p.active?'ซ่อน':'เปิดขาย'}</button>
        <button class="action danger" onclick="m34DeleteProduct('${p.id}')">ลบ</button>
      </td>
    </tr>`;
  }).join('');
  productsTable.innerHTML=table(['รูป','สินค้า','ขาย','ต้นทุน','คงเหลือ','จุดเตือน','กำไร/ชิ้น','สถานะ','จัดการ'],rows)
}
function showProductForm(){productForm.classList.remove('hidden')}function hideProductForm(){productForm.classList.add('hidden')}
function fileToDataURL(file){return new Promise((resolve,reject)=>{if(!file){resolve('');return}const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(file)})}
async function saveProduct(){
  const name=newProductName.value.trim(),price=Number(newProductPrice.value),cost=Number(newProductCost.value||0),stock=Number(newProductStock.value||0),minStock=Number(newProductMinStock.value||0),trackStock=newProductTrackStock.value==='yes';
  if(!name||price<0||Number.isNaN(price)){toast('กรอกชื่อและราคา');return}
  const image=await fileToDataURL(newProductImage.files[0]);
  db.products.push({id:'p'+Date.now(),name,price,cost,stock,minStock,trackStock,image,active:true});saveDB();hideProductForm();renderBackoffice();try{m33RenderAll()}catch(e){};toast('เพิ่มสินค้าแล้ว')
}
function toggleProduct(id){const p=db.products.find(x=>x.id===id);if(p){p.active=!p.active;saveDB();renderBackoffice()}}
function restockProduct(id){const p=db.products.find(x=>x.id===id);if(!p)return;if(!p.trackStock){toast('สินค้านี้ไม่ตัดสต๊อก');return}const qty=Number(prompt(`เติมสต๊อก ${p.name}\nปัจจุบัน ${p.stock}\nใส่จำนวนที่ต้องการเพิ่ม:`));if(!qty||qty<=0)return;p.stock+=qty;saveDB();renderBackoffice();toast(`เติมสต๊อกแล้ว +${qty}`)}

function renderSales(){const rows=visibleSales().map(s=>{const e=db.employees.find(x=>x.id===s.employeeId),b=branchById(s.branchId);return `<tr><td>${new Date(s.date).toLocaleString('th-TH')}</td><td>${s.id}</td><td>${b?b.name:''}</td><td>${e?e.name:''}</td><td>${s.payMethod}</td><td>${money(s.total)}</td><td>${money(s.costTotal)}</td><td>${money(s.total-s.costTotal)}</td></tr>`}).join('');salesTable.innerHTML=table(['วันที่','เลขบิล','สาขา','พนักงาน','ชำระ','ยอดสุทธิ','ต้นทุน','กำไร'],rows||'<tr><td colspan="8" class="empty">ยังไม่มีรายการขาย</td></tr>')}
function clearSales(){if(confirm('ล้างข้อมูลยอดขายทั้งหมดในเครื่องนี้?')){db.sales=[];saveDB();renderBackoffice();toast('ล้างข้อมูลแล้ว')}}
function table(headers,rows){return `<div class="table-wrap"><table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>`}

function periodKey(date,period){
  const d=new Date(date);
  if(period==='day')return d.toLocaleDateString('th-TH',{day:'2-digit',month:'short'});
  if(period==='month')return d.toLocaleDateString('th-TH',{month:'short',year:'2-digit'});
  return String(d.getFullYear()+543);
}
function inCurrentPeriod(date,period){
  const d=new Date(date),n=new Date();
  if(period==='day')return d.toDateString()===n.toDateString();
  if(period==='month')return d.getMonth()===n.getMonth()&&d.getFullYear()===n.getFullYear();
  return d.getFullYear()===n.getFullYear();
}
function renderReports(){
  const period=reportPeriod.value,sales=visibleSales(),current=sales.filter(s=>inCurrentPeriod(s.date,period));
  const revenue=current.reduce((a,s)=>a+s.total,0),cost=current.reduce((a,s)=>a+s.costTotal,0),profit=revenue-cost,margin=revenue?profit/revenue*100:0;
  reportRevenue.textContent=money(revenue);reportCost.textContent=money(cost);reportProfit.textContent=money(profit);reportMargin.textContent=margin.toFixed(1)+'%';

  let grouped={};
  sales.forEach(s=>{const k=periodKey(s.date,period);grouped[k]=(grouped[k]||0)+s.total});
  const labels=Object.keys(grouped).slice(-12),values=labels.map(k=>grouped[k]);
  if(salesChartObj)salesChartObj.destroy();
  if(window.Chart)salesChartObj=new Chart(document.getElementById('salesChart'),{type:'line',data:{labels,datasets:[{label:'ยอดขาย',data:values,tension:.25}]},options:{responsive:true,plugins:{legend:{display:true}},scales:{y:{beginAtZero:true}}}});

  const prod={};
  current.forEach(s=>(s.items||[]).forEach(i=>{prod[i.name]=(prod[i.name]||0)+i.price*i.qty}));
  const pLabels=Object.keys(prod),pValues=pLabels.map(k=>prod[k]),sum=pValues.reduce((a,b)=>a+b,0);
  if(pieChartObj)pieChartObj.destroy();
  if(window.Chart)pieChartObj=new Chart(document.getElementById('productPie'),{type:'doughnut',data:{labels:pLabels,datasets:[{data:pValues}]},options:{responsive:true,maintainAspectRatio:true,aspectRatio:1,plugins:{legend:{position:'bottom'}}}});
  productPercentTable.innerHTML=table(['สินค้า','ยอดขาย','สัดส่วน'],pLabels.map((k,i)=>`<tr><td>${k}</td><td>${money(pValues[i])}</td><td>${sum?(pValues[i]/sum*100).toFixed(1):0}%</td></tr>`).join('')||'<tr><td colspan="3" class="empty">ยังไม่มีข้อมูล</td></tr>')
}

function loadPrinterCheck(){
  const saved = JSON.parse(localStorage.getItem('yak_pos_printer_check') || 'null');
  const badge = document.getElementById('printerStatusBadge');
  const text = document.getElementById('printerStatusText');
  const last = document.getElementById('printerLastTest');
  if(!badge || !text || !last) return;
  if(!saved){
    badge.className='printer-status not-tested';
    badge.textContent='● ยังไม่ได้ตรวจสอบ';
    text.textContent='ยังไม่ได้ทดสอบเครื่องพิมพ์บิล';
    last.textContent='กด “ทดสอบพิมพ์” เพื่อเปิดหน้าพิมพ์ทดสอบ';
    return;
  }
  if(saved.status==='ready'){
    badge.className='printer-status ready';
    badge.textContent='● พร้อมใช้งาน';
    text.textContent='เครื่องพิมพ์บิลผ่านการทดสอบล่าสุด';
  }else{
    badge.className='printer-status problem';
    badge.textContent='● ต้องตรวจสอบ';
    text.textContent='การทดสอบล่าสุดแจ้งว่าพิมพ์ไม่ออก';
  }
  last.textContent='ตรวจล่าสุด: '+new Date(saved.time).toLocaleString('th-TH')+(saved.paper?' • '+saved.paper+' มม.':'');
}
function savePrinterCheck(status){
  const paper=document.getElementById('receiptPaperSize')?.value || '80';
  localStorage.setItem('yak_pos_printer_check', JSON.stringify({status,time:new Date().toISOString(),paper}));
  loadPrinterCheck();
updateCashPaymentVisibility();
}
function confirmPrinterReady(){savePrinterCheck('ready');toast('บันทึกว่าเครื่องพิมพ์พร้อมใช้งานแล้ว')}
function markPrinterProblem(){savePrinterCheck('problem');toast('บันทึกปัญหาเครื่องพิมพ์แล้ว')}
function testReceiptPrinter(){
  const paper=document.getElementById('receiptPaperSize')?.value || '80';
  const w=window.open('','YAK_POS_PRINT_TEST','width=420,height=650');
  if(!w){toast('เบราว์เซอร์บล็อกหน้าต่างพิมพ์ กรุณาอนุญาต Pop-up');return}
  const html=`<!doctype html><html><head><meta charset="utf-8"><title>YAK POS Print Test</title>
  <style>
    @page{size:${paper}mm auto;margin:3mm}
    body{font-family:Arial,Tahoma,sans-serif;width:${paper==='58'?'52':'72'}mm;margin:0 auto;color:#000}
    .c{text-align:center}.line{border-top:1px dashed #000;margin:8px 0}
    h2{font-size:18px;margin:5px 0}p{font-size:18px;margin:4px 0}.big{font-size:16px;font-weight:bold}
  </style></head><body>
    <div class="c"><h2>YAK POS</h2><p>ทดสอบเครื่องพิมพ์บิล</p></div>
    <div class="line"></div>
    <p>วันที่: ${new Date().toLocaleString('th-TH')}</p>
    <p>กระดาษ: ${paper} มม.</p>
    <p>รายการทดสอบ ........ 1 x 10.00</p>
    <div class="line"></div>
    <p class="big c">TOTAL 10.00 THB</p>
    <div class="line"></div>
    <p class="c">ถ้าใบนี้พิมพ์ออก ให้กลับไปกด “พิมพ์สำเร็จ”</p>
    <script>window.onload=()=>setTimeout(()=>window.print(),250);<\/script>
  </body></html>`;
  w.document.open();w.document.write(html);w.document.close();
}

refreshBranchSelects();
loadPrinterCheck();
updateCashPaymentVisibility();


let pendingUsbPrinterV371=null;
function printerProfile(){try{return JSON.parse(localStorage.getItem('yak_pos_printer_profile')||'null')}catch(e){return null}}
function openPrinterSettings(){
  const p=printerProfile();
  document.getElementById('printerCustomName').value=p?.name||'';
  document.getElementById('printerConnectionType').value=p?.connectionType||'windows';
  document.getElementById('printerPaperSetting').value=p?.paper||document.getElementById('receiptPaperSize')?.value||'80';
  document.getElementById('printerNote').value=p?.note||'';
  const info=document.getElementById('usbDeviceInfo');
  if(pendingUsbPrinterV371){
    info.classList.remove('hidden');
    info.textContent='USB: '+(pendingUsbPrinterV371.productName||'Unknown device');
  }else info.classList.add('hidden');
  document.getElementById('printerSetupModal').classList.remove('hidden');
}
function closePrinterSettings(){document.getElementById('printerSetupModal').classList.add('hidden')}
function savePrinterSettings(){
  const name=document.getElementById('printerCustomName').value.trim();
  if(!name){toast('กรุณาใส่ชื่อเครื่องพิมพ์');return}
  const type=document.getElementById('printerConnectionType').value;
  const p={name,connectionType:type,paper:document.getElementById('printerPaperSetting').value,note:document.getElementById('printerNote').value.trim(),savedAt:new Date().toISOString()};
  if(pendingUsbPrinterV371)p.usb={vendorId:pendingUsbPrinterV371.vendorId,productId:pendingUsbPrinterV371.productId,productName:pendingUsbPrinterV371.productName||''};
  localStorage.setItem('yak_pos_printer_profile',JSON.stringify(p));
  document.getElementById('receiptPaperSize').value=p.paper;
  // บันทึกเครื่องพิมพ์แบบถาวรใน LocalStorage ของเครื่อง POS นี้
  closePrinterSettings(); refreshPrinterSetupUI(); toast('บันทึกเครื่องพิมพ์ถาวรแล้ว');
}
function savePrinterPaperSize(){
  const p=printerProfile(); if(!p)return;
  p.paper=document.getElementById('receiptPaperSize').value;
  localStorage.setItem('yak_pos_printer_profile',JSON.stringify(p));
}
async function findReceiptPrinter(){
  if(!navigator.usb){toast('เบราว์เซอร์นี้ค้นหา USB ไม่ได้ กรุณากด ตั้งค่า/บันทึก');openPrinterSettings();return}
  try{
    const d=await navigator.usb.requestDevice({filters:[]});
    pendingUsbPrinterV371=d; openPrinterSettings();
    document.getElementById('printerCustomName').value=[d.manufacturerName,d.productName].filter(Boolean).join(' ')||'USB Printer';
    document.getElementById('printerConnectionType').value='usb';
  }catch(e){toast('ไม่ได้เลือกอุปกรณ์ USB')}
}
function refreshPrinterSetupUI(){
  const p=printerProfile();
  const check=(()=>{try{return JSON.parse(localStorage.getItem('yak_pos_printer_check')||'null')}catch(e){return null}})();
  const name=document.getElementById('printerDeviceName'),saved=document.getElementById('savedPrinterName'),conn=document.getElementById('printerConnectionState'),last=document.getElementById('printerLastTest'),badge=document.getElementById('printerStatusBadge'),txt=document.getElementById('printerStatusText');
  if(p){
    name.textContent=p.name;saved.textContent=p.name;
    conn.textContent=p.connectionType==='usb'?'USB':p.connectionType==='network'?'LAN / Network':'Windows / Driver';
    document.getElementById('receiptPaperSize').value=p.paper||'80';
  }else{saved.textContent='—';conn.textContent='ยังไม่บันทึก'}
  if(check){
    last.textContent=new Date(check.time).toLocaleString('th-TH');
    if(check.status==='ready'){badge.className='printer-status ready';badge.textContent='● พร้อมใช้งานจริง';txt.textContent='เครื่องพิมพ์ผ่านการทดสอบล่าสุด'}
    else{badge.className='printer-status problem';badge.textContent='● ต้องตรวจสอบ';txt.textContent='การทดสอบล่าสุดพิมพ์ไม่ออก'}
  }
}
window.addEventListener('load',refreshPrinterSetupUI);


function restoreSavedPrinterOnStartup(){
  const p=printerProfile();
  if(!p)return;
  const paper=document.getElementById('receiptPaperSize');
  if(paper)paper.value=p.paper||'80';
  refreshPrinterSetupUI();
}
window.addEventListener('DOMContentLoaded',restoreSavedPrinterOnStartup);


function desktopPrinterProfile(){try{return JSON.parse(localStorage.getItem('yak_pos_desktop_printer')||'null')}catch(e){return null}}
async function refreshWindowsPrinters(){const s=document.getElementById('windowsPrinterSelect');if(!s)return;if(!window.yakDesktop){s.innerHTML='<option>กรุณาเปิดผ่าน YAK POS Desktop</option>';return;}s.innerHTML='<option>กำลังค้นหา...</option>';try{const ps=await window.yakDesktop.listPrinters();const saved=desktopPrinterProfile();if(!ps.length){s.innerHTML='<option value="">ไม่พบ Printer</option>';return;}s.innerHTML=ps.map(p=>`<option value="${p.name.replace(/"/g,'&quot;')}">${p.displayName||p.name}${p.isDefault?' (Default)':''}</option>`).join('');if(saved&&ps.some(p=>p.name===saved.name))s.value=saved.name;else{const d=ps.find(p=>p.isDefault);if(d)s.value=d.name;}document.getElementById('printerConnectionState').textContent='พบ '+ps.length+' เครื่อง';updateDesktopPrinterUI();}catch(e){s.innerHTML='<option value="">ค้นหาไม่สำเร็จ</option>';}}
function saveWindowsPrinter(){const name=document.getElementById('windowsPrinterSelect')?.value,paper=document.getElementById('receiptPaperSize')?.value||'80';if(!name){toast('กรุณาเลือกเครื่องพิมพ์');return;}localStorage.setItem('yak_pos_desktop_printer',JSON.stringify({name,paper,savedAt:new Date().toISOString()}));updateDesktopPrinterUI();toast('บันทึกเครื่องพิมพ์แล้ว');}
function updateDesktopPrinterUI(){const p=desktopPrinterProfile();if(!p)return;document.getElementById('savedPrinterName').textContent=p.name;document.getElementById('printerDeviceName').textContent=p.name;document.getElementById('receiptPaperSize').value=p.paper||'80';document.getElementById('printerStatusBadge').className='printer-status ready';document.getElementById('printerStatusBadge').textContent='● พร้อมใช้งาน';}
async function desktopTestPrinter(){const pName=document.getElementById('windowsPrinterSelect')?.value,paper=document.getElementById('receiptPaperSize')?.value||'80';if(!window.yakDesktop||!pName){toast('ยังไม่ได้เลือกเครื่องพิมพ์');return;}const r=await window.yakDesktop.testPrinter({deviceName:pName,paper});if(r?.ok){document.getElementById('printerLastTest').textContent=new Date().toLocaleString('th-TH');document.getElementById('printerStatusBadge').className='printer-status ready';document.getElementById('printerStatusBadge').textContent='● Test Print สำเร็จ';toast('พิมพ์ทดสอบแล้ว');}else toast('พิมพ์ไม่สำเร็จ');}
window.addEventListener('DOMContentLoaded',()=>{refreshWindowsPrinters();updateDesktopPrinterUI();});


function updateDesktopModeBadge(){
  const b=document.getElementById('desktopModeBadge');
  const d=document.getElementById('printerDiagnostic');
  if(!b)return;
  if(window.yakDesktop){
    b.textContent='Desktop Mode'; b.className='mode-badge desktop';
    if(d){d.className='printer-diagnostic ok';d.textContent='✓ เชื่อมต่อระบบ Windows Printer แล้ว'}
  }else{
    b.textContent='Web Mode'; b.className='mode-badge web';
    if(d){d.className='printer-diagnostic error';d.textContent='✕ ตอนนี้เปิดเป็นไฟล์เว็บ จึงสั่ง Printer Windows โดยตรงไม่ได้ — ให้เปิด START_YAK_POS.bat'}
  }
}
async function desktopTestPrinter(){
  updateDesktopModeBadge();
  if(!window.yakDesktop){toast('กรุณาปิดหน้านี้ แล้วเปิด START_YAK_POS.bat');return}
  const name=document.getElementById('windowsPrinterSelect')?.value;
  const paper=document.getElementById('receiptPaperSize')?.value||'80';
  if(!name){toast('ยังไม่ได้เลือกเครื่องพิมพ์');return}
  const d=document.getElementById('printerDiagnostic');
  if(d){d.className='printer-diagnostic';d.textContent='กำลังส่ง Test Print ไป '+name+' ...'}
  try{
    const r=await window.yakDesktop.testPrinter({deviceName:name,paper});
    if(r?.ok){
      localStorage.setItem('yak_pos_desktop_printer_test',JSON.stringify({name,time:new Date().toISOString(),ok:true}));
      if(d){d.className='printer-diagnostic ok';d.textContent='✓ Windows รับคำสั่งพิมพ์แล้ว: '+name}
      const badge=document.getElementById('printerStatusBadge');if(badge){badge.className='printer-status ready';badge.textContent='● Test Print ส่งสำเร็จ'}
      const last=document.getElementById('printerLastTest');if(last)last.textContent=new Date().toLocaleString('th-TH');
      toast('ส่ง Test Print แล้ว');
    }else{
      if(d){d.className='printer-diagnostic error';d.textContent='✕ พิมพ์ไม่สำเร็จ: '+(r?.error||'ไม่ทราบสาเหตุ')}
      toast('พิมพ์ไม่สำเร็จ: '+(r?.error||'Unknown'));
    }
  }catch(e){
    if(d){d.className='printer-diagnostic error';d.textContent='✕ '+e.message}
    toast('เกิดข้อผิดพลาดตอนพิมพ์');
  }
}
window.addEventListener('DOMContentLoaded',updateDesktopModeBadge);


// ===== V4.2 AUTO PAIR PRINTER =====
const RECEIPT_PRINTER_KEYWORDS=['receipt','thermal','pos','xprinter','xp-','gprinter','gp-','epson tm','tm-t','rongta','hprt','imin','sunmi','zjiang','zj-','58mm','80mm','cash drawer'];
function v42SavedPrinter(){try{return JSON.parse(localStorage.getItem('yak_pos_desktop_printer')||'null')}catch(e){return null}}
function v42SavePrinter(p){localStorage.setItem('yak_pos_desktop_printer',JSON.stringify(p));}
function v42PrinterScore(p){
  const s=((p.displayName||'')+' '+(p.name||'')+' '+(p.description||'')).toLowerCase();
  let score=0;
  RECEIPT_PRINTER_KEYWORDS.forEach(k=>{if(s.includes(k))score+=10});
  if(p.isDefault)score+=2;
  if(s.includes('pdf')||s.includes('onenote')||s.includes('fax')||s.includes('xps'))score-=100;
  return score;
}
async function v42AutoPairPrinters(){
  const sel=document.getElementById('windowsPrinterSelect');
  const badge=document.getElementById('printerStatusBadge');
  const diag=document.getElementById('printerDiagnostic');
  if(!window.yakDesktop){
    if(sel)sel.innerHTML='<option value="">กรุณาเปิด YAK POS AUTO</option>';
    if(diag){diag.className='printer-diagnostic error';diag.textContent='เปิดผิดโหมด — ให้ดับเบิลคลิก YAK_POS_AUTO.bat'}
    return;
  }
  try{
    const ps=await window.yakDesktop.listPrinters();
    if(!sel)return;
    if(!ps.length){
      sel.innerHTML='<option value="">ไม่พบ Printer ใน Windows</option>';
      if(badge){badge.className='printer-status problem';badge.textContent='● ไม่พบเครื่องพิมพ์'}
      return;
    }
    sel.innerHTML=ps.map(p=>`<option value="${String(p.name).replace(/"/g,'&quot;')}">${p.displayName||p.name}${p.isDefault?' (Default)':''}</option>`).join('');
    const saved=v42SavedPrinter();
    let chosen=null;
    if(saved && ps.some(p=>p.name===saved.name)) chosen=ps.find(p=>p.name===saved.name);
    if(!chosen && ps.length===1) chosen=ps[0];
    if(!chosen){
      const ranked=[...ps].map(p=>({p,score:v42PrinterScore(p)})).sort((a,b)=>b.score-a.score);
      if(ranked[0] && ranked[0].score>=10) chosen=ranked[0].p;
    }
    if(!chosen){
      const def=ps.find(p=>p.isDefault && v42PrinterScore(p)>-50);
      if(def) chosen=def;
    }
    if(chosen){
      sel.value=chosen.name;
      const paper=(saved?.paper)||(/58/.test((chosen.displayName||chosen.name||''))?'58':'80');
      v42SavePrinter({name:chosen.name,paper,savedAt:saved?.savedAt||new Date().toISOString(),autoPaired:!saved});
      const paperEl=document.getElementById('receiptPaperSize');if(paperEl)paperEl.value=paper;
      const dev=document.getElementById('printerDeviceName');if(dev)dev.textContent=chosen.displayName||chosen.name;
      const sn=document.getElementById('savedPrinterName');if(sn)sn.textContent=chosen.displayName||chosen.name;
      const st=document.getElementById('printerConnectionState');if(st)st.textContent='Windows Printer';
      if(badge){badge.className='printer-status ready';badge.textContent=saved?'● จดจำเครื่องแล้ว':'● จับคู่ให้อัตโนมัติแล้ว'}
      if(diag){diag.className='printer-diagnostic ok';diag.textContent='✓ พร้อมใช้: '+(chosen.displayName||chosen.name)}
    }else{
      if(diag){diag.className='printer-diagnostic';diag.textContent='พบหลายเครื่อง — เลือกเครื่องพิมพ์บิล 1 ครั้ง แล้วกด ใช้เครื่องนี้'}
    }
  }catch(e){
    if(diag){diag.className='printer-diagnostic error';diag.textContent='ค้นหา Printer ไม่สำเร็จ: '+e.message}
  }
}
async function refreshWindowsPrinters(){return v42AutoPairPrinters();}
function saveWindowsPrinter(){
  const name=document.getElementById('windowsPrinterSelect')?.value;
  const paper=document.getElementById('receiptPaperSize')?.value||'80';
  if(!name){toast('กรุณาเลือกเครื่องพิมพ์');return}
  v42SavePrinter({name,paper,savedAt:new Date().toISOString(),autoPaired:false});
  const badge=document.getElementById('printerStatusBadge');if(badge){badge.className='printer-status ready';badge.textContent='● จดจำเครื่องแล้ว'}
  const sn=document.getElementById('savedPrinterName');if(sn)sn.textContent=name;
  toast('บันทึกแล้ว ครั้งต่อไปใช้เครื่องนี้อัตโนมัติ');
}
async function desktopTestPrinter(){
  if(!window.yakDesktop){toast('กรุณาเปิดด้วย YAK_POS_AUTO.bat');return}
  const profile=v42SavedPrinter();
  const name=document.getElementById('windowsPrinterSelect')?.value||profile?.name;
  const paper=document.getElementById('receiptPaperSize')?.value||profile?.paper||'80';
  if(!name){toast('ยังไม่พบเครื่องพิมพ์');return}
  const r=await window.yakDesktop.testPrinter({deviceName:name,paper});
  const diag=document.getElementById('printerDiagnostic');
  if(r?.ok){
    v42SavePrinter({name,paper,savedAt:profile?.savedAt||new Date().toISOString(),autoPaired:profile?.autoPaired||false,testedAt:new Date().toISOString()});
    localStorage.setItem('yak_pos_desktop_printer_test',JSON.stringify({name,time:new Date().toISOString(),ok:true}));
    const badge=document.getElementById('printerStatusBadge');if(badge){badge.className='printer-status ready';badge.textContent='● พร้อมใช้งานจริง'}
    const last=document.getElementById('printerLastTest');if(last)last.textContent=new Date().toLocaleString('th-TH');
    if(diag){diag.className='printer-diagnostic ok';diag.textContent='✓ Test Print ส่งสำเร็จ: '+name}
    toast('เครื่องพิมพ์พร้อมใช้งาน');
  }else{
    if(diag){diag.className='printer-diagnostic error';diag.textContent='✕ '+(r?.error||'พิมพ์ไม่สำเร็จ')}
    toast('พิมพ์ไม่สำเร็จ');
  }
}
function desktopPrinterProfile(){return v42SavedPrinter();}
window.addEventListener('DOMContentLoaded',()=>setTimeout(v42AutoPairPrinters,150));


function yakPrinterProfile(){
  try{return JSON.parse(localStorage.getItem('yak_pos_pos58_printer')||'null')}catch(e){return null}
}
function yakSavePrinterProfile(p){localStorage.setItem('yak_pos_pos58_printer',JSON.stringify(p))}
function yakEsc(s=''){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}

async function refreshWindowsPrinters(){
  const sel=document.getElementById('windowsPrinterSelect');
  if(!sel)return;
  if(!window.yakDesktop){
    sel.innerHTML='<option value="">ต้องเปิดด้วยโปรแกรม YAK POS Desktop</option>';
    document.getElementById('printerConnectionState').textContent='Web Mode';
    return;
  }
  sel.innerHTML='<option value="">กำลังค้นหา...</option>';
  try{
    const ps=await window.yakDesktop.listPrinters();
    if(!ps.length){
      sel.innerHTML='<option value="">ไม่พบเครื่องพิมพ์ใน Windows</option>';
      document.getElementById('printerConnectionState').textContent='ไม่พบเครื่อง';
      return;
    }
    sel.innerHTML=ps.map(p=>`<option value="${yakEsc(p.name)}">${yakEsc(p.displayName||p.name)}${p.isDefault?' (Default)':''}</option>`).join('');
    const saved=yakPrinterProfile();
    let chosen=saved && ps.find(p=>p.name===saved.name);
    if(!chosen) chosen=ps.find(p=>/POS58|POS-58|receipt|thermal|xprinter|xp-|epson\s*tm/i.test((p.displayName||'')+' '+p.name));
    if(!chosen) chosen=ps.find(p=>p.isDefault);
    if(!chosen && ps.length===1) chosen=ps[0];
    if(chosen) sel.value=chosen.name;
    document.getElementById('printerConnectionState').textContent='พบ '+ps.length+' เครื่อง';
    restorePOS58Printer();
  }catch(e){
    sel.innerHTML='<option value="">ค้นหาไม่สำเร็จ</option>';
    document.getElementById('printerConnectionState').textContent='Error';
  }
}
function saveWindowsPrinter(){
  const name=document.getElementById('windowsPrinterSelect')?.value;
  if(!name){toast('กรุณาเลือกเครื่องพิมพ์');return}
  const p={
    name,
    paper:document.getElementById('receiptPaperSize')?.value||'58',
    scale:Number(document.getElementById('printerScale')?.value||383),
    savedAt:new Date().toISOString()
  };
  yakSavePrinterProfile(p);
  restorePOS58Printer();
  toast('บันทึก '+name+' เป็นเครื่องพิมพ์หลักแล้ว');
}
function restorePOS58Printer(){
  const p=yakPrinterProfile(); if(!p)return;
  const sel=document.getElementById('windowsPrinterSelect');
  if(sel && [...sel.options].some(o=>o.value===p.name))sel.value=p.name;
  if(document.getElementById('receiptPaperSize'))document.getElementById('receiptPaperSize').value=p.paper||'58';
  if(document.getElementById('printerScale'))document.getElementById('printerScale').value=p.scale||383;
  if(document.getElementById('savedPrinterName'))document.getElementById('savedPrinterName').textContent=p.name;
  if(document.getElementById('printerDeviceName'))document.getElementById('printerDeviceName').textContent=p.name;
  const badge=document.getElementById('printerStatusBadge');
  if(badge){badge.className='printer-status ready';badge.textContent='● บันทึกเป็นเครื่องหลักแล้ว'}
}
async function desktopTestPrinter(){
  if(!window.yakDesktop){toast('กรุณาเปิด YAK POS แบบ Desktop');return}
  const name=document.getElementById('windowsPrinterSelect')?.value;
  const paper=document.getElementById('receiptPaperSize')?.value||'58';
  if(!name){toast('กรุณาเลือกเครื่องพิมพ์');return}
  const r=await window.yakDesktop.testPrinter({deviceName:name,paper});
  if(r?.ok){
    document.getElementById('printerLastTest').textContent=new Date().toLocaleString('th-TH');
    document.getElementById('printerConnectionState').textContent='พร้อมใช้งาน';
    const badge=document.getElementById('printerStatusBadge');
    badge.className='printer-status ready'; badge.textContent='● ทดสอบพิมพ์สำเร็จ';
    toast('พิมพ์ใบ Test สำเร็จที่ '+name);
  }else toast('พิมพ์ไม่สำเร็จ: '+(r?.error||'ไม่ทราบสาเหตุ'));
}
window.addEventListener('DOMContentLoaded',()=>{restorePOS58Printer();refreshWindowsPrinters()});


async function refreshWindowsPrinters(){
  const sel=document.getElementById('windowsPrinterSelect');
  if(!sel)return;
  if(!window.yakDesktop){
    sel.innerHTML='<option value="">กรุณาเปิดผ่าน YAK POS Desktop</option>';
    const st=document.getElementById('printerConnectionState'); if(st)st.textContent='ไม่ได้เปิดแบบ Desktop';
    return;
  }
  try{
    const ps=await window.yakDesktop.listPrinters();
    if(!ps.length){
      sel.innerHTML='<option value="">ไม่พบเครื่องพิมพ์ใน Windows</option>';
      document.getElementById('printerConnectionState').textContent='ไม่พบเครื่อง';
      return;
    }
    sel.innerHTML=ps.map(p=>`<option value="${yakEsc(p.name)}">${yakEsc(p.displayName||p.name)}</option>`).join('');
    const saved=yakPrinterProfile();
    let chosen=saved && ps.find(p=>p.name===saved.name);
    if(!chosen) chosen=ps.find(p=>/POS58|POS-58|receipt|thermal|xprinter|xp-|epson\s*tm/i.test((p.displayName||'')+' '+p.name));
    if(!chosen && ps.length===1) chosen=ps[0];
    if(!chosen) chosen=ps.find(p=>p.isDefault);
    if(chosen) sel.value=chosen.name;
    document.getElementById('printerConnectionState').textContent='พร้อมเลือกใช้งาน';
    restorePOS58Printer();
  }catch(e){
    sel.innerHTML='<option value="">ค้นหาไม่สำเร็จ</option>';
    document.getElementById('printerConnectionState').textContent='เกิดข้อผิดพลาด';
  }
}
function saveWindowsPrinter(){
  const name=document.getElementById('windowsPrinterSelect')?.value;
  if(!name){toast('เลือกเครื่องพิมพ์ก่อน');return}
  const p={name,paper:document.getElementById('receiptPaperSize')?.value||'58',savedAt:new Date().toISOString()};
  yakSavePrinterProfile(p);
  restorePOS58Printer();
  const badge=document.getElementById('printerStatusBadge');
  if(badge){badge.className='printer-status ready';badge.textContent='● พร้อมใช้งาน'}
  toast('บันทึกเครื่องพิมพ์แล้ว');
}
function restorePOS58Printer(){
  const p=yakPrinterProfile(); if(!p)return;
  const sel=document.getElementById('windowsPrinterSelect');
  if(sel && [...sel.options].some(o=>o.value===p.name))sel.value=p.name;
  const paper=document.getElementById('receiptPaperSize'); if(paper)paper.value=p.paper||'58';
  const saved=document.getElementById('savedPrinterName'); if(saved)saved.textContent=p.name;
  const device=document.getElementById('printerDeviceName'); if(device)device.textContent=p.name;
  const badge=document.getElementById('printerStatusBadge');
  if(badge){badge.className='printer-status ready';badge.textContent='● พร้อมใช้งาน'}
}

const RECEIPT_MASTER_STYLE = `
  width:100%;
  margin:0;
  font-family:Tahoma,Arial,sans-serif;
  font-size:1em;
  line-height:1.28;
`;

window.addEventListener('DOMContentLoaded',()=>setTimeout(loadReceiptDesignForm,300));

window.addEventListener('DOMContentLoaded',()=>{ensureSharedStockData();setTimeout(()=>{renderMaterialsAdmin();renderMaterialLinks();renderAdvancedReports();},350);});


function addExpense(){
  const date=document.getElementById('expenseDate').value;
  const title=document.getElementById('expenseTitle').value.trim();
  const amount=Number(document.getElementById('expenseAmount').value||0);
  const category=document.getElementById('expenseCategory').value.trim()||'ทั่วไป';
  if(!date||!title||amount<=0){toast('กรอกรายจ่ายให้ครบ');return}
  db.expenses.push({id:'ex'+Date.now(),date,title,amount,category,branchId:session?.branchId||db.branches?.[0]?.id});
  saveDB();renderExpenses();renderAdvancedReports();toast('บันทึกรายจ่ายแล้ว');
}
function deleteExpense(id){
  db.expenses=(db.expenses||[]).filter(x=>x.id!==id);saveDB();renderExpenses();renderAdvancedReports();
}
function renderExpenses(){
  const box=document.getElementById('expensesTable');if(!box)return;
  const rows=(db.expenses||[]).slice().sort((a,b)=>b.date.localeCompare(a.date)).map(x=>`
    <tr><td>${x.date}</td><td>${x.title}</td><td>${x.category}</td><td>${money(x.amount)}</td><td><button class="action" onclick="deleteExpense('${x.id}')">ลบ</button></td></tr>`).join('');
  box.innerHTML=table(['วันที่','รายการ','หมวด','จำนวน','จัดการ'],rows||'<tr><td colspan="5">ยังไม่มีรายจ่าย</td></tr>');
}

function reportRange(){
  const mode=document.getElementById('advancedReportMode')?.value||'day';
  const value=document.getElementById('advancedReportDate')?.value;
  const now=new Date();
  let start,end,label;

  if(mode==='day'){
    const d=value?new Date(value+'T00:00:00'):now;
    start=new Date(d.getFullYear(),d.getMonth(),d.getDate(),0,0,0);
    end=new Date(d.getFullYear(),d.getMonth(),d.getDate(),23,59,59);
    label=start.toLocaleDateString('th-TH');
  }else if(mode==='month'){
    const d=value?new Date(value+'-01T00:00:00'):now;
    start=new Date(d.getFullYear(),d.getMonth(),1,0,0,0);
    end=new Date(d.getFullYear(),d.getMonth()+1,0,23,59,59);
    label=start.toLocaleDateString('th-TH',{month:'long',year:'numeric'});
  }else{
    const y=Number(value||now.getFullYear());
    start=new Date(y,0,1,0,0,0);
    end=new Date(y,11,31,23,59,59);
    label=String(y+543);
  }
  return {start,end,label,mode};
}

function updateAdvancedDateInput(){
  const mode=document.getElementById('advancedReportMode').value;
  const input=document.getElementById('advancedReportDate');
  const now=new Date();
  if(mode==='day'){
    input.type='date';
    input.value=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  }else if(mode==='month'){
    input.type='month';
    input.value=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  }else{
    input.type='number';input.min='2020';input.max='2100';input.value=now.getFullYear();
  }
  renderAdvancedReports();
}

function renderAdvancedReports(){
  const root=document.getElementById('advancedReports');if(!root)return;
  const {start,end,label}=reportRange();
  const branchId=session?.branchId;

  const sales=(db.sales||[]).filter(s=>{
    const d=new Date(s.date);
    return d>=start&&d<=end&&(!branchId||s.branchId===branchId||currentEmployee()?.role==='owner');
  });
  const expenses=(db.expenses||[]).filter(x=>{
    const d=new Date(x.date+'T12:00:00');
    return d>=start&&d<=end&&(!branchId||x.branchId===branchId||currentEmployee()?.role==='owner');
  });

  const revenue=sales.reduce((a,s)=>a+Number(s.total||0),0);
  const expenseTotal=expenses.reduce((a,x)=>a+Number(x.amount||0),0);
  const cost=sales.reduce((a,s)=>a+Number(s.costTotal||0),0);
  const profit=revenue-cost-expenseTotal;
  const cash=sales.filter(s=>s.payMethod==='cash').reduce((a,s)=>a+Number(s.total||0),0);
  const qr=sales.filter(s=>s.payMethod==='qr').reduce((a,s)=>a+Number(s.total||0),0);
  const card=sales.filter(s=>s.payMethod==='card').reduce((a,s)=>a+Number(s.total||0),0);

  const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v};
  set('arLabel',label);set('arRevenue',money(revenue));set('arExpense',money(expenseTotal));
  set('arCost',money(cost));set('arProfit',money(profit));set('arBills',String(sales.length));

  const totalPay=revenue||1;
  set('arCashPct',(cash/totalPay*100).toFixed(1)+'%');
  set('arQrPct',(qr/totalPay*100).toFixed(1)+'%');
  set('arCardPct',(card/totalPay*100).toFixed(1)+'%');

  const prod={};
  sales.forEach(s=>(s.items||[]).forEach(i=>{
    prod[i.name]=(prod[i.name]||0)+Number(i.price||0)*Number(i.qty||0);
  }));
  const prodRows=Object.entries(prod).sort((a,b)=>b[1]-a[1]).map(([name,val])=>`
    <tr><td>${name}</td><td>${money(val)}</td><td>${revenue?(val/revenue*100).toFixed(1):0}%</td></tr>`).join('');
  document.getElementById('advancedProductShare').innerHTML=table(['สินค้า','ยอดขาย','สัดส่วน'],prodRows||'<tr><td colspan="3">ไม่มีข้อมูล</td></tr>');

  const payRows=[
    ['เงินสด',cash,revenue?cash/revenue*100:0],
    ['QR / โอน',qr,revenue?qr/revenue*100:0],
    ['บัตร',card,revenue?card/revenue*100:0]
  ].map(x=>`<tr><td>${x[0]}</td><td>${money(x[1])}</td><td>${x[2].toFixed(1)}%</td></tr>`).join('');
  document.getElementById('advancedPaymentShare').innerHTML=table(['ช่องทาง','ยอด','สัดส่วน'],payRows);

  renderExpenses();
}

window.addEventListener('DOMContentLoaded',()=>{
  const d=new Date();
  const ds=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const ex=document.getElementById('expenseDate');if(ex&&!ex.value)ex.value=ds;
  const rd=document.getElementById('advancedReportDate');if(rd&&!rd.value)rd.value=ds;
});


function localDayBounds(offsetDays=0){
  const n=new Date();
  const d=new Date(n.getFullYear(),n.getMonth(),n.getDate()+offsetDays);
  return {
    start:new Date(d.getFullYear(),d.getMonth(),d.getDate(),0,0,0,0),
    end:new Date(d.getFullYear(),d.getMonth(),d.getDate(),23,59,59,999)
  };
}

function salesForBounds(bounds){
  const emp=currentEmployee();
  return (db.sales||[]).filter(s=>{
    const d=new Date(s.date);
    const branchOk=emp?.role==='owner' ? true : s.branchId===session?.branchId;
    return branchOk && d>=bounds.start && d<=bounds.end;
  });
}

function paymentTotal(sales, method){
  return sales.filter(s=>s.payMethod===method).reduce((a,s)=>a+Number(s.total||0),0);
}

function pctChange(today,yesterday){
  today=Number(today||0);yesterday=Number(yesterday||0);
  if(yesterday===0){
    if(today===0)return {pct:0,dir:'same'};
    return {pct:100,dir:'up'};
  }
  const pct=(today-yesterday)/Math.abs(yesterday)*100;
  return {pct:Math.abs(pct),dir:pct>0?'up':pct<0?'down':'same'};
}

function compareMetric(label,today,yesterday,format='money'){
  const c=pctChange(today,yesterday);
  const arrow=c.dir==='up'?'▲':c.dir==='down'?'▼':'•';
  const cls=c.dir==='up'?'compare-up':c.dir==='down'?'compare-down':'compare-same';
  const tv=format==='money'?money(today):Number(today||0).toLocaleString('th-TH');
  const yv=format==='money'?money(yesterday):Number(yesterday||0).toLocaleString('th-TH');
  return `
    <div class="compare-card">
      <span class="compare-label">${label}</span>
      <strong class="compare-today">${tv}</strong>
      <div class="compare-yesterday">เมื่อวาน ${yv}</div>
      <div class="compare-change ${cls}">${arrow} ${c.pct.toFixed(1)}%</div>
    </div>`;
}

function renderTodayVsYesterday(){
  const box=document.getElementById('todayVsYesterdayGrid');if(!box)return;

  const todaySales=salesForBounds(localDayBounds(0));
  const yesterdaySales=salesForBounds(localDayBounds(-1));

  const sum=s=>s.reduce((a,x)=>a+Number(x.total||0),0);
  const todayRevenue=sum(todaySales);
  const yRevenue=sum(yesterdaySales);

  const todayBills=todaySales.length;
  const yBills=yesterdaySales.length;

  const todayAvg=todayBills?todayRevenue/todayBills:0;
  const yAvg=yBills?yRevenue/yBills:0;

  const todayCash=paymentTotal(todaySales,'cash');
  const yCash=paymentTotal(yesterdaySales,'cash');

  const todayQr=paymentTotal(todaySales,'qr');
  const yQr=paymentTotal(yesterdaySales,'qr');

  const todayCard=paymentTotal(todaySales,'card');
  const yCard=paymentTotal(yesterdaySales,'card');

  box.innerHTML=
    compareMetric('ยอดขายรวม',todayRevenue,yRevenue)+
    compareMetric('จำนวนบิล',todayBills,yBills,'number')+
    compareMetric('ยอดเฉลี่ย / บิล',todayAvg,yAvg)+
    compareMetric('เงินสด',todayCash,yCash)+
    compareMetric('QR / โอน',todayQr,yQr)+
    compareMetric('บัตร',todayCard,yCard);

  const now=new Date();
  const y=new Date(now.getFullYear(),now.getMonth(),now.getDate()-1);
  const label=document.getElementById('todayVsYesterdayLabel');
  if(label)label.textContent=
    `วันนี้ ${now.toLocaleDateString('th-TH')} เทียบกับ ${y.toLocaleDateString('th-TH')}`;
}

window.addEventListener('DOMContentLoaded',()=>setTimeout(renderTodayVsYesterday,400));


function yakSetWorkspaceMode(mode){
  document.body.classList.remove('yak-intro','yak-front','yak-backoffice');
  if(mode==='back') document.body.classList.add('yak-backoffice');
  else if(mode==='front') document.body.classList.add('yak-front');
  else document.body.classList.add('yak-intro');
  localStorage.setItem('yak_workspace_mode',mode);
}

function yakApplyWorkspaceFromSession(){
  // Every fresh app launch starts on the clean Intro.
  // Management panels are never rendered on Intro.
  yakSetWorkspaceMode('intro');
}

function yakEnterIntro(){ yakSetWorkspaceMode('intro'); }
function yakEnterFront(){ yakSetWorkspaceMode('front'); }
function yakEnterBack(){ yakSetWorkspaceMode('back'); }
window.addEventListener('DOMContentLoaded',()=>setTimeout(yakApplyWorkspaceFromSession,80));


// V4.4.24: Back Office opens directly (no PIN), while Intro remains clean.
yakEnterBack=function(){
  document.body.classList.remove('yak-intro','yak-front','yak-back-locked');
  document.body.classList.add('yak-backoffice');
  localStorage.setItem('yak_workspace_mode','intro'); // reload always returns to Intro
  setTimeout(()=>yakShowBackPage('products'),0);
};
window.addEventListener('DOMContentLoaded',()=>{
  document.body.classList.remove('yak-backoffice','yak-back-locked');
  document.body.classList.add('yak-intro');
  localStorage.setItem('yak_workspace_mode','intro');
},true);
window.addEventListener('beforeunload',()=>localStorage.setItem('yak_workspace_mode','intro'));

function setReportFromDateToNow(){
  const s=document.getElementById('reportRangeStart');
  const e=document.getElementById('reportRangeEnd');
  if(!s)return;
  if(!s.value)s.value=isoLocal(new Date());
  if(e)e.value=isoLocal(new Date());
  renderDateRangeReport();
}
let yakReportLiveTimer=null;
function startYakRealtimeReport(){
  if(yakReportLiveTimer)clearInterval(yakReportLiveTimer);
  yakReportLiveTimer=setInterval(()=>{
    if(document.body.classList.contains('yak-backoffice') && yakBackPage==='reports'){
      renderDateRangeReport();
      const x=document.getElementById('reportRealtimeStatus');
      if(x)x.textContent='อัปเดตล่าสุด '+new Date().toLocaleTimeString('th-TH');
    }
  },3000);
}
window.addEventListener('DOMContentLoaded',()=>setTimeout(startYakRealtimeReport,800));


let detailedReportMode='today';
let detailedReportLastData=null;
let detailedReportTimer=null;

function reportDateISO(d){
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function setDetailedReportMode(mode,btn){
  detailedReportMode=mode;
  document.querySelectorAll('.report-mode-btn').forEach(x=>x.classList.remove('active'));
  if(btn)btn.classList.add('active');

  ['reportSingleDayRow','reportMonthRow','reportYearRow','reportRangeRow','reportToNowRow'].forEach(id=>{
    document.getElementById(id)?.classList.add('hidden');
  });

  const now=new Date();
  if(mode==='day'){
    document.getElementById('reportSingleDayRow')?.classList.remove('hidden');
    const x=document.getElementById('detailDayInput');if(x&&!x.value)x.value=reportDateISO(now);
  }else if(mode==='month'){
    document.getElementById('reportMonthRow')?.classList.remove('hidden');
    const x=document.getElementById('detailMonthInput');
    if(x&&!x.value)x.value=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  }else if(mode==='year'){
    document.getElementById('reportYearRow')?.classList.remove('hidden');
    const x=document.getElementById('detailYearInput');if(x&&!x.value)x.value=now.getFullYear();
  }else if(mode==='range'){
    document.getElementById('reportRangeRow')?.classList.remove('hidden');
    const s=document.getElementById('detailRangeStart'),e=document.getElementById('detailRangeEnd');
    if(s&&!s.value)s.value=reportDateISO(now);
    if(e&&!e.value)e.value=reportDateISO(now);
  }else if(mode==='toNow'){
    document.getElementById('reportToNowRow')?.classList.remove('hidden');
    const s=document.getElementById('detailToNowStart');if(s&&!s.value)s.value=reportDateISO(now);
  }
  renderDetailedReport();
}

function detailedReportBounds(){
  const now=new Date();
  let start,end,label='';

  if(detailedReportMode==='calendarRange' || detailedReportMode==='calendarToNow'){
    const sv=document.getElementById('calendarReportStart')?.value||reportDateISO(now);
    const ev=document.getElementById('calendarReportEnd')?.value||reportDateISO(now);
    start=new Date(sv+'T00:00:00');
    end=detailedReportMode==='calendarToNow' ? new Date() : new Date(ev+'T23:59:59.999');
    if(start>end && detailedReportMode!=='calendarToNow'){
      const t=start;start=new Date(ev+'T00:00:00');end=new Date(sv+'T23:59:59.999');
    }
    label=detailedReportMode==='calendarToNow'
      ? `${start.toLocaleDateString('th-TH')} ถึงปัจจุบัน`
      : `${start.toLocaleDateString('th-TH')} ถึง ${end.toLocaleDateString('th-TH')}`;
    return {start,end,label};
  }

  if(detailedReportMode==='today'){
    start=new Date(now.getFullYear(),now.getMonth(),now.getDate(),0,0,0,0);
    end=new Date(now.getFullYear(),now.getMonth(),now.getDate(),23,59,59,999);
    label='วันนี้ '+start.toLocaleDateString('th-TH');
  }else if(detailedReportMode==='yesterday'){
    const y=new Date(now.getFullYear(),now.getMonth(),now.getDate()-1);
    start=new Date(y.getFullYear(),y.getMonth(),y.getDate(),0,0,0,0);
    end=new Date(y.getFullYear(),y.getMonth(),y.getDate(),23,59,59,999);
    label='เมื่อวาน '+start.toLocaleDateString('th-TH');
  }else if(detailedReportMode==='day'){
    const v=document.getElementById('detailDayInput')?.value||reportDateISO(now);
    const d=new Date(v+'T00:00:00');
    start=new Date(d.getFullYear(),d.getMonth(),d.getDate(),0,0,0,0);
    end=new Date(d.getFullYear(),d.getMonth(),d.getDate(),23,59,59,999);
    label=start.toLocaleDateString('th-TH');
  }else if(detailedReportMode==='month'){
    const v=document.getElementById('detailMonthInput')?.value||`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    const [y,m]=v.split('-').map(Number);
    start=new Date(y,m-1,1,0,0,0,0); end=new Date(y,m,0,23,59,59,999);
    label=start.toLocaleDateString('th-TH',{month:'long',year:'numeric'});
  }else if(detailedReportMode==='year'){
    const y=Number(document.getElementById('detailYearInput')?.value||now.getFullYear());
    start=new Date(y,0,1,0,0,0,0); end=new Date(y,11,31,23,59,59,999);
    label='ปี '+(y+543);
  }else if(detailedReportMode==='range'){
    const sv=document.getElementById('detailRangeStart')?.value||reportDateISO(now);
    const ev=document.getElementById('detailRangeEnd')?.value||reportDateISO(now);
    start=new Date(sv+'T00:00:00');end=new Date(ev+'T23:59:59.999');
    if(start>end){const t=start;start=new Date(ev+'T00:00:00');end=new Date(sv+'T23:59:59.999');}
    label=`${start.toLocaleDateString('th-TH')} ถึง ${end.toLocaleDateString('th-TH')}`;
  }else{
    const sv=document.getElementById('detailToNowStart')?.value||reportDateISO(now);
    start=new Date(sv+'T00:00:00');end=new Date();
    label=`${start.toLocaleDateString('th-TH')} ถึงปัจจุบัน`;
  }
  return {start,end,label};
}

function renderDetailedReport(){
  const {start,end,label}=detailedReportBounds();
  const emp=currentEmployee();
  const sales=(db.sales||[]).filter(s=>{
    const d=new Date(s.date);
    const branchOk=emp?.role==='owner'?true:s.branchId===session?.branchId;
    return branchOk&&d>=start&&d<=end;
  });
  const expenses=(db.expenses||[]).filter(x=>{
    const d=new Date(x.date+'T12:00:00');
    const branchOk=emp?.role==='owner'?true:x.branchId===session?.branchId;
    return branchOk&&d>=start&&d<=end;
  });

  const revenue=sales.reduce((a,s)=>a+Number(s.total||0),0);
  const expenseTotal=expenses.reduce((a,x)=>a+Number(x.amount||0),0);
  const cost=sales.reduce((a,s)=>a+Number(s.costTotal||0),0);
  const profit=revenue-cost-expenseTotal;
  const bills=sales.length;
  const avg=bills?revenue/bills:0;
  const pay=m=>sales.filter(s=>s.payMethod===m).reduce((a,s)=>a+Number(s.total||0),0);
  const cash=pay('cash'),qr=pay('qr'),card=pay('card');

  const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v};
  set('detailReportPeriod',label);
  set('detailReportUpdated',new Date().toLocaleString('th-TH'));
  set('detailedReportLiveText','อัปเดตล่าสุด '+new Date().toLocaleTimeString('th-TH'));
  set('drSales',money(revenue));set('drBills',String(bills));set('drAvg',money(avg));
  set('drExpense',money(expenseTotal));set('drCost',money(cost));set('drProfit',money(profit));
  set('drCash',money(cash));set('drQr',money(qr));set('drCard',money(card));
  const cashPct=revenue?cash/revenue*100:0,qrPct=revenue?qr/revenue*100:0,cardPct=revenue?card/revenue*100:0;
  set('drCashPct',cashPct.toFixed(1)+'%');set('drQrPct',qrPct.toFixed(1)+'%');set('drCardPct',cardPct.toFixed(1)+'%');
  const bar=(id,v)=>{const e=document.getElementById(id);if(e)e.style.width=Math.min(100,v)+'%'};
  bar('drCashBar',cashPct);bar('drQrBar',qrPct);bar('drCardBar',cardPct);

  // daily totals
  const byDay={};
  sales.forEach(s=>{
    const d=new Date(s.date); const k=reportDateISO(d);
    if(!byDay[k])byDay[k]={date:k,total:0,bills:0,cash:0,qr:0,card:0};
    byDay[k].total+=Number(s.total||0);byDay[k].bills++;
    byDay[k][s.payMethod]=(byDay[k][s.payMethod]||0)+Number(s.total||0);
  });
  const dayRows=Object.values(byDay).sort((a,b)=>a.date.localeCompare(b.date)).map(x=>
    `<tr><td>${new Date(x.date+'T12:00:00').toLocaleDateString('th-TH')}</td><td>${x.bills}</td><td>${money(x.total)}</td><td>${money(x.cash||0)}</td><td>${money(x.qr||0)}</td><td>${money(x.card||0)}</td></tr>`
  ).join('');
  document.getElementById('drDailyTable').innerHTML=yakReportTable(['วันที่','บิล','ยอดรวม','เงินสด','QR/โอน','บัตร'],dayRows||'<tr><td colspan="6">ไม่มีข้อมูล</td></tr>');

  // products
  const products={};
  sales.forEach(s=>(s.items||[]).forEach(i=>{
    const k=i.productId||i.name;
    if(!products[k])products[k]={name:i.name,qty:0,total:0};
    products[k].qty+=Number(i.qty||0);
    products[k].total+=Number(i.price||0)*Number(i.qty||0);
  }));
  const pRows=Object.values(products).sort((a,b)=>b.total-a.total).map((x,idx)=>
    `<tr><td>${idx+1}</td><td>${x.name}</td><td>${x.qty}</td><td>${money(x.total)}</td><td>${revenue?(x.total/revenue*100).toFixed(1):0}%</td></tr>`
  ).join('');
  document.getElementById('drProductsTable').innerHTML=yakReportTable(['#','สินค้า','จำนวน','ยอดขาย','สัดส่วน'],pRows||'<tr><td colspan="5">ไม่มีข้อมูล</td></tr>');

  // expenses
  const eRows=expenses.slice().sort((a,b)=>b.date.localeCompare(a.date)).map(x=>
    `<tr><td>${x.date}</td><td>${x.title}</td><td>${x.category||'-'}</td><td>${money(x.amount)}</td></tr>`
  ).join('');
  document.getElementById('drExpensesTable').innerHTML=yakReportTable(['วันที่','รายการ','หมวด','จำนวน'],eRows||'<tr><td colspan="4">ไม่มีรายจ่าย</td></tr>');

  // bills
  const bRows=sales.slice().sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,100).map(s=>{
    const employee=db.employees.find(e=>e.id===s.employeeId);
    const payLabel=s.payMethod==='cash'?'เงินสด':s.payMethod==='qr'?'QR / โอน':'บัตร';
    return `<tr><td>${s.id}</td><td>${new Date(s.date).toLocaleString('th-TH')}</td><td>${employee?.name||'-'}</td><td>${payLabel}</td><td>${money(s.total)}</td></tr>`;
  }).join('');
  document.getElementById('drBillsTable').innerHTML=yakReportTable(['เลขบิล','วันเวลา','พนักงาน','ชำระ','ยอด'],bRows||'<tr><td colspan="5">ไม่มีบิล</td></tr>');

  detailedReportLastData={start,end,label,revenue,expenseTotal,cost,profit,bills,avg,cash,qr,card,sales,expenses,products};
  renderTodayVsYesterday();
}

function buildDetailedReportHtml(){
  if(!detailedReportLastData)renderDetailedReport();
  const d=detailedReportLastData;if(!d)return null;
  const productRows=Object.values(d.products).sort((a,b)=>b.total-a.total).map(x=>
    `<tr><td>${x.name}</td><td>${x.qty}</td><td>${money(x.total)}</td></tr>`).join('');
  const expenseRows=d.expenses.map(x=>`<tr><td>${x.date}</td><td>${x.title}</td><td>${x.category||'-'}</td><td>${money(x.amount)}</td></tr>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  @page{size:A4;margin:12mm}body{font-family:Tahoma,Arial,sans-serif;font-size:12px;color:#111}
  h1{text-align:center;margin:0}.sub{text-align:center;color:#555;margin:4px 0 14px}
  .summary{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}.card{border:1px solid #bbb;padding:8px;border-radius:5px}
  .card span{font-size:10px;color:#666;display:block}.card b{font-size:15px}
  table{width:100%;border-collapse:collapse;margin:8px 0 16px}th,td{border:1px solid #bbb;padding:6px;text-align:left}th{background:#eee}
  .num{text-align:right}h2{font-size:15px;margin-top:18px}</style></head><body>
  <h1>รายงาน YAK POS</h1><div class="sub">${d.label}<br>สร้างเมื่อ ${new Date().toLocaleString('th-TH')}</div>
  <div class="summary">
   <div class="card"><span>ยอดขายรวม</span><b>${money(d.revenue)}</b></div>
   <div class="card"><span>จำนวนบิล</span><b>${d.bills}</b></div>
   <div class="card"><span>เฉลี่ย/บิล</span><b>${money(d.avg)}</b></div>
   <div class="card"><span>รายจ่าย</span><b>${money(d.expenseTotal)}</b></div>
   <div class="card"><span>ต้นทุน</span><b>${money(d.cost)}</b></div>
   <div class="card"><span>กำไรสุทธิ</span><b>${money(d.profit)}</b></div>
  </div>
  <h2>ช่องทางชำระเงิน</h2>
  <table><tr><th>ช่องทาง</th><th>ยอด</th></tr>
   <tr><td>เงินสด</td><td>${money(d.cash)}</td></tr>
   <tr><td>QR / โอน</td><td>${money(d.qr)}</td></tr>
   <tr><td>บัตร</td><td>${money(d.card)}</td></tr>
  </table>
  <h2>สินค้า</h2><table><tr><th>สินค้า</th><th>จำนวน</th><th>ยอดขาย</th></tr>${productRows||'<tr><td colspan="3">ไม่มีข้อมูล</td></tr>'}</table>
  <h2>รายจ่าย</h2><table><tr><th>วันที่</th><th>รายการ</th><th>หมวด</th><th>จำนวน</th></tr>${expenseRows||'<tr><td colspan="4">ไม่มีข้อมูล</td></tr>'}</table>
  </body></html>`;
}

async function saveDetailedReportPdf(){
  const html=buildDetailedReportHtml();if(!html)return;
  if(window.yakDesktop?.saveReportPdf){
    const r=await window.yakDesktop.saveReportPdf({html});
    if(r?.ok)toast('บันทึก PDF แล้ว'); else if(!r?.canceled)toast('บันทึก PDF ไม่สำเร็จ');
  }else{
    const w=window.open('','YAK_REPORT_PDF','width=900,height=700');if(!w)return;
    w.document.write(html);w.document.close();setTimeout(()=>w.print(),300);
  }
}
async function printDetailedReport(){
  const html=buildDetailedReportHtml();if(!html)return;
  if(window.yakDesktop?.printReport){
    const r=await window.yakDesktop.printReport({html});if(!r?.ok&&!r?.canceled)toast('พิมพ์รายงานไม่สำเร็จ');
  }else{
    const w=window.open('','YAK_REPORT_PRINT','width=900,height=700');if(!w)return;
    w.document.write(html);w.document.close();setTimeout(()=>w.print(),300);
  }
}

function startDetailedReportRealtime(){
  if(detailedReportTimer)clearInterval(detailedReportTimer);
  detailedReportTimer=setInterval(()=>{
    if(document.body.classList.contains('yak-backoffice')&&yakBackPage==='reports')renderDetailedReport();
  },3000);
}
window.addEventListener('DOMContentLoaded',()=>setTimeout(()=>{
  const now=new Date();
  const d=document.getElementById('detailDayInput');if(d)d.value=reportDateISO(now);
  const m=document.getElementById('detailMonthInput');if(m)m.value=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const y=document.getElementById('detailYearInput');if(y)y.value=now.getFullYear();
  const rs=document.getElementById('detailRangeStart'),re=document.getElementById('detailRangeEnd'),tn=document.getElementById('detailToNowStart');
  if(rs)rs.value=reportDateISO(now);if(re)re.value=reportDateISO(now);if(tn)tn.value=reportDateISO(now);
  renderDetailedReport();startDetailedReportRealtime();
},700));

// V4.4.26 FINAL REPORT ROUTING OVERRIDE
const _yakShowBackPageFinal = yakShowBackPage;
yakShowBackPage = function(page){
  yakBackPage=page||'products';

  document.querySelectorAll('[data-backpage-panel]').forEach(el=>{
    const active=el.getAttribute('data-backpage-panel')===yakBackPage;
    el.classList.toggle('yak-page-active',active);
    el.style.display=active?'block':'none';
  });

  document.querySelectorAll('.yak-back-tab').forEach(btn=>{
    btn.classList.toggle('active',btn.dataset.backpage===yakBackPage);
  });

  if(yakBackPage==='products'){
    try{renderProductsAdmin()}catch(e){}
  }else if(yakBackPage==='stock'){
    try{renderMaterialsAdmin()}catch(e){}
    try{renderMaterialLinks()}catch(e){}
    try{renderEasyMaterialPicker()}catch(e){}
    try{renderStockProductManager()}catch(e){}
  }else if(yakBackPage==='reports'){
    const panel=document.getElementById('advancedReports');
    if(panel){panel.style.display='block';panel.classList.add('yak-page-active')}
    try{renderDetailedReport()}catch(e){console.error('Detailed report render:',e)}
    try{renderTodayVsYesterday()}catch(e){}
  }else if(yakBackPage==='receipt'){
    try{loadReceiptDesignForm()}catch(e){}
  }
};

// Re-bind Back Office nav using capture phase to guarantee report tab works.
document.addEventListener('click',function(e){
  const b=e.target.closest('.yak-back-tab');
  if(!b)return;
  e.preventDefault();
  e.stopPropagation();
  yakShowBackPage(b.dataset.backpage);
},true);

// Keep report real-time while visible.
setInterval(()=>{
  if(document.body.classList.contains('yak-backoffice') && yakBackPage==='reports'){
    try{renderDetailedReport()}catch(e){}
  }
},3000);

function yakReportTable(headers,rows){
  if(typeof table==='function'){
    try{return table(headers,rows)}catch(e){}
  }
  return `<div class="table-wrap"><table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>`;
}


function clearCalendarPresetActive(btn){
  document.querySelectorAll('.calendar-quick-row .report-mode-btn').forEach(x=>x.classList.remove('active'));
  if(btn)btn.classList.add('active');
}
function calendarSetInputs(start,end){
  const s=document.getElementById('calendarReportStart');
  const e=document.getElementById('calendarReportEnd');
  if(s)s.value=reportDateISO(start);
  if(e)e.value=reportDateISO(end);
}
function calendarReportPreset(type,btn){
  clearCalendarPresetActive(btn);
  const now=new Date();
  let start=new Date(now.getFullYear(),now.getMonth(),now.getDate());
  let end=new Date(start);
  if(type==='yesterday'){start.setDate(start.getDate()-1);end=new Date(start);}
  else if(type==='7days'){start.setDate(start.getDate()-6);}
  else if(type==='month'){start=new Date(now.getFullYear(),now.getMonth(),1);end=new Date(now.getFullYear(),now.getMonth()+1,0);}
  else if(type==='year'){start=new Date(now.getFullYear(),0,1);end=new Date(now.getFullYear(),11,31);}
  calendarSetInputs(start,end);
  detailedReportMode='calendarRange';
  renderDetailedReport();
}
function calendarReportCustomRange(){
  clearCalendarPresetActive(null);
  detailedReportMode='calendarRange';
  renderDetailedReport();
}
function calendarReportToNow(){
  clearCalendarPresetActive(null);
  const v=document.getElementById('calendarToNowStart')?.value;
  if(!v){toast('กรุณาเลือกวันที่เริ่มต้น');return;}
  const s=document.getElementById('calendarReportStart');
  const e=document.getElementById('calendarReportEnd');
  if(s)s.value=v;if(e)e.value=reportDateISO(new Date());
  detailedReportMode='calendarToNow';
  renderDetailedReport();
}
function calendarReportMonth(){
  clearCalendarPresetActive(null);
  const v=document.getElementById('calendarMonth')?.value;
  if(!v){toast('กรุณาเลือกเดือน');return;}
  const [y,m]=v.split('-').map(Number);
  calendarSetInputs(new Date(y,m-1,1),new Date(y,m,0));
  detailedReportMode='calendarRange';
  renderDetailedReport();
}
function calendarReportYear(){
  clearCalendarPresetActive(null);
  const y=Number(document.getElementById('calendarYear')?.value);
  if(!y){toast('กรุณาเลือกปี');return;}
  calendarSetInputs(new Date(y,0,1),new Date(y,11,31));
  detailedReportMode='calendarRange';
  renderDetailedReport();
}

window.addEventListener('DOMContentLoaded',()=>setTimeout(()=>{
  const now=new Date();
  calendarSetInputs(now,now);
  const tn=document.getElementById('calendarToNowStart');if(tn)tn.value=reportDateISO(now);
  const mo=document.getElementById('calendarMonth');if(mo)mo.value=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const yr=document.getElementById('calendarYear');if(yr)yr.value=now.getFullYear();
  detailedReportMode='calendarRange';
  renderDetailedReport();
},900));

// === V4.4.28 VERIFIED REPORT ===
let r28Mode='range',r28Last=null;
function r28Iso(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function r28Set(a,b){document.getElementById('r28Start').value=r28Iso(a);document.getElementById('r28End').value=r28Iso(b)}
function r28Preset(t){
 const n=new Date();let a=new Date(n.getFullYear(),n.getMonth(),n.getDate()),b=new Date(a);
 if(t==='yesterday'){a.setDate(a.getDate()-1);b=new Date(a)}
 if(t==='7')a.setDate(a.getDate()-6);
 if(t==='month'){a=new Date(n.getFullYear(),n.getMonth(),1);b=new Date(n.getFullYear(),n.getMonth()+1,0)}
 if(t==='year'){a=new Date(n.getFullYear(),0,1);b=new Date(n.getFullYear(),11,31)}
 r28Mode='range';r28Set(a,b);r28Render();
}
function r28Custom(){r28Mode='range';r28Render()}
function r28FromToNow(){
 const v=document.getElementById('r28ToNow').value;if(!v){toast('เลือกวันที่เริ่มต้นก่อน');return}
 document.getElementById('r28Start').value=v;document.getElementById('r28End').value=r28Iso(new Date());
 r28Mode='now';r28Render();
}
function r28Month(){
 const v=document.getElementById('r28Month').value;if(!v)return;
 const [y,m]=v.split('-').map(Number);r28Mode='range';r28Set(new Date(y,m-1,1),new Date(y,m,0));r28Render()
}
function r28Year(){
 const y=Number(document.getElementById('r28Year').value);if(!y)return;
 r28Mode='range';r28Set(new Date(y,0,1),new Date(y,11,31));r28Render()
}
function r28Data(){
 const sv=document.getElementById('r28Start').value,ev=document.getElementById('r28End').value;
 let start=new Date((sv||r28Iso(new Date()))+'T00:00:00');
 let end=r28Mode==='now'?new Date():new Date((ev||r28Iso(new Date()))+'T23:59:59.999');
 if(start>end){const t=start;start=end;end=t}
 const emp=currentEmployee();
 const sales=(db.sales||[]).filter(x=>{const d=new Date(x.date);return (emp?.role==='owner'||x.branchId===session?.branchId)&&d>=start&&d<=end});
 const expenses=(db.expenses||[]).filter(x=>{const d=new Date(x.date+'T12:00:00');return (emp?.role==='owner'||x.branchId===session?.branchId)&&d>=start&&d<=end});
 return {start,end,sales,expenses};
}
function r28Table(h,rows){return `<div class="table-wrap"><table><thead><tr>${h.map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody>${rows||`<tr><td colspan="${h.length}">ไม่มีข้อมูล</td></tr>`}</tbody></table></div>`}
function r28Render(){
 if(!document.getElementById('r28Start'))return;
 const d=r28Data(),sales=d.sales,expenses=d.expenses;
 const total=sales.reduce((a,x)=>a+Number(x.total||0),0), exp=expenses.reduce((a,x)=>a+Number(x.amount||0),0);
 const cost=sales.reduce((a,x)=>a+Number(x.costTotal||0),0),profit=total-cost-exp,avg=sales.length?total/sales.length:0;
 const pay=m=>sales.filter(x=>x.payMethod===m).reduce((a,x)=>a+Number(x.total||0),0),cash=pay('cash'),qr=pay('qr'),card=pay('card');
 const put=(id,v)=>{const x=document.getElementById(id);if(x)x.textContent=v};
 put('r28Updated','อัปเดต '+new Date().toLocaleTimeString('th-TH'));
 put('r28Period',`${d.start.toLocaleDateString('th-TH')} → ${r28Mode==='now'?'ปัจจุบัน':d.end.toLocaleDateString('th-TH')}`);
 put('r28Sales',money(total));put('r28Bills',sales.length);put('r28Avg',money(avg));put('r28Expense',money(exp));put('r28Cost',money(cost));put('r28Profit',money(profit));
 put('r28Cash',money(cash));put('r28Qr',money(qr));put('r28Card',money(card));
 put('r28CashPct',(total?cash/total*100:0).toFixed(1)+'%');put('r28QrPct',(total?qr/total*100:0).toFixed(1)+'%');put('r28CardPct',(total?card/total*100:0).toFixed(1)+'%');
 const days={};sales.forEach(x=>{const k=r28Iso(new Date(x.date));days[k]=days[k]||{n:0,t:0};days[k].n++;days[k].t+=Number(x.total||0)});
 document.getElementById('r28Daily').innerHTML=r28Table(['วันที่','จำนวนบิล','ยอดขาย'],Object.entries(days).sort().map(([k,x])=>`<tr><td>${new Date(k+'T12:00').toLocaleDateString('th-TH')}</td><td>${x.n}</td><td>${money(x.t)}</td></tr>`).join(''));
 const ps={};sales.forEach(s=>(s.items||[]).forEach(i=>{const k=i.productId||i.name;ps[k]=ps[k]||{name:i.name,q:0,t:0};ps[k].q+=Number(i.qty||0);ps[k].t+=Number(i.price||0)*Number(i.qty||0)}));
 document.getElementById('r28Products').innerHTML=r28Table(['สินค้า','จำนวน','ยอดขาย'],Object.values(ps).sort((a,b)=>b.t-a.t).map(x=>`<tr><td>${x.name}</td><td>${x.q}</td><td>${money(x.t)}</td></tr>`).join(''));
 document.getElementById('r28BillList').innerHTML=r28Table(['เลขบิล','วันเวลา','ชำระ','ยอด'],sales.slice().sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,100).map(x=>`<tr><td>${x.id}</td><td>${new Date(x.date).toLocaleString('th-TH')}</td><td>${x.payMethod==='cash'?'เงินสด':x.payMethod==='qr'?'QR / โอน':'บัตร'}</td><td>${money(x.total)}</td></tr>`).join(''));
 r28Last={...d,total,exp,cost,profit,avg,cash,qr,card,products:ps};return r28Last
}
function r28PrintHtml(){
 const d=r28Render();if(!d)return null;
 const rows=Object.values(d.products).sort((a,b)=>b.t-a.t).map(x=>`<tr><td>${x.name}</td><td>${x.q}</td><td>${money(x.t)}</td></tr>`).join('');
 return `<!doctype html><html><head><meta charset="utf-8"><style>@page{size:A4;margin:12mm}body{font-family:Tahoma,Arial;font-size:12px}h1{text-align:center}table{width:100%;border-collapse:collapse}th,td{border:1px solid #bbb;padding:6px}.sum{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.sum div{border:1px solid #bbb;padding:8px}</style></head><body><h1>รายงาน YAK POS</h1><p style="text-align:center">${d.start.toLocaleDateString('th-TH')} ถึง ${r28Mode==='now'?'ปัจจุบัน':d.end.toLocaleDateString('th-TH')}</p><div class="sum"><div>ยอดขาย<br><b>${money(d.total)}</b></div><div>จำนวนบิล<br><b>${d.sales.length}</b></div><div>เฉลี่ย/บิล<br><b>${money(d.avg)}</b></div><div>รายจ่าย<br><b>${money(d.exp)}</b></div><div>ต้นทุน<br><b>${money(d.cost)}</b></div><div>กำไร<br><b>${money(d.profit)}</b></div></div><h3>ช่องทางชำระ</h3><p>เงินสด ${money(d.cash)} | QR/โอน ${money(d.qr)} | บัตร ${money(d.card)}</p><h3>สินค้า</h3><table><tr><th>สินค้า</th><th>จำนวน</th><th>ยอดขาย</th></tr>${rows}</table></body></html>`
}
async function r28SavePdf(){const html=r28PrintHtml();if(!html)return;if(window.yakDesktop?.saveReportPdf){const r=await window.yakDesktop.saveReportPdf({html});if(r?.ok)toast('บันทึก PDF แล้ว')}else{const w=window.open();w.document.write(html);w.document.close();setTimeout(()=>w.print(),300)}}
async function r28Print(){const html=r28PrintHtml();if(!html)return;if(window.yakDesktop?.printReport){await window.yakDesktop.printReport({html})}else{const w=window.open();w.document.write(html);w.document.close();setTimeout(()=>w.print(),300)}}

window.addEventListener('DOMContentLoaded',()=>setTimeout(()=>{
 const n=new Date();r28Set(n,n);
 const t=document.getElementById('r28ToNow');if(t)t.value=r28Iso(n);
 const m=document.getElementById('r28Month');if(m)m.value=`${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`;
 const y=document.getElementById('r28Year');if(y)y.value=n.getFullYear();
 r28Render();
},1000));
setInterval(()=>{if(document.body.classList.contains('yak-backoffice')&&yakBackPage==='reports')r28Render()},3000);

// Force report routing to V4.4.28 report.
const _r28ShowBack=yakShowBackPage;
yakShowBackPage=function(page){
 _r28ShowBack(page);
 if(page==='reports'){
  document.querySelectorAll('[data-backpage-panel]').forEach(x=>{const ok=x.id==='advancedReports';x.classList.toggle('yak-page-active',ok);x.style.display=ok?'block':'none'});
  setTimeout(r28Render,10);
 }
};

function r29ShowSelector(mode){
  const day=document.getElementById('r29DaySelector');
  const month=document.getElementById('r29MonthSelector');
  const dt=document.getElementById('r29DayTab');
  const mt=document.getElementById('r29MonthTab');
  if(mode==='month'){
    day?.classList.add('hidden');
    month?.classList.remove('hidden');
    dt?.classList.remove('active');
    mt?.classList.add('active');
  }else{
    day?.classList.remove('hidden');
    month?.classList.add('hidden');
    dt?.classList.add('active');
    mt?.classList.remove('active');
  }
}

function r29ApplyDay(){
  const v=document.getElementById('r29DayInput')?.value;
  if(!v){toast('กรุณาเลือกวันที่');return;}
  const d=new Date(v+'T12:00:00');
  r28Mode='range';
  r28Set(d,d);
  r28Render();
}

function r29ApplyMonth(){
  const v=document.getElementById('r29MonthInput')?.value;
  if(!v){toast('กรุณาเลือกเดือน');return;}
  const [y,m]=v.split('-').map(Number);
  r28Mode='range';
  r28Set(new Date(y,m-1,1),new Date(y,m,0));
  r28Render();
}

window.addEventListener('DOMContentLoaded',()=>setTimeout(()=>{
  const now=new Date();
  const d=document.getElementById('r29DayInput');
  const m=document.getElementById('r29MonthInput');
  if(d)d.value=r28Iso(now);
  if(m)m.value=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  r29ShowSelector('day');
},1100));

// ============================================================
// V4.4.30 - ACTUAL REPORT PAGE FIX
// This controls #tab-reports, the page visible in the user's screenshot.
// ============================================================
let actualReportMode = 'day';
let actualReportToNow = false;
let actualLastReportData = null;

function actualIso(d){
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function actualParseDay(v, endOfDay=false){
  const d = new Date((v || actualIso(new Date())) + 'T00:00:00');
  if(endOfDay) d.setHours(23,59,59,999);
  return d;
}
function actualSetMode(mode){
  actualReportMode = mode;
  actualReportToNow = false;
  ['day','month','range'].forEach(x=>{
    const tab=document.getElementById('actual'+x[0].toUpperCase()+x.slice(1)+'Tab');
    const panel=document.getElementById('actual'+x[0].toUpperCase()+x.slice(1)+'Panel');
    if(tab)tab.classList.toggle('active',x===mode);
    if(panel){
      panel.classList.toggle('hidden',x!==mode);
      panel.style.display=(x===mode)?'grid':'none';
    }
  });
  try{actualRenderReports()}catch(err){console.error('actualRenderReports:',err)}
}
function actualBounds(){
  const now = new Date();
  let start, end, label;

  if(actualReportToNow){
    const v = document.getElementById('actualToNowStart')?.value || actualIso(now);
    start = actualParseDay(v);
    end = new Date();
    label = `${start.toLocaleDateString('th-TH')} → ปัจจุบัน`;
    return {start,end,label};
  }

  if(actualReportMode === 'month'){
    const v = document.getElementById('actualReportMonth')?.value;
    const [y,m] = (v || `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`).split('-').map(Number);
    start = new Date(y,m-1,1,0,0,0,0);
    end = new Date(y,m,0,23,59,59,999);
    label = start.toLocaleDateString('th-TH',{month:'long',year:'numeric'});
  } else if(actualReportMode === 'range'){
    const sv = document.getElementById('actualReportStart')?.value || actualIso(now);
    const ev = document.getElementById('actualReportEnd')?.value || actualIso(now);
    start = actualParseDay(sv);
    end = actualParseDay(ev,true);
    if(start > end){
      const a = start;
      start = actualParseDay(ev);
      end = actualParseDay(sv,true);
    }
    label = `${start.toLocaleDateString('th-TH')} → ${end.toLocaleDateString('th-TH')}`;
  } else {
    const v = document.getElementById('actualReportDay')?.value || actualIso(now);
    start = actualParseDay(v);
    end = actualParseDay(v,true);
    label = start.toLocaleDateString('th-TH',{day:'numeric',month:'long',year:'numeric'});
  }
  return {start,end,label};
}
function actualUseRange(){
  actualReportMode='range';
  actualReportToNow=false;
  actualSetMode('range');
}
function actualPreset(type){
  const now = new Date();
  let start = new Date(now.getFullYear(),now.getMonth(),now.getDate());
  let end = new Date(start);

  if(type==='today'){
    document.getElementById('actualReportDay').value = actualIso(start);
    actualReportMode='day';
    actualReportToNow=false;
    actualSetMode('day');
    return;
  }
  if(type==='yesterday'){
    start.setDate(start.getDate()-1);
    document.getElementById('actualReportDay').value = actualIso(start);
    actualReportMode='day';
    actualReportToNow=false;
    actualSetMode('day');
    return;
  }
  if(type==='month'){
    document.getElementById('actualReportMonth').value =
      `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    actualReportMode='month';
    actualReportToNow=false;
    actualSetMode('month');
    return;
  }

  if(type==='7days'){
    start.setDate(start.getDate()-6);
  }else if(type==='year'){
    start = new Date(now.getFullYear(),0,1);
  }
  document.getElementById('actualReportStart').value = actualIso(start);
  document.getElementById('actualReportEnd').value = actualIso(end);
  actualReportMode='range';
  actualReportToNow=false;
  actualSetMode('range');
}
function actualFromDateToNow(){
  const v = document.getElementById('actualToNowStart')?.value;
  if(!v){ toast('กรุณาเลือกวันที่เริ่มต้น'); return; }
  actualReportMode='range';
  actualReportToNow=true;
  document.getElementById('actualReportStart').value=v;
  document.getElementById('actualReportEnd').value=actualIso(new Date());
  actualRenderReports();
}
function actualVisibleSalesInBounds(bounds){
  return visibleSales().filter(s=>{
    const d = new Date(s.date);
    return d >= bounds.start && d <= bounds.end;
  });
}
function actualGroupSales(sales){
  const grouped={};
  sales.forEach(s=>{
    const d=new Date(s.date);
    const key=actualIso(d);
    grouped[key]=(grouped[key]||0)+Number(s.total||0);
  });
  return grouped;
}
function actualRenderReports(){
  if(!document.getElementById('actualReportDay')) return;

  const bounds=actualBounds();
  const current=actualVisibleSalesInBounds(bounds);
  const revenue=current.reduce((a,s)=>a+Number(s.total||0),0);
  const cost=current.reduce((a,s)=>a+Number(s.costTotal||0),0);
  const profit=revenue-cost;
  const margin=revenue ? profit/revenue*100 : 0;

  const set=(id,val)=>{ const el=document.getElementById(id); if(el) el.textContent=val; };
  set('reportRevenue',money(revenue));
  set('reportCost',money(cost));
  set('reportProfit',money(profit));
  set('reportMargin',margin.toFixed(1)+'%');
  set('actualReportLabel',bounds.label);
  set('actualRealtimeText','อัปเดตล่าสุด '+new Date().toLocaleTimeString('th-TH'));

  const grouped=actualGroupSales(current);
  const labels=Object.keys(grouped).sort();
  const values=labels.map(k=>grouped[k]);

  if(salesChartObj) salesChartObj.destroy();
  if(window.Chart){
    salesChartObj=new Chart(document.getElementById('salesChart'),{
      type:'line',
      data:{
        labels:labels.map(k=>new Date(k+'T12:00:00').toLocaleDateString('th-TH',{day:'2-digit',month:'2-digit'})),
        datasets:[{label:'ยอดขาย',data:values,tension:.25}]
      },
      options:{responsive:true,plugins:{legend:{display:true}},scales:{y:{beginAtZero:true}}}
    });
  }

  const prod={};
  current.forEach(s=>(s.items||[]).forEach(i=>{
    prod[i.name]=(prod[i.name]||0)+Number(i.price||0)*Number(i.qty||0);
  }));
  const pLabels=Object.keys(prod);
  const pValues=pLabels.map(k=>prod[k]);
  const sum=pValues.reduce((a,b)=>a+b,0);

  if(pieChartObj) pieChartObj.destroy();
  if(window.Chart){
    pieChartObj=new Chart(document.getElementById('productPie'),{
      type:'doughnut',
      data:{labels:pLabels,datasets:[{data:pValues}]},
      options:{responsive:true,maintainAspectRatio:true,aspectRatio:1,plugins:{legend:{position:'bottom'}}}
    });
  }

  const shareRows=pLabels.map((k,i)=>`
    <tr><td>${k}</td><td>${money(pValues[i])}</td><td>${sum?(pValues[i]/sum*100).toFixed(1):0}%</td></tr>
  `).join('');
  const pctTable=document.getElementById('productPercentTable');
  if(pctTable){
    pctTable.innerHTML=table(
      ['สินค้า','ยอดขาย','สัดส่วน'],
      shareRows || '<tr><td colspan="3" class="empty">ยังไม่มีข้อมูล</td></tr>'
    );
  }

  const billRows=current.slice().sort((a,b)=>new Date(b.date)-new Date(a.date)).map(s=>`
    <tr>
      <td>${s.id||'-'}</td>
      <td>${new Date(s.date).toLocaleString('th-TH')}</td>
      <td>${(s.items||[]).reduce((a,i)=>a+Number(i.qty||0),0)}</td>
      <td>${s.payMethod==='cash'?'เงินสด':s.payMethod==='qr'?'QR / โอน':'บัตร'}</td>
      <td>${money(s.total)}</td>
    </tr>
  `).join('');
  const bills=document.getElementById('actualReportBills');
  if(bills) bills.innerHTML=table(
    ['เลขบิล','วันเวลา','จำนวนสินค้า','ชำระ','ยอดรวม'],
    billRows || '<tr><td colspan="5" class="empty">ยังไม่มีข้อมูลในช่วงนี้</td></tr>'
  );

  actualLastReportData={bounds,current,revenue,cost,profit,margin,prod};
  return actualLastReportData;
}

// Replace old page renderer so all old calls now render this page.
renderReports = actualRenderReports;

function actualReportPrintHtml(){
  const d=actualRenderReports();
  if(!d) return '';
  const productRows=Object.entries(d.prod).sort((a,b)=>b[1]-a[1]).map(([name,total])=>
    `<tr><td>${name}</td><td style="text-align:right">${money(total)}</td></tr>`
  ).join('');
  const billRows=d.current.slice().sort((a,b)=>new Date(b.date)-new Date(a.date)).map(s=>
    `<tr><td>${s.id||'-'}</td><td>${new Date(s.date).toLocaleString('th-TH')}</td><td>${s.payMethod==='cash'?'เงินสด':s.payMethod==='qr'?'QR / โอน':'บัตร'}</td><td style="text-align:right">${money(s.total)}</td></tr>`
  ).join('');

  return `<!doctype html><html><head><meta charset="utf-8"><title>YAK POS Report</title>
  <style>
    @page{size:A4;margin:12mm}
    body{font-family:Tahoma,Arial,sans-serif;color:#111;font-size:12px}
    h1{text-align:center;margin:0 0 4px}
    .period{text-align:center;margin-bottom:14px}
    .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:15px}
    .stats div{border:1px solid #bbb;padding:8px}
    .stats small{display:block;color:#666}.stats b{font-size:16px}
    table{width:100%;border-collapse:collapse;margin:7px 0 16px}
    th,td{border:1px solid #bbb;padding:6px;text-align:left}
  </style></head><body>
    <h1>รายงานยอดขายและกำไร</h1>
    <div class="period">${d.bounds.label}</div>
    <div class="stats">
      <div><small>ยอดขาย</small><b>${money(d.revenue)}</b></div>
      <div><small>ต้นทุน</small><b>${money(d.cost)}</b></div>
      <div><small>กำไร</small><b>${money(d.profit)}</b></div>
      <div><small>กำไร %</small><b>${d.margin.toFixed(1)}%</b></div>
    </div>
    <h3>สัดส่วนการขายสินค้า</h3>
    <table><thead><tr><th>สินค้า</th><th>ยอดขาย</th></tr></thead><tbody>${productRows||'<tr><td colspan="2">ไม่มีข้อมูล</td></tr>'}</tbody></table>
    <h3>รายละเอียดบิล</h3>
    <table><thead><tr><th>เลขบิล</th><th>วันเวลา</th><th>ชำระ</th><th>ยอดรวม</th></tr></thead><tbody>${billRows||'<tr><td colspan="4">ไม่มีข้อมูล</td></tr>'}</tbody></table>
  </body></html>`;
}
async function actualReportSavePdf(){
  const html=actualReportPrintHtml();
  if(window.yakDesktop?.saveReportPdf){
    const r=await window.yakDesktop.saveReportPdf({html});
    if(r?.ok) toast('บันทึก PDF แล้ว');
    else if(r?.error) toast('บันทึก PDF ไม่สำเร็จ');
  }else{
    const w=window.open('','YAK_REPORT_PDF','width=900,height=700');
    if(!w){toast('กรุณาอนุญาต Pop-up');return}
    w.document.write(html);w.document.close();
  }
}
async function actualReportPrint(){
  const html=actualReportPrintHtml();
  if(window.yakDesktop?.printReport){
    await window.yakDesktop.printReport({html});
  }else{
    const w=window.open('','YAK_REPORT_PRINT','width=900,height=700');
    if(!w){toast('กรุณาอนุญาต Pop-up');return}
    w.document.write(html);w.document.close();
    setTimeout(()=>w.print(),300);
  }
}

window.addEventListener('DOMContentLoaded',()=>{
  setTimeout(()=>{
    const n=new Date();
    const day=actualIso(n);
    const month=`${n.getFullYear()}-${String(n.getMonth()+1).padStart(2,'0')}`;
    const d=document.getElementById('actualReportDay');
    const m=document.getElementById('actualReportMonth');
    const s=document.getElementById('actualReportStart');
    const e=document.getElementById('actualReportEnd');
    const tn=document.getElementById('actualToNowStart');
    if(d)d.value=day;if(m)m.value=month;if(s)s.value=day;if(e)e.value=day;if(tn)tn.value=day;
    actualSetMode('day');
  },700);
});

// Real-time refresh while the actual report tab is visible.
setInterval(()=>{
  const tab=document.getElementById('tab-reports');
  if(tab && tab.classList.contains('active')) actualRenderReports();
},3000);

// V4.4.31: hard-bind report selector buttons in Electron.
function bindActualReportControls(){
  document.querySelectorAll('[data-report-mode]').forEach(btn=>{
    if(btn.dataset.boundReport==='1')return;
    btn.dataset.boundReport='1';
    btn.addEventListener('click',function(e){
      e.preventDefault();
      e.stopPropagation();
      actualSetMode(this.dataset.reportMode);
    });
  });

  const day=document.getElementById('actualReportDay');
  const month=document.getElementById('actualReportMonth');
  if(day && day.dataset.boundReport!=='1'){
    day.dataset.boundReport='1';
    day.addEventListener('change',()=>{actualReportMode='day'; actualReportToNow=false; try{actualRenderReports()}catch(e){console.error(e)}});
  }
  if(month && month.dataset.boundReport!=='1'){
    month.dataset.boundReport='1';
    month.addEventListener('change',()=>{actualReportMode='month'; actualReportToNow=false; try{actualRenderReports()}catch(e){console.error(e)}});
  }
}

document.addEventListener('DOMContentLoaded',()=>{
  setTimeout(bindActualReportControls,300);
  setTimeout(bindActualReportControls,1000);
});

// Also bind again whenever user opens the report tab.
const _openBackTab4431=openBackTab;
openBackTab=function(name,btn){
  _openBackTab4431(name,btn);
  if(name==='reports'){
    setTimeout(()=>{
      bindActualReportControls();
      actualSetMode(actualReportMode||'day');
    },80);
  }
};

// ============================================================
// V4.4.33 MATERIAL INVENTORY + PRODUCT RECIPE SYSTEM
// Visible inside the real #tab-products page.
// Uses db.materials + db.productMaterials, the same data checkout deducts.
// ============================================================
function m33EnsureData(){
  db.materials = Array.isArray(db.materials) ? db.materials : [];
  db.productMaterials = Array.isArray(db.productMaterials) ? db.productMaterials : [];
}
function m33Esc(v){
  return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
}
function m33Num(v){
  const n=Number(v||0);
  return Number.isFinite(n)?n:0;
}
function m33ShowAdd(){
  if(typeof m39EditingMaterialId!=='undefined' && m39EditingMaterialId){
    try{m39CancelMaterialEdit()}catch(e){}
  }
  const form=document.getElementById('m33AddForm');
  form?.classList.remove('hidden');
  const saveBtn=form?.querySelector('.btn.success');
  if(saveBtn){saveBtn.textContent='บันทึกวัตถุดิบ';saveBtn.setAttribute('onclick','m33SaveMaterial()')}
  const cancelBtn=form?.querySelector('.btn.ghost');
  if(cancelBtn)cancelBtn.setAttribute('onclick','m33HideAdd()');
  document.getElementById('m33Name')?.focus();
}
function m33HideAdd(){
  document.getElementById('m33AddForm')?.classList.add('hidden');
}
function m33SaveMaterial(){
  m33EnsureData();
  const name=document.getElementById('m33Name')?.value.trim();
  const unit=document.getElementById('m33Unit')?.value.trim()||'ชิ้น';
  const stock=Math.max(0,m33Num(document.getElementById('m33Stock')?.value));
  const minStock=Math.max(0,m33Num(document.getElementById('m33Min')?.value));
  if(!name){toast('กรุณากรอกชื่อวัตถุดิบ');return}
  db.materials.push({
    id:'mat'+Date.now(),
    name,unit,stock,minStock,active:true
  });
  saveDB();
  ['m33Name','m33Unit','m33Stock','m33Min'].forEach(id=>{const e=document.getElementById(id);if(e)e.value=''});
  m33HideAdd();
  m33RenderAll();
  toast('เพิ่มวัตถุดิบแล้ว');
}
function m33AdjustStock(id,amount){
  m33EnsureData();
  const m=db.materials.find(x=>x.id===id);if(!m)return;
  const next=Math.max(0,m33Num(m.stock)+Number(amount||0));
  m.stock=Math.round(next*10000)/10000;
  saveDB();m33RenderAll();
}
function m33Restock(id){
  m33EnsureData();
  const m=db.materials.find(x=>x.id===id);if(!m)return;
  const x=prompt(`เติมสต๊อก ${m.name}\nปัจจุบัน ${m.stock} ${m.unit}\nจำนวนที่เพิ่ม:`);
  if(x===null)return;
  const q=Number(x);
  if(!Number.isFinite(q)||q<=0){toast('จำนวนต้องมากกว่า 0');return}
  m.stock=Math.round((m33Num(m.stock)+q)*10000)/10000;
  saveDB();m33RenderAll();toast('เติมวัตถุดิบแล้ว');
}
function m33SetStock(id){
  m33EnsureData();
  const m=db.materials.find(x=>x.id===id);if(!m)return;
  const x=prompt(`กำหนดจำนวนคงเหลือ ${m.name}`,m.stock);
  if(x===null)return;
  const q=Number(x);
  if(!Number.isFinite(q)||q<0){toast('จำนวนไม่ถูกต้อง');return}
  m.stock=Math.round(q*10000)/10000;
  saveDB();m33RenderAll();
}
function m33EditMaterial(id){
  m33EnsureData();
  const m=db.materials.find(x=>x.id===id);if(!m)return;
  const name=prompt('ชื่อวัตถุดิบ',m.name);if(name===null)return;
  const unit=prompt('หน่วย',m.unit);if(unit===null)return;
  const min=prompt('แจ้งเตือนเมื่อเหลือ',m.minStock);if(min===null)return;
  const n=Number(min);
  if(!name.trim()||!Number.isFinite(n)||n<0){toast('ข้อมูลไม่ถูกต้อง');return}
  m.name=name.trim();m.unit=unit.trim()||'ชิ้น';m.minStock=n;
  saveDB();m33RenderAll();toast('แก้ไขวัตถุดิบแล้ว');
}
function m33ToggleMaterial(id){
  const m=db.materials.find(x=>x.id===id);if(!m)return;
  m.active=!m.active;saveDB();m33RenderAll();
}
function m33DeleteMaterial(id){
  m33EnsureData();
  const m=db.materials.find(x=>x.id===id);if(!m)return;
  const links=db.productMaterials.filter(x=>x.materialId===id);
  if(!confirm(`ลบวัตถุดิบ "${m.name}" ?\nการเชื่อมกับสินค้า ${links.length} รายการจะถูกลบด้วย`))return;
  db.materials=db.materials.filter(x=>x.id!==id);
  db.productMaterials=db.productMaterials.filter(x=>x.materialId!==id);
  saveDB();m33RenderAll();toast('ลบวัตถุดิบแล้ว');
}
function m33RenderMaterials(){
  m33EnsureData();
  const box=document.getElementById('m33MaterialsTable');if(!box)return;
  const low=db.materials.filter(m=>m.active && m33Num(m.stock)<=m33Num(m.minStock)).length;
  const sum=document.getElementById('m33MaterialSummary');
  if(sum)sum.innerHTML=`
    <div><small>วัตถุดิบทั้งหมด</small><strong>${db.materials.length}</strong></div>
    <div><small>ใกล้หมด / ต้องเติม</small><strong class="${low?'m33-warn':''}">${low}</strong></div>
    <div><small>เชื่อมกับสินค้า</small><strong>${db.productMaterials.length}</strong></div>`;
  const rows=db.materials.map(m=>{
    const isLow=m33Num(m.stock)<=m33Num(m.minStock);
    const linkCount=db.productMaterials.filter(x=>x.materialId===m.id).length;
    return `<tr>
      <td><b>${m33Esc(m.name)}</b></td>
      <td>${m33Esc(m.unit)}</td>
      <td><b>${m33Num(m.stock)}</b></td>
      <td>${m33Num(m.minStock)}</td>
      <td>${linkCount} สินค้า</td>
      <td><span class="badge ${!m.active?'orange':isLow?'red':'green'}">${!m.active?'ปิดใช้':isLow?'ใกล้หมด':'ปกติ'}</span></td>
      <td class="m33-actions">
        <button class="action" onclick="m33AdjustStock('${m.id}',1)">+1</button>
        <button class="action" onclick="m33AdjustStock('${m.id}',10)">+10</button>
        <button class="action" onclick="m33AdjustStock('${m.id}',-1)">−1</button>
        <button class="action" onclick="m33Restock('${m.id}')">เติม</button>
        <button class="action" onclick="m33SetStock('${m.id}')">กำหนด</button>
        <button class="action m39-edit-btn" onclick="m39StartEditMaterial('${m.id}')">✏️ แก้ไข</button>
        <button class="action" onclick="m33ToggleMaterial('${m.id}')">${m.active?'ปิดใช้':'เปิดใช้'}</button>
        <button class="action danger m39-delete-btn" onclick="m39DeleteMaterial('${m.id}')">🗑 ลบ</button>
      </td>
    </tr>`;
  }).join('');
  box.innerHTML=table(
    ['วัตถุดิบ','หน่วย','คงเหลือ','จุดเตือน','เชื่อม','สถานะ','จัดการ'],
    rows||'<tr><td colspan="7" class="empty">ยังไม่มีวัตถุดิบ — กด “+ เพิ่มวัตถุดิบ” เพื่อเริ่มใช้งาน</td></tr>'
  );
}

function m33RenderSelectors(){
  m33EnsureData();

  const pInput=document.getElementById('m33Product');
  const mInput=document.getElementById('m33Material');
  const pMenu=document.getElementById('m35ProductMenu');
  const mMenu=document.getElementById('m35MaterialMenu');
  const pBtn=document.getElementById('m35ProductBtn');
  const mBtn=document.getElementById('m35MaterialBtn');

  const oldP=pInput?.value||'';
  const oldM=mInput?.value||'';

  if(pMenu){
    pMenu.innerHTML=(db.products||[]).map(p=>`
      <button type="button" class="m35-option" onclick="m35SelectProduct('${p.id}')">
        <span class="m35-option-icon">📦</span>
        <span><b>${m33Esc(p.name)}</b><small>ขาย ${money(p.price)}</small></span>
      </button>`).join('') || '<div class="m35-empty-option">ยังไม่มีสินค้า</div>';
  }

  if(mMenu){
    mMenu.innerHTML=(db.materials||[]).filter(m=>m.active).map(m=>`
      <button type="button" class="m35-option" onclick="m35SelectMaterial('${m.id}')">
        <span class="m35-option-icon">🧱</span>
        <span><b>${m33Esc(m.name)}</b><small>เหลือ ${m33Num(m.stock)} ${m33Esc(m.unit)}</small></span>
      </button>`).join('') || '<div class="m35-empty-option">ยังไม่มีวัตถุดิบ</div>';
  }

  if(oldP && (db.products||[]).some(p=>p.id===oldP)){
    if(pInput)pInput.value=oldP;
    const p=db.products.find(x=>x.id===oldP);
    if(pBtn)pBtn.innerHTML=`${m33Esc(p.name)} <span>▾</span>`;
  }else{
    if(pInput)pInput.value='';
    if(pBtn)pBtn.innerHTML='-- เลือกสินค้า -- <span>▾</span>';
  }

  if(oldM && (db.materials||[]).some(m=>m.id===oldM && m.active)){
    if(mInput)mInput.value=oldM;
    const m=db.materials.find(x=>x.id===oldM);
    if(mBtn)mBtn.innerHTML=`${m33Esc(m.name)} (${m33Esc(m.unit)}) <span>▾</span>`;
  }else{
    if(mInput)mInput.value='';
    if(mBtn)mBtn.innerHTML='-- เลือกวัตถุดิบ -- <span>▾</span>';
  }
}

function m33SaveLink(){
  m33EnsureData();
  const productId=document.getElementById('m33Product')?.value;
  const materialId=document.getElementById('m33Material')?.value;
  const qty=Number(document.getElementById('m33Qty')?.value);
  if(!productId){toast('กรุณาเลือกสินค้า');return}
  if(!materialId){toast('กรุณาเลือกวัตถุดิบ');return}
  if(!Number.isFinite(qty)||qty<=0){toast('กรุณาระบุจำนวนวัตถุดิบที่ใช้ต่อขาย 1 หน่วย');return}
  const old=db.productMaterials.find(x=>x.productId===productId&&x.materialId===materialId);
  if(old)old.qtyPerSale=qty;
  else db.productMaterials.push({id:'pm'+Date.now(),productId,materialId,qtyPerSale:qty});
  saveDB();
  const q=document.getElementById('m33Qty');if(q)q.value='';
  m33RenderAll();
  try{renderProductsAdmin()}catch(e){}
  if(document.getElementById('m33Product'))document.getElementById('m33Product').value=productId;
  m33RenderProductRecipe();
  toast(old?'อัปเดตจำนวนวัตถุดิบแล้ว':'เชื่อมสินค้าและวัตถุดิบแล้ว');
}
function m33EditLink(id){
  const l=db.productMaterials.find(x=>x.id===id);if(!l)return;
  const p=db.products.find(x=>x.id===l.productId);
  const m=db.materials.find(x=>x.id===l.materialId);
  const x=prompt(`แก้จำนวนที่ใช้ต่อขาย 1 หน่วย\nสินค้า: ${p?.name||'-'}\nวัตถุดิบ: ${m?.name||'-'}`,l.qtyPerSale);
  if(x===null)return;
  const q=Number(x);
  if(!Number.isFinite(q)||q<=0){toast('จำนวนต้องมากกว่า 0');return}
  l.qtyPerSale=q;saveDB();m33RenderAll();toast('แก้สูตรแล้ว');
}
function m33DeleteLink(id){
  db.productMaterials=db.productMaterials.filter(x=>x.id!==id);
  saveDB();m33RenderAll();try{renderProductsAdmin()}catch(e){};toast('ยกเลิกการเชื่อมแล้ว');
}
function m33RecipeRows(productId){
  return db.productMaterials.filter(x=>x.productId===productId).map(l=>{
    const m=db.materials.find(x=>x.id===l.materialId);
    return `<tr>
      <td>${m33Esc(m?.name||'ไม่พบวัตถุดิบ')}</td>
      <td><b>${m33Num(l.qtyPerSale)}</b> ${m33Esc(m?.unit||'')}</td>
      <td>${m?m33Num(m.stock):'-'} ${m33Esc(m?.unit||'')}</td>
      <td>
        <button class="action" onclick="m33EditLink('${l.id}')">แก้จำนวน</button>
        <button class="action danger" onclick="m33DeleteLink('${l.id}')">ยกเลิก</button>
      </td>
    </tr>`;
  }).join('');
}
function m33RenderProductRecipe(){
  m33EnsureData();
  const productId=document.getElementById('m33Product')?.value;
  const box=document.getElementById('m33RecipeView');if(!box)return;
  if(!productId){box.innerHTML='<div class="m33-empty">เลือกสินค้าด้านบนเพื่อดูวัตถุดิบที่เชื่อมอยู่</div>';return}
  const p=db.products.find(x=>x.id===productId);
  const rows=m33RecipeRows(productId);
  box.innerHTML=`<div class="m33-recipe-card">
    <h3>${m33Esc(p?.name||'-')}</h3>
    <p>เมื่อขายสินค้า 1 หน่วย ระบบจะใช้วัตถุดิบตามรายการนี้</p>
    ${table(['วัตถุดิบ','ใช้ต่อ 1 หน่วยขาย','สต๊อกปัจจุบัน','จัดการ'],rows||'<tr><td colspan="4" class="empty">สินค้านี้ยังไม่ได้เชื่อมวัตถุดิบ</td></tr>')}
  </div>`;
}
function m33RenderAllRecipes(){
  const box=document.getElementById('m33AllRecipes');if(!box)return;
  const cards=db.products.map(p=>{
    const links=db.productMaterials.filter(x=>x.productId===p.id);
    if(!links.length)return '';
    const chips=links.map(l=>{
      const m=db.materials.find(x=>x.id===l.materialId);
      return `<span class="m33-chip">${m33Esc(m?.name||'-')} <b>${m33Num(l.qtyPerSale)} ${m33Esc(m?.unit||'')}</b></span>`;
    }).join('');
    return `<div class="m33-product-recipe"><b>${m33Esc(p.name)}</b><div>${chips}</div></div>`;
  }).join('');
  box.innerHTML=cards||'<div class="m33-empty">ยังไม่มีสินค้าที่เชื่อมกับวัตถุดิบ</div>';
}
function m33RenderAll(){
  if(!document.getElementById('m33MaterialsTable'))return;
  m33EnsureData();
  m33RenderMaterials();
  m33RenderSelectors();
  m33RenderProductRecipe();
  m33RenderAllRecipes();
}

// Refresh material UI when products tab is opened.
document.addEventListener('click',function(e){
  const b=e.target.closest('.side-btn');
  if(!b)return;
  if((b.getAttribute('onclick')||'').includes("'products'")){
    setTimeout(m33RenderAll,80);
  }
});
window.addEventListener('DOMContentLoaded',()=>setTimeout(m33RenderAll,900));

// ============================================================
// V4.4.34 - readable selectors + delete saved products
// ============================================================
function m34DeleteProduct(id){
  const p=(db.products||[]).find(x=>x.id===id); if(!p)return;
  const linked=(db.productMaterials||[]).filter(x=>x.productId===id).length;
  if(!confirm(`ลบสินค้า "${p.name}" ?\nสูตรวัตถุดิบที่เชื่อมอยู่ ${linked} รายการจะถูกลบด้วย`))return;
  db.products=(db.products||[]).filter(x=>x.id!==id);
  db.productMaterials=(db.productMaterials||[]).filter(x=>x.productId!==id);
  saveDB();
  renderBackoffice();
  try{m33RenderAll()}catch(e){}
  toast('ลบสินค้าแล้ว');
}

// ============================================================
// V4.4.35 CUSTOM DROPDOWN - avoids Windows/Electron native select bug
// ============================================================
function m35CloseDropdowns(){
  const p=document.getElementById('m35ProductMenu');
  const m=document.getElementById('m35MaterialMenu');
  if(p){p.classList.add('hidden');p.style.display='none';}
  if(m){m.classList.add('hidden');m.style.display='none';}
}
function m35ToggleDropdown(type){
  // Always refresh the current DB before opening.
  try{ m33EnsureData(); m33RenderSelectors(); }catch(e){ console.error('dropdown refresh:',e); }

  const target=document.getElementById(type==='product'?'m35ProductMenu':'m35MaterialMenu');
  const other=document.getElementById(type==='product'?'m35MaterialMenu':'m35ProductMenu');
  if(!target)return;

  const wasHidden=target.classList.contains('hidden');
  other?.classList.add('hidden');
  if(wasHidden){
    target.classList.remove('hidden');
    target.style.display='block';
  }else{
    target.classList.add('hidden');
    target.style.display='none';
  }
}
function m35SelectProduct(id){
  const p=(db.products||[]).find(x=>x.id===id);if(!p)return;
  const input=document.getElementById('m33Product');
  const btn=document.getElementById('m35ProductBtn');
  if(input)input.value=id;
  if(btn)btn.innerHTML=`${m33Esc(p.name)} <span>▾</span>`;
  m35CloseDropdowns();
  m33RenderProductRecipe();
}
function m35SelectMaterial(id){
  const m=(db.materials||[]).find(x=>x.id===id);if(!m)return;
  const input=document.getElementById('m33Material');
  const btn=document.getElementById('m35MaterialBtn');
  if(input)input.value=id;
  if(btn)btn.innerHTML=`${m33Esc(m.name)} (${m33Esc(m.unit)}) <span>▾</span>`;
  m35CloseDropdowns();
}
document.addEventListener('click',function(e){
  if(!e.target.closest('.m35-dropdown'))m35CloseDropdowns();
});

// ============================================================
// V4.4.36 - force material/product dropdown refresh whenever Products opens
// ============================================================
(function(){
  function refreshMaterialLinker(){
    try{
      if(typeof m33EnsureData==='function')m33EnsureData();
      if(typeof m33RenderAll==='function')m33RenderAll();
      if(typeof m33RenderSelectors==='function')m33RenderSelectors();
    }catch(e){console.error('V4.4.36 material refresh:',e)}
  }

  // Re-render shortly after page load, after db/session are initialized.
  window.addEventListener('DOMContentLoaded',()=>{
    setTimeout(refreshMaterialLinker,1200);
    setTimeout(refreshMaterialLinker,2200);
  });

  // Observe when the actual products tab becomes active.
  const watchProductsTab=()=>{
    const tab=document.getElementById('tab-products');
    if(!tab)return;
    const obs=new MutationObserver(()=>{
      if(tab.classList.contains('active')){
        setTimeout(refreshMaterialLinker,30);
      }
    });
    obs.observe(tab,{attributes:true,attributeFilter:['class']});
    if(tab.classList.contains('active'))setTimeout(refreshMaterialLinker,30);
  };
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',()=>setTimeout(watchProductsTab,200));
  }else{
    setTimeout(watchProductsTab,200);
  }

  // Also refresh right before mouse/pointer interaction with either custom dropdown.
  document.addEventListener('pointerdown',function(e){
    if(e.target.closest('#m35ProductBtn,#m35MaterialBtn')){
      refreshMaterialLinker();
    }
  },true);

  window.YAK_REFRESH_MATERIAL_LINKER=refreshMaterialLinker;
})();

// ============================================================
// V4.4.39 - MATERIAL EDIT / DELETE UX
// ============================================================
let m39EditingMaterialId=null;

function m39StartEditMaterial(id){
  const m=(db.materials||[]).find(x=>x.id===id); if(!m)return;
  m39EditingMaterialId=id;

  const name=document.getElementById('m33Name');
  const unit=document.getElementById('m33Unit');
  const stock=document.getElementById('m33Stock');
  const min=document.getElementById('m33Min');
  const form=document.getElementById('m33AddForm');

  if(name)name.value=m.name||'';
  if(unit)unit.value=m.unit||'ชิ้น';
  if(stock)stock.value=Number(m.stock||0);
  if(min)min.value=Number(m.minStock||0);

  form?.classList.remove('hidden');

  const saveBtn=form?.querySelector('.btn.success');
  if(saveBtn){
    saveBtn.textContent='บันทึกการแก้ไข';
    saveBtn.setAttribute('onclick','m39SaveMaterialEdit()');
  }

  const cancelBtn=form?.querySelector('.btn.ghost');
  if(cancelBtn)cancelBtn.setAttribute('onclick','m39CancelMaterialEdit()');

  form?.scrollIntoView({behavior:'smooth',block:'center'});
}

function m39CancelMaterialEdit(){
  m39EditingMaterialId=null;
  const form=document.getElementById('m33AddForm');
  ['m33Name','m33Unit','m33Stock','m33Min'].forEach(id=>{
    const e=document.getElementById(id); if(e)e.value='';
  });
  const saveBtn=form?.querySelector('.btn.success');
  if(saveBtn){
    saveBtn.textContent='บันทึกวัตถุดิบ';
    saveBtn.setAttribute('onclick','m33SaveMaterial()');
  }
  const cancelBtn=form?.querySelector('.btn.ghost');
  if(cancelBtn)cancelBtn.setAttribute('onclick','m33HideAdd()');
  form?.classList.add('hidden');
}

function m39SaveMaterialEdit(){
  if(!m39EditingMaterialId)return;
  const m=(db.materials||[]).find(x=>x.id===m39EditingMaterialId); if(!m)return;

  const name=document.getElementById('m33Name')?.value.trim();
  const unit=document.getElementById('m33Unit')?.value.trim()||'ชิ้น';
  const stock=Number(document.getElementById('m33Stock')?.value||0);
  const minStock=Number(document.getElementById('m33Min')?.value||0);

  if(!name){toast('กรุณากรอกชื่อวัตถุดิบ');return}
  if(!Number.isFinite(stock)||stock<0||!Number.isFinite(minStock)||minStock<0){
    toast('จำนวนคงเหลือหรือจุดเตือนไม่ถูกต้อง');return;
  }

  m.name=name;
  m.unit=unit;
  m.stock=stock;
  m.minStock=minStock;

  saveDB();
  m39CancelMaterialEdit();
  m33RenderAll();
  try{renderProductsAdmin();renderProducts();}catch(e){}
  toast('แก้ไขวัตถุดิบแล้ว');
}

function m39DeleteMaterial(id){
  const m=(db.materials||[]).find(x=>x.id===id); if(!m)return;
  const links=(db.productMaterials||[]).filter(x=>x.materialId===id);
  const linkedNames=[...new Set(links.map(l=>(db.products||[]).find(p=>p.id===l.productId)?.name).filter(Boolean))];

  let message=`ต้องการลบวัตถุดิบ "${m.name}" หรือไม่?`;
  if(linkedNames.length){
    message+=`\n\nวัตถุดิบนี้เชื่อมกับสินค้า ${linkedNames.length} รายการ:\n- ${linkedNames.join('\n- ')}\n\nถ้าลบ ระบบจะยกเลิกการเชื่อมเหล่านี้ด้วย`;
  }
  if(!confirm(message))return;

  db.materials=(db.materials||[]).filter(x=>x.id!==id);
  db.productMaterials=(db.productMaterials||[]).filter(x=>x.materialId!==id);

  saveDB();
  m33RenderAll();
  try{renderProductsAdmin();renderProducts();}catch(e){}
  toast('ลบวัตถุดิบแล้ว');
}

// ============================================================
// V4.4.40 - INDEPENDENT MATERIAL MANAGER + LINK SUMMARY
// ============================================================
let m40EditId=null;

function m40Data(){
  db.materials=Array.isArray(db.materials)?db.materials:[];
  db.productMaterials=Array.isArray(db.productMaterials)?db.productMaterials:[];
  db.products=Array.isArray(db.products)?db.products:[];
}
function m40E(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
function m40RenderMaterials(){
  m40Data();
  const box=document.getElementById('m40MaterialManager'); if(!box)return;
  if(!db.materials.length){
    box.innerHTML='<div class="m40-empty">ยังไม่มีวัตถุดิบ — กด <b>+ เพิ่มวัตถุดิบ</b> ด้านบน</div>';
    return;
  }
  box.innerHTML=`<div class="m40-material-list">${db.materials.map(m=>{
    const links=db.productMaterials.filter(l=>l.materialId===m.id);
    const linkedProducts=links.map(l=>db.products.find(p=>p.id===l.productId)).filter(Boolean);
    const low=Number(m.stock||0)<=Number(m.minStock||0);
    return `<div class="m40-material-card">
      <div class="m40-material-main">
        <div><b>${m40E(m.name)}</b><small>${m40E(m.unit||'ชิ้น')}</small></div>
        <div><small>สต๊อกคงเหลือ</small><strong>${Number(m.stock||0)} ${m40E(m.unit||'')}</strong></div>
        <div><small>จุดเตือน</small><strong>${Number(m.minStock||0)} ${m40E(m.unit||'')}</strong></div>
        <div><small>สถานะ</small><span class="badge ${!m.active?'orange':low?'red':'green'}">${!m.active?'ปิดใช้':low?'ใกล้หมด':'ปกติ'}</span></div>
      </div>
      <div class="m40-linked"><small>เชื่อมกับ:</small> ${
        linkedProducts.length
        ? linkedProducts.map(p=>`<span>${m40E(p.name)}</span>`).join('')
        : '<em>ยังไม่เชื่อมสินค้า</em>'
      }</div>
      <div class="m40-actions">
        <button class="action" onclick="m40AddStock('${m.id}')">+ เติมสต๊อก</button>
        <button class="action m39-edit-btn" onclick="m40EditMaterial('${m.id}')">✏️ แก้ไข</button>
        <button class="action danger" onclick="m40DeleteMaterial('${m.id}')">🗑 ลบ</button>
      </div>
    </div>`;
  }).join('')}</div>`;
}
function m40OpenForm(){
  m40EditId=null;
  const f=document.getElementById('m33AddForm'); if(!f)return;
  f.classList.remove('hidden');
  ['m33Name','m33Unit','m33Stock','m33Min'].forEach(id=>{const e=document.getElementById(id);if(e)e.value=''});
  const s=f.querySelector('.btn.success'); if(s){s.textContent='บันทึกวัตถุดิบ';s.onclick=m40SaveMaterial}
  const c=f.querySelector('.btn.ghost'); if(c){c.onclick=m40Cancel}
}
function m40EditMaterial(id){
  m40Data(); const m=db.materials.find(x=>x.id===id);if(!m)return;
  m40EditId=id;
  const f=document.getElementById('m33AddForm');if(!f)return;
  f.classList.remove('hidden');
  document.getElementById('m33Name').value=m.name||'';
  document.getElementById('m33Unit').value=m.unit||'ชิ้น';
  document.getElementById('m33Stock').value=Number(m.stock||0);
  document.getElementById('m33Min').value=Number(m.minStock||0);
  const s=f.querySelector('.btn.success');if(s){s.textContent='บันทึกการแก้ไข';s.onclick=m40SaveMaterial}
  const c=f.querySelector('.btn.ghost');if(c){c.onclick=m40Cancel}
  f.scrollIntoView({behavior:'smooth',block:'center'});
}
function m40SaveMaterial(){
  m40Data();
  const name=document.getElementById('m33Name')?.value.trim();
  const unit=document.getElementById('m33Unit')?.value.trim()||'ชิ้น';
  const stock=Number(document.getElementById('m33Stock')?.value||0);
  const minStock=Number(document.getElementById('m33Min')?.value||0);
  if(!name){toast('กรุณากรอกชื่อวัตถุดิบ');return}
  if(!Number.isFinite(stock)||stock<0||!Number.isFinite(minStock)||minStock<0){toast('จำนวนไม่ถูกต้อง');return}
  if(m40EditId){
    const m=db.materials.find(x=>x.id===m40EditId);
    if(m){m.name=name;m.unit=unit;m.stock=stock;m.minStock=minStock}
  }else{
    db.materials.push({id:'mat'+Date.now(),name,unit,stock,minStock,active:true});
  }
  saveDB();m40Cancel();m40Refresh();toast(m40EditId?'แก้ไขวัตถุดิบแล้ว':'เพิ่มวัตถุดิบแล้ว');
}
function m40Cancel(){
  m40EditId=null;
  document.getElementById('m33AddForm')?.classList.add('hidden');
}
function m40AddStock(id){
  const m=db.materials.find(x=>x.id===id);if(!m)return;
  const v=prompt(`เติมสต๊อก ${m.name}\nคงเหลือ ${m.stock} ${m.unit}\nจำนวนที่ต้องการเพิ่ม:`);
  if(v===null)return;const n=Number(v);
  if(!Number.isFinite(n)||n<=0){toast('กรุณากรอกจำนวนมากกว่า 0');return}
  m.stock=Number(m.stock||0)+n;saveDB();m40Refresh();toast('เติมสต๊อกแล้ว');
}
function m40DeleteMaterial(id){
  m40Data();const m=db.materials.find(x=>x.id===id);if(!m)return;
  const links=db.productMaterials.filter(l=>l.materialId===id);
  const names=links.map(l=>db.products.find(p=>p.id===l.productId)?.name).filter(Boolean);
  let msg=`ลบวัตถุดิบ "${m.name}" หรือไม่?`;
  if(names.length)msg+=`\n\nกำลังเชื่อมกับ:\n- ${names.join('\n- ')}\n\nการเชื่อมเหล่านี้จะถูกยกเลิกด้วย`;
  if(!confirm(msg))return;
  db.materials=db.materials.filter(x=>x.id!==id);
  db.productMaterials=db.productMaterials.filter(x=>x.materialId!==id);
  saveDB();m40Refresh();toast('ลบวัตถุดิบแล้ว');
}
function m40EditLink(id){
  const l=db.productMaterials.find(x=>x.id===id);if(!l)return;
  const p=db.products.find(x=>x.id===l.productId),m=db.materials.find(x=>x.id===l.materialId);
  const v=prompt(`แก้จำนวนที่ใช้ต่อขาย 1 หน่วย\n${p?.name||'-'} → ${m?.name||'-'}`,l.qtyPerSale);
  if(v===null)return;const n=Number(v);
  if(!Number.isFinite(n)||n<=0){toast('จำนวนต้องมากกว่า 0');return}
  l.qtyPerSale=n;saveDB();m40Refresh();toast('แก้ไขการเชื่อมแล้ว');
}
function m40DeleteLink(id){
  const l=db.productMaterials.find(x=>x.id===id);if(!l)return;
  const p=db.products.find(x=>x.id===l.productId),m=db.materials.find(x=>x.id===l.materialId);
  if(!confirm(`ยกเลิกการเชื่อม\n${p?.name||'-'} ↔ ${m?.name||'-'} ?`))return;
  db.productMaterials=db.productMaterials.filter(x=>x.id!==id);
  saveDB();m40Refresh();toast('ยกเลิกการเชื่อมแล้ว');
}
function m40RenderLinks(){
  m40Data();const box=document.getElementById('m40LinkSummary');if(!box)return;
  const links=db.productMaterials.map(l=>({
    l,p:db.products.find(x=>x.id===l.productId),m:db.materials.find(x=>x.id===l.materialId)
  })).filter(x=>x.p&&x.m);
  box.innerHTML=links.length?`<div class="m40-links">${links.map(x=>`
    <div class="m40-link-row">
      <div><b>${m40E(x.p.name)}</b><span>→</span><b>${m40E(x.m.name)}</b></div>
      <div>ใช้ <strong>${Number(x.l.qtyPerSale||0)} ${m40E(x.m.unit)}</strong> / ขาย 1 หน่วย</div>
      <div>วัตถุดิบเหลือ <strong>${Number(x.m.stock||0)} ${m40E(x.m.unit)}</strong></div>
      <div><button class="action" onclick="m40EditLink('${x.l.id}')">✏️ แก้ไข</button>
      <button class="action danger" onclick="m40DeleteLink('${x.l.id}')">ยกเลิก</button></div>
    </div>`).join('')}</div>`:'<div class="m40-empty">ยังไม่มีการเชื่อมสินค้า ↔ วัตถุดิบ</div>';
}
function m40Refresh(){
  try{m40RenderMaterials();m40RenderLinks();m33RenderSelectors();m33RenderProductRecipe();renderProductsAdmin();renderProducts()}catch(e){console.error('m40 refresh',e)}
}
// Override the visible add-material button/form flow with stable V4.4.40 functions.
window.m33ShowAdd=m40OpenForm;
window.m33SaveMaterial=m40SaveMaterial;
window.m33HideAdd=m40Cancel;

// Refresh after linking using existing linker.
document.addEventListener('click',e=>{
  const b=e.target.closest('button');
  if(b && (b.textContent||'').includes('เชื่อมวัตถุดิบ'))setTimeout(m40Refresh,100);
});
window.addEventListener('DOMContentLoaded',()=>{setTimeout(m40Refresh,1200);setTimeout(m40Refresh,2200)});

// ============================================================
// V4.4.41 - ACTIVE MATERIAL OVERVIEW
// Show active product ↔ material operation immediately on Products page.
// ============================================================
function m41RenderActiveOverview(){
  const box=document.getElementById('m41ActiveList');
  if(!box)return;

  db.products=Array.isArray(db.products)?db.products:[];
  db.materials=Array.isArray(db.materials)?db.materials:[];
  db.productMaterials=Array.isArray(db.productMaterials)?db.productMaterials:[];

  const links=db.productMaterials.map(l=>({
    link:l,
    product:db.products.find(p=>p.id===l.productId),
    material:db.materials.find(m=>m.id===l.materialId)
  })).filter(x=>x.product&&x.material);

  const count=document.getElementById('m41ActiveCount');
  if(count)count.textContent=`${links.length} การเชื่อม`;

  if(!links.length){
    box.innerHTML='<div class="m41-empty">ยังไม่มีสินค้าเชื่อมกับวัตถุดิบ</div>';
    return;
  }

  box.innerHTML=links.map(x=>{
    const m=x.material;
    const low=Number(m.stock||0)<=Number(m.minStock||0);
    const active=x.product.active && m.active;
    const status=!active?'หยุดใช้งาน':low?'วัตถุดิบใกล้หมด':'กำลังทำงาน';
    const statusClass=!active?'off':low?'warn':'ok';

    return `<div class="m41-active-row">
      <div class="m41-flow">
        <div class="m41-node product">
          <small>สินค้า</small>
          <strong>${m40E(x.product.name)}</strong>
        </div>
        <div class="m41-arrow">→</div>
        <div class="m41-node material">
          <small>วัตถุดิบ</small>
          <strong>${m40E(m.name)}</strong>
        </div>
      </div>

      <div class="m41-usage">
        <small>ใช้ต่อขาย 1 หน่วย</small>
        <strong>${Number(x.link.qtyPerSale||0)} ${m40E(m.unit||'')}</strong>
      </div>

      <div class="m41-stock">
        <small>เหลือ</small>
        <strong>${Number(m.stock||0)} ${m40E(m.unit||'')}</strong>
        <span>เตือน ${Number(m.minStock||0)}</span>
      </div>

      <div class="m41-status ${statusClass}">
        <span class="m41-dot"></span>${status}
      </div>

      <div class="m41-row-actions">
        <button class="action" onclick="m40EditLink('${x.link.id}')">✏️ แก้ไข</button>
        <button class="action danger" onclick="m40DeleteLink('${x.link.id}')">ยกเลิก</button>
      </div>
    </div>`;
  }).join('');
}

// Extend current refresh so this overview updates too.
const _m40Refresh_441=m40Refresh;
m40Refresh=function(){
  _m40Refresh_441();
  try{m41RenderActiveOverview()}catch(e){console.error('m41 overview',e)}
};

// Refresh immediately whenever products page opens.
document.addEventListener('click',function(e){
  const b=e.target.closest('.side-btn');
  if(!b)return;
  if((b.getAttribute('onclick')||'').includes("'products'")){
    setTimeout(m41RenderActiveOverview,60);
  }
});

window.addEventListener('DOMContentLoaded',()=>{
  setTimeout(m41RenderActiveOverview,1300);
  setTimeout(m41RenderActiveOverview,2300);
});



// ============================================================
// V4.4.45 - CLEAN FRONT / BACK SEPARATION
// Front Store = employee login -> sales screen
// Back Office  = direct management screen, no employee PIN
// ============================================================
function openFrontStore(){
  try{
    loginMode='front';

    // Return body to normal app state before showing login.
    document.body.classList.remove('yak-backoffice','yak-back-locked');
    document.body.classList.add('yak-intro');

    try{refreshBranchSelects()}catch(e){console.error('refreshBranchSelects',e)}

    const title=document.getElementById('loginTitle');
    const subtitle=document.getElementById('loginSubtitle');
    const error=document.getElementById('loginError');
    const emp=document.getElementById('loginEmp');
    const pin=document.getElementById('loginPin');

    if(title)title.textContent='เข้าสู่หน้าร้าน';
    if(subtitle)subtitle.textContent='ใช้รหัสพนักงานและ PIN เพื่อเปิดหน้าขาย';
    if(error)error.textContent='';
    if(emp)emp.value='';
    if(pin)pin.value='';

    showView('loginView');
    setTimeout(()=>emp?.focus(),50);
  }catch(err){
    console.error('openFrontStore',err);
    try{toast('เปิดหน้าร้านไม่สำเร็จ')}catch(e){}
  }
}

function openBackOfficeDirect(){
  const emp=db.employees.find(e=>e.id===session?.employeeId);
  if(!session || !emp || !['owner','manager'].includes(emp.role)){
    openBackOfficeLogin();
    return;
  }
  document.body.classList.remove('yak-intro','yak-front','yak-back-locked');
  document.body.classList.add('yak-backoffice');
  showView('backView');
  try{renderBackoffice()}catch(e){}
  try{openBackTab('products',document.querySelector('[data-tab="products"]'))}catch(e){}
}

// ============================================================
// V4.4.46 - BACK OFFICE LOGIN
// Back Office requires employee code + PIN, Owner/Manager only.
// ============================================================
function openBackOfficeLogin(){
  try{
    loginMode='back';

    document.body.classList.remove('yak-backoffice','yak-front','yak-back-locked');
    document.body.classList.add('yak-intro');

    try{refreshBranchSelects()}catch(e){console.error('refreshBranchSelects',e)}

    const title=document.getElementById('loginTitle');
    const subtitle=document.getElementById('loginSubtitle');
    const error=document.getElementById('loginError');
    const emp=document.getElementById('loginEmp');
    const pin=document.getElementById('loginPin');

    if(title)title.textContent='เข้าสู่ระบบหลังร้าน';
    if(subtitle)subtitle.textContent='สำหรับ Owner / Manager • ใช้รหัสพนักงานและ PIN';
    if(error)error.textContent='';
    if(emp)emp.value='';
    if(pin)pin.value='';

    showView('loginView');
    setTimeout(()=>emp?.focus(),50);
  }catch(err){
    console.error('openBackOfficeLogin',err);
    try{toast('เปิดหน้าล็อกอินหลังร้านไม่สำเร็จ')}catch(e){}
  }
}

// V4.4.47: keep front status synchronized with material changes.
function yakRefreshFrontStockState(){
  try{renderProducts()}catch(e){}
  try{renderStockAlerts()}catch(e){}
}
document.addEventListener('click',function(e){
  if(e.target.closest('#tab-products button')){
    setTimeout(yakRefreshFrontStockState,300);
  }
});

// ============================================================
// V4.4.58 - BRANCH EDIT / DELETE
// ============================================================
let br58EditingId=null;

function br58OpenAdd(){
  br58EditingId=null;
  const form=document.getElementById('branchForm');
  if(!form)return;
  form.classList.remove('hidden');

  if(document.getElementById('branchCode'))document.getElementById('branchCode').value='';
  if(document.getElementById('branchName'))document.getElementById('branchName').value='';

  const save=form.querySelector('.btn.success');
  if(save){
    save.textContent='บันทึก';
    save.setAttribute('onclick','saveBranch()');
  }

  let title=document.getElementById('br58FormTitle');
  if(!title){
    title=document.createElement('div');
    title.id='br58FormTitle';
    title.className='br58-form-title';
    form.prepend(title);
  }
  title.textContent='เพิ่มสาขาใหม่';
}

function br58Edit(id){
  const b=(db.branches||[]).find(x=>x.id===id);
  if(!b)return;

  br58EditingId=id;
  const form=document.getElementById('branchForm');
  if(!form)return;

  form.classList.remove('hidden');
  if(document.getElementById('branchCode'))document.getElementById('branchCode').value=b.code||'';
  if(document.getElementById('branchName'))document.getElementById('branchName').value=b.name||'';

  let title=document.getElementById('br58FormTitle');
  if(!title){
    title=document.createElement('div');
    title.id='br58FormTitle';
    title.className='br58-form-title';
    form.prepend(title);
  }
  title.textContent=`แก้ไขสาขา: ${b.name} (${b.code})`;

  const save=form.querySelector('.btn.success');
  if(save){
    save.textContent='บันทึกการแก้ไข';
    save.setAttribute('onclick','br58SaveEdit()');
  }

  const cancel=form.querySelector('.btn.ghost');
  if(cancel)cancel.setAttribute('onclick','br58CancelEdit()');

  try{form.scrollIntoView({behavior:'smooth',block:'center'})}catch(e){}
}

function br58SaveEdit(){
  const b=(db.branches||[]).find(x=>x.id===br58EditingId);
  if(!b)return;

  const code=document.getElementById('branchCode')?.value.trim().toUpperCase();
  const name=document.getElementById('branchName')?.value.trim();

  if(!code||!name){
    toast('กรอกรหัสสาขาและชื่อสาขาให้ครบ');
    return;
  }

  const duplicate=(db.branches||[]).find(x=>x.id!==b.id && String(x.code||'').toUpperCase()===code);
  if(duplicate){
    toast('รหัสสาขานี้ถูกใช้แล้ว');
    return;
  }

  b.code=code;
  b.name=name;
  saveDB();

  br58CancelEdit();
  renderBranches();
  try{refreshBranchSelects()}catch(e){}
  try{renderBackoffice()}catch(e){}
  toast('แก้ไขสาขาแล้ว');
}

function br58CancelEdit(){
  br58EditingId=null;
  const form=document.getElementById('branchForm');
  if(form){
    document.getElementById('br58FormTitle')?.remove();

    const save=form.querySelector('.btn.success');
    if(save){
      save.textContent='บันทึก';
      save.setAttribute('onclick','saveBranch()');
    }

    const cancel=form.querySelector('.btn.ghost');
    if(cancel)cancel.setAttribute('onclick','hideBranchForm()');

    form.classList.add('hidden');
  }
}

function br58Toggle(id){
  const b=(db.branches||[]).find(x=>x.id===id);
  if(!b)return;

  if(b.active!==false){
    const activeBranches=(db.branches||[]).filter(x=>x.id!==id && x.active!==false);
    if(!activeBranches.length){
      toast('ต้องมีสาขาที่ใช้งานอย่างน้อย 1 สาขา');
      return;
    }
  }

  b.active=b.active===false ? true : false;
  saveDB();
  renderBranches();
  try{refreshBranchSelects()}catch(e){}
}

function br58Delete(id){
  const b=(db.branches||[]).find(x=>x.id===id);
  if(!b)return;

  const employees=(db.employees||[]).filter(e=>e.branchId===id);
  const sales=(db.sales||[]).filter(s=>s.branchId===id);

  const activeBranches=(db.branches||[]).filter(x=>x.id!==id && x.active!==false);
  if(!activeBranches.length){
    toast('ไม่สามารถลบสาขาสุดท้ายที่ใช้งานอยู่ได้');
    return;
  }

  let msg=`ต้องการลบสาขา "${b.name}" (${b.code}) หรือไม่?`;

  if(employees.length){
    msg+=`\n\nมีพนักงาน ${employees.length} คนอยู่ในสาขานี้`;
    msg+=`\nกรุณาย้ายพนักงานไปสาขาอื่นก่อนลบ`;
    alert(msg);
    return;
  }

  if(sales.length){
    msg+=`\n\nสาขานี้มีประวัติขาย ${sales.length} บิล`;
    msg+=`\nประวัติยอดขายเดิมจะยังคงอยู่ แต่สาขาจะถูกลบจากรายการ`;
  }

  if(!confirm(msg))return;

  db.branches=(db.branches||[]).filter(x=>x.id!==id);
  saveDB();
  renderBranches();
  try{refreshBranchSelects()}catch(e){}
  try{renderBackoffice()}catch(e){}
  toast('ลบสาขาแล้ว');
}

// Keep old add button working, but reset edit mode when adding new branch.
const _br58ShowBranchForm=showBranchForm;
showBranchForm=function(){
  br58EditingId=null;
  _br58ShowBranchForm();

  const form=document.getElementById('branchForm');
  if(form){
    document.getElementById('br58FormTitle')?.remove();

    const save=form.querySelector('.btn.success');
    if(save){
      save.textContent='บันทึก';
      save.setAttribute('onclick','saveBranch()');
    }

    const cancel=form.querySelector('.btn.ghost');
    if(cancel)cancel.setAttribute('onclick','hideBranchForm()');
  }
};


// ============================================================
// V4.4.61 - STABLE BACK OFFICE NAVIGATION
// One controller for: Products / Stock / Reports / People / Receipt / Settings
// ============================================================
(function(){
  const PAGE_MAP={
    products:['tab-products'],
    stock:['tab-products'],       // stock/materials currently live inside Products page
    reports:['tab-reports'],
    people:['tab-employees','tab-branches'],
    receipt:['receiptDesignerPanel'],
    settings:['tab-settings']
  };

  function hideAllBackPages(){
    document.querySelectorAll(
      '#tab-dashboard,#tab-branches,#tab-employees,#tab-products,#tab-sales,#tab-reports,#tab-settings,[data-backpage-panel]'
    ).forEach(el=>{
      el.classList.remove('active','yak-page-active');
      el.classList.add('hidden');
      el.style.display='none';
    });
  }

  function showElement(id){
    const el=document.getElementById(id);
    if(!el)return false;
    el.classList.remove('hidden');
    el.classList.add('active');

    // Required by CSS:
    // body.yak-backoffice [data-backpage-panel].yak-page-active {display:block!important}
    if(el.hasAttribute('data-backpage-panel')){
      el.classList.add('yak-page-active');
    }

    el.style.display='';
    return true;
  }

  function openPage(page){
    if(!PAGE_MAP[page])page='products';

    hideAllBackPages();

    if(page==='products'){
      showElement('tab-products');
      try{renderProductsAdmin()}catch(e){}
      try{m40Refresh()}catch(e){}
      try{window.YAK_MATERIAL_LIVE_442?.render?.()}catch(e){}
    }
    else if(page==='stock'){
      // Material/stock manager is currently contained in tab-products.
      showElement('tab-products');
      try{renderProductsAdmin()}catch(e){}
      try{m40Refresh()}catch(e){}
      try{window.YAK_MATERIAL_LIVE_442?.render?.()}catch(e){}
      setTimeout(()=>{
        const target=document.querySelector('.material33-panel,#m40MaterialManager');
        if(target)target.scrollIntoView({behavior:'smooth',block:'start'});
      },80);
    }
    else if(page==='reports'){
      showElement('tab-reports');
      const adv=document.getElementById('advancedReports');
      if(adv){adv.classList.remove('hidden');adv.classList.add('yak-page-active');adv.style.display='';}
      try{renderReports()}catch(e){}
      try{window.YAK_REPORTS?.render?.()}catch(e){}
    }
    else if(page==='people'){
      showElement('tab-employees');
      showElement('tab-branches');
      try{renderEmployees()}catch(e){}
      try{renderBranches()}catch(e){}
    }
    else if(page==='receipt'){
      showElement('receiptDesignerPanel');
      try{loadReceiptDesignForm()}catch(e){}
    }
    else if(page==='settings'){
      showElement('tab-settings');
      try{loadPrinterCheck()}catch(e){}
    }

    document.querySelectorAll('#yakBackNav .yak-back-tab').forEach(btn=>{
      btn.classList.toggle('active',btn.dataset.backpage===page);
    });

    try{localStorage.setItem('yak_back_page',page)}catch(e){}
  }

  function bind(){
    const nav=document.getElementById('yakBackNav');
    if(!nav)return;

    // Capture phase makes this controller win over older/conflicting listeners.
    nav.addEventListener('click',e=>{
      const btn=e.target.closest('.yak-back-tab');
      if(!btn)return;
      e.preventDefault();
      e.stopImmediatePropagation();
      openPage(btn.dataset.backpage);
    },true);

    // Make current page visible on first entry to Back Office.
    setTimeout(()=>{
      if(document.body.classList.contains('yak-backoffice')){
        let page='products';
        try{page=localStorage.getItem('yak_back_page')||'products'}catch(e){}
        openPage(page);
      }
    },300);
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',bind);
  }else{
    bind();
  }

  window.YAK_BACK_NAV_461={open:openPage,bind};
})();


// ============================================================
// V4.4.63 - PRODUCT EDIT DIRECT CONTROLLER
// No dependency on DOMContentLoaded or delegated event binding.
// ============================================================
const PROD63={mode:'add',editingId:null,oldImage:''};

function prod63OpenAdd(){
  PROD63.mode='add';
  PROD63.editingId=null;
  PROD63.oldImage='';

  const form=document.getElementById('productForm');
  if(!form){toast('ไม่พบฟอร์มสินค้า');return}

  document.getElementById('prod63FormTitle').textContent='เพิ่มสินค้าใหม่';
  document.getElementById('newProductName').value='';
  document.getElementById('newProductPrice').value='';
  document.getElementById('newProductCost').value='';
  document.getElementById('newProductStock').value='';
  document.getElementById('newProductMinStock').value='';
  document.getElementById('newProductTrackStock').value='yes';
  document.getElementById('newProductImage').value='';
  document.getElementById('prod63ImageInfo').textContent='ยังไม่ได้เลือกรูป';

  document.getElementById('prod63SaveBtn').textContent='บันทึก';
  form.classList.remove('hidden');
  form.style.display='grid';

  try{form.scrollIntoView({behavior:'smooth',block:'center'})}catch(e){}
  setTimeout(()=>document.getElementById('newProductName')?.focus(),30);
}

function prod63OpenEdit(id){
  const product=(db.products||[]).find(x=>String(x.id)===String(id));
  if(!product){
    toast('ไม่พบสินค้าที่ต้องการแก้ไข');
    return;
  }

  PROD63.mode='edit';
  PROD63.editingId=product.id;
  PROD63.oldImage=product.image||'';

  const form=document.getElementById('productForm');
  if(!form){
    toast('ไม่พบฟอร์มแก้ไขสินค้า');
    return;
  }

  document.getElementById('prod63FormTitle').textContent=`แก้ไขสินค้า: ${product.name}`;
  document.getElementById('newProductName').value=product.name||'';
  document.getElementById('newProductPrice').value=Number(product.price||0);
  document.getElementById('newProductCost').value=Number(product.cost||0);
  document.getElementById('newProductStock').value=Number(product.stock||0);
  document.getElementById('newProductMinStock').value=Number(product.minStock||0);
  document.getElementById('newProductTrackStock').value=product.trackStock?'yes':'no';
  document.getElementById('newProductImage').value='';
  document.getElementById('prod63ImageInfo').textContent=
    product.image?'มีรูปเดิมอยู่ • ถ้าไม่เลือกรูปใหม่จะใช้รูปเดิม':'ยังไม่มีรูปสินค้า';

  document.getElementById('prod63SaveBtn').textContent='💾 บันทึกการแก้ไข';

  form.classList.remove('hidden');
  form.style.display='grid';

  try{form.scrollIntoView({behavior:'smooth',block:'center'})}catch(e){}
  setTimeout(()=>document.getElementById('newProductName')?.focus(),30);
}

function prod63Close(){
  PROD63.mode='add';
  PROD63.editingId=null;
  PROD63.oldImage='';

  const form=document.getElementById('productForm');
  if(form){
    form.classList.add('hidden');
    form.style.display='none';
  }
}

function prod63ReadImage(file){
  return new Promise((resolve,reject)=>{
    if(!file){
      resolve(PROD63.oldImage||'');
      return;
    }
    if(file.size>4*1024*1024){
      reject(new Error('รูปใหญ่เกิน 4 MB'));
      return;
    }
    const reader=new FileReader();
    reader.onload=()=>resolve(reader.result);
    reader.onerror=()=>reject(new Error('อ่านรูปไม่สำเร็จ'));
    reader.readAsDataURL(file);
  });
}

async function prod63Save(){
  const name=(document.getElementById('newProductName')?.value||'').trim();
  const price=Number(document.getElementById('newProductPrice')?.value||0);
  const cost=Number(document.getElementById('newProductCost')?.value||0);
  const stock=Number(document.getElementById('newProductStock')?.value||0);
  const minStock=Number(document.getElementById('newProductMinStock')?.value||0);
  const trackStock=document.getElementById('newProductTrackStock')?.value==='yes';
  const file=document.getElementById('newProductImage')?.files?.[0];

  if(!name){
    toast('กรุณากรอกชื่อสินค้า');
    return;
  }
  if([price,cost,stock,minStock].some(v=>!Number.isFinite(v)||v<0)){
    toast('ราคา ต้นทุน สต๊อก และจุดเตือนต้องเป็น 0 หรือมากกว่า');
    return;
  }

  let image='';
  try{
    image=await prod63ReadImage(file);
  }catch(err){
    toast(err.message);
    return;
  }

  if(PROD63.mode==='edit'){
    const product=(db.products||[]).find(x=>String(x.id)===String(PROD63.editingId));
    if(!product){
      toast('ไม่พบสินค้าที่ต้องการบันทึก');
      return;
    }

    // Update the same object/id so material links remain intact.
    product.name=name;
    product.price=price;
    product.cost=cost;
    product.stock=stock;
    product.minStock=minStock;
    product.trackStock=trackStock;
    product.image=image;

    saveDB();
    prod63Close();

    try{renderProductsAdmin()}catch(e){console.error(e)}
    try{renderProducts()}catch(e){}
    try{m33RenderAll()}catch(e){}
    try{m40Refresh()}catch(e){}
    try{window.YAK_MATERIAL_LIVE_442?.render?.()}catch(e){}

    toast('แก้ไขสินค้าเรียบร้อย');
  }else{
    db.products.push({
      id:'p'+Date.now(),
      name,price,cost,stock,minStock,trackStock,image,active:true
    });

    saveDB();
    prod63Close();

    try{renderProductsAdmin()}catch(e){}
    try{renderProducts()}catch(e){}
    try{m33RenderAll()}catch(e){}

    toast('เพิ่มสินค้าเรียบร้อย');
  }
}

// Compatibility with older callers.
function showProductForm(){prod63OpenAdd()}
function hideProductForm(){prod63Close()}
function saveProduct(){return prod63Save()}

// ============================================================
// V4.4.66 - LEFT SIDEBAR RECEIPT DESIGNER MENU
// ============================================================
function openLeftReceipt66(btn){
  try{
    // Keep the left sidebar active state correct.
    document.querySelectorAll('.side-btn').forEach(x=>x.classList.remove('active'));
    if(btn)btn.classList.add('active');

    // Prefer the stable back-office navigation controller from V4.4.61.
    if(window.YAK_BACK_NAV_461?.open){
      window.YAK_BACK_NAV_461.open('receipt');
    }else{
      // Fallback: show receipt designer directly.
      document.querySelectorAll(
        '#tab-dashboard,#tab-branches,#tab-employees,#tab-products,#tab-sales,#tab-reports,#tab-settings,[data-backpage-panel]'
      ).forEach(el=>{
        el.classList.remove('active');
        el.classList.add('hidden');
        el.style.display='none';
      });

      const receipt=document.getElementById('receiptDesignerPanel');
      if(receipt){
        receipt.classList.remove('hidden');
        receipt.classList.add('active','yak-page-active');
        receipt.style.display='';
      }

      document.querySelectorAll('#yakBackNav .yak-back-tab').forEach(x=>{
        x.classList.toggle('active',x.dataset.backpage==='receipt');
      });

      try{loadReceiptDesignForm()}catch(e){}
    }

    try{localStorage.setItem('yak_back_page','receipt')}catch(e){}
  }catch(err){
    console.error('openLeftReceipt66',err);
    try{toast('เปิดหน้าตกแต่งสลิปไม่สำเร็จ')}catch(e){}
  }
}

document.addEventListener('click',function(e){
  const btn=e.target.closest('#yakBackNav .yak-back-tab');
  if(!btn)return;
  if(btn.dataset.backpage==='receipt'){
    document.querySelectorAll('.side-btn').forEach(x=>x.classList.remove('active'));
    document.getElementById('__disabled_leftReceiptMenu66')?.classList.add('active');
  }else{
    document.getElementById('__disabled_leftReceiptMenu66')?.classList.remove('active');
  }
},true);

// ============================================================
// V4.4.68 - FULL LEFT SIDEBAR NAVIGATION
// Makes every left menu item work from every page, including Receipt Designer.
// ============================================================
(function(){
  let bound=false;

  function clearAllPages68(){
    document.querySelectorAll(
      '#tab-dashboard,#tab-branches,#tab-employees,#tab-products,#tab-sales,#tab-reports,#tab-settings,[data-backpage-panel]'
    ).forEach(el=>{
      el.classList.remove('active','yak-page-active');
      el.classList.add('hidden');
      el.style.display='none';
    });

    // Also clear bottom navigation state.
    document.querySelectorAll('#yakBackNav .yak-back-tab').forEach(b=>b.classList.remove('active'));
  }

  function show68(id){
    const el=document.getElementById(id);
    if(!el)return false;
    el.classList.remove('hidden');
    el.classList.add('active');
    if(el.hasAttribute('data-backpage-panel')){
      el.classList.add('yak-page-active');
    }
    el.style.display='';
    return true;
  }

  function setLeftActive68(page){
    document.querySelectorAll('#__disabled_yakLeftNav68 .side-btn').forEach(b=>{
      b.classList.toggle('active',b.dataset.leftpage===page);
    });
  }

  function setBottomActive68(page){
    const bottomMap={
      products:'products',
      reports:'reports',
      receipt:'receipt',
      branches:'people',
      employees:'people'
    };
    const bp=bottomMap[page];
    document.querySelectorAll('#yakBackNav .yak-back-tab').forEach(b=>{
      b.classList.toggle('active',!!bp && b.dataset.backpage===bp);
    });
  }

  function openLeftPage68(page){
    clearAllPages68();

    if(page==='dashboard'){
      show68('tab-dashboard');
      try{renderDashboard()}catch(e){}
    }
    else if(page==='branches'){
      show68('tab-branches');
      try{renderBranches()}catch(e){}
    }
    else if(page==='employees'){
      show68('tab-employees');
      try{renderEmployees()}catch(e){}
    }
    else if(page==='products'){
      show68('tab-products');
      try{renderProductsAdmin()}catch(e){}
      try{m40Refresh()}catch(e){}
      try{window.YAK_MATERIAL_LIVE_442?.render?.()}catch(e){}
    }
    else if(page==='sales'){
      show68('tab-sales');
      try{renderSales()}catch(e){}
    }
    else if(page==='reports'){
      show68('tab-reports');

      const adv=document.getElementById('advancedReports');
      if(adv){
        adv.classList.remove('hidden');
        adv.classList.add('active','yak-page-active');
        adv.style.display='';
      }

      try{renderReports()}catch(e){}
      try{window.YAK_REPORTS?.render?.()}catch(e){}
    }
    else if(page==='receipt'){
      show68('receiptDesignerPanel');
      try{loadReceiptDesignForm()}catch(e){}
    }
    else{
      show68('tab-dashboard');
      page='dashboard';
    }

    setLeftActive68(page);
    setBottomActive68(page);

    try{localStorage.setItem('yak_left_page_68',page)}catch(e){}
  }

  function bind68(){
    if(bound)return;
    bound=true;

    const nav=document.getElementById('__disabled_yakLeftNav68');
    if(!nav)return;

    nav.addEventListener('click',e=>{
      const btn=e.target.closest('[data-leftpage]');
      if(!btn)return;

      e.preventDefault();
      e.stopImmediatePropagation();

      openLeftPage68(btn.dataset.leftpage);
    },true);

    // Bottom navigation can still be used; synchronize left menu.
    const bottom=document.getElementById('yakBackNav');
    if(bottom){
      bottom.addEventListener('click',e=>{
        const btn=e.target.closest('.yak-back-tab');
        if(!btn)return;

        const page=btn.dataset.backpage;

        // Let our own logic handle these to prevent mixed navigation states.
        if(page==='products'){
          e.preventDefault();e.stopImmediatePropagation();openLeftPage68('products');
        }else if(page==='reports'){
          e.preventDefault();e.stopImmediatePropagation();openLeftPage68('reports');
        }else if(page==='people'){
          e.preventDefault();e.stopImmediatePropagation();openLeftPage68('employees');
        }else if(page==='receipt'){
          e.preventDefault();e.stopImmediatePropagation();openLeftPage68('receipt');
        }else if(page==='stock'){
          e.preventDefault();e.stopImmediatePropagation();
          openLeftPage68('products');
          setTimeout(()=>{
            const target=document.querySelector('.material33-panel,#m40MaterialManager');
            if(target)target.scrollIntoView({behavior:'smooth',block:'start'});
          },100);
        }else if(page==='settings'){
          // Settings remains bottom-only.
          e.preventDefault();e.stopImmediatePropagation();
          clearAllPages68();
          show68('tab-settings');
          document.querySelectorAll('#yakBackNav .yak-back-tab').forEach(x=>{
            x.classList.toggle('active',x.dataset.backpage==='settings');
          });
          setLeftActive68('');
          try{loadPrinterCheck()}catch(err){}
        }
      },true);
    }

    // When first entering Back Office, start cleanly.
    setTimeout(()=>{
      if(document.body.classList.contains('yak-backoffice')){
        let page='dashboard';
        try{
          page=localStorage.getItem('yak_left_page_68')||'dashboard';
        }catch(e){}
        openLeftPage68(page);
      }
    },350);
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',bind68);
  }else{
    bind68();
  }

  window.YAK_LEFT_NAV_468={
    open:openLeftPage68,
    clear:clearAllPages68
  };
})();
