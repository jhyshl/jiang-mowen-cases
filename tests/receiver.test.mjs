import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {webcrypto,createHash} from 'node:crypto';
import {dependency} from '../scripts/deps.mjs';
const {JSDOM}=dependency('jsdom'),{IDBFactory}=dependency('fake-indexeddb');
const sha=s=>createHash('sha256').update(s).digest('hex');
async function poll(check){for(let i=0;i<200;i++){if(check())return;await new Promise(r=>setTimeout(r,5));}throw new Error('Receiver did not become ready');}
test('Actual receiver boots offline, upgrades a verified full bundle, and restores last good code after a bad release',async()=>{
  const dom=new JSDOM('<body></body>',{url:'http://localhost:8000',runScripts:'outside-only'}),w=dom.window,idb=new IDBFactory();
  Object.defineProperty(w,'indexedDB',{value:idb});Object.defineProperty(w,'crypto',{value:webcrypto});
  Object.assign(w,{TextEncoder,TextDecoder,Response,Blob,DecompressionStream});
  const errors=[],events=new Map(),eventTypes={CHAT_COMPLETION_SETTINGS_READY:'settings',MESSAGE_RECEIVED:'received'};
  w.SillyTavern={getContext:()=>({chatId:'offline',characterId:0,characters:[{avatar:'jmw.png',data:{extensions:{jmw:{id:'jiang-mowen-cases'}}}}],chat:[{is_user:false,mes:'枫林小区天台蓄水池发现人体组织。'}],eventTypes,eventSource:{on(k,f){events.set(k,[...events.get(k)||[],f]);},removeListener(k,f){events.set(k,(events.get(k)||[]).filter(x=>x!==f));}}})};
  w.toastr={warning:m=>errors.push(m),error:m=>errors.push(m),success:()=>{}};
  w.console.warn=()=>{};
  let online=false,version='1.1.0',code='var JMWBundle={bootstrap:async()=>({version:"1.1.0",busy:false,show(){},async shutdown(){}})};';
  w.fetch=async url=>{if(!online)throw new Error('Offline fixture');return String(url).endsWith('manifest.json')?{ok:true,json:async()=>({schema:1,version,sha256:sha(code),urls:['https://jhyshl.github.io/jiang-mowen-cases/dist/test.js']})}:{ok:true,text:async()=>code};};
  try{
    w.eval(await readFile('dist/receiver.js','utf8'));
    await poll(()=>w.document.querySelector('#jmw-director-root'));
    const receiver=w.__JMW_RECEIVER_V1__;assert.equal(receiver.version,'1.0.0');
    // Let the automatic offline check finish before requesting an online check.
    await new Promise(r=>setTimeout(r,20));online=true;
    await receiver.checkUpdate(true);assert.equal(receiver.version,'1.1.0');assert.ok(!w.document.querySelector('#jmw-director-root'));
    version='1.2.0';code='var JMWBundle={bootstrap:async()=>{throw new Error("Bad test release")}};';
    await assert.rejects(receiver.checkUpdate(true),/Bad test release/);assert.equal(receiver.version,'1.1.0');
    await receiver.shutdown();assert.equal(w.__JMW_RECEIVER_V1__,undefined);
    assert.equal(errors.length,0);
  }finally{await w.__JMW_RECEIVER_V1__?.shutdown();dom.window.close();}
});
