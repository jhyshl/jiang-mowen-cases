export async function openStorage(host) {
  const db=await new Promise((resolve,reject)=>{
    const request=host.indexedDB.open('jmw-case-director',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('kv');
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(new Error('案卷数据库无法打开，请检查浏览器存储权限'));
  });
  const transact=(mode,key,value)=>new Promise((resolve,reject)=>{
    const tx=db.transaction('kv',mode),store=tx.objectStore('kv');
    const request=mode==='readonly'?store.get(key):store.put(value,key);
    let result;request.onsuccess=()=>{result=request.result;};
    tx.oncomplete=()=>resolve(result);
    tx.onerror=()=>reject(new Error('案卷存档失败：浏览器存储不足或不可用'));
    tx.onabort=()=>reject(new Error('案卷存储事务已中止'));
  });
  return {get:key=>transact('readonly',key),set:(key,value)=>transact('readwrite',key,value),close:()=>db.close()};
}
