// Invoked by the mapped-UID daemon with trusted Pi paths. Never print Pi errors or credentials.
import { pathToFileURL } from 'node:url';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const [entry, manifest, action, selected = ''] = process.argv.slice(-4);
try {
  if (JSON.parse(readFileSync(manifest, 'utf8')).version !== '1.3.0') throw Error('version');
  if (action !== 'list' && action !== 'select') throw Error('action');
  const { ModelRuntime, SettingsManager } = await import(pathToFileURL(entry).href);
  // Load Pi's native provider configuration and cached catalog, without refreshing
  // unrelated providers or executing their configured API-key resolvers.
  let catalogStatus = 'native_cached';
  let models = [];
  const { getSupportedThinkingLevels } = await import(new URL('../../pi-ai/dist/models.js', pathToFileURL(entry)).href);
  try {
    const runtime = await ModelRuntime.create({ allowModelNetwork: false, refreshOnCreate: false,
      modelsPath: join(process.env.HOME, '.pi', 'agent', 'models.json') });
    const credentials = await runtime.listCredentials();
    for (const provider of ['openai-codex', 'openai']) {
      if (!credentials.some(c => c.providerId === provider && c.type === (provider === 'openai' ? 'api_key' : 'oauth'))) continue;
      const refreshed = await runtime.refresh({ allowNetwork: false, providers: [provider] });
      if (refreshed.errors?.has(provider)) continue;
      models.push(...(await runtime.getAvailable(provider)).filter(m => m.provider === provider && m.input?.includes('text')));
    }
    // Load only the declared bridge extension, not arbitrary user extensions or
    // unrelated credential resolvers. Pinned Pi's loader queues provider registrations.
    const bridge = new URL('../../../pi-claude-bridge/src/index.ts', pathToFileURL(entry));
    if (existsSync(bridge)) {
      const { loadExtensions } = await import(new URL('./core/extensions/loader.js', pathToFileURL(entry)).href);
      const loaded = await loadExtensions([bridge.pathname], process.env.HOME);
      if (loaded.errors.length) throw Error('bridge');
      for (const registration of loaded.runtime.pendingProviderRegistrations) {
        if (registration.name === 'claude-bridge') runtime.registerProvider(registration.name, registration.config);
      }
      models.push(...runtime.getModels('claude-bridge').filter(m => m.input?.includes('text')));
    }
    models = models.slice(0, 100);
    if (!models.length) throw Error('auth');
  } catch { catalogStatus = 'unavailable'; }
  const levels = m => getSupportedThinkingLevels(m).filter(level => ['off','minimal','low','medium','high','xhigh','max'].includes(level));
  const settings = SettingsManager.create(process.env.HOME, join(process.env.HOME, '.pi', 'agent'), { projectTrusted: false });
  if (settings.drainErrors().length) throw Error('settings');
  if (action === 'select') {
    const model = models.find(m => m.id === selected && m.provider === (process.env.OH_PI_PROVIDER || 'openai-codex'));
    if (!model) throw Error('model');
    const thinking = process.env.OH_PI_THINKING || '';
    if (thinking && !levels(model).includes(thinking)) throw Error('thinking');
    settings.setDefaultModelAndProvider(model.provider, model.id);
    if (thinking) {
      settings.setDefaultThinkingLevel(thinking);
      settings.setModelThinkingLevel(model.provider, model.id, thinking);
    }
    await settings.flush();
    if (settings.drainErrors().length) throw Error('write');
  }
  // Read back from disk, not the session's cached settings.
  const stored = SettingsManager.create(process.env.HOME, join(process.env.HOME, '.pi', 'agent'), { projectTrusted: false });
  if (stored.drainErrors().length) throw Error('readback');
  const result = { schema_version: 1, default_provider: stored.getDefaultProvider() ?? null, default_model: stored.getDefaultModel() ?? null,
    default_thinking: stored.getModelThinkingLevel(stored.getDefaultProvider(), stored.getDefaultModel()) ?? stored.getDefaultThinkingLevel() ?? 'off',
    catalog_status: catalogStatus,
    models: models.map(m => ({ provider: m.provider, id: m.id, name: m.name, thinking_levels: levels(m) })) };
  process.stdout.write(JSON.stringify(result) + '\n');
} catch {
  // The provider may include tokens and response bodies in errors.
  process.stdout.write('{"error":"native_unavailable"}\n');
  process.exitCode = 1;
}
