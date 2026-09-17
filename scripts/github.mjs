import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
const result = spawnSync('git', ['credential', 'fill'], { input: 'protocol=https\nhost=github.com\n\n', encoding:'utf8', windowsHide:true });
if (result.status !== 0) throw new Error('GitHub credential manager is not signed in');
const credential = Object.fromEntries(result.stdout.trim().split('\n').map(s => { const i=s.indexOf('='); return [s.slice(0,i),s.slice(i+1)]; }));
if (!credential.password) throw new Error('Missing GitHub credential');
async function api(url, method='GET', body) {
  const r = await fetch('https://api.github.com' + url, {method,headers:{Authorization:`Bearer ${credential.password}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
  if (!r.ok) throw new Error(`GitHub ${r.status}: ${(await r.text()).slice(0,300)}`);
  return r.status===204?{}:r.json();
}
const me = await api('/user');
if (me.login !== 'jhyshl') throw new Error('Unexpected GitHub account: '+me.login);
const name='jiang-mowen-cases', repository=`${me.login}/${name}`;
if (process.argv[2] === 'create') {
  const repo=await api('/user/repos','POST',{name,description:'蒋莫闻 · 案卷推进器与角色卡接收器。独立副 API，内置案件与轻量状态投影。',private:false,auto_init:false});
  console.log(JSON.stringify({repository:repo.full_name,url:repo.html_url,created:true}));
} else if (process.argv[2] === 'pages') {
  const pages=await api(`/repos/${repository}/pages`,'POST',{source:{branch:'main',path:'/'}});
  console.log(JSON.stringify({url:pages.html_url,status:pages.status}));
} else if (process.argv[2] === 'status') {
  const repo=await api(`/repos/${repository}`); console.log(JSON.stringify({repository:repo.full_name,url:repo.html_url,branch:repo.default_branch}));
} else throw new Error('Expected create, pages or status');
