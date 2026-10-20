# Worktree creation contention: worker result

## Reproduction and scope

`TestWorktreeCreationWaitsForWorkspaceWriter` failed before the fix with
`"" 409 "workspace_busy"`: a 25 ms overlap with the shared workspace writer
refused creation before any work. The existing checkout-observation handler
holds that writer across native Git reads, and a clone owns it through job
completion. This establishes a reachable contention bug, not which request
held the lock in the quoted live incident. No server was accessed.

Creation now waits at most two seconds **before** doing any work. The same
workspace exclusion, discovery, inode fencing, ownership and native Git checks
remain in place. A longer conflict names its current operation with a fixed
code, translated by the browser. A refused or cancelled request neither creates
a branch/worktree nor retries in the background. Explicit retry is covered in Go.

## Verification

All build/test commands used `TMPDIR=/var/tmp`; final checks used `umask 077`.

- Before-fix regression: expected failure, 409 `workspace_busy`.
- Initial focused worktree checks under the inherited `umask 0002`: failed with
  `native_source_unavailable` because synthetic Git setup made group-writable
  files; rerun under `umask 077` passed (three worktree tests at that point).
- `npm ci --prefix internal/daemon/pi-device-test --ignore-scripts`: passed.
- `./scripts/test-focused.sh --area go --go-package ./internal/daemon`: passed
  with race detector, including cancellation, long-conflict/no-write and explicit
  retry regression cases.
- `./scripts/test-focused.sh --area contracts`: passed; no contracts changed.
- `npm ci --prefix web`: passed; npm reported two existing dependency advisories
  (one moderate, one high); lockfile unchanged.
- Web fast checks initially failed formatting on the added unit test and a
  pre-existing lab script, `web/lab/claude-default-model.mjs`. Both were formatted;
  the latter is a separate formatting-only commit, not a behavioral change.
- Final `./scripts/test-focused.sh --area web`: passed (49 unit files / 265
  tests; 31 component files / 191 tests; formatter, lint and TypeScript passed).
  Existing informational template-literal and jsdom canvas diagnostics remain.
- `./scripts/test-focused.sh --area browser --spec lab-worktree-agent.spec.ts
  --writers-paused`: **blocked**, exit 2. Alder's maintained runner explicitly
  refuses lab scope. No local or renamed-spec workaround was used.

The existing lab worktree-agent journey now exercises the old generic refusal,
the named conflict, preservation of the first message, explicit Retry followed
by Send, and one real successful native worktree creation and conversation.
It also runs the existing accessibility check at each refusal. This extension
is typechecked but **not browser-verified** here. Required before/after lab
captures have **not** been produced; the opt-in capture hook records paired PNG
and static HTML in this issue directory. The 'before' state is an explicitly
injected old `workspace_busy` refusal; the 'after' state is the new named
conflict. These demonstrate presentation and retry, not native contention by
themselves (the daemon regression tests cover native admission).

On a supported ordinary Linux lab host, after installing dependencies and
Chromium, run from the repository root:

```sh
umask 077
export TMPDIR=/var/tmp
OH_WORKTREE_CONFLICT_CAPTURE=1 \
PLAYWRIGHT_BROWSERS_PATH="$HOME/.cache/ms-playwright" \
  ./scripts/test-focused.sh --area browser --spec lab-worktree-agent.spec.ts
```

Do not run that locally on Alder. A missing browser/lab result is not a pass.

## Remaining live attribution

If live attribution is needed, inspect the daemon's overlapping requests around
2026-10-20 09:19:16Z (create request `akoQWAdgzBibbo-K`), specifically checkout
observations, clone admission and terminal job events, archive, workspace
settings/delete/restore, publish/disconnect, and worktree cleanup. Look for a
request/job whose lock-holding interval contains that timestamp. The old log
cannot itself distinguish those holders. No Fleetrepo installation change is
required by this implementation.

## Delivery state

The required lab run and captures are blocked by the current runner policy.
The issue must remain open and the worker must not merge until that required
evidence is obtained. No push or deployment was performed.

## Failure inventory

- Expected red regression and wrong-umask Go attempts: resolved by the fix and
  the required private umask respectively; final daemon checks pass.
- Initial web formatting failures: resolved; final complete fast checks pass.
- Mandatory lab/browser execution and before/after captures: **not resolved**.
  The runner refused lab scope before capture/build; there is no submitted job
  to reconnect to. This blocks success, issue closure and merge.
- Exploratory reads of guessed nonexistent test/source paths (`control*`,
  `workspace-management.spec.ts`, `host.ts`, `workspace_trash_linux_test.go`,
  `held-messages.spec.ts`, `pi-start.spec.ts`, `clone-jobs.spec.ts`) and a search
  in an absent `WorkspacePage.tsx` returned missing-path/non-match statuses.
  Relevant files were subsequently located in the scoped source tree; no
  implementation or validation relies on those failed lookups.
- `taskfleet --version` was rejected; the documented `taskfleet version
  --output json` succeeded (0.16.0). Exact current run ownership resolves to
  `01m5cak01at8yfwf1z662d73vx`.
- No clean gate, server access, push, deployment, or isolation claim was made.

## Review

Independent `/llm-review`: finder `claude-fable-5-1`, verifier `gpt-6-astra`,
two calls on the shared writer/concurrency boundary. `/assess-findings`
triage: one stale-test observation fixed by removing a redundant immediate-
refusal block, whose distinguishing no-write/exclusion coverage is now in the
stronger named-conflict/explicit-retry test; one scope-hygiene observation
resolved by the separate formatting commit. No runtime defect remains from
review. The final entire daemon race suite was rerun and passed after that
removal. The verifier also independently passed seven selected race tests.
Both models first hit the same wrong-umask fixture failures and recovered with
`umask 077`. No new issues were filed. Model-performance logging was disabled
because this run is not authorized to edit or push Fleetrepo.

This change preserves the Unix-user boundary, existing exclusion and native
validation, but the lock implementation changes destructive-operation admission,
so independent concurrency review was more proportionate than self-review alone.
The local review/assessment scratch is under `history/`; this issue result
retains the conclusions without depending on that ignored scratch surviving.

Verified code revision: `a5ef64aec9b4481d9b057706e24d0118b8713ec1`
(the daemon/web checks ran against these exact runnable bytes before commit;
subsequent changes only record issue evidence). Incidental baseline formatting:
`02b3c8c1`. Project-view validation, issue doctor (no schema violations/parse
errors), and `git diff --check` also passed.
