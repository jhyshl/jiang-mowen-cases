// 蒋莫闻完整脚本接收器。内置可运行首版；在线更新使用固定仓库的 SHA-256 清单。
;(async()=>{
  const SOURCE=window;
  let host=window;
  for(let i=0;i<5;i++){try{if(host.SillyTavern?.getContext)break;if(host.parent===host)break;host=host.parent;}catch{break;}}
  if(!host.SillyTavern?.getContext)throw new Error('蒋莫闻接收器：未找到酒馆，请启用酒馆助手脚本');
  const SLOT='__JMW_RECEIVER_V1__';
  if(host[SLOT]){host[SLOT].show?.();return;}
  const VERSION=__BUILTIN_VERSION__,BUILTIN=__BUILTIN_GZIP__,BUILTIN_SHA=__BUILTIN_SHA__;
  const MANIFESTS=__MANIFEST_URLS__;
  const bridge={
    getVariables:typeof getVariables==='function'?getVariables:undefined,
    replaceVariables:typeof replaceVariables==='function'?replaceVariables:undefined,
    events:typeof tavern_events==='object'?tavern_events:undefined
  };
  let runtime=null,checking=false,stopped=false,db=null,scheduled=null;
  const owner={version:VERSION,show:()=>runtime?.show(),checkUpdate:check,get busy(){return runtime?.busy||false;},shutdown};host[SLOT]=owner;
  const hash=async text=>Array.from(new Uint8Array(await host.crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),n=>n.toString(16).padStart(2,'0')).join('');
  const bundled=async()=>{
    const bytes=Uint8Array.from(atob(BUILTIN),c=>c.charCodeAt(0));
    return new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
  };
  async function database(){
    return new Promise((resolve,reject)=>{const r=host.indexedDB.open('jmw-receiver',1);r.onupgradeneeded=()=>r.result.createObjectStore('bundle');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  }
  async function cache(mode,key,value){
    if(!db)return null;
    return new Promise((resolve,reject)=>{const tx=db.transaction('bundle',mode),s=tx.objectStore('bundle'),r=mode==='readonly'?s.get(key):s.put(value,key);let result;r.onsuccess=()=>{result=r.result;};tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);});
  }
  async function run(bundle){
    if(stopped)return;
    if(await hash(bundle.code)!==bundle.sha256)throw new Error('完整脚本校验失败');
    // Releases are trusted code from the configured author's repository, never model output.
    const boot=new Function(bundle.code+'\nreturn JMWBundle.bootstrap;')();
    const previous=runtime;runtime=null;await previous?.shutdown();
    try{runtime=await boot({host,bridge,checkUpdate:check});owner.version=bundle.version;}
    catch(e){runtime=null;throw e;}
  }
  const allowed=url=>{
    const u=new URL(url);
    return u.protocol==='https:'&&(
      u.origin==='https://jhyshl.github.io'&&u.pathname.startsWith('/jiang-mowen-cases/')||
      ['https://cdn.jsdelivr.net','https://gcore.jsdelivr.net','https://testingcf.jsdelivr.net'].includes(u.origin)&&u.pathname.startsWith('/gh/jhyshl/jiang-mowen-cases@')||
      u.origin==='https://raw.githubusercontent.com'&&u.pathname.startsWith('/jhyshl/jiang-mowen-cases/')
    );
  };
  const newer=(next,current)=>{const a=String(next).split('.').map(Number),b=String(current).split('.').map(Number);return a.length===3&&a.every(Number.isFinite)&&a.some((v,i)=>v>(b[i]||0)&&a.slice(0,i).every((x,j)=>x===(b[j]||0)));};
  async function get(url,json=false){
    if(!allowed(url))throw new Error('更新地址不在此接收器的发布仓库内');
    const abort=new AbortController(),t=host.setTimeout(()=>abort.abort(),15000);
    try{const r=await host.fetch(url,{cache:'no-cache',signal:abort.signal,credentials:'omit'});if(!r.ok)throw new Error('更新下载 HTTP '+r.status);return json?r.json():r.text();}finally{host.clearTimeout(t);}
  }
  async function check(manual=false){
    if(checking||stopped)return;checking=true;
    try{
      let manifest,lastError;
      for(const url of MANIFESTS){try{const m=await get(url,true);if(m.schema!==1||!m.version||!/^[a-f0-9]{64}$/.test(m.sha256)||!Array.isArray(m.urls)||m.urls.length>5)throw new Error('版本清单格式不正确');manifest=m;break;}catch(e){lastError=e;}}
      if(!manifest)throw lastError||new Error('无法取得更新清单');
      if(!newer(manifest.version,owner.version)){if(manual)host.toastr?.info?.('当前已是最新完整脚本 '+owner.version,'蒋莫闻');return;}
      let code;
      for(const url of manifest.urls){try{const text=await get(url);if(text.length>4_000_000||await hash(text)!==manifest.sha256)throw new Error('更新校验失败');code=text;break;}catch(e){lastError=e;}}
      if(!code)throw lastError||new Error('无法下载完整脚本');
      scheduled={code,sha256:manifest.sha256,version:manifest.version};
      if(!runtime?.busy)await installScheduled();else if(manual)host.toastr?.info?.('新版已下载，本轮结束后自动更新','蒋莫闻');
    }catch(e){if(manual)throw e;console.warn('[蒋莫闻接收器] 在线检查未完成，继续使用已校验版本：',e.message);}finally{checking=false;}
  }
  async function installScheduled(){
    if(!scheduled||runtime?.busy||stopped)return;
    const next=scheduled;scheduled=null;const old=await cache('readonly','lastGood');
    try{await run(next);if(old)await cache('readwrite','previous',old);await cache('readwrite','lastGood',next);host.toastr?.success?.('完整脚本已更新至 '+next.version,'蒋莫闻');}
    catch(e){const fallback=old||{code:await bundled(),sha256:BUILTIN_SHA,version:VERSION};await run(fallback);throw e;}
  }
  let poll,settle,focus;
  async function shutdown(){stopped=true;host.clearInterval(poll);host.clearInterval(settle);host.removeEventListener('focus',focus);host.removeEventListener('online',focus);await runtime?.shutdown();db?.close();if(host[SLOT]===owner)delete host[SLOT];}
  try{
    try{db=await database();}catch(e){console.warn('[蒋莫闻接收器] 更新缓存不可用',e.message);}
    let loaded=false;
    for(const key of ['lastGood','previous']){try{const saved=await cache('readonly',key);if(saved?.code){await run(saved);loaded=true;break;}}catch(e){console.warn('[蒋莫闻接收器] 缓存版本未启动',e.message);}}
    if(!loaded)await run({code:await bundled(),sha256:BUILTIN_SHA,version:VERSION});
    let lastCheck=0;focus=()=>{if(Date.now()-lastCheck>600000){lastCheck=Date.now();void check().catch(console.warn);}};
    poll=host.setInterval(focus,600000);settle=host.setInterval(()=>{if(scheduled&&!runtime?.busy)void installScheduled().catch(e=>host.toastr?.error?.(e.message,'蒋莫闻更新'));},2000);
    host.addEventListener('focus',focus);host.addEventListener('online',focus);focus();
    SOURCE.addEventListener('pagehide',()=>{void shutdown();},{once:true});
  }catch(e){await shutdown();host.toastr?.error?.(e.message,'蒋莫闻接收器启动失败');console.error(e);}
})();
