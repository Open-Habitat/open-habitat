// Credential values arrive only on stdin. Never print native errors.
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const [entry, manifest, action] = process.argv.slice(-3);
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
  if (JSON.parse(readFileSync(manifest, 'utf8')).version !== '1.3.0') throw Error('version');
  const { SettingsManager, ModelRuntime } = await import(pathToFileURL(entry).href);
  const { AuthStorage, ReadOnlyAuthStorage, readStoredCredential } = await import(new URL('./core/auth-storage.js', pathToFileURL(entry)).href);
  const { defaultModelPerProvider } = await import(new URL('./core/model-resolver.js', pathToFileURL(entry)).href);
  const path = join(process.env.HOME, '.pi/agent/auth.json');
  // The raw reader suppresses parse errors; validate metadata before any mutation.
  await new ReadOnlyAuthStorage(path).list();
  const old = readStoredCredential('openai', path);
  if (action === 'save') {
    const key = readFileSync(0, 'utf8');
    if (!/^sk-[A-Za-z0-9_-]{20,200}$/.test(key)) throw Error('literal');
    await AuthStorage.create(path).modify('openai', async () => ({ type: 'api_key', key }));
  } else if (action === 'remove') {
    await AuthStorage.create(path).delete('openai');
  } else if (action !== 'read') throw Error('action');
  const stored = new ReadOnlyAuthStorage(path);
  const key = readStoredCredential('openai', path); // raw entry; never resolve !commands or environment references
  const list = await stored.list();
  const subscription = list.some(c => c.providerId === 'openai-codex' && c.type === 'oauth');
  if ((action === 'save' && old?.type !== 'api_key') || action === 'remove') {
    const settings = SettingsManager.create(process.env.HOME, join(process.env.HOME, '.pi/agent'), {projectTrusted:false});
    for (const failure of settings.drainErrors()) { reportStorage(failure.error); throw Error('settings'); }
    const provider = action === 'save' ? 'openai' : settings.getDefaultProvider() === 'openai' && subscription ? 'openai-codex' : null;
    if (provider) {
      const runtime = await ModelRuntime.create({allowModelNetwork:false, refreshOnCreate:false, modelsPath:null});
      const models = runtime.getModels(provider).filter(m => m.input?.includes('text'));
      const preferred = action === 'save' ? settings.getDefaultModel() : defaultModelPerProvider[provider];
      const model = models.find(m => m.id === preferred) ?? models.find(m => m.id === defaultModelPerProvider[provider]) ?? models[0];
      if (!model) throw Error('model');
      settings.setDefaultModelAndProvider(provider, model.id);
      await settings.flush();
      for (const failure of settings.drainErrors()) { reportStorage(failure.error); throw Error('settings'); }
    }
  }
  process.stdout.write(JSON.stringify({schema_version:1, openai:{present:key?.type === 'api_key', suffix:key?.type === 'api_key' && /^sk-[A-Za-z0-9_-]{20,200}$/.test(key.key) ? key.key.slice(-4) : null}, subscription:{present:subscription}}) + '\n');
} catch (error) {
  reportStorage(error);
  process.stdout.write('{"error":"native_unavailable"}\n');
  process.exitCode = 1;
}
