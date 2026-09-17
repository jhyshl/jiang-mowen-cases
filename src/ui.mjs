const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const labels={found:'已发现',submitted:'已送检 · 等待结果',resolved:'已记录'};
export function mountUI(host,callbacks) {
  const root=host.document.createElement('div');root.id='jmw-director-root';
  const shadow=root.attachShadow({mode:'open'});
  shadow.innerHTML=`<style>
  :host{all:initial;position:fixed;left:0;top:0;width:100vw;height:100dvh;pointer-events:none;z-index:2147483000;font-family:system-ui,"Microsoft YaHei",sans-serif;color:#e9e7df;font-size:14px;line-height:1.65;color-scheme:dark}
  *{box-sizing:border-box}button,input,select{font:inherit}button{cursor:pointer}button:disabled{opacity:.5;cursor:wait}button,input,select{border:1px solid #605d4e;border-radius:8px;background:#232821;color:#ecebdf;padding:9px 12px}button:hover{background:#394332}button:focus-visible,input:focus-visible,select:focus-visible{outline:2px solid #d1b678;outline-offset:2px}
  .dock{position:absolute;right:14px;bottom:82px;pointer-events:auto;box-shadow:0 6px 20px #0006;background:#26352e;border-color:#b59e66;padding:9px 18px}.dock small{display:block;font-size:10px;color:#c1c5b8;letter-spacing:2px}
  .panel{display:none;position:absolute;right:16px;bottom:145px;pointer-events:auto;width:min(470px,calc(100vw - 24px));height:min(710px,calc(100dvh - 175px));background:#18211c;border:1px solid #69715f;border-radius:16px;box-shadow:0 18px 80px #0009;overflow:hidden;flex-direction:column}.panel.open{display:flex}
  header{padding:18px 20px 10px;background:linear-gradient(135deg,#263b30,#1d2922)}header .bar{display:flex;justify-content:space-between;align-items:center}h1{font-size:19px;margin:0;font-weight:650;letter-spacing:2px}h2{font-size:16px;color:#d3bf8d;margin:18px 0 8px}p{margin:8px 0}.sub{color:#aebcac;font-size:12px}.status{color:#d6c794;font-size:12px;margin-top:10px;white-space:pre-wrap;overflow-wrap:anywhere}nav{display:flex;gap:6px;padding:10px 18px;border-bottom:1px solid #475044}nav button{flex:1;background:transparent;border-color:transparent;padding:6px}nav button.active{border-color:#8d926c;color:#e9d6a7;background:#344335}
  main{padding:0 20px 18px;overflow:auto;overscroll-behavior:contain;flex:1}article{border:1px solid #455140;border-radius:10px;margin:10px 0;padding:12px;background:#202b22}article strong{color:#e3d5ab}article p{font-size:13px;white-space:pre-wrap;overflow-wrap:anywhere}.badge{display:inline-block;font-size:10px;letter-spacing:.5px;color:#bfd0bf;border:1px solid #53644f;padding:0 6px;border-radius:4px;float:right}.muted{color:#a3b49f}.empty{border:1px dashed #647158;padding:20px;border-radius:12px;margin:15px 0;color:#c8cdbd}.row{display:flex;gap:8px;align-items:center;margin-top:10px}.row>*{flex:1}label{display:block;margin:12px 0 5px;font-size:13px}label.check{display:flex;gap:8px;align-items:center}input:not([type=checkbox]),select{width:100%;min-width:0}input[type=checkbox]{accent-color:#b4a77a}.hint{color:#a8b49e;font-size:12px}a{color:#d2bf88}.case-title{font-size:16px}footer{font-size:11px;text-align:center;color:#82947d;padding:6px;border-top:1px solid #374433}.close{padding:2px 8px;font-size:21px;background:none;border:none}.primary{background:#526347;color:#fff;border-color:#7d8f6d}.error{color:#ffc19e}.state-grid{display:grid;grid-template-columns:70px 1fr;gap:6px;font-size:12px;margin:12px 0}.state-grid b{color:#bbcaad;font-weight:500}
  @media(max-width:520px){.panel{right:8px;bottom:132px;height:calc(100dvh - 150px);width:calc(100vw - 16px)}main{padding:0 14px 16px}header{padding:12px 14px 8px}nav{padding:6px 10px}.dock{right:9px;bottom:76px;padding:7px 13px}}
  </style><button class="dock" aria-label="打开蒋莫闻案卷">蒋莫闻 · 案卷<small>CASE ARCHIVE</small></button><section class="panel" role="dialog" aria-label="蒋莫闻案卷"><header><div class="bar"><h1>北城 · 案卷档案</h1><button class="close" aria-label="关闭案卷">×</button></div><div class="sub">蒋莫闻 / 刑侦记录</div><div class="status" aria-live="polite"></div></header><nav><button data-tab="case" class="active">调查记录</button><button data-tab="library">案件库</button><button data-tab="settings">设置</button></nav><main></main><footer></footer></section>`;
  host.document.body.append(root);
  let tab='case',model={},open=false;
  const main=shadow.querySelector('main'),panel=shadow.querySelector('.panel');
  const show=()=>{open=true;panel.classList.add('open');render();};
  shadow.querySelector('.dock').onclick=()=>open?hide():show();
  const hide=()=>{open=false;panel.classList.remove('open');};
  shadow.querySelector('.close').onclick=hide;
  shadow.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;render();});
  const act=(selector,fn)=>{const e=main.querySelector(selector);if(e)e.onclick=async()=>{e.disabled=true;try{await fn();}catch(err){callbacks.report(err);}finally{e.disabled=false;}};};
  function render() {
    shadow.querySelector('.status').textContent=model.status||'等待选择开场或案件';
    shadow.querySelector('footer').textContent=`接收器 ${model.version||''} · 本机存档 · 已发现信息对玩家可见`;
    shadow.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
    if(tab==='case') {
      const p=model.publicCase;
      main.innerHTML=p?.active?`<h2>${escape(p.name)}</h2><p class="hint">${escape(p.phase)} · ${p.evidence.length} 条公开记录</p><article><strong>接警记录</strong><p>${escape(p.brief)}</p></article>${p.evidence.length?p.evidence.map(e=>`<article><span class="badge">${e.kind==='testimony'?'证词 · 待交叉核实':labels[e.stage]}</span><strong>${escape(e.name)}</strong><p>${escape(e.content)}</p></article>`).join(''):'<div class="empty">还没有调查记录。请在聊天中描述要采取的行动，副 API 会依据案情给出本轮许可。</div>'}<p class="hint">发现、送检和检验结果分别记录。本文字为已提交案卷；流式生成未完成时不会提前入档。</p>`:'<h2>当前为日常模式</h2><div class="empty">保留原来的恋爱与生活互动。选择案件开场，或在案件库切换，开始一份新的调查。</div>';
      const w=model.scene?.world;
      if(w) main.insertAdjacentHTML('beforeend',`<div class="state-grid"><b>当前场景</b><span>${escape(w.location)} · ${escape(w.date)} ${escape(w.time)}</span></div>`);
    } else if(tab==='library') {
      main.innerHTML=`<h2>内置案件</h2><p class="hint">每个聊天、案件和回复分支分别保存。切换案件不会删除另一案的记录。</p>${(model.cases||[]).map(c=>`<article><strong class="case-title">${escape(c.title)}</strong><p>${escape(c.name)}</p><p class="hint">${escape(c.start)}</p><button data-case="${escape(c.id)}" ${model.busy?'disabled':''}>${model.publicCase?.id===c.id?'当前案件':'进入此案'}</button></article>`).join('')}<button id="daily" ${model.busy?'disabled':''}>切回日常互动</button><h2>存档</h2><p class="hint">导出本聊天的案件进度和分支记录。不包含 API 密钥或完整案底。换浏览器前可先保存。</p><div class="row"><button id="export">导出进度</button><button id="import">导入进度</button></div><input id="import-file" type="file" accept="application/json,.json" hidden>`;
      main.querySelectorAll('[data-case]').forEach(b=>b.onclick=()=>callbacks.selectCase(b.dataset.case).catch(callbacks.report));
      act('#daily',()=>callbacks.selectCase(null));act('#export',callbacks.exportSave);
      main.querySelector('#import').onclick=()=>main.querySelector('#import-file').click();
      main.querySelector('#import-file').onchange=async e=>{try{const f=e.target.files?.[0];if(f)await callbacks.importSave(await f.text());}catch(err){callbacks.report(err);}};
    } else {
      const c=model.config||{};
      main.innerHTML=`<h2>推进器 · A 方案</h2><p class="hint">副 API 直接连接你填写的服务。需要支持浏览器 CORS 和 OpenAI 兼容 chat/completions；不借用酒馆的生成通道。</p><label for="endpoint">API 基础地址或完整接口</label><input id="endpoint" value="${escape(c.endpoint)}" placeholder="https://你的服务/v1" autocomplete="off"><label for="model">模型名称</label><input id="model" value="${escape(c.model)}" placeholder="填写服务提供的模型 ID" autocomplete="off"><label for="key">API Key</label><input id="key" type="password" value="${escape(c.key)}" placeholder="仅发送给上方地址" autocomplete="new-password"><label class="check"><input id="remember" type="checkbox" ${c.remember?'checked':''}>在此浏览器记住密钥</label><p class="hint">不勾选时密钥仅保留到当前页面关闭；不会写入聊天、MVU 或导出卡。</p><div class="row"><button class="primary" id="save">保存设置</button><button id="test">测试连接</button></div><p class="hint">测试会向该服务发出一次短请求。发生网络、CORS 或格式错误时，本轮案情暂停，正文只可继续已知范围内的互动。</p><h2>完整脚本更新</h2><p class="hint">接收器检查版本清单，下载并校验完整脚本。新案件随脚本更新到达。生成期间不替换运行脚本。</p><button id="update">检查更新</button><p><a href="https://github.com/jhyshl/jiang-mowen-cases" target="_blank" rel="noopener noreferrer">发布仓库与说明 ↗</a></p><p class="hint">主 API 的边界是提示约束，后台只认许可记录；即使正文越界，虚构证物也不会自动入档。</p>`;
      const form=()=>({endpoint:main.querySelector('#endpoint').value.trim(),model:main.querySelector('#model').value.trim(),key:main.querySelector('#key').value.trim(),remember:main.querySelector('#remember').checked});
      act('#save',()=>callbacks.saveConfig(form()));act('#test',()=>callbacks.testConfig(form()));act('#update',callbacks.update);
    }
  }
  return {show,update(data){model={...model,...data};if(tab!=='settings'||!open)render();else {shadow.querySelector('.status').textContent=model.status||'';}},destroy(){root.remove();},get root(){return root;}};
}
