
(function(){
'use strict';

const CK='yak_online_v500_config';
const DK='yak_online_v500_device';
const T='yak_store_state';
const LAST_PULL='yak_online_v510_last_pull';
let sb=null,ch=null,busy=false,pulling=false;

const E=i=>document.getElementById(i);

function st(t,k='orange'){
  const a=E('online500Status');
  if(a){a.textContent=t;a.className='badge '+k}
  const b=E('online500Info');
  if(b)b.textContent=t;
}

function cfg(){
  try{return JSON.parse(localStorage.getItem(CK)||'{}')}catch(e){return {}}
}

function saveCfg(x){
  localStorage.setItem(CK,JSON.stringify(x));
}

function dev(){
  let d=localStorage.getItem(DK);
  if(!d){
    d='yak-'+Date.now()+'-'+Math.random().toString(36).slice(2,7);
    localStorage.setItem(DK,d);
  }
  return d;
}

async function lib(){
  if(window.supabase?.createClient)return;
  await new Promise((ok,no)=>{
    let s=document.createElement('script');
    s.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
    s.onload=ok;s.onerror=no;
    document.head.appendChild(s);
  });
}

async function conn(x=cfg(),silent=false){
  if(!x.url||!x.key){
    if(!silent)st('Offline • ยังไม่ได้ตั้งค่า');
    return false;
  }
  try{
    if(!silent)st('กำลังเชื่อมต่อ...');
    await lib();
    sb=window.supabase.createClient(x.url,x.key,{
      auth:{persistSession:false,autoRefreshToken:false}
    });

    const {error}=await sb.from(T).select('store_id,updated_at').eq('store_id','yak-main').maybeSingle();
    if(error)throw error;

    saveCfg(x);
    await sub();
    st('Online • เชื่อมต่ออัตโนมัติแล้ว','green');
    return true;
  }catch(e){
    console.error(e);
    st('เชื่อมต่อไม่สำเร็จ','red');
    return false;
  }
}

async function form(){
  const x={
    url:(E('online500Url')?.value||'').trim(),
    key:(E('online500Key')?.value||'').trim()
  };
  if(!x.url||!x.key){
    alert('กรอก Project URL และ Publishable Key ให้ครบ');
    return;
  }
  if(await conn(x)){
    await pull(true);
  }
}

async function push(show=true){
  if(busy||pulling)return;
  if(!sb && !(await conn(cfg(),true)))return;
  busy=true;
  try{
    const {error}=await sb.from(T).upsert({
      store_id:'yak-main',
      state:db,
      updated_at:new Date().toISOString(),
      updated_by:dev()
    },{onConflict:'store_id'});
    if(error)throw error;
    if(show)st('Online • บันทึก Cloud แล้ว','green');
  }catch(e){
    console.error(e);
    if(show)st('อัปโหลดไม่สำเร็จ','red');
  }finally{
    busy=false;
  }
}

async function pull(show=true){
  if(pulling)return;
  if(!sb && !(await conn(cfg(),true)))return;
  pulling=true;
  try{
    const {data,error}=await sb.from(T).select('*').eq('store_id','yak-main').maybeSingle();
    if(error)throw error;

    if(!data?.state){
      if(show)st('Online • Cloud ยังไม่มีข้อมูล','orange');
      return;
    }

    db=data.state;
    try{
      if(typeof saveDB==='function')saveDB();
    }catch(e){}

    localStorage.setItem(LAST_PULL,new Date().toISOString());
    refreshAll();

    if(show)st('Online • ดึงข้อมูลล่าสุดแล้ว','green');
    else st('Online • พร้อมใช้งาน','green');
  }catch(e){
    console.error(e);
    if(show)st('ดึงข้อมูลไม่สำเร็จ','red');
  }finally{
    pulling=false;
  }
}

function refreshAll(){
  const names=[
    'renderDashboard','renderBranches','renderEmployees',
    'renderProductsAdmin','renderProducts','renderSales','renderReports'
  ];
  names.forEach(n=>{
    try{
      if(typeof window[n]==='function')window[n]();
    }catch(e){}
  });
  try{window.YAK_MATERIAL_LIVE_442?.render?.()}catch(e){}
  try{window.YAK_REPORTS?.render?.()}catch(e){}
}

async function sub(){
  if(ch){
    try{await sb.removeChannel(ch)}catch(e){}
  }

  ch=sb.channel('yak-pos-v510')
    .on('postgres_changes',{
      event:'*',
      schema:'public',
      table:T,
      filter:'store_id=eq.yak-main'
    },async p=>{
      if(p.new?.updated_by===dev() || !p.new?.state)return;

      pulling=true;
      try{
        db=p.new.state;
        try{
          if(typeof saveDB==='function')saveDB();
        }catch(e){}
        refreshAll();
        localStorage.setItem(LAST_PULL,new Date().toISOString());
        st('Online • อัปเดตจากอีกเครื่องแล้ว','green');
      }finally{
        pulling=false;
      }
    })
    .subscribe();
}

function off(){
  try{if(sb&&ch)sb.removeChannel(ch)}catch(e){}
  sb=null;ch=null;
  localStorage.removeItem(CK);
  if(E('online500Url'))E('online500Url').value='';
  if(E('online500Key'))E('online500Key').value='';
  st('Offline • ใช้ข้อมูลในเครื่อง');
}

function openPage(ev){
  if(ev){
    ev.preventDefault();
    ev.stopPropagation();
  }

  document.querySelectorAll(
    '#tab-dashboard,#tab-branches,#tab-employees,#tab-products,#tab-sales,#tab-reports,[data-backpage-panel]'
  ).forEach(x=>{
    x.classList.remove('active','yak-page-active');
    x.classList.add('hidden');
    x.style.display='none';
  });

  const p=E('online500Panel');
  if(p){
    p.classList.remove('hidden');
    p.classList.add('active','yak-page-active');
    p.style.display='block';
  }

  document.querySelectorAll('#yakBackNav .yak-back-tab').forEach(x=>{
    x.classList.toggle('active',x.dataset.backpage==='online');
  });

  const x=cfg();
  if(E('online500Url')&&!E('online500Url').value)E('online500Url').value=x.url||'';
  if(E('online500Key')&&!E('online500Key').value)E('online500Key').value=x.key||'';
}

function hook(){
  if(typeof window.saveDB!=='function'||window.saveDB.__cloud510)return;

  const old=window.saveDB;
  window.saveDB=function(){
    const r=old.apply(this,arguments);
    if(sb&&!busy&&!pulling){
      setTimeout(()=>push(false),120);
    }
    return r;
  };
  window.saveDB.__cloud510=true;
}

async function copySetup(){
  const x=cfg();
  if(!x.url||!x.key){
    alert('ยังไม่มีการตั้งค่า Cloud ให้คัดลอก');
    return;
  }

  const code=btoa(unescape(encodeURIComponent(JSON.stringify({
    type:'YAK-POS-CLOUD',
    v:1,
    url:x.url,
    key:x.key
  }))));

  try{
    await navigator.clipboard.writeText(code);
    alert('คัดลอกการตั้งค่า Cloud แล้ว\nนำรหัสนี้ไปวางที่เครื่องใหม่ได้เลย');
  }catch(e){
    prompt('คัดลอกรหัสนี้ไปเครื่องใหม่',code);
  }
}

async function importSetup(){
  const code=prompt('วางรหัสการตั้งค่า Cloud ที่คัดลอกจากเครื่องหลัก');
  if(!code)return;

  try{
    const data=JSON.parse(decodeURIComponent(escape(atob(code.trim()))));
    if(data.type!=='YAK-POS-CLOUD'||!data.url||!data.key)throw new Error('bad');
    saveCfg({url:data.url,key:data.key});
    if(E('online500Url'))E('online500Url').value=data.url;
    if(E('online500Key'))E('online500Key').value=data.key;

    if(await conn({url:data.url,key:data.key})){
      await pull(true);
    }
  }catch(e){
    alert('รหัสการตั้งค่าไม่ถูกต้อง');
  }
}

async function boot(){
  hook();

  const x=cfg();

  if(E('online500Url'))E('online500Url').value=x.url||'';
  if(E('online500Key'))E('online500Key').value=x.key||'';

  if(x.url&&x.key){
    const ok=await conn(x,true);
    if(ok){
      await pull(false);
    }
  }else{
    st('Offline • ตั้งค่า Cloud ครั้งแรก 1 ครั้ง');
  }
}

window.YAK_ONLINE_510={
  connectFromForm:form,
  pushLocal:push,
  pullCloud:pull,
  disconnect:off,
  openPage,
  copySetup,
  importSetup
};

// Compatibility for old inline calls / old cached HTML.
window.YAK_ONLINE_500=window.YAK_ONLINE_510;

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',()=>setTimeout(boot,700));
}else{
  setTimeout(boot,700);
}
})();
