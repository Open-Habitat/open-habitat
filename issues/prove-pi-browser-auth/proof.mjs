#!/usr/bin/env node
// Pinned, negative capability proof. All token traffic is intercepted; no Pi CLI or real auth home.
import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = '/home/maintainer/.local/lib/node_modules/@earendil-works/pi-coding-agent';
const piAI = `${root}/node_modules/@earendil-works/pi-ai`;
const providerFile = `${piAI}/dist/auth/oauth/openai-codex.js`;
const runtimeFile = `${root}/dist/core/model-runtime.js`;
const expected = {
  [providerFile]: '41432753ef2ec7ef21c577fdc8f83b731c78be90c10ed8e7e1df7010f84d198f',
  [runtimeFile]: '32cd50599d9e6e001229090e3d0554b60e4addb8ab7b3165635a574feb660b74',
};
const access = `x.${Buffer.from(JSON.stringify({'https://api.openai.com/auth': {chatgpt_account_id:'synthetic-account'}})).toString('base64url')}.x`;
const refresh = 'SYNTHETIC-REFRESH-SECRET';
const timeout = (ms, label) => new Promise((_, reject) => setTimeout(() => reject(new Error(`timeout: ${label}`)), ms));
const race = (promise, ms, label) => Promise.race([promise, timeout(ms, label)]);
const pause = (ms) => new Promise(resolve => setTimeout(resolve, ms));
function mockFetch() {
  let exchanges = 0;
  globalThis.fetch = async (url, init) => {
    assert.equal(String(url), 'https://auth.openai.com/oauth/token', 'unexpected network URL');
    assert.equal(init.method, 'POST');
    assert.equal(init.body.get('grant_type'), 'authorization_code');
    assert.ok(init.body.get('code_verifier'));
    assert.equal(init.body.get('redirect_uri'), 'http://localhost:1455/auth/callback');
    exchanges++;
    return {ok:true, json:async () => ({access_token:access, refresh_token:refresh, expires_in:3600})};
  };
  return () => exchanges;
}
async function nativeTest(oauth, getExchanges) {
  const sentinel = createServer();
  sentinel.on('connection', socket => socket.destroy());
  await new Promise((resolve, reject) => {
    sentinel.once('error', reject);
    sentinel.listen(1455, '127.0.0.1', resolve);
  });
  // The sentinel forces Pi's listener bind to fail. It is NOT evidence of manual-only mode.
  try {
    let authorizationURL, promptSignal;
    const value = await race(oauth.login({
      signal: new AbortController().signal,
      notify: event => {if (event.type === 'auth_url') authorizationURL = event.url;},
      prompt: async request => {
        if (request.type === 'select') return 'browser';
        assert.equal(request.type, 'manual_code');
        promptSignal = request.signal;
        return 'bare-code-with-no-state';
      },
    }), 3000, 'baseline bare code');
    assert.equal(value.type, 'oauth');
    assert.equal(value.refresh, refresh);
    assert.equal(getExchanges(), 1, 'baseline exchanged bare code');
    const url = new URL(authorizationURL);
    assert.equal(url.searchParams.get('redirect_uri'), 'http://localhost:1455/auth/callback');
    assert.ok(url.searchParams.get('state'));
    assert.equal(promptSignal.aborted, true);
    console.log('PASS baseline: bound-port fallback exchanges bare code with no state (UNSAFE)');
    for (const [label, inputForURL, shouldExchange] of [
      ['missing state', url => `http://localhost:1455/auth/callback?code=missing-state`, true],
      ['wrong callback origin and path', url => `https://unrelated.invalid/other?code=wrong-path&state=${url.searchParams.get('state')}`, true],
      ['duplicate state', url => `http://localhost:1455/auth/callback?code=duplicate&state=${url.searchParams.get('state')}&state=other`, true],
      ['mismatched state', url => `http://localhost:1455/auth/callback?code=mismatch&state=wrong`, false],
    ]) {
      let before = getExchanges(), authURL;
      const attempt = oauth.login({
        signal:new AbortController().signal,
        notify:event => {if(event.type === 'auth_url') authURL = new URL(event.url);},
        prompt: request => request.type === 'select' ? Promise.resolve('browser') : Promise.resolve(inputForURL(authURL)),
      });
      if (shouldExchange) await race(attempt,3000,label);
      else await assert.rejects(race(attempt,3000,label),/State mismatch/);
      assert.equal(getExchanges(),before + Number(shouldExchange),label);
    }
    console.log('PASS baseline: missing state, wrong origin/path, duplicate state accepted; wrong state rejected (UNSAFE)');

    let promptSeen;
    const seen = new Promise(resolve => {promptSeen = resolve;});
    const controller = new AbortController();
    let finishPrompt;
    const pending = oauth.login({
      signal: controller.signal,
      notify: () => {},
      prompt: request => {
        if (request.type === 'select') return Promise.resolve('browser');
        promptSeen();
        return new Promise((resolve, reject) => {
          finishPrompt = resolve;
          request.signal.addEventListener('abort', () => reject(new Error('prompt aborted')), {once:true});
        });
      },
    });
    await race(seen, 3000, 'manual prompt start');
    controller.abort();
    const settled = await Promise.race([pending.then(() => true, () => true), pause(120).then(() => false)]);
    assert.equal(settled, false, 'unmodified provider should hang on outer abort');
    // Deliberately release the prompt to cleanly settle rather than leave a live login behind.
    finishPrompt('');
    await assert.rejects(race(pending, 3000, 'prompt cleanup'));
    assert.equal(getExchanges(), 4);
    console.log('PASS baseline: operation abort alone does NOT settle prompt; explicit prompt release required (UNSAFE)');
  } finally {await new Promise(resolve => sentinel.close(resolve));}
}
function syntheticProvider(login) {
  return {
    id:'openai-codex', name:'Synthetic Codex', auth:{oauth:{name:'Synthetic OAuth', isSubscription:true,
      login, refresh:async () => ({type:'oauth',access,refresh,expires:Date.now()+3600000}),
      toAuth:async credential => ({apiKey: credential.access})}},
    getModels:() => [], stream:() => {throw Error('no stream');}, streamSimple:() => {throw Error('no stream');},
  };
}
async function runtime(authPath, login = async () => ({type:'oauth',access,refresh,expires:Date.now()+3600000})) {
  const { ModelRuntime } = await import(fileURLToPath(new URL(`file://${runtimeFile}`)));
  const modelRuntime = await ModelRuntime.create({authPath, modelsPath:null, refreshOnCreate:false});
  modelRuntime.registerNativeProvider(syntheticProvider(login));
  return modelRuntime;
}
async function runtimeTests(dir) {
  const a = join(dir, 'uid-A', 'agent', 'auth.json');
  const b = join(dir, 'uid-B', 'agent', 'auth.json');
  const A = await runtime(a);
  const B = await runtime(b);
  await A.login('openai-codex', 'oauth', {prompt: async () => '', notify:()=>{}});
  assert.deepEqual(await A.listCredentials(), [{providerId:'openai-codex',type:'oauth'}]);
  assert.deepEqual(await B.listCredentials(), []);
  const fileA = await readFile(a,'utf8');
  assert.ok(fileA.includes(refresh));
  assert.equal((await stat(a)).mode & 0o777, 0o600);
  assert.equal((await stat(join(dir, 'uid-A', 'agent'))).mode & 0o777, 0o700);
  assert.equal((await B.checkAuth('openai-codex')), undefined);
  assert.equal((await A.checkAuth('openai-codex')).type, 'oauth');
  await A.logout('openai-codex');
  assert.deepEqual(await A.listCredentials(), []);
  console.log('PASS ModelRuntime: synthetic native provider writes 0600 in isolated authPath; other synthetic context is empty');

  const c = join(dir, 'uid-C', 'agent', 'auth.json');
  const C = await runtime(c);
  // Force failure AFTER a real file mutation in the pinned runtime's local synchronization phase.
  C.synchronizeCredentialState = async () => {throw new Error('synthetic post-commit synchronization failure');};
  await assert.rejects(C.login('openai-codex','oauth',{prompt:async()=>'',notify:()=>{}}), /post-commit synchronization failure/);
  assert.ok((await readFile(c,'utf8')).includes(refresh));
  console.log('PASS ModelRuntime: committed credential can coexist with rejected login; never blindly retry');

  const held = join(dir, 'uid-D', 'agent', 'auth.json');
  const child = fork(new URL('./cross-process.mjs', import.meta.url), [], {
    env:{PATH:process.env.PATH, HOME:join(dir,'uid-D'), PI_CODING_AGENT_DIR:join(dir,'uid-D','agent'),
      PI_OFFLINE:'1',PI_TELEMETRY:'0',PROOF_AUTH_PATH:held},
    stdio:['ignore','pipe','pipe','ipc'],
  });
  let childOutput = '';
  child.stdout.on('data', chunk => {childOutput += chunk;});
  child.stderr.on('data', chunk => {childOutput += chunk;});
  const message = () => race(new Promise((resolve,reject)=>{
    child.once('message',resolve);
    child.once('error',reject);
  }),3000,'child IPC');
  try {
    assert.equal((await message()).phase,'pending');
    const E = await runtime(held);
    await E.logout('openai-codex');
    child.send('release');
    assert.equal((await message()).phase,'committed');
    assert.deepEqual(await E.listCredentials(), [{providerId:'openai-codex',type:'oauth'}]);
    assert.equal(childOutput.includes('SYNTHETIC-CHILD-'), false, 'credential leaked to child stdout/stderr');
    console.log('PASS cross-process: logout does not fence pending child login; no credentials printed');
  } finally {if (child.exitCode === null) child.kill();}
}
async function main() {
  const dir = await mkdtemp(join(tmpdir(),'pi-browser-auth-proof-'));
  const oldFetch = globalThis.fetch;
  const oldHome = process.env.HOME;
  const oldAgentDir = process.env.PI_CODING_AGENT_DIR;
  const oldOffline = process.env.PI_OFFLINE;
  process.env.HOME = dir;
  process.env.PI_CODING_AGENT_DIR = join(dir, 'agent');
  process.env.PI_OFFLINE = '1';
  try {
    assert.equal(JSON.parse(await readFile(`${root}/package.json`,'utf8')).version,'0.85.1');
    for (const [file, hash] of Object.entries(expected)) {
      assert.equal(createHash('sha256').update(await readFile(file)).digest('hex'),hash,`pinned source changed: ${file}`);
    }
    const getExchanges = mockFetch();
    const { openaiCodexOAuth } = await import(`file://${providerFile}`);
    await nativeTest(openaiCodexOAuth, getExchanges);
    await runtimeTests(dir);
    console.log('PASS proof completed (negative for manual-only capability; no live provider request)');
  } finally {
    globalThis.fetch = oldFetch;
    if (oldHome === undefined) delete process.env.HOME; else process.env.HOME = oldHome;
    if (oldAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR; else process.env.PI_CODING_AGENT_DIR = oldAgentDir;
    if (oldOffline === undefined) delete process.env.PI_OFFLINE; else process.env.PI_OFFLINE = oldOffline;
    await rm(dir,{recursive:true,force:true});
  }
}
main().catch(error => {console.error(error); process.exitCode=1;});
