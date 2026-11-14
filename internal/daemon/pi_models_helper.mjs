// Invoked by the mapped-UID daemon with trusted Pi paths. Never print Pi errors or credentials.
import { pathToFileURL, fileURLToPath } from 'node:url';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const [entry, manifest, action, selected = ''] = process.argv.slice(-4);
const storageCode = error => {
  for (let i = 0; error && i < 5; i++, error = error.cause) {
    if (error.code === 'EDQUOT' || error.code === 'ENOSPC') return error.code;
  }
};
const reportStorage = error => {
  const code = storageCode(error);
  if (code) process.stderr.write(code + '\n');
};
let rejection;
try {
  if (JSON.parse(readFileSync(manifest, 'utf8')).version !== '1.5.2') throw Error('version');
  if (!['list', 'select', 'initialize-claude'].includes(action)) throw Error('action');
  const { ModelRuntime, SettingsManager } = await import(pathToFileURL(entry).href);
  // Load Pi's native provider configuration and cached catalog, without refreshing
  // unrelated providers or executing their configured API-key resolvers.
  let catalogStatus = 'native_cached';
  let models = [];
  let bridgePath;
  const { getSupportedThinkingLevels } = await import(new URL('../../pi-ai/dist/models.js', pathToFileURL(entry)).href);
  try {
    const runtime = await ModelRuntime.create({ allowModelNetwork: false, refreshOnCreate: false,
      modelsPath: join(process.env.HOME, '.pi', 'agent', 'models.json') });
    const credentials = await runtime.listCredentials();
    // An API key's presence is enough: Pi's availability check resolves the
    // stored value, which would run a `!command` key or expand `$NAME`.
    for (const provider of ['openai', 'anthropic', 'deepseek']) {
      if (credentials.some(c => c.providerId === provider && c.type === 'api_key'))
        models.push(...runtime.getModels(provider).filter(m => m.input?.includes('text')));
    }
    if (credentials.some(c => c.providerId === 'openai-codex' && c.type === 'oauth')) {
      const refreshed = await runtime.refresh({ allowNetwork: false, providers: ['openai-codex'] });
      if (!refreshed.errors?.has('openai-codex'))
        models.push(...(await runtime.getAvailable('openai-codex')).filter(m => m.provider === 'openai-codex' && m.input?.includes('text')));
    }
    // Load only the declared bridge extension, not arbitrary user extensions or
    // unrelated credential resolvers. Pinned Pi's loader queues provider registrations.
    const bridge = new URL('../../../pi-claude-bridge/src/index.ts', pathToFileURL(entry));
    if (existsSync(bridge)) {
      bridgePath = fileURLToPath(bridge);
      const { loadExtensions } = await import(new URL('./core/extensions/loader.js', pathToFileURL(entry)).href);
      const loaded = await loadExtensions([bridgePath], process.env.HOME);
      if (loaded.errors.length) throw Error('bridge');
      // Registering a provider makes Pi refresh every provider in the background,
      // resolving stored keys; the bridge's catalog needs none of them.
      const { AuthStorage } = await import(new URL('./core/auth-storage.js', pathToFileURL(entry)).href);
      const bridgeRuntime = await ModelRuntime.create({ allowModelNetwork: false, refreshOnCreate: false, modelsPath: null, credentials: AuthStorage.inMemory() });
      for (const registration of loaded.runtime.pendingProviderRegistrations) {
        if (registration.name === 'claude-bridge') bridgeRuntime.registerProvider(registration.name, registration.config);
      }
      models.push(...bridgeRuntime.getModels('claude-bridge').filter(m => m.input?.includes('text')));
    }
    models = models.slice(0, 100);
    if (!models.length) throw Error('auth');
  } catch (error) { reportStorage(error); catalogStatus = 'unavailable'; }
  const levels = m => getSupportedThinkingLevels(m).filter(level => ['off','minimal','low','medium','high','xhigh','max'].includes(level));
  const settings = SettingsManager.create(process.env.HOME, join(process.env.HOME, '.pi', 'agent'), { projectTrusted: false });
  for (const failure of settings.drainErrors()) { reportStorage(failure.error); throw Error('settings'); }
  // Native settings outlive release generations. Only rewrite this installation's
  // managed bridge entries; never resolve the old path (it may already be pruned).
  const bridgeSuffix = '/node_modules/pi-claude-bridge/src/index.ts';
  const generationBridge = /^(.*)\/generations\/[^/]+\/payloads\/core\/runtime\/node_modules\/pi-claude-bridge\/src\/index\.ts$/;
  const declaredBridge = fileURLToPath(new URL('../../../pi-claude-bridge/src/index.ts', pathToFileURL(entry)));
  const installed = declaredBridge.match(generationBridge) ?? declaredBridge.match(/^(.*)\/core\/node_modules\/pi-claude-bridge\/src\/index\.ts$/);
  if (installed) {
    const stable = installed[1] + '/core' + bridgeSuffix;
    if (bridgePath) bridgePath = stable;
    const paths = settings.getExtensionPaths();
    let seen = false;
    const repaired = paths.flatMap(path => {
      const legacy = typeof path === 'string' && path.match(generationBridge);
      if (path !== stable && (!legacy || legacy[1] !== installed[1])) return [path];
      if (seen) return [];
      seen = true;
      return [stable];
    });
    if (JSON.stringify(paths) !== JSON.stringify(repaired)) {
      settings.setExtensionPaths(repaired);
      await settings.flush();
      const failures = settings.drainErrors();
      for (const failure of failures) reportStorage(failure.error);
      // A readable catalog must remain available when housekeeping cannot write.
      if (failures.length && action !== 'list') throw Error('write');
    }
  }
  // Pi has no built-in default for extension providers and falls back to the
  // first available row (Fable). Initialize only at successful browser sign-in,
  // never on a read or over a person's saved model, even from another provider.
  const initialize = action === 'initialize-claude' && !settings.getDefaultModel() && !settings.getDefaultProvider();
  if (action === 'select' || initialize) {
    const model = initialize
      ? models.find(m => m.provider === 'claude-bridge' && m.id === 'claude-opus-5-5')
      : models.find(m => m.id === selected && m.provider === (process.env.OH_PI_PROVIDER || 'openai-codex'));
    if (!model) { rejection = 'model_unavailable'; throw Error('model'); }
    const thinking = initialize
      ? (settings.getModelThinkingLevel(model.provider, model.id) ?? settings.getDefaultThinkingLevel() ?? 'medium')
      : (process.env.OH_PI_THINKING || '');
    if (thinking && !levels(model).includes(thinking)) { rejection = 'thinking_unsupported'; throw Error('thinking'); }
    // Explicitly selecting this installed provider also makes the same native
    // default usable over SSH. Preserve all other native extension preferences.
    if (model.provider === 'claude-bridge') {
      if (!bridgePath) throw Error('bridge');
      const paths = settings.getExtensionPaths();
      if (!paths.includes(bridgePath)) settings.setExtensionPaths([...paths, bridgePath]);
    }
    settings.setDefaultModelAndProvider(model.provider, model.id);
    if (thinking) {
      settings.setDefaultThinkingLevel(thinking);
      settings.setModelThinkingLevel(model.provider, model.id, thinking);
    }
    await settings.flush();
    for (const failure of settings.drainErrors()) { reportStorage(failure.error); throw Error('write'); }
  }
  // Read back from disk, not the session's cached settings.
  const stored = SettingsManager.create(process.env.HOME, join(process.env.HOME, '.pi', 'agent'), { projectTrusted: false });
  for (const failure of stored.drainErrors()) { reportStorage(failure.error); throw Error('readback'); }
  // The context indicator's limits: the window and Pi's own compaction
  // threshold. An invalid compaction setting omits them; it is Pi's to report.
  const limit = n => Number.isSafeInteger(n) && n >= 0 && n <= 100000000 ? n : undefined;
  const reserve = m => { try { return limit(stored.getCompactionReserveTokens(m)); } catch { return undefined; } };
  let autoCompaction;
  try { autoCompaction = stored.getCompactionEnabled() === true; } catch { autoCompaction = undefined; }
  // What the recap's automatic model is for a conversation of each provider,
  // by the same policy the recap extension uses. A provider whose own model
  // would be the fallback is left out: that depends on the conversation.
  let backgroundModels;
  try {
    const policy = await import(process.env.OH_BACKGROUND_POLICY);
    backgroundModels = {};
    for (const provider of new Set(models.map(m => m.provider))) {
      const [choice] = policy.backgroundModels(models, { provider });
      if (choice?.provider === provider) backgroundModels[provider] = choice.id;
    }
  } catch { backgroundModels = undefined; }
  const result = { schema_version: 1, background_models: backgroundModels, default_provider: stored.getDefaultProvider() ?? null, default_model: stored.getDefaultModel() ?? null,
    default_thinking: stored.getModelThinkingLevel(stored.getDefaultProvider(), stored.getDefaultModel()) ?? stored.getDefaultThinkingLevel() ?? 'off',
    catalog_status: catalogStatus, auto_compaction: autoCompaction,
    models: models.map(m => ({ provider: m.provider, id: m.id, name: m.name, thinking_levels: levels(m),
      context_window: limit(m.contextWindow) || undefined, compaction_reserve_tokens: reserve(m) })) };
  process.stdout.write(JSON.stringify(result) + '\n');
} catch (error) {
  reportStorage(error);
  // The provider may include tokens and response bodies in errors.
  process.stdout.write(JSON.stringify({ error: rejection ?? 'native_unavailable' }) + '\n');
  process.exitCode = 1;
}
