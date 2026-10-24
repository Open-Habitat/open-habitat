---
created: 2026-10-24
updated: 2026-10-24
type: bug
status: untriaged
priority: normal
provenance: other
provenance_detail: worker gate run
source_ref: taskfleet:01m5q3xmvvzvekacj5ddjpqfvy/gate-flake:agent-credentials-routes
originating_run: 01m5q3xmvvzvekacj5ddjpqfvy
originating_run_kind: spinoff
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
