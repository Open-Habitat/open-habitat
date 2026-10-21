# Integrations and protected credential input batch

This is a partial slice-3 delivery, not completion of the login inventory.

## Delivered

- `agent integration list`: native provider availability, account addresses and
  service/sync state through the same catalog instance the browser uses.
- `agent integration-account create/update/delete`: native IMAP/CalDAV/CardDAV
  password configuration, password replacement, and local account removal
  (including OAuth accounts already present). Input is bounded protected JSON
  through `--input-file FILE|-`, with the action supplied by the command.
  Removal explicitly requires `delete_directories`; true uses the existing
  stop-sync-before-Trash operation, not permanent deletion or grant revocation.
- `agent credential list/update/delete`: native Pi literal OpenAI API key
  presence/save/remove, preserving subscriptions. Raw keys enter only via
  `--secret-file FILE|-`. Native Pi can adjust model defaults on key changes.
- Files must be regular, own-UID, non-symlink and inaccessible to group/others;
  redirected stdin is supported. Maximum input sizes are 8192 bytes for account
  JSON and 256 bytes for keys. Invalid arguments, paths and parser/native errors
  are not echoed. Replies retain native redaction (presence and at most a
  literal API key's four-character suffix); configured references are not resolved.
- Four explicit agent routes reuse account operations and the Pi credential
  handler, behind the existing kernel own-UID gate. No browser mux forwarding,
  gateway/broker operation, identity selector, or new credential store exists.
  The production catalog is shared, preserving its write lock and sync ownership.
- Each write explicitly refuses dry-run before reading secrets or starting
  native work. Missing replies/503 are uncertain; no automatic retry or new
  credential transaction ledger is introduced. Help and the bundled agent skill
  document protected inputs, side effects and remaining gaps.

## Verification

Checks on this batch's working tree, based on `5ad569e73bf7ab18ae6ed063b545281da2595ab6` (the exact parent is
recorded by the landing commit), with `TMPDIR=/var/tmp`:

- `npm ci --prefix internal/daemon/pi-device-test --ignore-scripts`: installed
  the pinned native SDK test dependency.
- `umask 077; go test -race ./internal/cli ./internal/daemon
  ./internal/daemon/integrations ./internal/transport`: passed. Initial native
  daemon run took 85.497s, integrations 11.138s, transport 2.098s. A corrected CLI
  fixture and stricter duplicate-input/global-error redaction were followed by
  passing package reruns; final CLI check took 8.375s. Unchanged package results
  were cached in the final combined run (9s wall), not rerun native evidence.
- `./scripts/test-focused.sh --area contracts`: passed, generation clean,
  60 schemas, 61 fixtures, 39 scenarios, 17 negative checks. No wire shape changed.
- `./scripts/test-agent-uids.sh`: passed (102s with the preceding contract check).
  Disposable networkless Ubuntu container: activated socket pairs, broker socket
  readiness and owner/foreign/root/gateway probes. Every new path is denied at
  the kernel-peer gate even after socket permissions are deliberately widened;
  no distinct-UID test was skipped. The UID route test itself took 96s.
- `python3 scripts/validate-project-view.py`, `issuectl doctor --json` and
  `git diff --check`: passed.

One initial CLI test failed because umask 077 made its intended 0644 fixture
0600. Explicit chmod fixed the fixture; the retry passed without weakening the
protected input check. The reviewer's optional run under umask 0002 hit the
existing native writable-directory refusal; required documented-umask tests
passed. No full gate or web suite was run (no web change).

Tests use synthetic homes, keys and native tool fixtures only.
The actual provider services and deployed test host have not been exercised by
this worker. No Fleetrepo change is required: the existing own-UID socket is used.

## Independent security review and assessment

`/llm-review --rigor critical`: finder `claude-fable-5-1` and independent
high-risk false-negative verifier `gpt-6-astra` completed (two calls). No actionable
security finding or unresolved candidate; `/assess-findings` produced an empty
finding table (0 fixes/spin-offs/discussions/drops). No issues filed.

Local verification traced all four routes through the own-UID accept/handler
gates, confirmed browser/login/gateway/broker route absence, shared catalog writer
and sync ownership, native-only stores, stdin-only native secret handoff, fixed
errors/diagnostics and redacted replies, and unchanged safe Trash operations.
Duplicate protected JSON and leading malformed global flag values were rejected;
write-side 5xx wording explicitly warns about uncertain outcomes and no replay.
No conversation ownership, one-writer, observation-token or typed-delete check
was relaxed. Review scratch is `history/review-agent-integrations.md` and
`history/assessment-agent-integrations.{json,md}` (not durable acceptance).

## Remaining

Keep `agent-cli-surface` open. Integration OAuth start/relogin, redirect handling,
folder selection/cancellation and Pi device/Claude subscription login still need
own-UID adapters. Existing login attempts are browser-session-owned leases;
exposing those handlers or accepting a forged session owner is not a substitute.
This delivery intentionally does not mark those inventory rows native/complete.

Also still outstanding from slice 3: history discovery and large-block reads,
receipts, process observations/controls, questions and command/file discovery as
appropriate, attachments/local-file requests, whole-surface canon completion and
live acceptance. Earlier native git/gh/tmux/Taskfleet boundaries remain unchanged.
