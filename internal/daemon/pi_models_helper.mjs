// Invoked by the mapped-UID daemon with trusted Pi paths. Never print Pi errors or credentials.
import { pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const [entry, manifest, action, selected = ''] = process.argv.slice(-4);
try {
  if (JSON.parse(readFileSync(manifest, 'utf8')).version !== '0.85.1') throw Error('version');
  if (action !== 'list' && action !== 'select') throw Error('action');
  const { ModelRuntime, SettingsManager } = await import(pathToFileURL(entry).href);
  const runtime = await ModelRuntime.create({ allowModelNetwork: false, refreshOnCreate: false, modelsPath: null });
  const auth = await runtime.getAuth('openai-codex');
  if (!auth?.auth?.apiKey) throw Error('auth');
  const models = (await runtime.getAvailable('openai-codex')).filter(m => m.provider === 'openai-codex' && m.input?.includes('text'));
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
  const result = { schema_version: 1, default_model: stored.getDefaultProvider() === 'openai-codex' ? stored.getDefaultModel() ?? null : null,
    models: models.slice(0, 100).map(m => ({ id: m.id, name: m.name })) };
  process.stdout.write(JSON.stringify(result) + '\n');
} catch {
  // The provider may include tokens and response bodies in errors.
  process.stdout.write('{"error":"native_unavailable"}\n');
  process.exitCode = 1;
}
