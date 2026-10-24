---
created: 2026-10-24
updated: 2026-10-24
type: bug
status: untriaged
priority: normal
provenance: other
provenance_detail: observed while running focused tests in a worker
source_ref: taskfleet:01m5p6fgxv7gxg515cm3xew9ww/observed:microsoft-removal-fence-flake
originating_run: 01m5p6fgxv7gxg515cm3xew9ww
originating_run_kind: spinoff
---

# Microsoft removal-fence test races the pending cache directory

## Description

## Observed

`TestMicrosoftRemovalFencesAnAttemptBeforeItsIdentityIsPublished`
(`internal/daemon/integrations/microsoft_linux_test.go:951`) fails intermittently
on unmodified commit `2c1a5ad6`: 3 of 10 runs with
`go test -count=10 -run TestMicrosoftRemovalFencesAnAttemptBeforeItsIdentityIsPublished ./internal/daemon/integrations`
(TMPDIR under /var/tmp, alder, 2026-10-24). The failure is:

    microsoft_linux_test.go:983: open .../.config/ms-365-mcp-server/open-habitat/.pending/person@example.test/.token-cache.json: no such file or directory

## Likely cause

The test waits until the login reports `state == completing` and
`login_phase == files_discovery`, then writes the token cache into the
attempt's `.pending/<address>/` directory. That directory apparently is not
always created by the time the phase is visible, so the write races the
native staging step.

## Impact

`./scripts/test-focused.sh --area go --go-package ./internal/daemon/integrations`
and the gate fail randomly, which costs reruns and hides real failures.

## Direction

Wait for the pending directory itself (or have the fixture create it the way
the native writer does) before writing, instead of relying on the phase alone.
