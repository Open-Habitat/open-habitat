# Result

## Cause

`worktreeName` called any directory matching `wt-<id>-<title>` a leftover when owner metadata was absent. A directory name cannot establish whether its run ended. Separately, `worktreeRuns` used `taskfleet run list --repo`, unlike the snapshot's Taskfleet discovery phase. Taskfleet's repository filter omits runs without recorded/resolvable repository identity even when their native worktree paths identify a listed checkout. That loses both the owner and the live-run deletion blocker. The synthetic regression models that exact omission; no private installation was inspected or captured.

## Change

Cleanup now reads the same unfiltered native run inventory as snapshot discovery and matches run/node worktree paths. Pending/running owners remain non-deletable, including fresh deletion checks. Repository scoping is used only to rule out an unnamed, source-attributed run from another repository; missing ownership evidence still fails closed.

Storage rows describe working, waiting, attention-needed and ended owners in Finnish and English. Unowned directory spelling no longer implies a remnant. Live rows direct the person to the conversation that started the worker. Ended leftovers retain normal safe removal; blocked removal directs the person to the workspace agent and disables another confirmation in that dialog. Ordinary worktree names and non-run blocker reasons remain intact.

## Verification

- `./scripts/test-focused.sh --area go --go-package ./internal/daemon`: passed. Regression covers missing repository identity, interactive pending/waiting ownership, terminal statuses, node-only ownership appearing after listing, and unrelated unnamed runs.
- `./scripts/test-focused.sh --area web`: passed; 217 test files, 1694 tests. Includes naming, live-action suppression and blocked-dialog submit prevention.
- `./scripts/test-focused.sh --area browser --lab --spec lab-storage-run-state.spec.ts`: passed. Synthetic host with explicit owner/removal-response overrides reproduces a waiting live row followed by a cancelled leftover whose removal is blocked by a process. This is not live-host evidence.
- Independent review: claude-fable-5-2 finder and gpt-6-astra verifier, with local assessment. Three initial regressions were confirmed and corrected (unrelated unnamed run blocking, hidden blocker details/unrealistic fixture, ordinary name rewriting). No remaining actionable finding. No authority or wire-contract change.
- Synthetic PNG/HTML pairs saved outside the repository in the worker-results directory for this run. No captures committed. Full browser suite and clean gate left to the conductor.

## Decisions for later review

- Use the existing `ended` owner wording rather than claim every terminal run was cancelled: the current owner contract combines done, cancelled and failed. Alternative was extending the wire solely for finer copy; unnecessary to distinguish live work from leftovers safely.
- Do not add browser cancellation or process termination. The agent already owns that lifecycle; provide an honest agent-directed route rather than add authority or a fragile automatic cleanup.
- After a blocked deletion, close/reopen to retry after the agent resolves the blocker. A permanently active confirmation invites repeating an operation the host just refused.

Live check: In Settings → Storage, inspect an interactive worker awaiting a decision: it must say it is waiting, point back to its originating conversation, and offer no delete. After cancellation, an existing checkout is identified as left behind by an ended run. Try removal; if processes still use it, the dialog directs you to the agent and its delete confirmation becomes disabled.
