# Result: idle Pi shuts down automatically

The daemon checks its owned Pi children once a minute. After ten minutes of
consecutive idle observations it uses the same graceful stop/reap path as
archive. Reading a conversation starts nothing and does not keep Pi alive;
the next send resumes from native history. Stops log `conversation_idle_stop`
with fixed reason `idle_timeout` and outcome `stopped` or `uncertain`.

## Decisions for later review

1. **Ten minutes idle; one-minute checks.** Both are daemon constants, not
   persisted configuration. Alternatives: shorter deadlines save memory sooner;
   longer ones reduce restarts. Ten minutes leaves room for reading an answer
   and continuing. Polling bounds overhead and reuses the existing shared probe.
2. **Idle means the existing shared busy definition says idle.** A running or
   submitted turn (including an in-turn spinoff wait), held/queued input,
   pending question, title/recap/abort, unpublished settlement, running processes
   or unknown state keeps Pi alive. No separate definition or Taskfleet registry.
3. **Count from the first idle observation, not the last prompt.** Background
   work can finish much later than the turn. A busy observation clears the idle
   period; a newer prompt/settlement also resets it. Alternative: expire directly
   from `lastUsed`, which could stop Pi immediately after a long background job.
   The check interval adds up to a minute; automatic recap work can delay the
   deadline further. The clock is injected as the sweep's `now` argument in tests.
4. **Send during graceful stopping retains existing behavior:** a brief conflict
   response, not an automatically repeated write. Once reaped, lazy resume is
   unchanged and browser command IDs remain spent. No new message queue/store.

## Evidence

Synthetic homes and fake Pi only; no deployment, push or live-server access.

Validation and independent review results are recorded below before closing.

A full-suite run exposed a shared stop-path race: the RPC pipe's EOF could
publish `uncertain` before the exit watcher ran, and `closeStopping` only
updated `stopping`. An immediate send could therefore be refused despite a
reaped Pi. A completed stop now reconciles both states without overwriting a
new `starting` handle. A deterministic regression covers that ordering.

Development validation initially failed for three fixture/assertion mistakes,
all corrected: a duplicate command correctly returns 409 rather than 200;
Python's prompt log JSON-escapes non-ASCII text, so the assertion now reads
decoded prompts; and UI `idle` can precede title/history publication, so the
injected clock now advances only after the shared busy definition is idle.
The full-suite failure above was a real stop-path race, not a fixture issue.

Final validation (all passed on the implementation in this worktree):

- `go test -race ./internal/daemon -run 'Test(IdleTimeout|GracefulIdleStop)' -count=30`
  (final post-review run: 10.1 s): timeout boundary, all held busy reasons, running/unknown/finished
  background inventory, recent-turn reset, lazy resume with one delivery and
  retained native history, EOF/reap ordering.
- `go test -race -count=1 ./internal/daemon ./internal/gateway ./internal/cli ./test/browser-host`
  (final post-review run: daemon 78.7 s): daemon and callers passed; browser-host compiles, no Go tests.
- `go build ./...`, `go vet ./internal/daemon ./internal/gateway ./internal/cli ./test/browser-host`.
- `scripts/test-focused.sh --area contracts`: generation clean; 52 schemas,
  47 fixtures, 35 scenarios and 17 negative checks valid.
- `python3 scripts/validate-project-view.py`, `git diff --check`.

Go commands used `umask 077` and a fresh short disk-backed `/var/tmp/oh-*`
TMPDIR. Web and pinned Pi test dependencies were installed successfully.
No browser behavior or contract changed, so no Playwright run was selected.
Not established: real pinned Pi extension behavior, live-server behavior,
or distinct-UID isolation (unchanged security boundary).

## Independent review and assessment

`/llm-review` finder `claude-fable-5-1` inspected the lifecycle change,
including lazy-resume callers and the revised tests. Its one finding was a
pre-existing rejected-prompt bug in the shared busy definition: `beginPrompt`
cleared the old settlement; rejection restored `settled` but not `settlement`,
leaving Pi classified as a turn forever. Local test
`TestIdleTimeoutAfterRejectedPrompt` failed with `busy: turn` before the fix
and passed after it. The pinned Pi RPC code emits `success:false` when prompt
preflight fails (including missing model/auth availability); no later turn
settlement is guaranteed in that path. This is an occasional real failure,
not merely a hypothetical data combination.

The correction carries the previous settlement alongside the existing
`wasSettled` flag through both direct and held submissions and restores it only
on rejection. The shared busy definition itself is unchanged. Assessment:
CONFIRMED / OCCASIONAL / NEUTRAL / MINOR → FIX (applied). Independent verifier
`gpt-6-astra` confirmed the original finding and inspected the applied fix,
including both submission paths. It refuted an overwrite concern at the changed
EOF/reap reconciliation: `starting` is preserved and new children have new
conversation handles. No findings remain open. Frequency is uncommon and not
measured; ordinary provider errors after acceptance do not trigger this defect.


The full command sequence above was rerun successfully after the reviewed
rejected-prompt correction; all claims refer to that final runnable tree.
`issuectl doctor --json` and the project-view validator also passed after
closing the issue. `KOKEILTAVAA.md` has the Finnish pilot checks at the top.

Failure inventory: early test failures and their corrections are recorded
above, including the deliberately failing rejected-prompt regression. All
required checks subsequently passed. The first combined skill-file read used
a nonexistent pi-processes path; the declared installed path was read in full
before running managed processes. No required tool/service remains failed or
incomplete. Performance-corpus publication was intentionally disabled under the
no-push brief; no optional external service failed. The live/real-Pi checks
listed above were not attempted and are not claimed.
