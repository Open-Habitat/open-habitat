// Run only in a disposable container with a private 1 MiB tmpfs at /data.
// No mocked writes: the kernel cuts the SDK append and returns ENOSPC.
// From the repository root, after npm ci in pi-device-test:
//   for mode in unguarded guarded; do
//     timeout 120 podman run --rm --network none --tmpfs /data:rw,size=1m \
//       -v "$PWD/internal/daemon/pi-device-test:/fixture/pi-device-test:ro" \
//       -v "$PWD/internal/daemon/process-extension.mjs:/fixture/process-extension.mjs:ro" \
//       -v "$(readlink -f "$(command -v node)"):/usr/local/bin/node:ro" \
//       docker.io/library/ubuntu:24.04 node /fixture/pi-device-test/fixtures/session-enospc.mjs "$mode"
//   done
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { SessionManager } from '@earendil-works/pi-coding-agent';
import { guardSessionWrites } from '../../process-extension.mjs';

const guarded = process.argv[2] === 'guarded';
const volume = fs.statfsSync('/data');
assert.equal(volume.type, 0x01021994, 'requires a private tmpfs');
assert.equal(volume.blocks * volume.bsize, 1024 * 1024, 'requires a 1 MiB volume');
assert.deepEqual(fs.readdirSync('/data'), [], 'requires an empty disposable volume');
const sm = SessionManager.create('/synthetic', '/data/sessions');
sm.appendMessage({ role: 'user', content: 'saved', timestamp: 1 });
const file = sm.getSessionFile();
const saved = fs.readFileSync(file);
const leaf = sm.getLeafId();
let stops = 0;
if (guarded) guardSessionWrites(sm, () => { stops++; });
const free = fs.statfsSync('/data');
fs.writeFileSync('/data/filler', Buffer.alloc((free.bavail - 1) * free.bsize));
assert.throws(() => sm.appendCustomEntry('failed', { text: 'x'.repeat(64 * 1024) }), { code: 'ENOSPC' });
const torn = fs.readFileSync(file);
if (guarded) assert.deepEqual(torn, saved, 'the guard cut the failed bytes');
else {
  assert.ok(torn.length > saved.length, 'write must be cut part way, not fail before writing');
  assert.notEqual(torn.at(-1), 10);
}
assert.equal(sm.getLeafId(), leaf);
if (guarded) {
  // Still full: another attempt fails the same way and is undone again.
  assert.throws(() => sm.appendCustomEntry('still-full', { text: 'y'.repeat(64 * 1024) }), { code: 'ENOSPC' });
  assert.deepEqual(fs.readFileSync(file), saved);
}
fs.unlinkSync('/data/filler');
const id = sm.appendCustomEntry('later', {});
const reloaded = SessionManager.open(file).getEntry(id);
if (guarded) {
  assert.ok(reloaded, 'the later entry survives reload');
  assert.ok(fs.readFileSync(file, 'utf8').trimEnd().split('\n').every(line => JSON.parse(line)));
  assert.equal(stops, 0);
} else {
  const glued = fs.readFileSync(file, 'utf8').trimEnd().split('\n').at(-1);
  assert.throws(() => JSON.parse(glued));
  assert.equal(reloaded, undefined);
}
console.log(JSON.stringify({ guarded, error: 'ENOSPC', partialBytes: torn.length - saved.length,
  laterAppend: guarded ? 'kept-after-rollback' : 'glued-and-lost-on-reload', stops }));
