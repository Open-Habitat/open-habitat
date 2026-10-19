# Daemon gate-load reliability

## Diagnosis

The gate runs browser hosts and `go test -race ./...` concurrently under one
Unix UID. The daemon package itself has no `t.Parallel` calls. Two different
assumptions failed under that shared load; there is no evidence that a single
15-second CPU delay caused both occurrences.

- On this run, `/proc/sys/fs/inotify/max_user_instances` was **128**,
  `max_user_watches` 121385 and `max_queued_events` 16384. The UID already had
  **90 visible inotify descriptors** before pressure (38 browser-host, 20 Pi,
  and others), and about **4410 visible FDs**. The process FD limit was
  **524288**. Descriptor counts are an upper bound on visible instances
  (fork/dup share instances), not exact kernel headroom. Inotify's UID-wide
  instance quota, not the process FD ceiling, is the credible resource limit
  behind the original watcher failure. No host sysctl was changed.
- EOF and child reaping are independent goroutines. Both the event drain and
  readiness handler previously exposed `start_failed` on EOF **before** the
  old child had been reaped. A send immediately starts a retry, but
  `relaunchFresh` correctly refuses an unreaped writer as `writer_present`.
  A late old-child watcher could also overwrite that retry's `starting`
  state. The held receipts then stay held: waiting another 15 seconds cannot
  repair the failed transition. Load enlarges these scheduling windows.
- A controlled EOF-before-reap fixture reproduces both premature failure
  publications in the original implementation, without depending on scheduler
  luck. The ordinary failed-start test passed 1000 times pinned to one CPU;
  this is why merely increasing its timeout would be unjustified. The original
  gate did not preserve detailed session state, so this run cannot prove which
  exact interleaving caused that historical timeout.

## Changes

`awaitReady` now owns startup failure and performs bounded RPC cleanup before
publishing it. The process watcher and event drain leave startup failure to
that handler. The new regression holds reaping behind a channel and verifies
that EOF cannot expose a retry and that held content survives cleanup.

The external-append test captures the actual inotify-init error. It skips only
`EMFILE` **with ordinary file-descriptor headroom**, the kernel's per-UID
inotify-instance exhaustion case. Registration errors and process FD exhaustion
still fail. Watcher cancellation is joined so repeated tests do not leave a
polling watcher alive until after their temporary home is removed. Existing
injected-init-failure coverage still proves native history remains readable.

The gate prints the visible UID inotify/FD counts, kernel instance limit,
process FD limit and load average before its parallel heavy phases. This is
observability only; it never waives tests. Browser worker counts, gate
parallelism and test deadlines are unchanged.

## Evidence

Base revision: `ff70c503`. All Go commands used `umask 077` and short
`/var/tmp/oh-XXXX` scratch directories. Both npm dependency installs completed.

- Original `go test ./internal/daemon -count=3`: PASS (138 s wall time).
- Original held retry test, `taskset -c 0 ... -count=1000`: PASS (47 s).
- New controlled regression against original product code: FAIL as expected,
  `EOF advertised "start_failed" before child reap` and
  `before reap: state="start_failed" held=1`.
- Fixed focused watcher/held/regression tests under `-race -count=20`: PASS.
- `./scripts/check-generated.sh`, `bash -n scripts/ci-local.sh`,
  `git diff --check`: PASS.

- Original full suite under pressure, `-count=3`: PASS (270.887 s test
  time, 272 s wall). General load alone did not reproduce the flake.
- Controlled regression against original product code using a Go overlay,
  pinned to CPUs 0/1 while that same pressure harness ran: FAIL as expected
  (0.011 s test time). This reproduces the ordering defect without exhausting
  the shared host or guessing how much delay is enough.
- Focused contracts checks: PASS (47 schemas, 40 fixtures, 34 scenarios,
  12 negative checks).

- First fixed five-repeat run: PASS (227.038 s test time, 230 s wall), while
  the separate pressure experiment was still active. It is **not** the final
  no-deliberate-pressure evidence.

