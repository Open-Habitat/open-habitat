#!/usr/bin/env node
// Child of proof.mjs only. File path is provided by parent and confined to its temporary home.
import { ModelRuntime } from '/home/maintainer/.local/lib/node_modules/@earendil-works/pi-coding-agent/dist/core/model-runtime.js';
let release;
const held = new Promise(resolve => { release = resolve; });
const runtime = await ModelRuntime.create({authPath:process.env.PROOF_AUTH_PATH,modelsPath:null,refreshOnCreate:false});
runtime.registerNativeProvider({
  id:'openai-codex',name:'Synthetic',getModels:()=>[],
  auth:{oauth:{name:'Synthetic',isSubscription:true,login:async()=>{
    process.send({phase:'pending'});
    await held;
    return {type:'oauth',access:'SYNTHETIC-CHILD-ACCESS',refresh:'SYNTHETIC-CHILD-REFRESH',expires:Date.now()+3600000};
  },refresh:async credential=>credential,toAuth:async credential=>({apiKey:credential.access})}},
  stream:()=>{throw Error('no stream');},streamSimple:()=>{throw Error('no stream');},
});
process.on('message', msg => {if(msg==='release') release();});
try {
  await runtime.login('openai-codex','oauth',{prompt:async()=>'',notify:()=>{}});
  process.send({phase:'committed'});
} catch {
  process.send({phase:'failed'});
  process.exitCode=1;
}
