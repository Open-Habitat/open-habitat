# Result — incomplete, not fixed

The corrected same-code approval-detection defect was not reproduced or established from the permitted journal. The issue remains open. No production, contract or UI change was made, and this branch must not be merged as a completed fix.

`investigation.md` records the redacted live timeline, actual grant owners, polling behavior, native CLI limitations, targeted diagnosis and evidence gaps. The new characterization test passes on unchanged production code after pending, slow-down and successful approval; it is not a before/after fix regression. Targeted and full integrations-package Go checks passed with `umask 077`, `TMPDIR=/var/tmp`.

A definite presentation defect remains: the relay still displays the first code during post-grant Graph work. Neither that defect nor the existing two-flow implementation explains Jari's same-code correction from available evidence. First establish/observe the approval timeline, then implement the detection fix before declaring single-code/two-step handling complete.

Still incomplete: the detection fix, supported single-code handoff or justified fallback, Finnish wording, updates to the three earlier result files, Storybook, web/browser/a11y checks and desktop/390px light/dark screenshot/HTML review. No VM or Fleetrepo changes, live acceptance, full clean gate, issue closure, push or merge is claimed.