### Final-code validation

Product revision: `e1a74992f0799f0056030c58ed71f768bbcb6f4d` (following
`987f6c3c`). Only issue evidence changes after this revision.

- Final focused held/regression suite, `-race -count=20`: PASS (60.374 s).
- Final full daemon suite with the adjacent pressure harness, `-count=5`:
  PASS (427.938 s). The harness then terminated/joined its burners and closed
  its 16 instances before launching the no-deliberate-pressure run.
- Final full daemon suite without deliberate pressure, `-count=5`: PASS
  (233.457 s), launched only after the pressure harness finished its cleanup.
- The committed clean-gate result is recorded below when complete.

### Independent review

`/llm-review --no-perf-log` used claude-fable-5-1 as finder and gpt-6-astra
as the focused concurrency verifier (two calls). Two reachable cancellation
edge cases in the first fix were confirmed locally and by caller tracing:
returning messages from a reaped startup could leave a spurious failure, and
stop→retry could reuse the old handle's `starting` state before replacement.
Both are fixed with a never-reset per-child cancellation fence; fresh child
objects start unfenced. Controlled tests cover cancellation during cleanup
and the old state being reused before the late publication returns. The
explicit stop also sets that fence atomically before asynchronous cleanup.

The finder initially saw an older test lacking its post-reap assertion; the
final test does check post-reap state and content, so that candidate was
dropped. `/proc` errors named by the diagnostic candidate were already caught;
the invocation is now also explicitly nonfatal because it is observation only.
Local review/assessment artifacts are in ignored `history/`, and this summary
preserves their actionable result. No follow-up issue was needed. Performance
corpus logging was disabled rather than pushing from a no-push worker.

### Pressure experiment

A private Python harness holds 16 additional inotify instances and runs two
CPU burners, with the test subprocess pinned to CPUs 0 and 1. It terminates
only its own burners and closes its own FDs in `finally`; no other sessions or
host settings are touched. Forked burner children inherit the 16 descriptors,
so `/proc` reports 48 extra descriptors, **not** 48 new instances. The baseline
snapshot under pressure was 139 visible inotify descriptors, ~4452 FDs and
load average 4.59/4.45/2.96 on eight CPUs. The adjacent `pressure.py` preserves
this harness with a 590-second subprocess bound and portable selection of the
first two allowed CPUs:

```sh
umask 077
export TMPDIR=$(mktemp -d /var/tmp/oh-XXXX)
python3 issues/downright-public-cub/pressure.py go test ./internal/daemon -count=5
go test ./internal/daemon -count=5
```

For red/green replay, use `go test -overlay <mapping.json>` with the three
changed product Go files replaced by their `ff70c503` contents; retain the
new tests. Run `-run '^TestFailedStartWaitsForChildReapBeforeRetry$' -count=1`.
No worktree code needs to be reverted for this replay.

### Failure inventory

The first pressure harness launch failed before running Go because Python
3.14's default forkserver requires a main guard. It was corrected to use the
explicit fork context and rerun. An initial foreground focused race command
was interrupted by the tool's 20-second limit; the managed-process rerun passed.
The failing original-code regression is intentional red/green evidence, not
an outstanding failure. The review finder reported its own sandbox's
end-to-end create returning 503 even on the base revision; its local unit and
watcher checks passed, but it supplied no end-to-end evidence. The host-agent
suite runs, not the review sandbox, supply that evidence. The verifier did not
run tests.

## Decisions for later review

- Fix the real startup-order race rather than retrying an uncertain product
  write or extending the test timeout. No new authority or persistence.
- Keep default gate concurrency. Reducing workers would conceal the race and
  only temporarily defer a UID-wide inotify shortage.
- Recommend Fleetrepo review Alder's instance limit (128 is tight for concurrent
  development/browser workloads). This repository does not change the host.

No KOKEILTAVAA entry: this is gate health, not a new live-check journey.
