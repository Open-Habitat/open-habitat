# Result

Whole-suite browser runs now take a host-wide lock, `scripts/browser-suite-lock.py`
(flock on `/var/tmp/open-habitat-browser-suite.lock`). It wraps
`browser-focused.py` when neither `--spec` nor `--tag` is given, which covers
`test-focused.sh --area browser`, `npm run test:browser` and
`test:browser:lab`. It also wraps the gate's browser phase in `ci-local.sh`,
where one hold covers both the ordinary and the lab suite. A waiter prints
`waiting for browser suite lock held by <worktree> (pid, since)` and how long
it waited. TESTING.md documents the lock.

## Evidence

The lock was tested with dummy holders on a private lock file
(`OH_BROWSER_SUITE_LOCK`) on Birch:

- Holder A was running `sleep 3` when B started. B printed the waiting message
  naming A, started only after A ended, and kept its own exit code (7).
- A wrapper killed with SIGKILL while holding the lock released it; the waiter
  acquired it 2 s later.
- SIGTERM to the wrapper terminated its child, and the wrapper exited 143.
- While the lock was held, `browser-focused.py --spec …` and `--tag …` ran at
  once (stub `npx`), and the bare whole-suite invocation waited.
- The `ci-local.sh` form (`9>&2 >log 2>&1`, `--status-fd 9`) sends the waiting
  message to the terminal and the command's output to the log.

I then ran one whole suite and one lab suite on Birch through the real lock
(`OH_BROWSER_WORKERS=4`); no other suite held the lock, so neither waited. The
lock file was created with mode 0644 and named this worktree as holder.

- Whole suite (`test-focused.sh --area browser`), 11.0 min: 406 passed,
  3 skipped and 4 failed.
- Lab suite (`--area browser --lab`), 4.1 min: 135 passed and 2 failed.

All six failures are the ones already recorded in `main-browser-suite-red`:
`title-regeneration.spec.ts:161`, the three `browser-conversation.spec.ts:465`
send-receipt cases, and the two `lab-title-generation.spec.ts:8` cases. This
change touches only test tooling.

## Decisions for later review

- Tag runs (`--tag`) are not locked: the issue exempts named-spec runs, and a
  grep tag selects a named subset too. A broad tag can still be heavy.
- The lock file sits in shared `/var/tmp` with mode 0644, so another Unix user
  on the host can open it read-only and take part in the lock. If that user
  already owns the file, the description of the holder is not written.
- The lock is held by the wrapper process, not inherited by the suite's
  children (close-on-exec). If someone SIGKILLs only the wrapper, the suite
  keeps running unlocked. The alternative, letting the children inherit the
  lock, would let a leaked browser or synthetic host hold it forever.
- A bare `npx playwright test` bypasses the lock; TESTING.md says to use the
  scripts for whole suites.
