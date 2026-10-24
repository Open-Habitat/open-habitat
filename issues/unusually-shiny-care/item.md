---
created: 2026-10-24
updated: 2026-10-24
type: bug
status: open
priority: normal
provenance: other
provenance_detail: Observed in the full gate during onboarding-ai-offer
source_ref: taskfleet:01m5pqte7cwfv3mv41k8j4jf77/gate-flake:pi-rpc-native-abort
originating_run: 01m5pqte7cwfv3mv41k8j4jf77
originating_run_kind: spinoff
lane: unlaned
preparation: ready
---

# Gate flake: TestPiRPCNativeAbortDuringToolSettlesFirst sees the abort acknowledged before the run settles under load

## Description

Observed 2026-10-24 in the full clean gate (`./scripts/ci-local.sh --clean --json`) on branch `wt/41k8j4jf77-onboarding-ai-offer`, which changes nothing under `internal/` (web, browser-host fixture and issue files only):

```
--- FAIL: TestPiRPCNativeAbortDuringToolSettlesFirst (1.10s)
    pi_rpc_native_abort_linux_test.go:116: Pi acknowledged the abort before its run settled
FAIL	github.com/Open-Habitat/open-habitat/internal/daemon	177.760s
```

The same test run alone, `go test ./internal/daemon -run TestPiRPCNativeAbortDuringToolSettlesFirst -count=8`, passed 8/8 on the same tree. So it is load-sensitive: under the gate's parallel Go and browser phases the pinned Pi sometimes acknowledges the abort before the running tool's run has settled, or the test's ordering check reads it that way.

Impact: the gate fails Go/contracts and writes no receipt, so a gated release has to be rerun. The cause is either the real-Pi ordering this test pins (which the daemon relies on, per `stop-turn-flicker`) is not guaranteed under load, or the test's observation window is racy. Which of the two it is matters, because the first is a product assumption.
