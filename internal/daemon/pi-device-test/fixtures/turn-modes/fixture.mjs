// Test-only: a scripted provider, a tool with a visible side effect and an
// extension command that starts a run with pi.sendUserMessage.
import { appendFileSync } from 'node:fs';

export default function (pi) {
  pi.registerProvider('fixture', {
    baseUrl: process.env.FIXTURE_URL, api: 'openai-completions', apiKey: 'synthetic', authHeader: true,
    models: [{ id: 'fixture-model', name: 'fixture-model', reasoning: false, input: ['text'], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 65536, maxTokens: 1024 }],
  });
  pi.registerTool({
    name: 'mark', label: 'Mark', description: 'Append a label to the mark file.',
    parameters: { type: 'object', properties: { label: { type: 'string' } }, required: ['label'], additionalProperties: false },
    async execute(_id, params) {
      appendFileSync(process.env.MARK_FILE, `${params.label}\n`);
      return { content: [{ type: 'text', text: `marked ${params.label}` }], details: {} };
    },
  });
  pi.registerCommand('ext-send', { description: 'send a user message as an extension', handler: async () => { pi.sendUserMessage('message from an extension'); } });
}
