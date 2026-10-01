# Result: MVP journeys and acceptance scenarios

## Inputs and revisions

Definition work used repository revision `c7ed46ee20821a6faaa4072fc7645c8ebeba8b2d`
(the issue's in-progress transition) and these governing inputs at that revision:

- `issues/define-mvp-scope/item.md`, `TODO.md`, `AGENTS.md`,
  `AGENTS-WORKFLOW.md`, `docs/AGENTS.md` and
  `issues/plan-v1-implementation/plan.md`;
- `docs/adr-0001-unix-native-agent-host.md`, `docs/architecture.md`,
  `docs/implementation.md`, and the prior `docs/product.md`, `docs/ui.md` and
  `docs/assumptions.md`;
- `issues/receive-designer-v1/review.md` and both delivered design handoffs:
  `design-system/drafts/v1/AGENTS.md` and
  `design-system/drafts/v1/workspaces/AGENTS.md`;
- conversation design delivery SHA-256
  `a517af7bab5261a9e51c5c8df21da37d74c25fe9bb9816d74d4d232dd8f62744` and
  workspace/navigation delivery SHA-256
  `598a9b7e31edf7f67078d60258050ccdb4a85014e4a1f62e4d8f8a49eb871813`,
  as recorded in the reception review;
- the acceptance criteria and current ownership of `prepare-ui-review`,
  `review-ui-v1` and the implementation issues linked from the durable pages.

No product runtime, design token or frontend technology was selected or changed.

## Revisions delivered

- `docs/product.md` now separates the working-core demonstration from full-MVP
  acceptance and gives success/failure scenarios for login, native discovery,
  conversation, reconnect, workspace lifecycle, GitHub, worktrees, archive and
  operations. It preserves creation/deletion, settings, hide, GitHub, worktrees,
  archive/resume and accepted automatic focus/start effects.
- `docs/product.md` also proposes a measurable two-user pilot and representative
  workload. It labels the proposal as awaiting Jari's approval.
- `docs/ui.md` combines the two received designs into one desktop journey and a
  state inventory. It inventories conversation and host components, missing
  states, mocked behavior and open choices without changing tokens or choosing
  a runtime.
- `docs/ui.md` gives `prepare-ui-review` explicit questions about queue/steering,
  synopsis, focus/drafts, read position, attention, control, uncertain sends and
  partial host operations.
- `docs/assumptions.md` converts the initial claims into an explicitly unverified
  evidence matrix. Each claim names the evidence needed, responsible issue(s)
  and consequence if false, including probe authorization boundaries.

## Independent review

A routine, focused review used `claude-fable-5-1` once against the three durable
documents, the defining issue, ADR 0001, accepted design review and staged plan.
A model panel or verifier would not have added proportionate evidence because
all candidates were settled against primary repository sources. The review found
and this delivery corrected eight scope ambiguities: delivered A7 coverage,
native versus browser GitHub auth, settings-time Git/GitHub operations,
delete/process/worktree boundaries, expired login, the read-only core-demo case,
remote GitHub probe ownership and links to later human reviews. The local review
record is `history/review-define-mvp-scope.md` (gitignored by repository policy).

Performance logging for that optional review failed: `assess-models.sh` exited 3
because SSH to `alder` was rejected (`Permission denied (publickey,password)`).
The review output was already available and was checked against local evidence,
so this did not invalidate the review or deterministic repository checks. No
review finding required a new issue.

## Verification

Final checks were run from the repository root after all revisions:

- `python3 scripts/validate-project-view.py` — passed: 12 pages and 12 navigation entries.
- `issuectl doctor --json` — passed with no warnings or reported violations.
- `git diff --check` — passed with no output.

The exact closure stamp and closure commit are recorded in the issue metadata,
separately from the content commit, after these checks.

## Remaining limits

- All Pi, GitHub, daemon, gateway and frontend capability claims remain
  unverified until their assigned probes and implementation tests produce
  versioned evidence. A clickable mock is not integration evidence.
- Queue/steering, synopsis behavior, terminal-agent control, draft persistence,
  read-position behavior and cross-agent attention still require the probes and
  Jari's UI review. This issue recommends no answer on Jari's behalf.
- The pilot criteria are a review proposal, not approval or proof of deployment.
- There is no product build, test or deployment command yet. Documentation
  validation is the complete applicable gate for this issue; deployment is not
  applicable.
