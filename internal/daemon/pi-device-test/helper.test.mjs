import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp, readFile, writeFile, stat, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const here = fileURLToPath(new URL('.',import.meta.url));
const helper = resolve(here,'../pi_device_helper.mjs');
const pkg = resolve(here,'node_modules/@earendil-works/pi-coding-agent');
const entry = join(pkg,'dist/index.js'), manifest=join(pkg,'package.json');
const mock = join(here,'mock.mjs');
async function run(home, action, options = {}) {
  const proc=spawn(process.execPath,['--import',mock,helper,entry,manifest,action],{
    env:{HOME:home, PATH:process.env.PATH, PI_OFFLINE:'1', ...options.env}, stdio:['pipe','pipe','pipe']});
  // Keep parent lifetime pipe open until the helper exits.
  let stdout='',stderr='';
  for (const [stream, append] of [[proc.stdout,s=>stdout+=s],[proc.stderr,s=>stderr+=s]]) stream.on('data', append);
  const code=await new Promise((resolve,reject)=>{proc.on('exit',resolve);proc.on('error',reject)});
  assert.equal(stderr,'');
  return {code,frames:stdout.trim().split('\n').map(x=>JSON.parse(x)),stdout};
}
test('native device-code exchange, native file and redacted frames under disposable HOME',async()=>{
  const home=await mkdtemp(join(tmpdir(),'pi-adapter-'));
  try {
    assert.deepEqual((await run(home,'status')).frames,[{type:'status',state:'missing'}]);
    const login=await run(home,'login');
    assert.equal(login.code,0);
    assert.deepEqual(login.frames,[{type:'device_code',verificationUri:'https://auth.openai.com/codex/device',userCode:'ABCD-1234'},{type:'completed'}]);
    const auth=await readFile(join(home,'.pi/agent/auth.json'),'utf8');
    assert.ok(auth.includes('SYNTHETIC-REFRESH-SECRET'));
    assert.equal((await stat(join(home,'.pi/agent/auth.json'))).mode&0o777,0o600);
    assert.ok(!login.stdout.includes('SYNTHETIC-REFRESH-SECRET'));
    assert.ok(!login.stdout.includes('synthetic-code'));
    assert.deepEqual((await run(home,'status')).frames,[{type:'status',state:'usable'}]);
    const expired=JSON.parse(auth);
    expired['openai-codex'].expires=1;
    await writeFile(join(home,'.pi/agent/auth.json'),JSON.stringify(expired),{mode:0o600});
    const failure=await run(home,'status',{env:{MOCK_REFRESH_FAIL:'1'}});
    assert.deepEqual(failure.frames,[{type:'unknown'}]);
    assert.ok(!failure.stdout.includes('SYNTHETIC-REFRESH-SECRET'));
    // Pi's login, not the host, repairs the native credential.
    assert.equal((await run(home,'login')).code,0);
    assert.deepEqual((await run(home,'status')).frames,[{type:'status',state:'usable'}]);
    const malformed=JSON.parse(auth);
    malformed['openai-codex'].access='';
    await writeFile(join(home,'.pi/agent/auth.json'),JSON.stringify(malformed),{mode:0o600});
    assert.deepEqual((await run(home,'status')).frames,[{type:'status',state:'unknown'}]);
  } finally { await rm(home,{recursive:true,force:true}); }
});
test('loss of parent lifetime pipe aborts a pending poll without writing auth',async()=>{
  const home=await mkdtemp(join(tmpdir(),'pi-abort-'));
  try {
    const proc=spawn(process.execPath,['--import',mock,helper,entry,manifest,'login'],{
      env:{HOME:home,PATH:process.env.PATH,PI_OFFLINE:'1',MOCK_HOLD:'1'},stdio:['pipe','pipe','pipe']});
    const chunks=[];
    const done=new Promise((resolve,reject)=>{proc.on('exit',resolve);proc.on('error',reject)});
    for await (const chunk of proc.stdout) {
      chunks.push(chunk.toString());
      if (chunks.join('').includes('device_code')) { proc.stdin.end(); break; }
    }
    const code=await Promise.race([done,new Promise((_,reject)=>setTimeout(()=>reject(new Error('orphaned poll')),3000))]);
    assert.notEqual(code,0);
    assert.ok(!chunks.join('').includes('SYNTHETIC-REFRESH-SECRET'));
    const auth=await readFile(join(home,'.pi/agent/auth.json'),'utf8').catch(e=>e.code==='ENOENT'?'':Promise.reject(e));
    assert.ok(!auth.includes('openai-codex'));
  } finally { await rm(home,{recursive:true,force:true}); }
});
test('native Pi credentials are separated by disposable homes',async()=>{
  const a=await mkdtemp(join(tmpdir(),'pi-A-')), b=await mkdtemp(join(tmpdir(),'pi-B-'));
  try { await run(a,'login'); assert.deepEqual((await run(b,'status')).frames,[{type:'status',state:'missing'}]); }
  finally { await rm(a,{recursive:true,force:true});await rm(b,{recursive:true,force:true}); }
});
