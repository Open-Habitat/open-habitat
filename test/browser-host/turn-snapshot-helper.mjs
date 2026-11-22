// The synthetic Pi's stand-in for the turn-snapshot recorder and for the
// rewind extension's snapshot restore (scenario pi-snapshots, snapshots.go):
// the real recorder module takes the snapshots, compares them and restores,
// so the daemon reads a real store. Usage: node turn-snapshot-helper.mjs
// <snapshot|stat|rewind> <json>; prints one JSON result.
import { readFileSync } from 'node:fs';
import { pathsChangedSince, restorePaths, snapshotNow, turnSnapshotsFromEntries } from '../../internal/daemon/turn-snapshots/src/turn-snapshots/index.ts';
import { diffTreeNumstat, storeDirectory, summarizeNumstat, takeSnapshot } from '../../internal/daemon/turn-snapshots/src/turn-snapshots/store.ts';

const [command, raw] = process.argv.slice(2);
const a = JSON.parse(raw);
let out;
if (command === 'snapshot') {
  out = await takeSnapshot({ agentDir: a.agentDir, storeId: a.storeId, cwd: a.cwd, sessionFile: a.sessionFile, label: a.label });
} else if (command === 'stat') {
  out = summarizeNumstat(await diffTreeNumstat(storeDirectory(a.agentDir, a.storeId), a.from, a.to));
} else if (command === 'rewind') {
  const entries = readFileSync(a.sessionFile, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const records = turnSnapshotsFromEntries(entries);
  const start = records.find((r) => r.phase === 'start' && r.userEntryId === a.entry && r.tree);
  if (!start) out = { restored: 0, errors: 0 };
  else {
    const { paths } = await pathsChangedSince(a.agentDir, records, a.entry);
    const undo = await snapshotNow({ agentDir: a.agentDir, storeId: a.storeId, cwd: start.cwd, sessionFile: a.sessionFile, labelPrefix: 'oh-rewind' });
    if (!undo.tree) out = { restored: 0, errors: paths.length };
    else {
      const result = await restorePaths(a.agentDir, start, paths);
      out = { restored: result.changedFiles.length, errors: result.errors.length };
    }
  }
} else throw new Error('unknown command');
process.stdout.write(JSON.stringify(out));
