# SessionManager glues the next entry onto a torn append in the same process after ENOSPC/EDQUOT

Posting destination: https://github.com/earendil-works/pi/issues/new
Repository: https://github.com/earendil-works/pi (the published package's
`repository` field; `directory: packages/coding-agent`)
Source: `packages/coding-agent/src/core/session-manager.ts`, `_persist`

Draft only; not posted. Checked on 2026-11-21 against v1.5.2 (npm) and `main`
at `cb1205e46` (v1.6.0 has the same `_persist`). Related upstream items:
#8345 (closed; fixed by the load-time newline in `loadEntriesFromFile`) and
#11460 / #11486 (the in-memory rollback in `_appendEntry`). This report is
the remaining gap between those two: a running manager after a failed write.
New-contributor issues are auto-closed until a maintainer reviews them, so
the poster should expect that and not re-file.

---

## Title

SessionManager: after a write cut short by ENOSPC/EDQUOT, the next append in the same process is glued onto the fragment and lost on reload

## Environment

- `@earendil-works/pi-coding-agent` 1.5.2 from npm; the same code is on `main`.
- Node 22, Linux (Ubuntu 24.04 container).
- A private 1 MiB tmpfs with a filler file, so the kernel itself cuts the write.
- No model, provider, API key or extension involved.

## What happens

`_appendEntry` now rolls a failed entry back in memory (#11486), but the
bytes `appendFileSync` managed to write before ENOSPC/EDQUOT stay in the
file. `_persist` does not check the file's last byte before its next
`appendFileSync`, so once space is freed the next successful entry is
written straight after the fragment. The resulting newline-terminated line
is not valid JSON:

- the live manager holds the new entry, but reopening the file skips the
  line, so the entry is lost, and every later entry's `parentId` points at
  it, which cuts the branch on reload (the symptom of #11460);
- a host that reads the history strictly refuses the file as damaged.

The load-time repair from #8345 only runs when a file is opened, so it does
not help a manager that keeps running after the failure.

Expected: a failed append must not cause a later successful entry to be lost.

## Minimal reproduction

Run in an isolated container with a fresh, empty 1 MiB tmpfs at `/data`
(for example `podman run --rm --network none --tmpfs /data:rw,size=1m ...`).
Do not fill a shared filesystem to reproduce this.

```sh
npm install --ignore-scripts @earendil-works/pi-coding-agent@1.5.2
node repro.mjs
```

```js
// repro.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { SessionManager } from '@earendil-works/pi-coding-agent';

const volume = fs.statfsSync('/data');
assert.equal(volume.type, 0x01021994); // tmpfs
assert.equal(volume.blocks * volume.bsize, 1024 * 1024);
assert.deepEqual(fs.readdirSync('/data'), []);

const sm = SessionManager.create('/synthetic', '/data/sessions');
sm.appendMessage({ role: 'user', content: 'saved', timestamp: 1 });
const file = sm.getSessionFile();
const before = fs.statSync(file).size;
const leaf = sm.getLeafId();

const free = fs.statfsSync('/data');
fs.writeFileSync('/data/filler', Buffer.alloc((free.bavail - 1) * free.bsize));
assert.throws(() => sm.appendCustomEntry('failed', { text: 'x'.repeat(65536) }), { code: 'ENOSPC' });
assert.ok(fs.statSync(file).size > before);      // a real partial write
assert.notEqual(fs.readFileSync(file).at(-1), 10); // file ends mid-line
assert.equal(sm.getLeafId(), leaf);                // memory rolled back (#11486)

fs.unlinkSync('/data/filler');
const id = sm.appendCustomEntry('later', {});      // succeeds
assert.ok(sm.getEntry(id));
const last = fs.readFileSync(file, 'utf8').trimEnd().split('\n').at(-1);
assert.throws(() => JSON.parse(last));             // fragment + complete entry
assert.equal(SessionManager.open(file).getEntry(id), undefined); // lost
console.log('Reproduced: a successful later append is lost on reload');
```

Observed: the failed write added 7,911 bytes before ENOSPC; the next entry
was glued to them and was missing after reload. The exact byte count depends
on the session length and the filesystem's block size.

## Proposed fix

Before the `appendFileSync` in `_persist`, check the file's last byte (read
one byte at `size - 1`, not the whole history). When a non-empty file does
not end in `\n`, append a newline first, and only then the entry. If that
boundary write fails, propagate the error without attempting the entry.
The fragment then stays a malformed line that the loader already skips, and
the new entry keeps its own line and its valid parent.

That keeps a skipped garbage line in the file. A complementary fix that
leaves the file valid JSONL is to mirror the in-memory rollback on disk:
note the file size before the write and, if the write throws, truncate back
to it (shrinking needs no free space, so this works at a full quota). The
same applies to the first flush in `_persist`, where a failed `wx` write
leaves a partial file that makes every later flush fail with `EEXIST`;
removing the file the failed call created fixes both.

Tests worth adding: failed write → free space → append in the same manager
→ reopen; a complete record without its newline; failure of the boundary
newline write itself; a failed first flush.

I'm happy to send a PR with these regression tests.
