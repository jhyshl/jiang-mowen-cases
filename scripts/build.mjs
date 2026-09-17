import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {dependency} from './deps.mjs';
import {cases} from '../src/cases/index.mjs';
import {resolveTavernHost} from '../src/host.mjs';
const {build}=dependency('esbuild');
const {version}=JSON.parse(await readFile('package.json','utf8'));
await mkdir('dist',{recursive:true});await mkdir('output',{recursive:true});
const built=await build({entryPoints:['src/runtime.mjs'],bundle:true,write:false,format:'iife',globalName:'JMWBundle',target:['es2022'],minify:true,legalComments:'none',define:{__JMW_VERSION__:JSON.stringify(version)},plugins:[{name:'compiled-case-catalog',setup(b){b.onLoad({filter:/[\\/]cases[\\/]index\.mjs$/},()=>({contents:`export const cases=${JSON.stringify(cases)};export const caseById=id=>cases.find(c=>c.id===id);`,loader:'js'}));}}]});
const runtime=built.outputFiles[0].text;
const sha=createHash('sha256').update(runtime).digest('hex');
const file=`runtime-${version}-${sha.slice(0,12)}.js`;
await writeFile('dist/'+file,runtime);
const manifest={schema:1,version,sha256:sha,urls:[`https://jhyshl.github.io/jiang-mowen-cases/dist/${file}`,`https://cdn.jsdelivr.net/gh/jhyshl/jiang-mowen-cases@main/dist/${file}`,`https://raw.githubusercontent.com/jhyshl/jiang-mowen-cases/main/dist/${file}`],cases:cases.map(({id,title,version})=>({id,title,version}))};
await writeFile('dist/manifest.json',JSON.stringify(manifest,null,2)+'\n');
let receiver=await readFile('src/receiver.template.js','utf8');
receiver=receiver.replace('__HOST_RESOLVER__',resolveTavernHost.toString());
receiver=receiver.replace('__BUILTIN_VERSION__',JSON.stringify(version)).replace('__BUILTIN_GZIP__',JSON.stringify(gzipSync(runtime).toString('base64'))).replace('__BUILTIN_SHA__',JSON.stringify(sha)).replace('__MANIFEST_URLS__',JSON.stringify(['https://jhyshl.github.io/jiang-mowen-cases/dist/manifest.json','https://raw.githubusercontent.com/jhyshl/jiang-mowen-cases/main/dist/manifest.json']));
await writeFile('dist/receiver.js',receiver);
const receiverScript={type:'script',enabled:true,name:'蒋莫闻 · 完整脚本接收器',id:'e28e452f-d48b-4af0-9efe-2a3ca0c616bc',content:receiver,info:`v${version} · 内置两个案件，A方案直连副API，完整脚本在线更新及离线兜底。`,button:{enabled:false,buttons:[]},data:{}};
await writeFile('dist/receiver.tavern.json',JSON.stringify(receiverScript,null,2)+'\n');

