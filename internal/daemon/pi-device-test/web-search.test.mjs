import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { nativeSearchTools, withSources } from '../../../runtime/core/web-search.mjs';

const here = fileURLToPath(new URL('.', import.meta.url));
const cli = resolve(here, 'node_modules/@earendil-works/pi-coding-agent/dist/bundle/cli.js');
const extension = resolve(here, '../../../runtime/core/web-search.mjs');

const sse = events => events.map(e => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join('');

// What the provider streams back after searching: the search items Pi skips,
// then the answer it keeps, citing a source only in structured form.
const responsesAnswer = sse([
  { type: 'response.created', response: { id: 'resp_1', status: 'in_progress', output: [] } },
  { type: 'response.output_item.added', output_index: 0, item: { type: 'web_search_call', id: 'ws_1', status: 'in_progress' } },
  { type: 'response.output_item.done', output_index: 0, item: { type: 'web_search_call', id: 'ws_1', status: 'completed', action: { type: 'search', query: 'synthetic' } } },
  { type: 'response.output_item.added', output_index: 1, item: { type: 'message', id: 'msg_1', role: 'assistant', status: 'in_progress', content: [] } },
  { type: 'response.content_part.added', item_id: 'msg_1', output_index: 1, content_index: 0, part: { type: 'output_text', text: '', annotations: [] } },
  { type: 'response.output_text.delta', item_id: 'msg_1', output_index: 1, content_index: 0, delta: 'SEARCHED-ANSWER' },
  { type: 'response.output_item.done', output_index: 1, item: { type: 'message', id: 'msg_1', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: 'SEARCHED-ANSWER', annotations: [{ type: 'url_citation', url: 'https://example.com/', title: 'Example', start_index: 0, end_index: 15 }] }] } },
  { type: 'response.completed', response: { id: 'resp_1', status: 'completed', output: [], usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 } } },
]);

const anthropicAnswer = sse([
  { type: 'message_start', message: { id: 'msg_1', type: 'message', role: 'assistant', model: 'synthetic', content: [], usage: { input_tokens: 1, output_tokens: 0 } } },
  { type: 'content_block_start', index: 0, content_block: { type: 'server_tool_use', id: 'srvtoolu_1', name: 'web_search', input: {} } },
  { type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: '{"query":"synthetic"}' } },
  { type: 'content_block_stop', index: 0 },
  { type: 'content_block_start', index: 1, content_block: { type: 'web_search_tool_result', tool_use_id: 'srvtoolu_1', content: [{ type: 'web_search_result', url: 'https://example.com/', title: 'Example', encrypted_content: 'opaque' }] } },
  { type: 'content_block_stop', index: 1 },
  { type: 'content_block_start', index: 2, content_block: { type: 'text', text: '' } },
  { type: 'content_block_delta', index: 2, delta: { type: 'citations_delta', citation: { type: 'web_search_result_location', url: 'https://example.org/cited', title: 'Cited', cited_text: 'x', encrypted_index: 'opaque' } } },
  { type: 'content_block_delta', index: 2, delta: { type: 'text_delta', text: 'SEARCHED-ANSWER' } },
  { type: 'content_block_stop', index: 2 },
  { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 1 } },
  { type: 'message_stop' },
]);

