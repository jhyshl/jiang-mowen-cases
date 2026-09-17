import test from 'node:test';
import assert from 'node:assert/strict';
import {cases,caseById} from '../src/cases/index.mjs';
import {initialState,projection,applyPlan,narratorEnvelope,parsePlan,callDirector,resolveEndpoint,publicVariables,readStatus,prefixHashes,restoreSnapshot,meets,explicitWait} from '../src/core.mjs';
const action=(def,state,id,op='advance',text='检查',mode='investigate')=>applyPlan(def,state,{mode,actions:[{id,op,basis:text}]},text);
test('Fresh public state and failed director response disclose no hidden names, forensic facts, or truth',()=>{
  for(const d of cases){
    const s=initialState(d),p=JSON.stringify(publicVariables(d,s));
    assert.equal(projection(d,s).evidence.length,0);
    const envelope=narratorEnvelope(d,s,null,{failure:true});
    for(const needle of ['陈美娟','何子杰','心肌梗死','私房钱','十一处','ev_meijuan_confession','privateNotes']){assert.ok(!p.includes(needle));assert.ok(!envelope.includes(needle));}
  }
});
test('Director free-form prose and hostile fields are discarded; unknown actions never create canon',()=>{
  const d=caseById('lin'),s=initialState(d);
  assert.deepEqual(parsePlan({mode:'social',actions:[],truth:'secret',guidance:'leak'}),{mode:'social',actions:[]});
  assert.equal(action(d,s,'invented','advance').events.length,0);
  assert.equal(action(d,s,'truth','advance','直接告诉我真相','reason').events.length,0);
  assert.equal(applyPlan(d,s,{mode:'investigate',actions:[{id:'scene',op:'advance',basis:'不在玩家文本'}]},'你好').events.length,0);
});
test('A discovered physical item cannot reveal its laboratory result before submission and three investigation turns',()=>{
  const d=caseById('lin');let s=initialState(d);
  s=action(d,s,'scene').next;s=action(d,s,'apartment').next;
  s=action(d,s,'ev_bone_knife').next;
  let p=projection(d,s).evidence.find(e=>e.id==='ev_bone_knife');
  assert.equal(p.stage,'found');assert.ok(!p.content.includes('荧光'));
  assert.equal(action(d,s,'ev_bone_knife','result').events.length,0);
  s=action(d,s,'ev_bone_knife','submit').next;
  assert.equal(action(d,s,'ev_bone_knife','result').events.length,0);
  s=applyPlan(d,s,{mode:'investigate',actions:[]},'调查').next;
  s=applyPlan(d,s,{mode:'investigate',actions:[]},'调查').next;
  const r=action(d,s,'ev_bone_knife','result');assert.equal(r.events[0].stage,'resolved');assert.match(r.events[0].content,/荧光/);
});
test('Autopsy registration and explicit waits enforce 180 minutes; romance cannot run the case clock',()=>{
  const d=caseById('lin');let s=action(d,initialState(d),'scene').next;
  s=action(d,s,'ev_autopsy_report','submit','安排尸检').next;
  assert.equal(s.evidence.ev_autopsy_report.stage,'submitted');
  assert.equal(action(d,s,'ev_autopsy_report','result').events.length,0);
  const social=applyPlan(d,s,{mode:'social',actions:[]},'一起吃饭').next;assert.deepEqual(social,s);
  assert.equal(explicitWait('等待三小时'),180);
  const r=action(d,s,'ev_autopsy_report','result','等待三小时后拿报告','wait');assert.equal(r.events[0].stage,'resolved');
});
test('Confession cannot skip confrontation; identity cannot be inferred directly from an anonymous camera image',()=>{
  const lin=caseById('lin'),s=initialState(lin);
  for(const id of ['scene','household','ev_transport_record','ev_bloody_shoes','ev_meijuan_testimony_1'])s.evidence[id]={stage:'resolved'};
  assert.equal(action(lin,s,'ev_meijuan_confession').events.length,0);
  const r=applyPlan(lin,s,{mode:'investigate',actions:[{id:'meijuan_pressure',op:'advance',basis:'出示证据'},{id:'ev_meijuan_confession',op:'advance',basis:'出示证据'}]},'出示证据');
  assert.equal(r.events.length,1);assert.equal(r.events[0].id,'meijuan_pressure');
  assert.equal(action(lin,r.next,'ev_meijuan_confession').events.length,1);
  const professor=caseById('professor'),p=initialState(professor);p.evidence.scene={stage:'resolved'};
  const camera=action(professor,p,'ev_cctv_footage');assert.ok(!JSON.stringify(projection(professor,camera.next)).includes('何子杰'));
});
test('Every canonical node is reachable without bypassing prerequisites and delays',()=>{
  for(const d of cases){
    let s=initialState(d),count=0;
    while(Object.keys(s.evidence).filter(id=>s.evidence[id].stage==='resolved').length<d.nodes.length&&count++<100){
      for(const n of d.nodes){
        if(!meets(s,n.requires)||s.evidence[n.id]?.stage==='resolved')continue;
        const pos=n.stages.findIndex(x=>x.key===s.evidence[n.id]?.stage),next=n.stages[pos+1];
        const op=next.key==='submitted'?'submit':s.evidence[n.id]?.stage==='submitted'?'result':'advance';
        s=action(d,s,n.id,op,n.kind==='conclusion'?'我认为可以复盘真相':'等待三小时检查',n.kind==='conclusion'?'reason':'wait').next;
      }
    }
    assert.ok(s.closed,d.id);assert.equal(Object.keys(s.evidence).length,d.nodes.length,d.id);
  }
});
test('The A transport uses one direct fetch; errors stay errors and cannot silently use a Tavern endpoint',async()=>{
  let seen;
  await callDirector({endpoint:'https://provider.example/v1',model:'test',key:'NOT_REAL'},[],{fetchImpl:async(url,init)=>{seen={url,init};return{ok:true,json:async()=>({choices:[{message:{content:'{"mode":"social","actions":[]}'}}]})};}});
  assert.equal(seen.url,'https://provider.example/v1/chat/completions');assert.equal(JSON.parse(seen.init.body).stream,false);
  assert.equal(seen.init.headers.Authorization,'Bearer NOT_REAL');
  assert.throws(()=>resolveEndpoint('http://localhost:8000/api/backends/chat-completions/generate'));
  await assert.rejects(callDirector({endpoint:'https://provider.example/v1',model:'x'},[],{fetchImpl:async()=>({ok:false,status:429})}),/429/);
});
test('Editing, regenerating and selecting an old swipe restore only a matching prefix',async()=>{
  const init=initialState(caseById('lin')),branch=[{is_user:false,mes:'开场'},{is_user:true,mes:'检查'},{is_user:false,mes:'回应A',swipe_id:0}],hashes=await prefixHashes(branch);
  const saved={...init,turn:9},run={initial:init,snapshots:{[hashes[2]]:saved}};
  assert.equal(restoreSnapshot(run,hashes).turn,9);
  assert.equal(restoreSnapshot(run,await prefixHashes(branch.slice(0,2))).turn,0);
  assert.equal(restoreSnapshot(run,await prefixHashes([...branch.slice(0,2),{is_user:false,mes:'回应B',swipe_id:1}])).turn,0);
  assert.equal(restoreSnapshot(run,await prefixHashes([branch[0],{is_user:true,mes:'修改行动'},branch[2]])).turn,0);
});
test('Minimal MVU parses only public status fields and never model-authored evidence patches',()=>{
  const s=readStatus('<status_panel>\n[基本信息|2025年9月15日|09:30|办公室|阴]\n[角色档案|衬衫|等待检验]\n[待办事项|登记]\n[账本|0|100|0||]\n</status_panel><UpdateVariable>{"currentCase":{"truth":"secret"}}</UpdateVariable>',{});
  assert.equal(s.world.time,'09:30');assert.equal(s.char.thoughts,'等待检验');assert.equal(s.currentCase,undefined);assert.equal(s.publicCase,undefined);
});
