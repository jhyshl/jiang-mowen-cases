import {createRequire} from 'node:module';
const local=createRequire(import.meta.url);
export function dependency(name){
  try{return local(name);}catch(e){
    if(process.env.JMW_BUILD_DEPS)return createRequire(process.env.JMW_BUILD_DEPS+'/package.json')(name);
    throw new Error(`缺少 ${name}。先运行 npm install，或设置 JMW_BUILD_DEPS 指向已安装依赖的工程。`);
  }
}
