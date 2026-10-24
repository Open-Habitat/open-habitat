---
created: 2026-10-24
updated: 2026-10-24
type: bug
status: untriaged
priority: normal
provenance: other
provenance_detail: observed by worker gate run
source_ref: taskfleet:01m5p8nzrctp6srmczyhwvb694/gate:main-5d3791f4
originating_run: 01m5p8nzrctp6srmczyhwvb694
originating_run_kind: spinoff
---

# Main's clean gate fails: three lab specs and gofmt drift in integrations files

## Description

The full clean gate (`./scripts/ci-local.sh --clean --json`) fails on main as of 5d3791f4 (observed 2026-10-24 by run 01m5p8nzrctp6srmczyhwvb694 while gating runtime-admission-broker, and reproduced on a pristine main worktree):

- Lab browser specs fail on main as well:
  - `tests/lab-outage-account.spec.ts:9` "pi-onboarding account menu admin/non-admin on desktop and phone": `expect(page.getByRole("navigation")).toHaveCount(0)` receives 1 (line 62). Likely the onboarding route map now renders a navigation landmark during Pi onboarding.
  - `tests/lab-english-url-paths.spec.ts:13` "English settings links survive OAuth, reload and browser history" (1 failed).
  - `tests/lab-conversation.spec.ts:1050` "slow turn explains work and stop requires an explicit confirmation" (1 failed).
- `gofmt` rewrites three files that landed unformatted, so a green gate would also fail its "changed the clean tree" check: `internal/daemon/integrations/dropbox_linux.go`, `internal/daemon/integrations/google_linux.go`, `internal/host/integrations_linux_test.go` (one-line closures in a map literal).
- `start-here.spec.ts` and `lab-browser-editor.spec.ts` failed once under the full gate and passed on rerun (flaky under load).

Impact: no gated release can be cut from main until these are fixed; workers cannot use the gate as a health check.