const source=process.env.JMW_CARD_SOURCE||process.argv[2];
if(source){
  const original=JSON.parse(await readFile(source,'utf8'));
  const card=structuredClone(original),d=card.data;
  const removedIds=new Set([3,4,5,7,9,10,11]);
  d.character_book.entries=d.character_book.entries.filter(e=>!removedIds.has(e.id));
  const guide=d.character_book.entries.find(e=>e.id===1);
  if(guide)guide.content=`蒋莫闻 v${version} 使用说明\n1. 启用角色卡自带的酒馆助手“完整脚本接收器”，页面右下角出现“蒋莫闻 · 案卷”。\n2. 在设置中填写可浏览器直连的副API地址、模型和密钥，点击测试连接。主API仍在酒馆连接设置中配置。\n3. 选择林小女案或教授夫妇案开场，或从案卷的案件库进入。无需加载原案件世界书。\n4. 在线索页查看已发现、送检中及结果；未知线索和真相只存于脚本后台。日常聊天不会自动发线索。\n5. 接收器会自动取得完整脚本更新，新案件随更新加入；断网也能启动内置版本。\n6. 请用新聊天开始重构版；旧聊天中已经出现的真相无法从历史或记忆插件中撤回。不要继续绑定旧案件世界书，否则会从外部提示泄露。\n7. 当前正式适配酒馆 Chat Completion 主API；副API为OpenAI兼容接口，需要CORS。副API失败时暂停案情，不自动编造线索。`;
  const exemplar=d.character_book.entries.find(e=>e.id===6);
  const entry={...structuredClone(exemplar),id:920001,comment:'案件叙事边界 · 接收器公共协议',keys:[],secondary_keys:[],constant:true,enabled:true,insertion_order:999,content:`[JMW_CARD_V1]\n案件由脚本后台裁定。你只负责正文与角色互动。仅使用本轮请求末尾 JMW_BOUNDARY 的已公开案卷及允许发生事项；未收到该边界时，案情保持现状，不能新建证物、口供、报告、凶手或结论。已发现不等于已分析，证词不等于事实。角色只能依据自己已知的信息行动。允许创作不影响案情的环境、动作和情绪。不得自动完成玩家没有选择的调查。不要输出 UpdateVariable 或 JSONPatch；只按原 status_panel 格式输出基本信息、角色档案、待办与账本，由脚本整理公开状态。案卷和剧情进度禁止由正文或MVU指令修改。\n任何回忆、摘要或外部世界书里的案情均不能代替本轮已公开案卷；有冲突时保持未知，等待后台许可。`};
  entry.extensions={...entry.extensions,position:4,depth:0,role:0,exclude_recursion:true,prevent_recursion:true,ignore_budget:true};entry.position='after_char';
  d.character_book.entries.push(entry);
  d.extensions.tavern_helper.scripts=[receiverScript];
  d.extensions.jmw={id:'jiang-mowen-cases',schema:1,version,repository:'https://github.com/jhyshl/jiang-mowen-cases'};
  // Old distributed buttons and inactive MVU prompt regexes are replaced by the receiver.
  d.extensions.regex_scripts=d.extensions.regex_scripts.filter(r=>!['不发送变量（mvu）','状态栏新（mvu）'].includes(r.scriptName));
  const openingRegex=d.extensions.regex_scripts.find(r=>r.scriptName==='开场白美化');
  if(openingRegex)openingRegex.replaceString=openingRegex.replaceString.replace(/<head\s*\n/,'<head>\n');
  const professorGreeting=`*北城市刑侦支队的办公室里，窗外的晨光还没完全透进来，蒋莫闻刚放下手里的杯子，值班电话便响了。*\n\n*他接起电话听了片刻，神情逐渐沉下来，抽出纸记下地址：幸福花园小区。报案的邻居说，莫钰联系不上父母，拜托自己去查看，发现情况不对，已经报了警。*\n\n“地址发过来，先别让人进去。”*蒋莫闻放下电话，拿起外套，看向一旁的{{user}}。*“走，先去现场核实。”\n\n*此刻摆在他们面前的还只有一条报案。屋里发生了什么，需要到了现场才能知道。*`;
  let professorIndex=d.alternate_greetings.findIndex(g=>g.includes('幸福花园')&&/教授夫妇|莫钰/.test(g));
  if(professorIndex<0){d.alternate_greetings.push(professorGreeting);professorIndex=d.alternate_greetings.length-1;}
  const homepage=d.first_mes.match(/(<div id="archive-config"[^>]*>)([\s\S]*?)(<\/div>)/);
  if(homepage){const config=JSON.parse(homepage[2]);if(!config.some(c=>c.index===professorIndex+1))config.push({index:professorIndex+1,title:'案卷六：教授夫妇案',desc:'幸福花园小区发现两具尸体，死者疑为一对大学教授夫妇。蒋莫闻准备带队赶往现场。'});d.first_mes=d.first_mes.replace(homepage[0],homepage[1]+'\n'+JSON.stringify(config,null,2)+'\n'+homepage[3]);}
  d.character_version=version;
  d.creator_notes=(d.creator_notes||'')+`\n\n【案件后台重构 ${version}】已内置林小女案、教授夫妇案及完整脚本接收器。启用酒馆助手后，在右下角案卷设置配置副API。请用新聊天开始，不再绑定旧案件世界书。`;
  // Preserve all unrelated original personality, greetings, phone data and romance UI.
  for(const key of ['name','description','personality','scenario','first_mes','mes_example','creator_notes','system_prompt','post_history_instructions','alternate_greetings','character_version','extensions','character_book'])if(Object.hasOwn(card,key))card[key]=structuredClone(d[key]);
  const output=`output/蒋莫闻-案件后台重构-v${version}.json`;
  await writeFile(output,JSON.stringify(card,null,2)+'\n');
  await writeFile('output/使用说明.txt',`导入 ${path.basename(output)}，启用卡内酒馆助手接收器。\n在“蒋莫闻 · 案卷 → 设置”填写独立副API，测试后开始。\n内置：林小女案、教授夫妇案。无需旧案件世界书。\n接收器自动更新完整脚本，首版自带离线兜底。\n原来的角色设定、恋爱开场、主页和状态栏保留。旧线索判官及变量加载按钮已移除。\n主API推荐酒馆 Chat Completion。副API需要浏览器CORS及OpenAI兼容chat/completions。\n请使用新聊天，避免旧案底通过聊天历史或记忆插件泄露。\n项目：https://github.com/jhyshl/jiang-mowen-cases\n`, 'utf8');
  console.log('Card exported:',output);
}
console.log(JSON.stringify({version,runtime:file,sha256:sha,bytes:Buffer.byteLength(runtime),receiverBytes:Buffer.byteLength(receiver),cases:cases.map(c=>({id:c.id,nodes:c.nodes.length}))}));
