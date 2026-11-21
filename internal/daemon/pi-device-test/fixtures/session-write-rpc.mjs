// Synthetic RPC command: fail an actual SDK append part-way, then append
// again. No provider is contacted.
//   /tear prefix   the failed call left a prefix of its own entry
//   /tear foreign  bytes that are not the entry's (the guard may not cut them)
//   /tear hang     as foreign, and the command never settles, so Pi's
//                  graceful shutdown waits forever unless something ends it
//   /tear hang-shutdown  as foreign, and this extension's session_shutdown
//                  handler (after the companion's) never settles
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import assert from 'node:assert/strict';

export default function (pi) {
  let hangShutdown = false;
  pi.on('session_shutdown', () => (hangShutdown ? new Promise(() => {}) : undefined));
  pi.registerCommand('tear', {
    description: 'Synthetic persistence failure',
    handler: async (args, ctx) => {
      const mode = String(args ?? '').trim();
      hangShutdown = mode === 'hang-shutdown';
      const file = ctx.sessionManager.getSessionFile();
      const before = fs.readFileSync(file);
      const append = fs.appendFileSync;
      const error = Object.assign(new Error('synthetic full quota'), { code: 'EDQUOT' });
      fs.appendFileSync = (path, data, ...rest) => {
        if (path !== file) return append(path, data, ...rest);
        append(path, mode === 'prefix' ? Buffer.from(data).subarray(0, 53) : '{"foreign":', ...rest);
        throw error;
      };
      syncBuiltinESMExports();
      try { assert.throws(() => pi.appendEntry('failed', {}), e => e === error); }
      finally { fs.appendFileSync = append; syncBuiltinESMExports(); }
      if (mode === 'prefix') {
        assert.deepEqual(fs.readFileSync(file), before, 'the torn bytes are gone');
        pi.appendEntry('after-room', { kept: true });
        fs.writeFileSync(`${file}.test-proof`, fs.readFileSync(file));
        return;
      }
      const torn = fs.readFileSync(file);
      assert.throws(() => pi.appendEntry('must-not-glue', {}), e => e === error);
      assert.deepEqual(fs.readFileSync(file), torn);
      fs.writeFileSync(`${file}.test-proof`, torn);
      if (mode === 'hang') await new Promise(() => {});
      throw error;
    },
  });
}
