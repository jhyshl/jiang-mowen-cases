import {cases,caseById} from './cases/index.mjs';
import {initialState,projection,publicVariables,parsePlan,applyPlan,narratorEnvelope,directorMessages,callDirector,resolveEndpoint,readStatus,digest,prefixHashes,restoreSnapshot,clone} from './core.mjs';
import {openStorage} from './storage.mjs';
import {mountUI} from './ui.mjs';
import {resolveTavernHost} from './host.mjs';
export const VERSION=typeof __JMW_VERSION__==='string'?__JMW_VERSION__:'1.0.2';
const ACTIVE_TYPES=new Set([undefined,'','normal','regenerate','swipe','continue']);
const MARKER='JMW_CARD_V1';

export async function bootstrap(env) {
  const host=resolveTavernHost(env.host),bridge=env.bridge||{},ctx=()=>host.SillyTavern?.getContext();
  if(!ctx()?.eventSource) throw new Error('酒馆尚未就绪，找不到 SillyTavern.getContext()');
  const storage=await openStorage(host),disposers=[];
  let config={endpoint:'',model:'',key:'',remember:false,...await storage.get('config')};
  let session=null,sessionKey=null,pending=null,busy=false,controller=null,epoch=0,dead=false,status='案件后台已就绪';
  let queue=Promise.resolve(),syncQueue=Promise.resolve(),ui;
  const write=(key,value)=>{const copy=clone(value);queue=queue.catch(()=>{}).then(()=>storage.set(key,copy));return queue;};
  const character=()=>{const c=ctx();return c?.characters?.[c.characterId];};
  const target=()=>{const c=character();return c?.data?.extensions?.jmw?.id==='jiang-mowen-cases'||c?.extensions?.jmw?.id==='jiang-mowen-cases';};
  const chatKey=()=>{
    const c=ctx(),id=c?.getCurrentChatId?.()||c?.chatId;
    return id?`${character()?.avatar||c.characterId}:${String(id)}`:null;
  };
  const report=error=>{status=error instanceof Error?error.message:String(error);host.toastr?.warning?.(status,'蒋莫闻 · 案卷');render();};
  const run=()=>session?.selected?session.runs[session.selected]:null;
  const def=()=>caseById(session?.selected);
  async function currentState(messages=ctx()?.chat||[]) {
    const r=run();return r?restoreSnapshot(r,await prefixHashes(messages)):null;
  }
  async function render() {
    if(dead||!ui)return;
    const state=await currentState();
    ui.update({version:VERSION,status,busy,cases:cases.map(({id,title,name,start})=>({id,title,name,start})),config,publicCase:projection(def(),state),scene:state?.scene});
    ui.root.style.display=target()?'':'none';
  }
  function ensureRun(id) {
    const d=caseById(id);if(!d)throw new Error('未识别的案件');
    if(!session.runs[id])session.runs[id]={initial:initialState(d),snapshots:{},plans:{}};
    if(session.runs[id].initial.caseVersion!==d.version)throw new Error('此案存档版本不兼容，请导出进度并按发布说明迁移');
    return session.runs[id];
  }
  function detectGreeting() {
    const first=String(ctx()?.chat?.[0]?.mes||'');
    if(first.includes('【开场主页】'))return null;
    if(/枫林小区/.test(first)&&/(蓄水池|天台|人腿)/.test(first))return 'lin';
    if(/幸福花园/.test(first)&&/莫钰|教授夫妇|两具尸体/.test(first))return 'professor';
    return null;
  }
  async function syncNow() {
    if(dead)return;
    if(!target()){session=null;sessionKey=null;await render();return;}
    const key=chatKey();if(!key)return;
    if(sessionKey!==key) {
      epoch++;controller?.abort();pending=null;sessionKey=key;
      session=await storage.get('chat:'+key)||{schema:1,selected:null,runs:{},greetingHash:''};
    }
    const first=String(ctx()?.chat?.[0]?.mes||'');
    const greetingHash=await digest(first);
    if(session.greetingHash!==greetingHash) {
      session.greetingHash=greetingHash;session.selected=detectGreeting();if(session.selected)ensureRun(session.selected);
      await write('chat:'+key,session);
    }
    await render();
  }
  const sync=()=>{syncQueue=syncQueue.catch(()=>{}).then(syncNow);return syncQueue;};
  async function selectCase(id) {
    if(busy)throw new Error('请等本轮正文完成后再切换案件');
    await sync();if(!session)throw new Error('请先进入蒋莫闻的聊天');
    if(id)ensureRun(id);session.selected=id;epoch++;pending=null;
    await write('chat:'+sessionKey,session);
    status=id?`已进入${caseById(id).title}。在聊天里描述调查行动即可。`:'日常模式：不调用案件推进器';
    await project();await render();
  }
  async function project(stateOverride,messageId) {
    if(!target()||!bridge.replaceVariables||!bridge.getVariables)return;
    const state=stateOverride||await currentState();
    const index=Number.isInteger(messageId)?messageId:(ctx()?.chat?.length||0)-1;
    if(index<0)return;
    const options={type:'message',message_id:index};
    try {
      const variables=await bridge.getVariables(options)||{};
      // Preserve unrelated variables; replace only the old all-seeing MVU stat_data.
      variables.stat_data=publicVariables(def(),state);
      await bridge.replaceVariables(variables,options);
    } catch(error) {report(new Error('案卷已保存，但公开变量同步失败：'+error.message));}
  }
  function commandCase(text) {
    if(/^\s*(?:加载|开始|进入|切换到?)\s*(?:林小女案|枫林小区蓄水池藏尸案)[。！!\s]*$/.test(text))return 'lin';
    if(/^\s*(?:加载|开始|进入|切换到?)\s*(?:教授夫妇案|北城幸福花园小区入室抢劫杀人案)[。！!\s]*$/.test(text))return 'professor';
    return undefined;
  }
  function append(data,envelope,isText=false) {
    if(isText)data.prompt=String(data.prompt||'')+'\n\n'+envelope+'\n';
    else data.messages=[...data.messages.filter(m=>!(m.role==='system'&&typeof m.content==='string'&&m.content.startsWith('<JMW_BOUNDARY'))),{role:'system',content:envelope}];
  }
  async function prepare(data,isText=false) {
    if(dead||!target()||!ACTIVE_TYPES.has(data?.type))return;
    if(isText?typeof data?.prompt!=='string':!Array.isArray(data?.messages))return;
    // The marker protects other cards and auxiliary calls that omit this card's context.
    const containsMarker=isText?data.prompt.includes(MARKER):data.messages.some(m=>typeof m.content==='string'&&m.content.includes(MARKER));
    if(!containsMarker)return;
    await sync();if(!session)return;
    let messages=ctx().chat.slice();
    if(['regenerate','swipe'].includes(data.type)&&messages.length>1&&!messages.at(-1).is_user)messages=messages.slice(0,-1);
    const lastUser=messages.findLast(m=>m.is_user),text=String(lastUser?.mes||'');
    const requested=commandCase(text);
    if(requested&&session.selected!==requested&&!busy) {
      session.selected=requested;ensureRun(requested);await write('chat:'+sessionKey,session);
    }
    if(!def())return;
    const d=def(),r=ensureRun(d.id),hashes=await prefixHashes(messages),key=hashes.at(-1)||'root';
    const base=restoreSnapshot(r,hashes);
    if(data.type==='continue') {append(data,narratorEnvelope(d,base,null,{continuation:true}),isText);return;}
    if(busy&&pending&&!controller) {
      if(pending.key===key&&pending.caseId===d.id){append(data,narratorEnvelope(d,pending.base,pending.result),isText);return;}
      // A new foreground request supersedes an uncommitted failed request. Untyped
      // GENERATION_ENDED events from background plugins must never do this.
      pending=null;busy=false;
    }
    if(busy) {append(data,narratorEnvelope(d,base,null,{failure:true}),isText);return;}
    const myEpoch=epoch,myChat=sessionKey,expectedLength=messages.length;
    busy=true;status='推进器正在确定本轮边界…';await render();
    const requestController=new AbortController();controller=requestController;
    const timer=host.setTimeout(()=>requestController.abort(new Error('副 API 请求超时')),90000);
    try {
      let plan=r.plans[key];
      if(!plan) {
        plan=await callDirector(config,directorMessages(d,base,text,messages.slice(0,-1)),{fetchImpl:host.fetch.bind(host),signal:requestController.signal});
        if(dead||epoch!==myEpoch||sessionKey!==myChat||requestController.signal.aborted)return;
        r.plans[key]=plan;
        await write('chat:'+myChat,session);
      }
      const result=applyPlan(d,base,plan,text);
      append(data,narratorEnvelope(d,base,result),isText);
      // A proposal becomes state only once its associated assistant message completes.
      pending={key,prefixLength:expectedLength,caseId:d.id,chatKey:myChat,epoch:myEpoch,result,base};
      status=result.events.length?`本轮已许可 ${result.events.length} 项内容，等待正文完成后入档`:'本轮不新增线索，等待正文完成';
    } catch(error) {
      if(epoch===myEpoch&&sessionKey===myChat&&!dead) {
        append(data,narratorEnvelope(d,base,null,{failure:true}),isText);
        pending=null;busy=false;report(new Error('案情暂缓：'+(requestController.signal.aborted?'请求已取消或超时':error.message)));
      }
    } finally {host.clearTimeout(timer);if(controller===requestController)controller=null;await render();}
  }
  async function commit(messageId,type) {
    if(!target()||type==='quiet')return;
    const chat=ctx()?.chat||[],index=Number(messageId);
    if(!Number.isInteger(index)||!chat[index]||chat[index].is_user)return;
    const p=pending;
    if(p&&p.epoch===epoch&&p.chatKey===sessionKey&&p.caseId===session?.selected&&index===p.prefixLength) {
      const hashes=await prefixHashes(chat.slice(0,index+1));
      if((hashes[p.prefixLength-1]||'root')!==p.key){pending=null;busy=false;report(new Error('聊天分支已变化，本轮案卷未提交'));return;}
      const next=p.result.next;next.scene=readStatus(chat[index].mes,next.scene);
      const r=ensureRun(p.caseId);r.snapshots[hashes.at(-1)]=clone(next);
      await write('chat:'+sessionKey,session);
      pending=null;busy=false;status=p.result.events.length?'本轮调查记录已入档':'已保存本轮状态，案件未新增事实';
      await project(next,index);await render();return;
    }
    // Daily mode and continuation only parse the narrow public status fields.
    if(!p) {
      const r=run();
      if(r) {const hashes=await prefixHashes(chat.slice(0,index+1)),state=restoreSnapshot(r,hashes);state.scene=readStatus(chat[index].mes,state.scene);r.snapshots[hashes.at(-1)]=state;await write('chat:'+sessionKey,session);await project(state,index);}
      else if(bridge.getVariables&&bridge.replaceVariables) {const options={type:'message',message_id:index};const v=await bridge.getVariables(options)||{};v.stat_data={...readStatus(chat[index].mes,{world:{},char:{},todos:[],ledger:{}}),publicCase:{active:false,evidence:[]}};await bridge.replaceVariables(v,options);}
      await render();
    }
  }
  function on(name,fn) {
    const c=ctx(),event=c.eventTypes?.[name]||bridge.events?.[name];
    if(!event)return false;
    const wrapped=(...args)=>Promise.resolve(fn(...args)).catch(report);
    c.eventSource.on(event,wrapped);disposers.push(()=>c.eventSource.removeListener(event,wrapped));return true;
  }
  async function change() {epoch++;controller?.abort();pending=null;busy=false;await sync();await project();}
  const hasChatHook=on('CHAT_COMPLETION_SETTINGS_READY',data=>prepare(data,false));
  on('TEXT_COMPLETION_SETTINGS_READY',data=>prepare(data,true));
  if(!hasChatHook) {storage.close();throw new Error('当前酒馆缺少 CHAT_COMPLETION_SETTINGS_READY 事件，请升级酒馆后使用');}
  on('MESSAGE_RECEIVED',commit);
  on('GENERATION_STOPPED',()=>{epoch++;controller?.abort();pending=null;busy=false;status='已停止；未完成的案件变更未入档';return render();});
  on('GENERATION_ENDED',()=>render());
  for(const event of ['CHAT_CHANGED','CHAT_LOADED','CHARACTER_FIRST_MESSAGE_SELECTED','MESSAGE_EDITED','MESSAGE_DELETED','MESSAGE_SWIPED','MESSAGE_SWIPE_DELETED'])on(event,change);
  on('MESSAGE_UPDATED',async()=>{
    if(target()&&session&&await digest(String(ctx()?.chat?.[0]?.mes||''))!==session.greetingHash)await change();
  });

  async function saveConfig(value) {
    resolveEndpoint(value.endpoint);if(!value.model.trim())throw new Error('请填写模型名称');
    config={endpoint:value.endpoint,model:value.model,key:value.key,remember:!!value.remember};
    await write('config',{...config,key:config.remember?config.key:''});status='副 API 设置已保存';await render();
  }
  async function testConfig(value) {
    const abort=new AbortController(),timer=host.setTimeout(()=>abort.abort(),30000);
    try{await callDirector(value,[{role:'system',content:'连接测试，只输出 {"mode":"social","actions":[]}'},{role:'user',content:'test'}],{fetchImpl:host.fetch.bind(host),signal:abort.signal});status='连接成功：副 API 可直接访问且返回格式正确';await render();}
    finally{host.clearTimeout(timer);}
  }
  function validateSave(value) {
    if(value?.schema!==1||!value.runs||typeof value.runs!=='object')throw new Error('不兼容的案卷存档');
    const clean={schema:1,selected:caseById(value.selected)?.id||null,runs:{},greetingHash:session.greetingHash};
    for(const [id,r]of Object.entries(value.runs)) {
      const d=caseById(id);if(!d)continue;
      const check=s=>{
        if(s.caseId!==id||s.caseVersion!==d.version||!Number.isSafeInteger(s.turn)||s.turn<0||!Number.isFinite(s.minutes)||s.minutes<0||!s.evidence)throw new Error('案卷状态损坏或版本不兼容');
        for(const [key,e]of Object.entries(s.evidence)){const n=d.nodes.find(n=>n.id===key);if(!n?.stages.some(t=>t.key===e.stage))throw new Error('存档含无效线索阶段');}
        return clone(s);
      };
      clean.runs[id]={initial:check(r.initial),snapshots:Object.fromEntries(Object.entries(r.snapshots||{}).map(([key,s])=>{if(!/^[a-f0-9]{64}$/.test(key))throw new Error('分支标识不正确');return[key,check(s)];})),plans:{}};
    }
    return clean;
  }
  ui=mountUI(host,{report,selectCase,saveConfig,testConfig,
    update:async()=>{await env.checkUpdate?.(true);status='已完成更新检查；若有新版，会在本轮结束后加载';await render();},
    exportSave:async()=>{
      if(!session)throw new Error('当前没有案卷存档');
      const save=clone(session);for(const r of Object.values(save.runs))delete r.plans;
      const blob=new host.Blob([JSON.stringify(save,null,2)],{type:'application/json'}),url=host.URL.createObjectURL(blob),a=host.document.createElement('a');a.href=url;a.download=`蒋莫闻-案卷进度-${Date.now()}.json`;a.click();host.setTimeout(()=>host.URL.revokeObjectURL(url),1000);
    },
    importSave:async text=>{if(busy)throw new Error('请等正文生成结束');if(text.length>20_000_000)throw new Error('存档文件过大');const value=validateSave(JSON.parse(text));if(session)await write('backup:'+sessionKey,session);session=value;await write('chat:'+sessionKey,session);status='存档已导入；当前聊天中的匹配分支会恢复，原存档已在本机备份';await project();await render();}
  });
  await sync();await project();await render();
  return {version:VERSION,get busy(){return busy||!!controller;},show:()=>ui.show(),async shutdown(){dead=true;epoch++;controller?.abort();for(const off of disposers)off();ui.destroy();await queue.catch(()=>{});storage.close();},
    // Public API deliberately contains no private case catalog or hidden state.
    getPublicState:async()=>projection(def(),await currentState())};
}
