import {test} from 'node:test';
import assert from 'node:assert/strict';
import {backgroundModels} from '../background-model.mjs';

const free = {input: 0, output: 0, cacheRead: 0, cacheWrite: 0};
const model = (provider, id, cost = free) => ({provider, id, name: id, input: ['text'], cost});
const ids = (models) => models.map(m => `${m.provider}/${m.id}`);
// pi-claude-bridge's order (flagship first) with its declared zero cost.
const bridge = ['claude-fable-5-1', 'claude-opus-5-5', 'claude-sonnet-4-6', 'claude-sonnet-5-5', 'claude-haiku-5-5'].map(id => model('claude-bridge', id));

test('bridge models all cost 0: the newest Sonnet, then the conversation model', () => {
  assert.deepEqual(ids(backgroundModels(bridge, {provider: 'claude-bridge', id: 'claude-haiku-5-5'})),
    ['claude-bridge/claude-sonnet-5-5', 'claude-bridge/claude-haiku-5-5']);
  assert.deepEqual(ids(backgroundModels(bridge, {provider: 'claude-bridge', id: 'claude-sonnet-5-5'})), ['claude-bridge/claude-sonnet-5-5']);
});

test('never Fable or Opus, not even as the conversation fallback', () => {
  for (const id of ['claude-fable-5-1', 'claude-opus-5-5']) {
    assert.deepEqual(ids(backgroundModels(bridge, {provider: 'claude-bridge', id})), ['claude-bridge/claude-sonnet-5-5']);
    assert.deepEqual(backgroundModels(bridge.filter(m => !m.id.includes('sonnet') && !m.id.includes('haiku')), {provider: 'claude-bridge', id}), []);
  }
  const named = [model('other', 'flagship'), model('other', 'house-medium')];
  named[0].name = 'Claude Opus via proxy';
  assert.deepEqual(ids(backgroundModels(named, {provider: 'other', id: 'flagship'})), ['other/house-medium']);
});

test('no middle-tier model: the conversation model alone', () => {
  const available = [model('fixture', 'big', {input: 0.1, output: 0.1}), model('fixture', 'fake', {input: 3, output: 15})];
  assert.deepEqual(ids(backgroundModels(available, {provider: 'fixture', id: 'fake'})), ['fixture/fake']);
  // A conversation model the registry cannot use is not offered.
  assert.deepEqual(backgroundModels(available, {provider: 'fixture', id: 'gone'}), []);
});

test('other providers: their middle tier by name, newest, not by price', () => {
  const openai = ['gpt-6-sol', 'gpt-5.5-luna', 'gpt-6-luna', 'gpt-6-terra', 'gpt-6-luna-preview', 'gpt-5-mini'].map(id => model('openai-codex', id, {input: 1, output: 1}));
  assert.deepEqual(ids(backgroundModels(openai, {provider: 'openai-codex', id: 'gpt-6-sol'})), ['openai-codex/gpt-6-luna', 'openai-codex/gpt-6-sol']);
  const google = ['gemini-2.5-pro', 'gemini-2.5-flash-lite', 'gemini-2.5-flash-preview-09-2025', 'gemini-2.0-flash', 'gemini-2.5-flash'].map(id => model('google', id));
  assert.deepEqual(ids(backgroundModels(google, {provider: 'google', id: 'gemini-2.5-pro'})), ['google/gemini-2.5-flash', 'google/gemini-2.5-pro']);
  // "mini" is a word of the name, not a substring of "gemini".
  assert.deepEqual(ids(backgroundModels([model('google', 'gemini-2.5-pro')], {provider: 'google', id: 'gemini-2.5-pro'})), ['google/gemini-2.5-pro']);
});

test("the conversation's provider first; without a known conversation any provider's tier", () => {
  const available = [...bridge, model('openai-codex', 'gpt-6-luna'), model('openai-codex', 'gpt-6-sol')];
  assert.deepEqual(ids(backgroundModels(available, {provider: 'openai-codex', id: 'gpt-6-sol'})), ['openai-codex/gpt-6-luna', 'openai-codex/gpt-6-sol']);
  assert.deepEqual(ids(backgroundModels(available, undefined)), ['claude-bridge/claude-sonnet-5-5']);
  // A provider without a middle tier does not borrow another provider's.
  assert.deepEqual(ids(backgroundModels([model('openai-codex', 'gpt-6-luna'), model('fixture', 'fake')], {provider: 'fixture', id: 'fake'})), ['fixture/fake']);
  // The title helper's registry lacks the bridge: another provider's tier, never its Fable or Opus.
  assert.deepEqual(ids(backgroundModels([model('openai-codex', 'gpt-6-luna'), model('openai-codex', 'gpt-6-sol')], {provider: 'claude-bridge', id: 'claude-opus-5-5'})), ['openai-codex/gpt-6-luna']);
  assert.deepEqual(backgroundModels([model('other', 'claude-fable-5-1')], {provider: 'claude-bridge', id: 'claude-fable-5-1'}), []);
});
