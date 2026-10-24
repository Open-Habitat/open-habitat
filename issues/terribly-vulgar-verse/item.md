---
created: 2026-10-24
updated: 2026-10-24
type: bug
status: open
priority: normal
provenance: other
provenance_detail: observed in a taskfleet worker's focused browser run
source_ref: taskfleet:01m5pzvqy96808zcq0tc7pegxk/observed:auto-defaults-alone
originating_run: 01m5pzvqy96808zcq0tc7pegxk
originating_run_kind: spinoff
lane: unlaned
preparation: ready
---

# Browser case 'auto: the readable defaults are locked rows' fails when run alone

## Description

`web/tests/onboarding-default-repos.spec.ts`, case "@site-defaults auto: the readable defaults are locked rows already being fetched", fails when it runs alone and passes inside the whole spec.

Observed 2026-10-24 three times running it alone with `./scripts/test-focused.sh --area browser --spec onboarding-default-repos.spec.ts --tag "auto: the readable"`: twice on branch `wt/q0tc7pegxk-onboarding-signin-receipt` and once on a detached checkout of main at 87fb0d72. The same case passed twice in whole-spec runs on the same branch.

Failure: `expect(getByRole('heading').and(getByTestId('repository-chooser-title'))).toBeVisible()` times out at line 63 after `newPerson(page, "auto")`. A body dump at that point in a sibling case with the same steps showed the person still on the Git identity step ("Vahvista Git-identiteetti"), with the route listing both readable defaults as `valmis`. So `confirmGitIdentity`'s click did not move the route to the chooser within 5 s. One reading is that the auto defaults finish cloning before the chooser renders, and the route then no longer shows it. Not investigated further.

Impact: a focused run of this case gives a false red. The clean gate runs the whole spec and is unaffected so far.
