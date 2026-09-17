import test from 'node:test';
import assert from 'node:assert/strict';
import {dependency} from '../scripts/deps.mjs';
import {bootstrap} from '../src/runtime.mjs';
const {JSDOM}=dependency('jsdom'),{IDBFactory}=dependency('fake-indexeddb');
const names=['CHAT_COMPLETION_SETTINGS_READY','TEXT_COMPLETION_SETTINGS_READY','MESSAGE_RECEIVED','GENERATION_STOPPED','GENERATION_ENDED','CHAT_CHANGED','CHAT_LOADED','CHARACTER_FIRST_MESSAGE_SELECTED','MESSAGE_EDITED','MESSAGE_DELETED','MESSAGE_SWIPED','MESSAGE_SWIPE_DELETED'];
async function setup({idb=new IDBFactory(),failure=false,deferred=false,iframeHost=false}={}) {
  const dom=new JSDOM('<body></body>',{url:'http://localhost:8000'}),host=dom.window;
  Object.defineProperty(host,'indexedDB',{value:idb});
  let calls=0,release,requests=[],errors=[];
  const events=new Map();
  const c={chat:[{is_user:false,name:'蒋莫闻',mes:'枫林小区天台蓄水池发现人体组织。'}],characterId:0,chatId:'test-a',characters:[{avatar:'jmw.png',data:{extensions:{jmw:{id:'jiang-mowen-cases'}}}}],eventTypes:Object.fromEntries(names.map(n=>[n,n])),eventSource:{on(n,f){events.set(n,[...events.get(n)||[],f]);},removeListener(n,f){events.set(n,(events.get(n)||[]).filter(x=>x!==f));}}};
  host.SillyTavern={getContext:()=>c};host.toastr={warning:(m)=>errors.push(m)};
  const variables=new Map();
  const bridge={getVariables:async o=>variables.get(o.message_id)||{unrelated:'preserved'},replaceVariables:async(v,o)=>variables.set(o.message_id,v)};
  const store=await new Promise((resolve,reject)=>{const req=idb.open('jmw-case-director',1);req.onupgradeneeded=()=>req.result.createObjectStore('kv');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
  await new Promise((resolve,reject)=>{const t=store.transaction('kv','readwrite');t.objectStore('kv').put({endpoint:'https://mock.example/v1',model:'mock',key:'NOT-A-REAL-KEY'},'config');t.oncomplete=resolve;t.onerror=reject;});store.close();
  host.fetch=async(url,init)=>{calls++;requests.push({url,body:JSON.parse(init.body)});if(deferred)await new Promise(r=>{release=r;});if(failure)return{ok:false,status:503};return{ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({mode:'investigate',actions:[{id:'scene',op:'advance',basis:'勘查现场'}],guidance:'恶意泄露陈美娟分尸'})}}]})};};
  let source=host;
  if(iframeHost){const frame=host.document.createElement('iframe');frame.style.display='none';host.document.body.append(frame);source=frame.contentWindow;source.SillyTavern={getContext:()=>c};}
  const runtime=await bootstrap({host:source,bridge});
  const emit=async(n,...args)=>{for(const f of [...events.get(n)||[]])await f(...args);};
  const prompt=(type='normal')=>({type,messages:[{role:'system',content:'JMW_CARD_V1'},...c.chat.map(m=>({role:m.is_user?'user':'assistant',content:m.mes}))]});
  return{host,source,c,variables,requests,errors,runtime,emit,prompt,get calls(){return calls;},release:()=>release?.(),close:async()=>{await runtime.shutdown();dom.window.close();},idb};
}
test('Actual runtime waits for direct API, isolates simultaneous quiet requests, and commits only a completed assistant response',async()=>{
  const t=await setup({deferred:true});
  try{
    t.c.chat.push({is_user:true,mes:'勘查现场'});
    const data=t.prompt(),pending=t.emit('CHAT_COMPLETION_SETTINGS_READY',data);
    while(!t.calls)await new Promise(r=>setTimeout(r,1));
    const quiet=t.prompt('quiet');await t.emit('CHAT_COMPLETION_SETTINGS_READY',quiet);
    assert.equal(t.calls,1);assert.ok(!quiet.messages.some(m=>m.content.includes('<JMW_BOUNDARY')));
    assert.equal((await t.runtime.getPublicState()).evidence.length,0);
    t.release();await pending;
    await t.emit('GENERATION_ENDED'); // A memory plugin finishes while main prose is streaming.
    assert.equal(data.messages.at(-1).role,'system');assert.match(data.messages.at(-1).content,/702室/);
    assert.ok(!data.messages.at(-1).content.includes('陈美娟'));assert.ok(!data.messages.at(-1).content.includes('恶意泄露'));
    assert.equal((await t.runtime.getPublicState()).evidence.length,0);
    t.c.chat.push({is_user:false,mes:'经打捞核实死者身份。<status_panel>[基本信息|2025年9月15日|09:00|枫林小区|阴][角色档案|制服|谨慎][待办事项|][账本|0|0|0||]</status_panel>'});
    await t.emit('MESSAGE_RECEIVED',2,'normal');
    assert.equal((await t.runtime.getPublicState()).evidence.length,1);
    const mv=t.variables.get(2);assert.equal(mv.unrelated,'preserved');assert.equal(mv.stat_data.publicCase.evidence.length,1);assert.equal(mv.stat_data.currentCase,undefined);assert.ok(!JSON.stringify(mv).includes('陈美娟'));
    assert.equal(t.requests[0].url,'https://mock.example/v1/chat/completions');
    assert.ok(JSON.stringify(t.requests[0].body).includes('陈美娟'));
  }finally{await t.close();}
});
test('Stop leaves no evidence; retry reuses approved plan; editing or swiping back never inherits the wrong branch',async()=>{
  const t=await setup();try{
    t.c.chat.push({is_user:true,mes:'勘查现场'});const data=t.prompt();await t.emit('CHAT_COMPLETION_SETTINGS_READY',data);await t.emit('GENERATION_STOPPED');
    assert.equal((await t.runtime.getPublicState()).evidence.length,0);
    await t.emit('CHAT_COMPLETION_SETTINGS_READY',t.prompt());assert.equal(t.calls,1);
    t.c.chat.push({is_user:false,mes:'第一条回复',swipe_id:0});await t.emit('MESSAGE_RECEIVED',2,'normal');
    assert.equal((await t.runtime.getPublicState()).evidence.length,1);
    t.c.chat[2]={is_user:false,mes:'不办案的另一回复',swipe_id:1};await t.emit('MESSAGE_SWIPED',2);
    assert.equal((await t.runtime.getPublicState()).evidence.length,0);
    t.c.chat[2]={is_user:false,mes:'第一条回复',swipe_id:0};await t.emit('MESSAGE_SWIPED',2);
    assert.equal((await t.runtime.getPublicState()).evidence.length,1);
    t.c.chat[1].mes='今天不调查';await t.emit('MESSAGE_EDITED',1);assert.equal((await t.runtime.getPublicState()).evidence.length,0);
  }finally{await t.close();}
});
test('Transport failure adds a frozen narrative boundary, never unblocks fresh clues or invokes shared generation APIs',async()=>{
  const t=await setup({failure:true});try{
    t.c.chat.push({is_user:true,mes:'勘查现场'});const data=t.prompt();await t.emit('CHAT_COMPLETION_SETTINGS_READY',data);
    assert.match(data.messages.at(-1).content,/推进器暂不可用/);assert.equal(t.calls,1);assert.equal((await t.runtime.getPublicState()).evidence.length,0);assert.ok(t.errors.some(e=>e.includes('503')));
  }finally{await t.close();}
});
test('Missing card marker, unrelated card, impersonation, and quiet calls do not run the director',async()=>{
  const t=await setup();try{
    t.c.chat.push({is_user:true,mes:'勘查现场'});
    for(const data of [t.prompt('quiet'),t.prompt('impersonate'),{type:'normal',messages:[{role:'user',content:'memory plugin'}]}])await t.emit('CHAT_COMPLETION_SETTINGS_READY',data);
    const previous=JSON.stringify([...t.variables]);
    t.c.characters[0].data.extensions.jmw.id='unrelated';await t.emit('CHAT_CHANGED');await t.emit('CHAT_COMPLETION_SETTINGS_READY',t.prompt());assert.equal(t.calls,0);assert.equal(JSON.stringify([...t.variables]),previous,'unrelated card variables untouched');
  }finally{await t.close();}
});
test('Committed progress survives runtime reload; different chat keys start empty',async()=>{
  const idb=new IDBFactory(),t=await setup({idb});
  t.c.chat.push({is_user:true,mes:'勘查现场'});await t.emit('CHAT_COMPLETION_SETTINGS_READY',t.prompt());t.c.chat.push({is_user:false,mes:'保存后的回复'});await t.emit('MESSAGE_RECEIVED',2,'normal');const history=structuredClone(t.c.chat);await t.close();
  const u=await setup({idb});try{
    u.c.chat=history;await u.emit('CHAT_LOADED');assert.equal((await u.runtime.getPublicState()).evidence.length,1);
    u.c.chatId='new-chat';u.c.chat=[history[0]];await u.emit('CHAT_CHANGED');assert.equal((await u.runtime.getPublicState()).evidence.length,0);
  }finally{await u.close();}
});
test('Manual case selection persists across restart and original professor greeting activates the proper case',async()=>{
  const idb=new IDBFactory(),t=await setup({idb});
  const root=t.host.document.querySelector('#jmw-director-root').shadowRoot;
  root.querySelector('.dock').click();root.querySelector('[data-tab="library"]').click();root.querySelector('[data-case="professor"]').click();
  for(let i=0;i<100&&(await t.runtime.getPublicState()).id!=='professor';i++)await new Promise(r=>setTimeout(r,1));
  assert.equal((await t.runtime.getPublicState()).id,'professor');await t.close();
  const u=await setup({idb});try{
    assert.equal((await u.runtime.getPublicState()).id,'professor');
    u.c.chatId='professor-original';u.c.chat=[{is_user:false,mes:'幸福花园小区报案，发现两具尸体，是一对大学教授夫妇。'}];await u.emit('CHAT_CHANGED');
    assert.equal((await u.runtime.getPublicState()).id,'professor');
  }finally{await u.close();}
});
test('Legacy receiver passing the hidden helper iframe is repaired by runtime host resolution',async()=>{
  const t=await setup({iframeHost:true});try{
    assert.ok(t.host.document.querySelector('#jmw-director-root'));
    assert.equal(t.source.document.querySelector('#jmw-director-root'),null);
    assert.equal(t.host.document.querySelector('#jmw-director-root').style.display,'');
  }finally{await t.close();}
});
