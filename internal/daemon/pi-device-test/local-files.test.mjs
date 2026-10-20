import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('local_files tool uses the private socket, returns a native path and writes a visible native receipt', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'oh-files-'));
  const socket = join(directory, 'f.sock');
  const source = `const localFilesSocket = ${JSON.stringify(socket)};\n` + await readFile(new URL('../local-files.mjs', import.meta.url), 'utf8') + '\nexport default registerLocalFiles;';
  const register = (await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)).default;
  const calls = [], receipts = [];
  let tool;
  register({ registerTool: definition => { tool = definition; }, sendMessage: (message, options) => { receipts.push({ message, options }); } });
  const server = http.createServer((request, response) => {
    let body = '';
    request.on('data', b => { body += b; });
    request.on('end', () => {
      calls.push(JSON.parse(body));
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify(calls.at(-1).action === 'fetch' ? { attachment: '11111111-1111-4111-8111-111111111111' } : { names: ['notes.txt'] }));
    });
  });
  try {
    await new Promise(resolve => server.listen(socket, resolve));
    assert.equal(tool.name, 'local_files');
    const listed = await tool.execute('list', { action: 'list' }, new AbortController().signal);
    assert.match(listed.content[0].text, /notes.txt/);
    assert.equal(receipts.length, 0);
    const fetched = await tool.execute('fetch', { action: 'fetch', name: 'notes.txt' }, new AbortController().signal);
    assert.match(fetched.content[0].text, /attachments\/11111111-1111-4111-8111-111111111111/);
    assert.deepEqual(calls, [{ action: 'list' }, { action: 'fetch', name: 'notes.txt' }]);
    assert.equal(receipts[0].message.content, 'Agentti haki koneeltasi: notes.txt');
    assert.equal(receipts[0].message.display, true);
    assert.equal(receipts[0].options.triggerTurn, false);
  } finally { await new Promise(resolve => server.close(resolve)); await rm(directory, { recursive: true, force: true }); }
});
