---
created: 2026-10-24
updated: 2026-10-24
type: bug
status: open
priority: normal
provenance: other
provenance_detail: observed in a worker's full gate run
source_ref: taskfleet:01m5pmjem2rha0jsyngvvntyft/observed:integrations-gate-flakes
originating_run: 01m5pmjem2rha0jsyngvvntyft
originating_run_kind: spinoff
lane: unlaned
collision: [internal/daemon/integrations]
preparation: ready
---

# integrations: relay TempDir cleanup and resume health flake in the gate

## Description

## Observed

In the full clean gate (`./scripts/ci-local.sh --clean --json`, Alder,
2026-10-24) on a tree that does not touch `internal/daemon/integrations`
(stop-interrupt-visible, rebased on main 7a131538), two tests in that
package failed; the package then passed 2 of 3 standalone runs
(`go test -count=1 ./internal/daemon/integrations`, umask 077, TMPDIR under
/var/tmp). The third run failed in
`TestMicrosoftRemovalFencesAnAttemptBeforeItsIdentityIsPublished`, already
filed as `supremely-simple-bottle`.

    --- FAIL: TestMicrosoftRelayHidesApprovedCodeDuringDiscovery (1.03s)
        testing.go:1617: TempDir RemoveAll cleanup: unlinkat /var/tmp/TestMicrosoftRelayHidesApprovedCodeDuringDiscovery2698091393/003: directory not empty
    --- FAIL: TestDaemonStartResumesInterruptedFirstPass (0.06s)
        resume_linux_test.go:143: completed resume not healthy: map[directory:~/cloud/dropbox/p@example.test id:dropbox last_synced_at:2026-10-24T10:09:26Z state:syncing]

The first looks like a child process (the relay or a sync client) still
writing into the test home when `t.TempDir` cleanup runs. The second reads
`state: syncing` after a resume reported complete, perhaps a status read
racing the supervisor. Either one fails the gate and blocks a receipt.
