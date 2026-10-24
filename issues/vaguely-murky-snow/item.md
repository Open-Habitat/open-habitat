---
created: 2026-10-24
updated: 2026-10-24
type: bug
status: open
priority: normal
provenance: other
provenance_detail: observed in full gate
source_ref: taskfleet:01m5pwmdabepexwttxd0x753zh/gate-flake:resume-unreachable
originating_run: 01m5pwmdabepexwttxd0x753zh
originating_run_kind: spinoff
lane: unlaned
collision: [internal/daemon/integrations]
preparation: ready
---

# Flaky daemon test: TestResumeRetriesUnreachableAndNamesItsFailure reads 'syncing' under gate load

## Description

`TestResumeRetriesUnreachableAndNamesItsFailure` (internal/daemon/integrations, resume_linux_test.go:243) failed once in the full clean gate on 2026-10-24 (tree with only web changes on top of main ebfe63e6), under the gate's parallel load:

    resume_linux_test.go:243: unreachable provider: map[directory:~/cloud/dropbox/p@example.test id:dropbox progress:map[bytes:0 elapsed_seconds:0 files:0 phase:preparing service:dropbox total_bytes:0 total_files:0] state:syncing]

The service was still `syncing` (phase preparing) when the test read it, rather than the expected unreachable/sync_restarting state. Three isolated reruns (`go test -run TestResumeRetriesUnreachableAndNamesItsFailure -count=1`) passed, so it looks like a timing assumption that breaks under load. Impact: a red gate on main for unrelated changes.