// The real pinned Pi, the shipped extension and a synthetic provider endpoint:
// what Pi actually sends, and whether it survives what comes back.
async function converse(provider, model, prompts, reply) {
  const bodies = [];
  const server = http.createServer((req, res) => {
    let data = '';
    req.on('data', c => { data += c; });
    req.on('end', () => {
      bodies.push(JSON.parse(data));
      const [status, body] = reply(bodies.length);
      res.writeHead(status, { 'content-type': status === 200 ? 'text/event-stream' : 'application/json' });
      res.end(body);
    });
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const home = await mkdtemp(join(tmpdir(), 'oh-web-search-'));
  try {
    const base = `http://127.0.0.1:${server.address().port}${provider === 'openai' ? '/v1' : ''}`;
    await writeFile(join(home, 'models.json'), JSON.stringify({ providers: { [provider]: { baseUrl: base } } }), { mode: 0o600 });
    const child = spawn(process.execPath, [cli, '--extension', extension, '--provider', provider, '--model', model,
      '--no-session', '--tools', 'read', '--thinking', 'low', '-p', ...prompts], {
      cwd: home, stdio: ['ignore', 'pipe', 'pipe'],
      env: { HOME: home, PATH: process.env.PATH, PI_CODING_AGENT_DIR: home, PI_OFFLINE: '1', OPENAI_API_KEY: 'synthetic', ANTHROPIC_API_KEY: 'synthetic' },
    });
    let out = '';
    child.stdout.on('data', c => { out += c; });
    child.stderr.on('data', c => { out += c; });
    const timer = setTimeout(() => child.kill('SIGKILL'), 30000);
    await new Promise(r => child.on('close', r));
    clearTimeout(timer);
    return { bodies, out };
  } finally {
    server.close();
    await rm(home, { recursive: true, force: true });
  }
}

const added = body => (body.tools ?? []).filter(t => !(t.type === 'function' || (t.input_schema && !t.type)));

test('an OpenAI key conversation searches natively and keeps the answer', async () => {
  const { bodies, out } = await converse('openai', 'gpt-5.5', ['first', 'second'], () => [200, responsesAnswer]);
  assert.equal(bodies.length, 2, out);
  assert.deepEqual(added(bodies[0]), [{ type: 'web_search' }]);
  assert.match(out, /SEARCHED-ANSWER/);
  assert.match(out, /\(https:\/\/example\.com\/\)/, 'the cited source must reach the answer');
  // The listed sources stay in the history the next request replays.
  const replayed = bodies[1].input.filter(i => i.type === 'message' && i.role === 'assistant').flatMap(i => i.content.map(c => c.text));
  assert.ok(replayed.some(t => t.includes('(https://example.com/)')), JSON.stringify(bodies[1].input));
});

// Pi 1.5 declares a current OpenAI model's tools in `additional_tools` input
// items and sends no top-level tools; search still has to be offered.
test('a current OpenAI model whose tools are additional_tools items searches natively', async () => {
  const { bodies, out } = await converse('openai', 'gpt-6.1-terra', ['first', 'second'], () => [200, responsesAnswer]);
  assert.equal(bodies.length, 2, out);
  assert.ok(bodies[0].input.some(i => i.type === 'additional_tools'), JSON.stringify(bodies[0].input));
  assert.deepEqual(added(bodies[0]), [{ type: 'web_search' }]);
  assert.deepEqual(added(bodies[1]), [{ type: 'web_search' }]);
  assert.match(out, /SEARCHED-ANSWER/);
  assert.match(out, /\(https:\/\/example\.com\/\)/, 'the cited source must reach the answer');
});

test('an Anthropic key conversation gets server-side search and fetch and keeps the answer', async () => {
  const { bodies, out } = await converse('anthropic', 'claude-fable-5-2', ['first'], () => [200, anthropicAnswer]);
  assert.equal(bodies.length, 1, out);
  assert.deepEqual(added(bodies[0]).map(t => t.type), ['web_search_20250305', 'web_fetch_20250910']);
  assert.match(out, /SEARCHED-ANSWER/);
  assert.match(out, /\(https:\/\/example\.org\/cited\)/, 'the cited source must reach the answer');
});

test('an Anthropic search turn that pauses says the answer is incomplete', async () => {
  const paused = anthropicAnswer.replace('"stop_reason":"end_turn"', '"stop_reason":"pause_turn"');
  assert.notEqual(paused, anthropicAnswer);
  const { out } = await converse('anthropic', 'claude-sonnet-5', ['first'], () => [200, paused]);
  const { out: complete } = await converse('anthropic', 'claude-sonnet-5', ['first'], () => [200, anthropicAnswer]);
  assert.ok(out.length > complete.length && out.startsWith(complete.trimEnd()), out);
});

test('a provider that refuses web search fails once, then the conversation goes on without it', async () => {
  const refusal = JSON.stringify({ error: { type: 'invalid_request_error', message: "Tool 'web_search' is not supported with this model." } });
  const { bodies, out } = await converse('openai', 'gpt-5.5', ['first', 'second'],
    n => n === 1 ? [400, refusal] : [200, responsesAnswer]);
  assert.equal(bodies.length, 2, out);
  assert.deepEqual(added(bodies[0]), [{ type: 'web_search' }]);
  assert.deepEqual(added(bodies[1]), []);
  assert.match(out, /SEARCHED-ANSWER/);
});

test('search is added only to the conversation model of a covered provider, once', () => {
  const codex = { provider: 'openai-codex', api: 'openai-codex-responses', id: 'gpt-5.6' };
  const payload = (extra = {}) => ({ model: 'gpt-5.6', tools: [{ type: 'function', name: 'bash' }], ...extra });
  assert.deepEqual(nativeSearchTools(codex, payload()), [{ type: 'web_search' }]);
  // A helper request with another model, or one without tools, is left alone.
  assert.deepEqual(nativeSearchTools(codex, payload({ model: 'gpt-5.6-mini' })), []);
  assert.deepEqual(nativeSearchTools(codex, { model: 'gpt-5.6' }), []);
  // OpenAI refuses web_search at minimal effort.
  assert.deepEqual(nativeSearchTools(codex, payload({ reasoning: { effort: 'minimal' } })), []);
  // The person's own search tool wins, whatever its exact spelling.
  assert.deepEqual(nativeSearchTools(codex, payload({ tools: [{ type: 'function', name: 'web_search' }] })), []);
  // Tools declared only in additional_tools items count as the conversation's.
  const items = tools => ({ model: 'gpt-5.6', input: [{ type: 'additional_tools', role: 'developer', tools }, { type: 'message', role: 'user', content: [] }] });
  assert.deepEqual(nativeSearchTools(codex, items([{ type: 'function', name: 'bash' }])), [{ type: 'web_search' }]);
  assert.deepEqual(nativeSearchTools(codex, items([{ type: 'function', name: 'WebSearch' }])), []);
  assert.deepEqual(nativeSearchTools(codex, { model: 'gpt-5.6', input: [{ type: 'message', role: 'user', content: [] }] }), []);
  const anthropic = { provider: 'anthropic', api: 'anthropic-messages', id: 'claude-sonnet-5' };
  assert.deepEqual(nativeSearchTools(anthropic, { model: 'claude-sonnet-5', tools: [{ name: 'WebFetch', input_schema: {} }] }), []);
  // A compatible endpoint of another provider is not assumed to have the tool.
  for (const model of [{ provider: 'openrouter', api: 'openai-responses', id: 'x' }, { provider: 'claude-bridge', api: 'claude-bridge', id: 'x' },
    { provider: 'deepseek', api: 'anthropic-messages', id: 'x' }]) {
    assert.deepEqual(nativeSearchTools(model, { model: 'x', tools: [] }), []);
  }
});

test('a source the answer already links is not listed again', () => {
  const answer = { role: 'assistant', content: [{ type: 'text', text: 'See [it](https://example.com/a).' }] };
  assert.equal(withSources(answer, new Map([['https://example.com/a', 'A']])), undefined);
  const listed = withSources(answer, new Map([['https://example.com/a', 'A'], ['https://example.com/b (x)', '']]));
  assert.equal(listed.content.length, 2);
  assert.equal(listed.content[0], answer.content[0]);
  assert.doesNotMatch(listed.content[1].text, /example\.com\/a\)/);
  assert.match(listed.content[1].text, /\(https:\/\/example\.com\/b%20%28x%29\)/);
});
