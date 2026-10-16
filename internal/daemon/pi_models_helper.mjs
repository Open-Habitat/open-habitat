// Invoked by the mapped-UID daemon with trusted Pi paths. Never print Pi errors or credentials.
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const [entry, manifest, action, selected = ''] = process.argv.slice(-4);
try {
  if (JSON.parse(readFileSync(manifest, 'utf8')).version !== '1.3.0') throw Error('version');
  if (action !== 'list' && action !== 'select') throw Error('action');
  const { ModelRuntime, SettingsManager } = await import(pathToFileURL(entry).href);
  // Load Pi's native provider configuration and cached catalog, without refreshing
  // unrelated providers or executing their configured API-key resolvers.
  const runtime = await ModelRuntime.create({ allowModelNetwork: false, refreshOnCreate: false,
    modelsPath: join(process.env.HOME, '.pi', 'agent', 'models.json') });
  const refreshed = await runtime.refresh({ allowNetwork: false, providers: ['openai-codex'] });
  if (refreshed.errors?.has('openai-codex')) throw Error('catalog');
  const auth = await runtime.getAuth('openai-codex');
  if (!auth?.auth?.apiKey) throw Error('auth');
  // A catalog entry is a candidate, not proof of account entitlement. Offer
  // only the newest numbered chat model in each requested family; no probes.
  const newest = new Map();
  for (const model of await runtime.getAvailable('openai-codex')) {
    const match = /^gpt-(\d+(?:\.\d+)*)-(luna|terra|sol|astra)$/.exec(model.id);
    if (model.provider !== 'openai-codex' || !model.input?.includes('text') || !match) continue;
    const version = match[1].split('.').map(Number);
    const previous = newest.get(match[2]);
    const compare = (a, b) => {
      for (let i = 0; i < Math.max(a.length, b.length); i++) {
        const difference = (a[i] ?? 0) - (b[i] ?? 0);
        if (difference) return difference;
      }
      return 0;
    };
    if (!previous || compare(version, previous.version) > 0) newest.set(match[2], {model, version});
  }
  const models = ['luna', 'terra', 'sol', 'astra'].flatMap(family => newest.has(family) ? [newest.get(family).model] : []);
  const settings = SettingsManager.create(process.env.HOME, join(process.env.HOME, '.pi', 'agent'), { projectTrusted: false });
  if (settings.drainErrors().length) throw Error('settings');
  if (action === 'select') {
    const model = models.find(m => m.id === selected);
    if (!model) throw Error('model');
    settings.setDefaultModelAndProvider(model.provider, model.id);
    await settings.flush();
    if (settings.drainErrors().length) throw Error('write');
  }
  // Read back from disk, not the session's cached settings.
  const stored = SettingsManager.create(process.env.HOME, join(process.env.HOME, '.pi', 'agent'), { projectTrusted: false });
  if (stored.drainErrors().length) throw Error('readback');
  const result = { schema_version: 1, default_provider: stored.getDefaultProvider() ?? null, default_model: stored.getDefaultModel() ?? null,
    models: models.slice(0, 100).map(m => ({ id: m.id, name: m.name })) };
  process.stdout.write(JSON.stringify(result) + '\n');
} catch {
  // The provider may include tokens and response bodies in errors.
  process.stdout.write('{"error":"native_unavailable"}\n');
  process.exitCode = 1;
}
