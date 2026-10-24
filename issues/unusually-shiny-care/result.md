# Result

The flake was a test observation race, not a product abort race. Only the native test changed.

`piRPC.read` reads stdout sequentially but routes events to buffered `events` and ordinary RPC responses to buffered `frames`. The test selected between `events` and a goroutine's acknowledgement channel. If both were ready, Go could select the acknowledgement while the earlier `agent_settled` was still queued, making its local `settled` flag falsely report reversed native ordering.

The test now deliberately leaves native events unread while requesting abort synchronously. After acknowledgement it drains only already-available events, without a timeout or sleep that could hide a missing settlement. Settlement must be queued, marked aborted, and backed by native assistant history reporting `aborted`. The existing five-second stop bound is retained.

The installed pinned Pi 1.3.0 confirms the native guarantee: `dist/modes/rpc/rpc-mode.js` awaits `session.abort()` before its success reply; `dist/core/agent-session.js` abort waits for idle, and `_emitAgentSettled` emits settlement before resolving idle waiters. The daemon controller does not infer idle from abort acknowledgement: the event drain owns settlement and the accepted-to-idle transition. Thus differing channel-consumer scheduling does not establish a premature product settlement.

## Verification

Tested on base `c2b3aaef` plus the test-only change in this commit:

- `npm ci --prefix internal/daemon/pi-device-test --ignore-scripts` installed the pinned fixture.
- Under `umask 077`, `TMPDIR=$(mktemp -d /var/tmp/oh-XXXX)`, ran `go test -race ./internal/daemon -run '^TestPiRPCNativeAbortDuringToolSettlesFirst$' -count=50 -v`: **50 passes, zero skips**, no race detector reports; package time 49.031s. Log: `/var/tmp/oh-aUnR/abort-50.log` (local working evidence).

- Under the same restrictive umask and a fresh short `/var/tmp` TMPDIR, `go test ./internal/daemon -count=1` passed (121.303s). `go test ./internal/contracts ./cmd/contractgen` compiled both packages (no test files).
- `./scripts/check-generated.sh` passed with no generated drift.
- `python3 scripts/validate-contracts.py` passed (66 schemas, 78 fixtures, 40 scenarios).
- `issuectl doctor --json` passed with only pre-existing image/large-binary inventories; `python3 scripts/validate-project-view.py` and `git diff --check` passed.

The provider is loopback synthetic; Pi and its bash tool are native. This is not live-provider or installed-server evidence. No full gate or deployment is claimed.
