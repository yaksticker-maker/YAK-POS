(function(){
'use strict';

const CFG_KEY='yak_online_v500_config';
const DEV_KEY='yak_online_v500_device';
const TABLE='yak_store_state';
const STORE_ID='yak-main';
const QUEUE_KEY='yak_offline_v520_pending_sales';
const LAST_SYNC_KEY='yak_offline_v520_last_sync';
let client=null;
let syncing=false;
let checkoutWrapped=false;

const E=id=>document.getElementById(id);

function config(){
  try{return JSON.parse(localStorage.getItem(CFG_KEY)||'{}')}catch(e){return {}}
}
function deviceId(){
  let d=localStorage.getItem(DEV_KEY);
  if(!d){
    d='yak-'+Date.now()+'-'+Math.random().toString(36).slice(2,7);
    localStorage.setItem(DEV_KEY,d);
  }
  return d;
}
function getQueue(){
  try{
    const q=JSON.parse(localStorage.getItem(QUEUE_KEY)||'[]');
    return Array.isArray(q)?q:[];
  }catch(e){return []}
}
function setQueue(q){
  localStorage.setItem(QUEUE_KEY,JSON.stringify(q||[]));
  renderStatus();
}
function addPendingSale(sale){
  if(!sale?.id)return;
  const q=getQueue();
  if(!q.some(x=>x.id===sale.id)){
    q.push(JSON.parse(JSON.stringify(sale)));
    setQueue(q);
  }
}
function clearPending(ids){
  const set=new Set(ids||[]);
  setQueue(getQueue().filter(x=>!set.has(x.id)));
}
function fmtTime(v){
  if(!v)return 'ยังไม่เคย Sync';
  try{return new Date(v).toLocaleString('th-TH',{dateStyle:'short',timeStyle:'medium'})}catch(e){return v}
}
function onlineBadge(text,kind){
  const b=E('frontCloudBadge');
  if(!b)return;
  b.textContent=text;
  b.className='front-cloud-badge '+kind;
}
function renderStatus(extra){
  const q=getQueue();
  const pending=E('frontCloudPending');
  const last=E('frontCloudLast');
  const note=E('frontCloudNote');
  if(pending) pending.textContent=String(q.length);
  if(last) last.textContent=fmtTime(localStorage.getItem(LAST_SYNC_KEY));
  if(note && extra) note.textContent=extra;

  if(!navigator.onLine){
    onlineBadge('● Offline','offline');
    if(note) note.textContent=q.length
      ? `ขายต่อได้ • มี ${q.length} บิลรอส่งขึ้น Cloud`
      : 'ขายต่อได้ • ระบบจะเก็บข้อมูลไว้ในเครื่อง';
  }else if(syncing){
    onlineBadge('● กำลัง Sync','syncing');
    if(note) note.textContent='กำลังตรวจและส่งข้อมูลขึ้น Cloud...';
  }else if(q.length){
    onlineBadge('● Online • มีข้อมูลค้าง','warning');
    if(note) note.textContent=`มี ${q.length} บิลรอ Sync • ระบบจะลองส่งอัตโนมัติ`;
  }else{
    onlineBadge('● Online','online');
    if(note && !extra) note.textContent='Cloud พร้อมใช้งาน • ไม่มีบิลค้าง';
  }
}

async function ensureSupabase(){
  if(window.supabase?.createClient)return true;
  await new Promise((resolve,reject)=>{
    const old=document.querySelector('script[data-yak-supabase-v520]');
    if(old){
      old.addEventListener('load',resolve,{once:true});
      old.addEventListener('error',reject,{once:true});
      return;
    }
    const s=document.createElement('script');
    s.dataset.yakSupabaseV520='1';
    s.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
    s.onload=resolve;
    s.onerror=reject;
    document.head.appendChild(s);
  });
  return !!window.supabase?.createClient;
}

async function getClient(){
  const x=config();
  if(!x.url||!x.key)throw new Error('ยังไม่ได้ตั้งค่า Cloud');
  if(!navigator.onLine)throw new Error('อินเทอร์เน็ตยังไม่เชื่อมต่อ');
  await ensureSupabase();
  if(!client){
    client=window.supabase.createClient(x.url,x.key,{auth:{persistSession:false,autoRefreshToken:false}});
  }
  return client;
}

function ensureStateShape(state){
  state=state&&typeof state==='object'?state:{};
  state.sales=Array.isArray(state.sales)?state.sales:[];
  state.products=Array.isArray(state.products)?state.products:[];
  state.materials=Array.isArray(state.materials)?state.materials:[];
  state.productMaterials=Array.isArray(state.productMaterials)?state.productMaterials:[];
  return state;
}

// Apply one offline sale to the newest Cloud state. This avoids replacing newer
// data from another device with an old offline snapshot.
function applySaleToState(state,sale){
  state=ensureStateShape(state);
  if(state.sales.some(s=>s.id===sale.id))return false;

  const required={};
  for(const item of (sale.items||[])){
    const productId=item.productId||item.id;
    const qty=Number(item.qty||0);
    const links=state.productMaterials.filter(l=>l.productId===productId);

    if(links.length){
      for(const link of links){
        const m=state.materials.find(x=>x.id===link.materialId);
        if(!m || m.active===false)continue;
        const need=Number(link.qtyPerSale||0)*qty;
        required[m.id]=(required[m.id]||0)+need;
      }
    }else{
      const p=state.products.find(x=>x.id===productId);
      if(p?.trackStock){
        p.stock=Math.max(0,Number(p.stock||0)-qty);
      }
    }
  }

  for(const [mid,need] of Object.entries(required)){
    const m=state.materials.find(x=>x.id===mid);
    if(m)m.stock=Math.max(0,Number(m.stock||0)-Number(need||0));
  }

  state.sales.unshift(JSON.parse(JSON.stringify(sale)));
  return true;
}

function refreshLocal(state){
  try{
    window.db=state;
  }catch(e){}
  // app.js declares db with let, so direct window.db may not replace it.
  // Store locally first; pages that reload will always get the reconciled state.
  try{localStorage.setItem('yak_pos_db_v2',JSON.stringify(state))}catch(e){}
}

async function syncPending(showMessage=true){
  if(syncing)return false;
  syncing=true;
  renderStatus();

  try{
    const sb=await getClient();
    const queue=getQueue();
    const {data,error}=await sb.from(TABLE).select('*').eq('store_id',STORE_ID).maybeSingle();
    if(error)throw error;

    let cloud=ensureStateShape(data?.state ? JSON.parse(JSON.stringify(data.state)) : JSON.parse(JSON.stringify(db)));
    const done=[];
    let changed=false;

    for(const sale of queue){
      if(applySaleToState(cloud,sale))changed=true;
      done.push(sale.id); // already in Cloud also counts as safely synced
    }

    if(changed || (!data?.state && queue.length)){
      const {error:upErr}=await sb.from(TABLE).upsert({
        store_id:STORE_ID,
        state:cloud,
        updated_at:new Date().toISOString(),
        updated_by:deviceId()
      },{onConflict:'store_id'});
      if(upErr)throw upErr;
    }

    if(done.length)clearPending(done);
    localStorage.setItem(LAST_SYNC_KEY,new Date().toISOString());

    // If no pending sales, a successful select is still a successful Cloud check.
    if(showMessage && typeof window.toast==='function'){
      window.toast(done.length ? `ส่งข้อมูลขึ้น Cloud สำเร็จ ${done.length} บิล` : 'Cloud เชื่อมต่อปกติ • ไม่มีข้อมูลค้าง');
    }
    renderStatus(done.length ? `Sync สำเร็จ ${done.length} บิล • ข้อมูลปลอดภัยแล้ว` : 'Cloud เชื่อมต่อปกติ • ไม่มีบิลค้าง');
    return true;
  }catch(e){
    console.error('[YAK V5.2 offline sync]',e);
    const msg=e?.message||'เชื่อมต่อ Cloud ไม่สำเร็จ';
    if(showMessage && typeof window.toast==='function')window.toast(msg);
    renderStatus(navigator.onLine ? 'เชื่อม Cloud ไม่สำเร็จ • ข้อมูลยังเก็บอยู่ในเครื่อง' : 'เน็ตหลุด • ข้อมูลยังเก็บอยู่ในเครื่อง');
    return false;
  }finally{
    syncing=false;
    renderStatus();
  }
}

async function checkCloud(){
  return syncPending(true);
}

function wrapCheckout(){
  if(checkoutWrapped || typeof window.checkout!=='function')return;
  const old=window.checkout;
  window.checkout=function(){
    const before=new Set((db.sales||[]).map(s=>s.id));
    const r=old.apply(this,arguments);
    const sale=(db.sales||[]).find(s=>!before.has(s.id));
    if(sale){
      // Queue every new bill first. It is removed only after Cloud confirms it exists.
      addPendingSale(sale);
      renderStatus();
      setTimeout(()=>syncPending(false),700);
    }
    return r;
  };
  checkoutWrapped=true;
}

function bindNetwork(){
  window.addEventListener('offline',()=>{
    renderStatus('เน็ตหลุด • ยังขายต่อได้ และบิลจะรอส่งอัตโนมัติ');
  });
  window.addEventListener('online',()=>{
    renderStatus('อินเทอร์เน็ตกลับมาแล้ว • กำลังส่งข้อมูลค้าง');
    setTimeout(()=>syncPending(false),500);
  });
}

function boot(){
  wrapCheckout();
  bindNetwork();
  renderStatus();
  if(navigator.onLine)setTimeout(()=>syncPending(false),1800);
  setInterval(()=>{
    if(navigator.onLine && getQueue().length)syncPending(false);
    else renderStatus();
  },15000);
}

window.YAK_OFFLINE_520={
  syncPending,
  checkCloud,
  pendingCount:()=>getQueue().length,
  renderStatus
};

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,900));
else setTimeout(boot,900);
})();
