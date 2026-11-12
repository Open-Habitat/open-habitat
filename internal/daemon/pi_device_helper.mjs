// Invoked only by the mapped-UID daemon. stdout is the sole, bounded protocol channel.
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';

const [entry, manifest, action] = process.argv.slice(-3);
const send = (event) => {
  const frame = JSON.stringify(event);
  if (Buffer.byteLength(frame) > 1024) throw new Error('frame too large');
  process.stdout.write(frame + '\n');
};
// The parent owns stdin. Losing it cancels polling even if the daemon was SIGKILLed.
const abort = new AbortController();
process.stdin.resume();
process.stdin.on('end', () => abort.abort());
process.stdin.on('error', () => abort.abort());
const storageCode = error => {
  for (let i = 0; error && i < 5; i++, error = error.cause) {
    if (error.code === 'EDQUOT' || error.code === 'ENOSPC') return error.code;
  }
};
const reportStorage = error => {
  const code = storageCode(error);
  if (code) process.stderr.write(code + '\n');
};
try {
  if (action !== 'login' && action !== 'status') throw new Error('invalid action');
  if (JSON.parse(readFileSync(manifest, 'utf8')).version !== '1.5.2') throw new Error('unsupported Pi version');
  const { ModelRuntime } = await import(pathToFileURL(entry).href);
  // Avoid Pi's create-time scan of unrelated providers (which can execute
  // configured API-key shell resolvers). Login synchronizes its own provider.
  const runtime = await ModelRuntime.create({ allowModelNetwork: false, refreshOnCreate: false, modelsPath: null, signal: abort.signal });
  if (action === 'status') {
    const credentials = await runtime.listCredentials({ signal: abort.signal });
    if (credentials.some(c => ['openai', 'anthropic', 'deepseek'].includes(c.providerId) && c.type === 'api_key')) {
      send({type:'status', state:'usable'});
    } else if (!credentials.some(c => c.providerId === 'openai-codex' && c.type === 'oauth')) {
      send({type: 'status', state: 'missing'});
    } else {
      // checkAuth only checks the stored type; getAuth resolves/refreshes expiry.
      const resolved = await runtime.getAuth('openai-codex', {signal: abort.signal});
      send({type: 'status', state: typeof resolved?.auth?.apiKey === 'string' && resolved.auth.apiKey.length > 0 ? 'usable' : 'unknown'});
    }
  } else {
    await runtime.login('openai-codex', 'oauth', {
      signal: abort.signal,
      prompt: async p => {
        if (p.type !== 'select' || !p.options?.some(o => o.id === 'device_code')) throw new Error('unexpected prompt');
        return 'device_code';
      },
      notify: e => {
        if (e.type !== 'device_code' || e.verificationUri !== 'https://auth.openai.com/codex/device' ||
            !/^[A-Z0-9-]{4,24}$/.test(e.userCode)) throw new Error('unexpected notification');
        send({type:'device_code', verificationUri:e.verificationUri, userCode:e.userCode});
      },
    });
    // Never send credentials returned by login. Parent rechecks native status.
    send({type:'completed'});
  }
} catch (error) {
  reportStorage(error);
  // Pi errors may contain tokens, paths or HTTP bodies. Never print them.
  send({type:'unknown'});
  process.exitCode = 1;
} finally {
  process.stdin.destroy();
}
