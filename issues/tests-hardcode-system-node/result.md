# Result

Implemented in `7dbba38e` (before closure stamping), tested tree `562aff22c4ff5ae20bd3c00c32e579b3c05dc1f5`.

All eight fixed-path call sites in seven daemon test files now use `nativeNodePath(t)`. It looks up Node on the runner PATH, makes the executable absolute, and fails explicitly when absent. The resume shell launcher single-quotes the resolved executable. Child environments are unchanged; production code is unchanged.

## Validation

- `npm ci --prefix internal/daemon/pi-device-test --ignore-scripts`: passed.
- `umask 077; TMPDIR=/var/tmp/agent-scratch/ns7 go test ./internal/daemon`: passed, 180.153s.
- Compiled daemon test binary, ran from `internal/daemon` with `PATH=/var/tmp/agent-scratch/ns7/alt:/usr/local/bin:/bin`: all seven runnable affected native cases passed (plus native state). `alt/node` is an executable logging wrapper invoking `/usr/local/bin/node`; its invocation log confirms use despite restricted child PATHs. This exercises a non-system Node lookup, not an actual Birch run.
- With `PATH=/nonexistent`, the title-model test failed as expected with `native Pi tests require node on PATH: exec: "node": executable file not found in $PATH`.
- `flock --shared /var/tmp/agent-scratch/.lease env TMPDIR=/var/tmp/agent-scratch/ns7 OH_PORT_BASE=24700 ./scripts/ci-local.sh --clean --json`: passed, 647s, `reused_phases: []`. The existing gate internally resets TMPDIR to `/var/tmp`; the caller supplied scratch TMPDIR and held the lease throughout. Receipt: `/home/maintainer/Sources/open-habitat/.git/open-habitat-gate-receipts/562aff22c4ff5ae20bd3c00c32e579b3c05dc1f5.json`. Subsequent issue evidence/closure changes are not covered by this tree receipt.

## Focused self-review

Reviewed the full final test-only diff: all fixed executable paths removed, restricted environments preserved, helper errors include their cause and caller location, relative executable paths become absolute, and the generated shell safely quotes Node. No production changes or remaining fixed Node paths found in `internal/daemon`. No findings requiring changes.

## Failed/incomplete attempts and limits

- Looking for `internal/daemon/AGENTS.md` returned ENOENT; applicable instructions are in `internal/AGENTS.md`.
- First alternate-path test binary ran from the repository root and skipped dependency-backed cases. Repeated from the package directory; that result supersedes it.
- Initial daemon suite used a group-writable, long scratch path, causing trust checks and Unix socket length failures. Repeated with private, shorter scratch and umask 077.
- An intermediate retry overlapped the gate's npm reinstall and had native SDK failures. A fresh complete suite after installation passed.
- `TestNativePiNoticeOneToolCall` is container-only and skipped normally. Its dedicated container workflow was not run; no claim of distinct-UID notice acceptance is made.

Logs retained at `/var/tmp/agent-keep/tests-system-node-7vg2/`: `npm.log`, `daemon.log`, `daemon-retry.log`, `daemon-final.log`, `alternate-tests.log`, `alternate-native-tests.log`, `alternate-retry.log`, `alternate-invocations.log`, `missing-node.log`, `gate.log`, and `discovery.log`.
