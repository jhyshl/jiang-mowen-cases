import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import vm from 'node:vm';
test('Published manifest, full bundle, receiver fallback and standalone helper export match byte-for-byte',async()=>{
  const m=JSON.parse(await readFile('dist/manifest.json','utf8'));
  const runtime=await readFile(new URL(m.urls[0]).pathname.replace('/jiang-mowen-cases/',''),'utf8');
  assert.equal(createHash('sha256').update(runtime).digest('hex'),m.sha256);
  const receiver=await readFile('dist/receiver.js','utf8');
  new vm.Script(receiver);new vm.Script(runtime);
  const gzip=receiver.match(/BUILTIN="([A-Za-z0-9+/=]+)"/)[1];
  assert.equal(gunzipSync(Buffer.from(gzip,'base64')).toString('utf8'),runtime);
  const script=JSON.parse(await readFile('dist/receiver.tavern.json','utf8'));assert.equal(script.content,receiver);assert.deepEqual(script.button.buttons,[]);
  assert.ok(!runtime.includes('generateRaw'));assert.ok(!runtime.includes('ConnectionManager'));assert.ok(!runtime.includes('getRequestHeaders'));
});
test('Importable character card retains unrelated content but removes legacy omniscient MVU and buttons',async t=>{
  const originalPath=process.env.JMW_CARD_SOURCE;
  if(!originalPath){t.skip('Set JMW_CARD_SOURCE when validating a personal card export');return;}
  const original=JSON.parse(await readFile(originalPath,'utf8')),card=JSON.parse(await readFile('output/蒋莫闻-案件后台重构-v1.0.0.json','utf8'));
  const a=original.data,b=card.data;
  for(const key of ['name','description','personality','scenario','mes_example','system_prompt','post_history_instructions'])assert.equal(b[key],a[key],key);
  assert.equal(JSON.stringify(b.alternate_greetings),JSON.stringify(a.alternate_greetings),'all original greetings preserved');
  for(const id of [0,2,6,8,25,45,121681,394303,668183,707295,728963,951497])assert.deepEqual(b.character_book.entries.find(e=>e.id===id),a.character_book.entries.find(e=>e.id===id),'worldbook '+id);
  const scripts=b.extensions.tavern_helper.scripts;assert.equal(scripts.length,1);assert.ok(scripts[0].name.includes('接收器'));assert.equal(scripts[0].enabled,true);assert.equal(scripts[0].content,await readFile('dist/receiver.js','utf8'));
  assert.deepEqual(b.extensions.tavern_helper.variables,a.extensions.tavern_helper.variables);
  for(const regex of a.extensions.regex_scripts.filter(r=>!['不发送变量（mvu）','状态栏新（mvu）'].includes(r.scriptName))){const expected=structuredClone(regex);if(expected.scriptName==='开场白美化')expected.replaceString=expected.replaceString.replace(/<head\s*\n/,'<head>\n');assert.deepEqual(b.extensions.regex_scripts.find(r=>r.id===regex.id),expected);}
  const publicPrompt=[b.description,b.personality,b.scenario,b.system_prompt,b.post_history_instructions,...b.character_book.entries.filter(e=>e.enabled).map(e=>e.content)].join('\n');
  for(const secret of ['陈美娟','何子杰','心肌梗死','ev_bone_knife','JSONPatch>','format_message_variable::stat_data'])assert.ok(!publicPrompt.includes(secret),'primary leak: '+secret);
  assert.ok(publicPrompt.includes('JMW_CARD_V1'));
  const config=JSON.parse(b.first_mes.match(/<div id="archive-config"[^>]*>([\s\S]*?)<\/div>/)[1]);assert.equal(config.length,6);assert.equal(config.at(-1).index,6);
  assert.equal(card.first_mes,b.first_mes);assert.equal(card.description,b.description);
});
