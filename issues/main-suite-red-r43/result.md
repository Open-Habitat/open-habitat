# Result

Seven browser journeys repaired without changing product code. Six failures
reproduced in isolation and asserted behavior that had deliberately changed.
The scrolling case passed four unchanged isolated runs; its programmatic scroll
bypassed the reader-input condition used by follow-latest, so it now scrolls
through real browser wheel input. No timeout was increased.

## Per-spec diagnosis

| Spec / failing journey | Cause and change |
|---|---|
| `browser-conversation.spec.ts`: stale working view | Obsolete refusal expectation, introduced by the earlier `8a18cc64` (`enter-sends-twice`), **not** `next-waiting-on-send`. Its result in git history explicitly admits late browser steer/follow-up as a new turn when Pi is live and idle. Hold the request until idle as before, then require an OK response, the native answer, an empty draft and no uncertain command. This retains the distinction from a stranded draft. |
| `clone-page.spec.ts`: Gitea common list | `01e110f6` (`clone-empty-repo`) deliberately enables empty Gitea/GitLab repositories. Assert enabled rather than disabled; retain the subsequent real clone, discovery and fetch journey. Empty native Gitea clone/first-commit behavior is already covered by the originating fix's daemon tests. |
| `spinoffs.spec.ts`: restart / settle | `d2646e25` (`rail-recent-five`) retains a completed ordinary conversation in Recent. Assert absent from Running but present in Recent before/after the worker, and explicitly require the worker marker to clear. Preserve the actual fixture worker and daemon restart. |
| `lab-worker-row-sentence.spec.ts` | `d2646e25` excludes finished worktree conversations, including the selected one, from Recent. Confirm exclusion, then mark this agent as having an idle worker in a validated snapshot seam to keep it in Running. Test feature-off and feature-on sentence rendering there, against the real Git commit summary. The seam does not claim real worker discovery. |
| `lab-workspace-icons.spec.ts` | `d2646e25` adds a second possible workspace group in Recent and flattens iconed rows. Scope to Running; use the started conversation IDs for icon/card actions rather than removed groups. Keep source-chain, authenticated inert image, phone/narrow layouts and axe checks. |
| `lab-worktree-agent.spec.ts` | `d2646e25` excludes finished worktrees before and after merge. Require no rail worktree row after settlement; retain real create/send/commit/merge, Git chip and workspace-card assertions, archive and axe. The removed merged-rail assertion enforced the removed finished-row behavior; native merge evidence stays on the chip and card. |
| `thread-fill.spec.ts` | Not reproduced in four isolated runs. The test assigned `scrollTop = 0` while follow-latest still owned scrolling, so a later history paint could return it to the bottom. `useReadingPosition.ts` explicitly distinguishes reader wheel/key/pointer input from programmatic scroll events. Use wheel-up and wait for actual top position before testing reachable first content. This removes the identified timing susceptibility; CPU load as the original trigger is not proven. |

Read all four suspected landed issues' item/result documents. Neither
`single-workspace-normal-rail` nor `next-waiting-on-send` caused these obsolete
expectations. No daemon, contract, session-state or authority changes.

## Decisions for later review

- Preserve the existing rail decision excluding **all** finished worktree
  conversations, rather than broadening Recent to browser-created worktrees.
  The originating rail result already records this consequence for review;
  a test repair should not silently reverse it. The sentence test exercises
  an active row with a synthetic worker instead of keeping a finished row.
- The task's opening paragraph requested whole ordinary/lab suites, but its
  later Checks section explicitly forbade them and assigned them to the
  conductor, consistent with the repository worker policy. Followed that later
  instruction: ran every touched spec in full, **not** either whole suite.
  The conductor must run the integrated ordinary and lab suites; no whole-suite
  pass or clean-gate receipt is claimed here.

## Evidence

Birch, `OH_BROWSER_WORKERS=2`, `OH_PORT_BASE=9950`, umask 077, disk-backed
`/var/tmp` scratch. Installed both web dependencies and the Pi SDK fixture.
Each of the seven reported cases ran individually first via
`python3 scripts/browser-focused.py --spec NAME --tag JOURNEY`; lab-prefixed
specs use the lab config. Six reproduced their reported failures. Thread-fill
passed four times before editing. All seven passed individually after editing.

Rebased onto local main `6193febb` (Web Push removal), with unchanged patch
confirmed by `git range-diff`. Final runnable revision `ec54d422`:

- `./scripts/test-focused.sh --area web`: **160 files / 1180 tests passed**,
  including formatting, lint and TypeScript checks.
- Each touched file separately via
  `./scripts/test-focused.sh --area browser --spec NAME.spec.ts`:
  - browser-conversation: **77 passed**;
  - clone-page: **11 passed, 1 skipped** (opt-in visual capture);
  - spinoffs: **5 passed**;
  - thread-fill: **1 passed**;
  - lab-worker-row-sentence, lab-workspace-icons, lab-worktree-agent:
    **1 passed each**, through lab configuration.
- Total named-spec validation: **97 passed, 1 capture-only skip**.
- `python3 scripts/validate-project-view.py` and `git diff --check`: passed.
  `issuectl doctor --json`: no schema drift, broken references or conflict
  markers; existing `flat/decisions-review-31-10` missing-item and raster-format
  advisories remain outside this change.

Focused self-review checked each changed assertion against the originating
intent and current render/state conditions. Removed expectations are accounted
for above; native delivery, clone/fetch, worker marker clearing and Git merge
checks remain. This is synthetic same-UID browser/host evidence, not live
provider or kernel-user isolation evidence. No Go/contracts checks were needed
for test-only changes. No full gate was run.

## Command failures

The six initial red cases are the intentional reproduction evidence, not
accepted final failures. Exploratory ripgrep globs for guessed scroll/feed
filenames did not exist; subsequent inspection used the actual
`useReadingPosition.ts` path. All final focused checks passed. Nonfatal bundle
size/PostCSS/canvas warnings did not prevent checks from completing. Closing
initially warned that the issue had no Acceptance Criteria section; added the
completed criteria to its body.
