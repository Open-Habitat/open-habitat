---
created: 2026-10-24
updated: 2026-10-24
type: bug
status: fixed
priority: normal
provenance: other
provenance_detail: worker gate run
source_ref: taskfleet:01m5q3xmvvzvekacj5ddjpqfvy/gate-flake:agent-credentials-routes
originating_run: 01m5q3xmvvzvekacj5ddjpqfvy
originating_run_kind: spinoff
lane: unlaned
preparation: ready
closed: 2026-10-24
---

# TestAgentCredentialsAndIntegrationRoutes times out under gate load

## Description

# TestAgentCredentialsAndIntegrationRoutes times out under gate load

On 2026-10-24, `./scripts/ci-local.sh --clean --json` on Alder (branch
`wt/j5ddjpqfvy-broker-replace-invalid-section`, which changes only
internal/provision, internal/host's plan reason and internal/cli text) failed in
`internal/daemon`:

```
--- FAIL: TestAgentCredentialsAndIntegrationRoutes (24.07s)
    agent_integrations_linux_test.go:84: Post "http://unix/agent/v1/credentials": context deadline exceeded (Client.Timeout exceeded while awaiting headers)
```

The load average was about 36 at the time; other workers were running gates. Run
alone (`go test ./internal/daemon -run TestAgentCredentialsAndIntegrationRoutes -count=3`)
the test passed three times in 6.7 s. The client timeout at
internal/daemon/agent_integrations_linux_test.go:84 is too short for a loaded
host, so the full gate is not repeatable on a shared Alder.

## Acceptance Criteria

- [x] Identify whether this is test timing or a product race, and remove the timing dependency without dropping successful credential-operation coverage.
- [x] Repeat the affected test 50 times with `-race`, umask 077 and a fresh `/var/tmp/oh-XXXX` TMPDIR.

## Result

No product data race was found. The socket route test was also a native SDK
integration test: every successful credential call started Node and imported Pi,
while the test's HTTP client allowed only 16 seconds. The native helper has its
own 12-second budget and the credential adapter a 14-second write deadline;
these independently scheduled timers are not a completion-order guarantee on an
overloaded host. The reported client timeout is a test timing failure, not
proof of a credential-state race. Production timeout and storage behavior remain
unchanged.

The socket test now uses an unavailable Pi configuration, which fails validation
synchronously before any subprocess starts. It still checks the real own-UID
listener, unguarded denial, exact paths, invalid requests, unknown providers and
native-unavailable responses. Successful agent credential adapter calls moved
into `TestPiCredentialsNative`, using an in-process HTTP recorder rather than a
competing socket/client timer. That existing native test now proves HTTP save,
read, redaction, exact key persistence, per-provider removal and preservation of
the native OAuth entry. This separates route/peer correctness from SDK startup
latency without adding a production injection seam or substituting a fake SDK.

Validation of the final test changes (based on `218705c06a0db434e59ee42222a105ee03b97e91`):

- With `umask 077; export TMPDIR=$(mktemp -d /var/tmp/oh-XXXX)`,
  `go test -race ./internal/daemon -run '^(TestAgentCredentialsAndIntegrationRoutes|TestPiCredentialsNative)$' -count=50 -v`
  passed all 50 iterations of **both** tests (289.026 s). Log:
  `/var/tmp/oh-aQOp/race-50.log`. No race reports; neither test skipped.
- With the same umask and a separate fresh TMPDIR,
  `go test -race ./internal/daemon ./internal/transport` passed
  (189.006 s / 2.110 s), and `./scripts/check-generated.sh` passed.
  Logs: `/var/tmp/oh-4rb9/{packages,contracts}.log`.
- `git diff --check` and `python3 scripts/validate-project-view.py` passed.

This is same-UID synthetic/native SDK evidence, not distinct-user isolation or
an unlimited-load latency guarantee. No full gate was run in this worker.
