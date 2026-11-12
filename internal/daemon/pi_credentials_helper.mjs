// Credential values arrive only on stdin. Never print native errors.
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import { createHmac } from 'node:crypto';
import { join } from 'node:path';
const [entry, manifest, action, provider] = process.argv.slice(-4);
// Pi stores each of these as {type:'api_key', key} under its own provider id.
const providers = ['openai', 'anthropic', 'deepseek'];
// A literal key only: Pi runs `!…` values and expands `$NAME` when it resolves one.
const literal = /^sk-[A-Za-z0-9_-]{20,200}$/;
const storageCode = error => {
  for (let i = 0; error && i < 5; i++, error = error.cause) {
    if (error.code === 'EDQUOT' || error.code === 'ENOSPC') return error.code;
  }
};
// The site's salted key fingerprints (ADR 0030): a site key is recognised by
// HMAC-SHA256 under the gateway's salt, computed here in the person's own UID.
// Nothing about a credential the person added ever leaves, not even a hash.
const hex64 = /^[0-9a-f]{64}$/;
const fingerprint = (salt, value) => createHmac('sha256', Buffer.from(salt, 'hex')).update(value, 'utf8').digest('hex');
const siteInput = () => {
  const input = JSON.parse(readFileSync(0, 'utf8'));
  const keys = Object.keys(input).sort().join(',');
  const shape = action === 'site_check' ? 'current,earlier,salt' : 'earlier,key,salt';
  if (keys !== shape || !hex64.test(input.salt) || !Array.isArray(input.earlier) || input.earlier.length > 32 || !input.earlier.every(f => typeof f === 'string' && hex64.test(f))) throw Error('input');
  if (action === 'site_check' ? !hex64.test(input.current) : typeof input.key !== 'string' || !literal.test(input.key)) throw Error('input');
  const current = action === 'site_check' ? input.current : fingerprint(input.salt, input.key);
  if (input.earlier.includes(current)) throw Error('input');
  // One word about the provider's entry: none, exactly the site's current or
  // an earlier site key, or anything else, which is the person's own.
  const classify = entry => {
    if (!entry) return 'absent';
    if (entry.type !== 'api_key' || typeof entry.key !== 'string') return 'own';
    const f = fingerprint(input.salt, entry.key);
    return f === current ? 'current' : input.earlier.includes(f) ? 'earlier' : 'own';
  };
  return { key: input.key, classify };
};
const reportStorage = error => {
  const code = storageCode(error);
  if (code) process.stderr.write(code + '\n');
};
try {
  if (JSON.parse(readFileSync(manifest, 'utf8')).version !== '1.5.2') throw Error('version');
  if (action !== 'read' && !providers.includes(provider)) throw Error('provider');
  const { SettingsManager, ModelRuntime } = await import(pathToFileURL(entry).href);
  const { AuthStorage, ReadOnlyAuthStorage, readStoredCredential } = await import(new URL('./core/auth-storage.js', pathToFileURL(entry)).href);
  const { defaultModelPerProvider } = await import(new URL('./core/model-resolver.js', pathToFileURL(entry)).href);
  const path = join(process.env.HOME, '.pi/agent/auth.json');
  // The raw reader suppresses parse errors; validate metadata before any mutation.
  await new ReadOnlyAuthStorage(path).list();
  const old = action === 'read' ? undefined : readStoredCredential(provider, path);
  // Pi keeps Anthropic's Claude Pro/Max sign-in under the same id as its key.
  // A key change must never replace or delete a credential of another kind; the
  // check runs under Pi's file lock, since a native login may write meanwhile.
  // seed is the site AI key (ADR 0030): written only where the person's Pi
  // has no credential of any kind for this provider, decided under the same
  // lock, so a key the person saved meanwhile always stays.
  // site_check and site_seed give an already-joined person the site key:
  // the seed writes only where the check, repeated under the lock, says
  // absent or exactly an earlier site key, and never touches anything else.
  let seeded = false;
  let site;
  if (action === 'site_check') {
    site = siteInput().classify(readStoredCredential(provider, path));
  } else if (action === 'site_seed') {
    const { key, classify } = siteInput();
    await AuthStorage.create(path).modify(provider, async current => {
      const state = classify(current);
      site = { absent: 'seeded', earlier: 'replaced', current: 'already_current', own: 'kept' }[state];
      seeded = state === 'absent';
      return state === 'absent' || state === 'earlier' ? { type: 'api_key', key } : undefined;
    });
  } else if (action === 'save') {
    const key = readFileSync(0, 'utf8');
    if (!literal.test(key)) throw Error('literal');
    await AuthStorage.create(path).modify(provider, async current => {
      if (current && current.type !== 'api_key') throw Error('kind');
      return { type: 'api_key', key };
    });
  } else if (action === 'seed') {
    const key = readFileSync(0, 'utf8');
    if (!literal.test(key)) throw Error('literal');
    await AuthStorage.create(path).modify(provider, async current => {
      if (current) return undefined;
      seeded = true;
      return { type: 'api_key', key };
    });
  } else if (action === 'remove') {
    // AuthStorage.delete removes any kind; do its locked write with the same check.
    const auth = AuthStorage.create(path);
    await auth.storage.withLockAsync(async content => {
      const data = auth.parseStorageData(content);
      if (data[provider] && data[provider].type !== 'api_key') throw Error('kind');
      delete data[provider];
      return { result: undefined, next: JSON.stringify(data, null, 2) };
    });
  } else if (action !== 'read') throw Error('action');
  const list = await new ReadOnlyAuthStorage(path).list();
  const subscription = list.some(c => c.providerId === 'openai-codex' && c.type === 'oauth');
  const keys = {};
  for (const id of providers) {
    const key = readStoredCredential(id, path); // raw entry; never resolve !commands or environment references
    keys[id] = {present: key?.type === 'api_key', suffix: key?.type === 'api_key' && literal.test(key.key) ? key.key.slice(-4) : null};
  }
  if ((action === 'save' && old?.type !== 'api_key') || action === 'remove' || seeded) {
    const settings = SettingsManager.create(process.env.HOME, join(process.env.HOME, '.pi/agent'), {projectTrusted:false});
    for (const failure of settings.drainErrors()) { reportStorage(failure.error); throw Error('settings'); }
    // A provider's first key becomes the default for new conversations. Removing
    // the default's key falls back to the subscription, then to another key.
    // A seed becomes the default only for a person who has none yet, so it
    // never moves anyone's conversations onto the site's bill.
    const target = action === 'save' ? provider
      : action === 'seed' || action === 'site_seed' ? (settings.getDefaultProvider() ? null : provider)
      : settings.getDefaultProvider() !== provider ? null
      : subscription ? 'openai-codex' : providers.find(id => keys[id].present) ?? null;
    if (target) {
      const runtime = await ModelRuntime.create({allowModelNetwork:false, refreshOnCreate:false, modelsPath:null});
      const models = runtime.getModels(target).filter(m => m.input?.includes('text'));
      const preferred = action === 'remove' ? defaultModelPerProvider[target] : settings.getDefaultModel();
      const model = models.find(m => m.id === preferred) ?? models.find(m => m.id === defaultModelPerProvider[target]) ?? models[0];
      if (!model) throw Error('model');
      settings.setDefaultModelAndProvider(target, model.id);
      await settings.flush();
      for (const failure of settings.drainErrors()) { reportStorage(failure.error); throw Error('settings'); }
    }
  }
  const outcome = action === 'seed' ? {seed: seeded ? 'seeded' : 'already_present'} : site ? {site} : {};
  process.stdout.write(JSON.stringify({schema_version:1, ...keys, subscription:{present:subscription}, ...outcome}) + '\n');
} catch (error) {
  reportStorage(error);
  process.stdout.write('{"error":"native_unavailable"}\n');
  process.exitCode = 1;
}
