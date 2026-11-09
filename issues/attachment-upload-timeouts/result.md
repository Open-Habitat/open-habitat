# Result

Attachment uploads now have a five-minute absolute daemon body deadline,
5m30s response deadline, and six-minute gateway ceiling. The gateway also
bounds its browser-body read: cancelling the outbound request context alone
cannot interrupt that read. Download and unrelated route limits are unchanged.
The daemon already overrode the socket server's five-second default with 60s;
the effective defect in this checkout was the 60s limit at both layers.

## Verification

- `go test ./internal/gateway -run TestSlowAttachmentThroughGateway -count=1 -timeout=90s`: passed. A 61-second trickle crosses the real authenticated TLS gateway, Unix socket and daemon attachment handler, then checks saved bytes. The synthetic backend has the user-socket server's five-second read/write defaults; this is not a distinct-UID isolation test.
- `go test ./internal/daemon -run 'Test(Attachment|StalledAttachment|PromptAttachment)' -count=1 -timeout=60s`: passed.
- `go test -race ./internal/daemon -run TestStalledAttachmentDeadline -count=1 -timeout=30s`: passed. A shortened absolute deadline refuses a stalled body, removes its partial file, and permits the next upload.
- `go test ./internal/transport -count=1`: passed as part of the package run.
- Installed the pinned Pi fixture dependencies with `npm ci --prefix internal/daemon/pi-device-test --ignore-scripts`.
- Full gateway/daemon package run attempted, not green: existing fixtures exceed the Unix socket path limit under the required home-local TMPDIR; daemon cases also lack Python `referencing`. Other broad-suite failures remain unverified. Log: `~/.local/state/oh-upload-tests/go.log`. The new integration test's initial fixture setup failures were corrected and the final version passed separately.
- No web changes, browser checks or full clean gate claimed.

Focused self-review chosen: a small route-local deadline adjustment, with no
identity/authority, contract, synchronization or dependency changes. Checked
read/write/proxy deadline ordering, absolute rather than sliding bounds,
partial-file cleanup, and unchanged non-upload limits.
