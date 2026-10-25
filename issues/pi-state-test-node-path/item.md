---
created: 2026-10-25
updated: 2026-10-25
type: bug
reporter: claude
status: fixed
priority: normal
lane: unlaned
collision: [internal/daemon]
closed: 2026-10-25
closed_by: claude
---

# TestPiRPCNativeState needs node on the restricted PATH

## Description

A follow-up to `tests-hardcode-system-node`. On Birch (2026-10-25), the full gate is green except `internal/daemon` `TestPiRPCNativeState`: `real Pi get_state: false Pi acceptance uncertain: output closed`. The test launches `pi-device-test/node_modules/.bin/pi`, a `#!/usr/bin/env node` script, with `PATH=/usr/bin:/bin`. Where node lives only in the account's PATH (`~/.local/bin`), `env` cannot find node, and Pi exits immediately. Alder hides this because it has `/usr/bin/node`.

## Acceptance Criteria

- [x] The test launches Pi through the shared node lookup helper (resolved node plus the Pi CLI entry, as the other native tests do), keeping the restricted child PATH.
- [x] `go test ./internal/daemon -run TestPiRPCNativeState` passes on Birch (`ssh birch`, a clone under `/var/tmp`), and the full gate passes on Alder.

## Result

Test-only fix: `TestPiRPCNativeState` resolves Node with `nativeNodePath(t)` and passes the pinned `dist/bundle/cli.js` entry to `launchPiRPCCommand`; child PATH remains `/usr/bin:/bin`.

Validated runnable revision `1e95ac5ff14506c9dcad56812f50a362f31dfc31`:

- Birch, fresh bundle clone `/var/tmp/pi-state-01m5sb5w77-clone`, account `maintainer`: installed fixtures with `npm ci --prefix internal/daemon/pi-device-test --ignore-scripts`; `umask 077; PATH="$HOME/.local/bin:$PATH" go test -v -count=1 ./internal/daemon -run TestPiRPCNative` passed all three tests. Node resolves outside system PATH.
- Alder: all native RPC tests passed with a logging Node wrapper first on PATH. Its invocation log proves the resolved wrapper launched `cli.js --mode rpc` despite restricted child PATH.
- Alder: `umask 077; TMPDIR=/var/tmp/agent-scratch/n7 flock --shared /var/tmp/agent-scratch/.lease go test -count=1 ./internal/daemon` passed (168.701s).
- `./scripts/ci-local.sh --clean --json` passed without phase reuse. Receipt: common Git directory `open-habitat-gate-receipts/be49e20486e753897d3d908bc95d0a838294347c.json`.

Focused mechanical self-review: only the test changed; CLI invocation matches existing native RPC tests, and get_state still requires a real Pi acknowledgement. Searched native launch sites, env-node shebangs, system Node paths and `.bin/pi` usages in `internal/`, `scripts/`, `test/`. Other native RPC `.bin/pi` references only check fixture availability. Production uses the explicit checked runtime Node; no production assumption requiring a change was found.

Failures recovered during validation: SSH non-login PATH lacked user tools (set explicit PATH); first bundle transfer timed out (complete retransmission succeeded); initial standalone runs used inherited umask 0002 (reran with 077); a full daemon retry exceeded Unix socket path length and overlapped gate fixture installation (shorter scratch path and non-overlapping install fixed it); first gate dependency download hit npm ETIMEDOUT (clean retry passed). No required check remains failed or incomplete.

Gate invocation held the shared scratch lease and exported scratch TMPDIR, but the existing gate script resets TMPDIR to disk-backed `/var/tmp` internally; it was not changed outside test-only authority. Logs, alternate-node invocation proof and detailed self-review remain at `/var/tmp/agent-keep/pi-state-01m5sb5w77/`.
