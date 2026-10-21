# Result

## Cause and change

The embedded host context advertised environment/context reads and already pointed
to `open-habitat skill print agent`. That skill already documented notices and
CLI help already exposed `agent notice create`; this was not an absent command
or a missing skill. The missing piece was a direct cue connecting a person's
request for a conversation reminder to notices, rather than treating it only as
an unsupported scheduled alarm.

The release-provided context now points to general agent help and explicitly
routes reminder/notice requests to notice creation, with command help and the
existing skill supplying inputs and persistence semantics. It distinguishes an
immediate dismissible notice from scheduled delivery. No new tool, authority,
registry or context-injection mechanism was added.

## Review and limits

Focused self-review compared the guidance with the existing CLI help, agent skill,
and native Pi prompt-section injection. This is proportionate to a short context
change with no executable behavior or authority change. The test extends the
existing pinned native-Pi/synthetic-provider test instead of adding a duplicate
journey; it checks CLI entry points in the actual provider request independently
of the embedded guide value, without freezing prose or UI wording.

A real provider/model turn was not run: repository tests use synthetic credentials
and do not borrow personal accounts. Native Pi with a synthetic provider proves
prompt delivery, not that every model follows it. The Finnish next-update item
asks for an unprompted reminder request in a new conversation on the test server.

## Verification

- Before the fix, the extended `TestPiRPCNativeSyntheticProvider` failed with
  `native Pi did not load context: "open-habitat agent --help"` (log:
  `/var/tmp/notices-before.log`). This is the intended red regression result.
- After the fix, `TMPDIR=/var/tmp; umask 077; go test ./internal/daemon
  ./internal/cli -count=1` passed, including the pinned native-Pi regression
  (daemon 82.804s, CLI 0.083s; `/var/tmp/notices-go.log`).
- `./scripts/test-focused.sh --area contracts` passed generation drift and
  validation (63 schemas; `/var/tmp/notices-contracts.log`).
- `issuectl doctor --json`, `python3 scripts/validate-project-view.py`, and
  `git diff --check` passed. Doctor reports existing image-format advisories.
- Tested code is based on `266d93f8a9b034fef1c1e3bbb54d1051a07d2cf9` plus this
  delivering commit's context/test diff. No browser code changed, so browser/web
  suites were not selected. Full gate is left to the conductor as requested.
- The requested `done` close was rejected by issuectl's bug-status rule; closed
  as `fixed`, its supported completed-bug status. No implementation step was
  blocked. Initial directory/glob probes found no daemon-local AGENTS.md or
  CLI skill Go file; the governing internal instructions and actual embedded
  skill/help were read instead.
