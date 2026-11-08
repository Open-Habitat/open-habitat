// Synthetic 100 MiB prompt through the pinned Pi RPC framing and JSON parser.
// Echo the same user events as Pi, without image conversion or a model call.
import assert from 'node:assert/strict';
import { attachJsonlLineReader } from './node_modules/@earendil-works/pi-coding-agent/dist/modes/rpc/jsonl.js';
let received = 0;
attachJsonlLineReader(process.stdin, line => {
  const prompt = JSON.parse(line);
  assert.equal(prompt.type, 'prompt');
  assert.equal(prompt.images.length, 30);
  let bytes = 0;
  for (const image of prompt.images) {
    assert.equal(image.type, 'image');
    assert.equal(image.mimeType, 'image/png');
    bytes += Buffer.from(image.data, 'base64').length;
  }
  assert.equal(bytes, 100 * 1024 * 1024);
  const message = { role: 'user', content: [{type: 'text', text: prompt.message}, ...prompt.images] };
  for (const type of ['message_start', 'message_end']) {
    process.stdout.write(JSON.stringify({ type, message }) + '\n');
  }
  process.stdout.write(JSON.stringify({ type: 'response', id: prompt.id, command: 'prompt', success: true }) + '\n');
  received++;
});
process.stdin.on('end', () => assert.equal(received, 1));
