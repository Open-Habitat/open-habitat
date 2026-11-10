import {test, mock} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import recapExtension from '../recap-extension.mjs';

// Drives the recap command with a synthetic model registry whose models answer
// after a given delay, on mocked timers: how long each candidate may take.
async function recap(latencies, conversation) {
  const agent = await mkdtemp(join(tmpdir(), 'pi-recap-timeout-'));
  const previous = process.env.PI_CODING_AGENT_DIR;
  process.env.PI_CODING_AGENT_DIR = agent;
  mock.timers.enable({apis: ['setTimeout', 'Date'], now: 0});
  try {
    let handler;
    const appended = [];
    recapExtension({registerCommand: (_, command) => { handler = command.handler; }, appendEntry: (type, data) => appended.push({type, data})});
    const models = Object.keys(latencies).map(id => ({provider: 'claude-bridge', id, input: ['text']}));
    const branch = [
      {type: 'message', id: 'u1', message: {role: 'user', content: 'Korjaa testi'}},
      {type: 'message', id: 'a1', message: {role: 'assistant', content: 'Korjasin testin.'}},
    ];
    const calls = [], notes = [];
    const ctx = {
      model: models.find(m => m.id === conversation),
      sessionManager: {getBranch: () => branch},
      ui: {notify: (message) => notes.push(JSON.parse(message.slice(message.indexOf(':') + 1)))},
      modelRegistry: {
        getAvailable: () => models,
        hasConfiguredAuth: () => true,
        complete: (model, _request, {signal}) => new Promise(resolve => {
          calls.push(model.id);
          const answer = setTimeout(() => resolve({stopReason: 'stop', content: [{type: 'text', text: '{"recap":"Testi korjattu.","next":"Aja testit."}'}]}), latencies[model.id]);
          signal.addEventListener('abort', () => { clearTimeout(answer); resolve({stopReason: 'aborted', content: []}); });
        }),
      },
    };
    const done = handler('', ctx);
    // Each candidate starts only after the previous one gave up.
    for (let i = 0; i < 30 && !notes.length; i++) {
      mock.timers.tick(1000);
      await new Promise(resolve => setImmediate(resolve));
    }
    await done;
    return {calls, note: notes.at(-1), appended};
  } finally {
    mock.timers.reset();
    if (previous === undefined) delete process.env.PI_CODING_AGENT_DIR; else process.env.PI_CODING_AGENT_DIR = previous;
    await rm(agent, {recursive: true, force: true});
  }
}

test("the only candidate may take the whole budget, not the per-model share", async () => {
  // An Opus conversation leaves Sonnet as the sole background model; the
  // bridge's slow tail answered after 12 s on the ARM host (2026-10-29).
  const {calls, note, appended} = await recap({'claude-sonnet-5-5': 18000, 'claude-opus-5-5': 1000}, 'claude-opus-5-5');
  assert.deepEqual(calls, ['claude-sonnet-5-5']);
  assert.equal(note.outcome, 'done');
  assert.equal(appended.length, 1);
});

test("a stalled first candidate leaves the fallback time to answer", async () => {
  const {calls, note} = await recap({'claude-sonnet-5-5': 60000, 'claude-haiku-own': 5000}, 'claude-haiku-own');
  assert.deepEqual(calls, ['claude-sonnet-5-5', 'claude-haiku-own']);
  assert.equal(note.outcome, 'done');
  assert.equal(note.model, 'claude-bridge/claude-haiku-own');
});

test("a model that never answers is a timeout that says how long it waited", async () => {
  const {note, appended} = await recap({'claude-sonnet-5-5': 60000}, undefined);
  assert.equal(note.outcome, 'model_timeout');
  assert.match(note.detail, /^no answer in 2[45] s$/);
  assert.equal(appended.length, 0);
});
