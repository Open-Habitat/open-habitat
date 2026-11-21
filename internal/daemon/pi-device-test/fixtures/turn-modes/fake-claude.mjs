#!/usr/bin/env node
// Test-only stand-in for the Claude Code CLI behind pi-claude-bridge. It
// speaks the Agent SDK's stream-json protocol just far enough for one turn:
// it answers initialize, asks the model's way for one call of the served Pi
// tool `mark` (a tool_use block streamed to the bridge and a tools/call on
// the bridge's in-process MCP server, as Claude Code does), records what the
// MCP server answered, then finishes the turn with text. It records its argv
// so the test sees which built-in tools the bridge gave it.
import { appendFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { createInterface } from 'node:readline';

const log = process.env.FAKE_CLAUDE_LOG;
const record = value => appendFileSync(log, JSON.stringify(value) + '\n');
record({ argv: process.argv.slice(2) });
const session = randomUUID();
const send = value => process.stdout.write(JSON.stringify(value) + '\n');
const pending = new Map();
let seq = 0;
const control = request => new Promise(resolve => {
  const id = `fake_${++seq}`;
  pending.set(id, resolve);
  send({ type: 'control_request', request_id: id, request });
});
const mcp = (method, params, id) => control({ subtype: 'mcp_message', server_name: 'custom-tools', message: { jsonrpc: '2.0', ...(id === undefined ? {} : { id }), method, params } });
const stream = event => send({ type: 'stream_event', event, parent_tool_use_id: null, uuid: randomUUID(), session_id: session });

async function turn() {
  const toolId = `toolu_${randomUUID().replace(/-/g, '').slice(0, 20)}`;
  const first = `msg_${randomUUID().slice(0, 8)}`;
  const input = { label: 'via-bridge' };
  stream({ type: 'message_start', message: { id: first, type: 'message', role: 'assistant', model: 'synthetic', content: [], usage: { input_tokens: 1, output_tokens: 0 } } });
  stream({ type: 'content_block_start', index: 0, content_block: { type: 'tool_use', id: toolId, name: 'mcp__custom-tools__mark', input: {} } });
  stream({ type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: JSON.stringify(input) } });
  send({ type: 'assistant', message: { id: first, type: 'message', role: 'assistant', model: 'synthetic', content: [{ type: 'tool_use', id: toolId, name: 'mcp__custom-tools__mark', input }], stop_reason: null, usage: { input_tokens: 1, output_tokens: 1 } }, parent_tool_use_id: null, uuid: randomUUID(), session_id: session });
  stream({ type: 'content_block_stop', index: 0 });
  stream({ type: 'message_delta', delta: { stop_reason: 'tool_use' }, usage: { output_tokens: 1 } });
  stream({ type: 'message_stop' });
  await mcp('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'fake-claude', version: '0' } }, 1);
  await mcp('notifications/initialized', {});
  const reply = await mcp('tools/call', { name: 'mark', arguments: input, _meta: { 'claudecode/toolUseId': toolId } }, 2);
  record({ mcp: reply });
  const second = `msg_${randomUUID().slice(0, 8)}`;
  stream({ type: 'message_start', message: { id: second, type: 'message', role: 'assistant', model: 'synthetic', content: [], usage: { input_tokens: 1, output_tokens: 0 } } });
  stream({ type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } });
  stream({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Bridge turn done.' } });
  send({ type: 'assistant', message: { id: second, type: 'message', role: 'assistant', model: 'synthetic', content: [{ type: 'text', text: 'Bridge turn done.' }], stop_reason: null, usage: { input_tokens: 1, output_tokens: 1 } }, parent_tool_use_id: null, uuid: randomUUID(), session_id: session });
  stream({ type: 'content_block_stop', index: 0 });
  stream({ type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 1 } });
  stream({ type: 'message_stop' });
  send({ type: 'result', subtype: 'success', is_error: false, duration_ms: 1, duration_api_ms: 1, num_turns: 1, result: 'Bridge turn done.', session_id: session, total_cost_usd: 0, usage: { input_tokens: 1, output_tokens: 1 }, uuid: randomUUID() });
}

for await (const line of createInterface({ input: process.stdin })) {
  let m;
  try { m = JSON.parse(line); } catch { continue; }
  if (m.type === 'control_response') {
    pending.get(m.response?.request_id)?.(m.response?.response?.mcp_response ?? m.response);
    pending.delete(m.response?.request_id);
  } else if (m.type === 'control_request') {
    if (m.request?.subtype === 'initialize') {
      send({ type: 'control_response', response: { subtype: 'success', request_id: m.request_id, response: { commands: [], agents: [], output_style: 'default', available_output_styles: ['default'], models: [], account: {} } } });
      send({ type: 'system', subtype: 'init', session_id: session, tools: [], mcp_servers: [{ name: 'custom-tools', status: 'connected' }], model: 'synthetic', permissionMode: 'bypassPermissions', claude_code_version: '0.0.0-fake', uuid: randomUUID() });
    } else {
      send({ type: 'control_response', response: { subtype: 'success', request_id: m.request_id, response: {} } });
    }
  } else if (m.type === 'user') {
    turn().catch(e => { record({ error: String(e) }); process.exit(1); });
  }
}
