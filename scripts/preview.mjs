import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
const root=process.cwd(),port=8197;
const server=createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://localhost');
    if(url.pathname==='/v1/chat/completions'&&req.method==='POST'){
      let body='';for await(const chunk of req)body+=chunk;
      const input=JSON.parse(body),last=input.messages.at(-1)?.content||'';
      let plan={mode:'social',actions:[]};
      try{const {playerAction}=JSON.parse(last);const state=JSON.parse(input.messages[0].content.split('私有已提交状态：')[1]);
        const id=!state.evidence.scene?'scene':/家庭|走访/.test(playerAction)?'household':/702|房间/.test(playerAction)?'apartment':'scene';
        plan={mode:'investigate',actions:[{id,op:'advance',basis:playerAction}]};
      }catch{}
      res.writeHead(200,{'content-type':'application/json','Access-Control-Allow-Origin':'*'});res.end(JSON.stringify({choices:[{message:{content:JSON.stringify(plan)}}]}));return;
    }
    if(url.pathname==='/opening'){
      const card=JSON.parse(await readFile(path.join(root,'output/蒋莫闻-案件后台重构-v1.0.0.json'),'utf8'));
      let html=card.data.extensions.regex_scripts.find(r=>r.scriptName==='开场白美化').replaceString.replace(/^```html\s*/,'').replace(/\s*```$/,'');
      html=html.replace('<head>',`<head><script>window.getChatMessages=async()=>[{message:${JSON.stringify(card.data.first_mes)},swipes:[${JSON.stringify(card.data.first_mes)}]}];window.setChatMessages=async(data)=>{document.body.innerHTML='<p style="color:white;font-size:30px">选择完成：开场 '+data[0].swipe_id+'</p>';};</script>`);
      res.writeHead(200,{'content-type':'text/html; charset=utf-8'});res.end(html);return;
    }
    const requested=url.pathname==='/'?'tests/preview.html':url.pathname.slice(1);
    const file=path.resolve(root,requested);if(!file.startsWith(root+path.sep)||requested.includes('..'))throw new Error('Path outside workspace');
    if(!requested.startsWith('dist/')&&requested!=='tests/preview.html')throw new Error('Not public preview content');
    res.writeHead(200,{'content-type':file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.json')?'application/json':'text/javascript; charset=utf-8','cache-control':'no-store'});res.end(await readFile(file));
  }catch(e){res.writeHead(404);res.end(e.message);}
});
server.listen(port,'127.0.0.1',()=>console.log(`PREVIEW http://127.0.0.1:${port} (isolated fixture; no real model calls)`));
