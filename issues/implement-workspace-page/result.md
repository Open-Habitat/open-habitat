# Result

Implemented direction 1, **Keskustelut edellä**, from the accepted workspace
round. The page leads with the same native recap cards as home, ordered by
attention. Valmiit and Arkisto are folded. The archive remains in App's existing
source-aware workspace section (outside WorkspacePage), retaining its observation-
token, unreadable-history and restore guards; restoration does not start Pi. There is no worktree-agent placeholder
group or + chooser: the page and sidebar + create a default-agent conversation
directly. The shared … menu offers copy path, GitHub (when observed), display
name, hide, and disabled deletion with its reason. Sidebar/home settings intents
navigate to the workspace and are consumed once in browser memory; they are not
stored in URLs or replayed after reload.

The Git pill opens an anchored desktop layer and a phone bottom sheet. The
new read-only endpoint discovers the workspace afresh as the mapped Unix user,
checks directory identity, and runs bounded native Git commands through the
existing native runner. It returns branch, changed paths (including rename pairs
and literal newline filenames), local-upstream ahead/behind, recent commits and
known publication marks. A safely opened main-checkout FETCH_HEAD supplies the
last recorded fetch time; missing/unsafe records and linked-worktree fetch times
stay unknown. It never fetches, writes Git state, creates a store, or accepts a
browser path/identity as authority. The browser caps and schema-validates replies
and verifies the echoed workspace ID before rendering native text.

## Prototype comparison

`page-*`, `git-*`, and `menu-*` are paired synthetic-lab screenshots and offline
HTML at 1440 and 390 px in light and dark, captured at `OH_PORT_BASE=27700` by
`web/lab/capture-workspace-page.mjs`. Git facts and recaps come through production
handlers from disposable native repositories and histories, not browser mocks.

Deliberate differences:
- Changed files show native status and path, but not added/deleted line figures:
  opening an overview does not additionally diff the contents of every modified
  file. The changed-file count is complete up to the bounded native read; a long
  file list explicitly says when only its first 200 paths are shown.
- Time on a recap card is its native recap age, not an invented last-activity
  time. Synthetic terminal histories remain honestly marked read-only/unknown;
  the screenshot does not pretend that those Pi processes are running.
- The fetch label says **last recorded fetch**, not that origin has just been
  checked. These are local remote-tracking observations, not network freshness.
- The conventional `~/src/<name>` path is shown where the returned native path
  matches that source model. Its full value remains in the tooltip and copy
  operation. No username is reconstructed in the browser.
- The existing shared React Aria buttons, menu, popover and modal focus semantics
  remain; the new Git layer supplies only the chosen responsive presentation.

## Verification

- Fast web format/lint/type/unit/component checks passed.
- Affected normal browser journeys: 18/18 passed (archive/undo, unread latest
  state/count, direct + creation, workspace routing, recovery and a11y).
- Workspace and sidebar lab browser journeys: 5/5 passed, including desktop and
  phone Git layer, file/commit/sync facts, Escape/focus return, Axe checks, direct
  + on both surfaces, sidebar rename, save, hide, and disabled deletion.
- `go test ./internal/daemon ./internal/gateway ./internal/contracts` passed with
  `TMPDIR=/var/tmp/o`. An initial run used an overlong temporary-directory prefix
  and hit Linux's Unix-socket pathname limit in unrelated gateway fixtures; the
  shorter disk-backed path resolved it without a code change.
- Generated drift, all contract fixtures (including the new Git reply), and
  project documentation validation passed.
- Targeted `/llm-review`: signature output could contaminate custom-format logs;
  fixed with `--no-show-signature`, hexadecimal validation and an actual
  disposable SSH-signed-commit regression. An unborn branch is distinguished
  from corrupt/malformed refs using only Git's explicit missing-ref exit status.
  The shared native runner preserves that numeric status without diagnostics;
  timeout/output-cap failures cannot be mistaken for absence. The verifier
  rejected the speculative large-repository deadline finding. No follow-up issue
  was filed. Performance-corpus recording was attempted but SSH-to-self rejected
  the available key, so the assessment was not logged there.

Existing browser assertions were updated for the folded archive, native path
heading and direct + rather than a + menu. Their route, restore, keyboard and
single-creation assertions remain. Archive timer tests install the browser clock
**before** mounting the notice; installing it afterwards leaves already-created
native timers outside clock control. The unread test establishes a native
baseline and scrolls away before sending, so commentary/final reply arrival does
not race the assertion about two unseen messages.

## Gate-driven fixes and integration

The first combined clean-gate run found real regressions in the new direct-start
path: uncertain creation could be retried and a known refused default was not
blocked. Both creation surfaces now share the existing identity-fenced command
marker helper, including the logout generation fence. Native default refusal is
reobserved on workspace entry and after settings; ordinary + still starts the
default directly. Only a refused-default error offers an explicit per-session
model recovery, without changing the native default. A failed catalog read has
an explicit retry action. Archive focus now follows the workspace DOM commit,
not a frame that can race a query-only route change.

The Claude bridge landed on main during this run. Its provider-qualified model
selection, native authorization and schema changes are retained. Only the two
generated fingerprint files conflicted; they were regenerated from both schema
sets. The obsolete-issue plan-test fix already landed upstream and was retained
rather than duplicated. Targeted integrated regression tests passed 9/9,
including Claude sign-in, uncertain create/reload, late reply after logout,
refused-default recovery, warm return, and explicit empty-composer selection.

Jari then reported the archive icon wrapping beside the stale-recap tag
(`arkistoi-rivittyy.png`, main commit `acb276b1`). Both pages now use the same card
grid and action logic. The header has a reserved top-right archive cell; metadata
can wrap below it without moving the action. Pending/refused-archive feedback is
owned by the page, so optimistically hiding its last card cannot discard the
error if the archive is refused. The lab includes a genuinely stale native recap
for this check. A browser geometry test checks both home and workspace at 1440,
640 (1280 at 200% zoom equivalent), and 390 CSS pixels: action above the stale
tag, right of the title, inside the card, and no horizontal page overflow.
`home-archive-*` adds paired synthetic cropped-card evidence for both themes.
The combined sidebar/workspace lab suite passed 6/6, including this geometry
case. Fast web checks also passed. The subsequent normal browser launch hit the
shared UID's inotify-instance limit (Vite EMFILE), not an assertion failure;
its retry uses polling and reduced browser concurrency. With available RAM
below 2 GiB, further heavy checks wait rather than changing shared services.

The final clean gate and delivery evidence follow below. This result claims synthetic same-UID/browser evidence,
not distinct-UID isolation, real provider behavior or live sign-in.

## Final integration iterations

Rebased without dropping or combining feature commits onto the settings refresh,
reasoning-title, and open-at-end/extension-message fixes. Their server-name
invalidation, new-opening-at-latest semantics, readable process summaries and
native empty-message filtering remain intact. The unread counter still counts
new visible text messages, not tool results or older-page insertion.

The clean gate exposed two obsolete onboarding-lab assertions: the workspace
page's former back-link class and former empty-state wording. The journey now
returns through the accessible phone drawer and checks the accepted open-section
empty state. The next lab run caught a real omission: the existing guarded
GitHub publication workflow was no longer reachable. It is retained inside the
Git layer for eligible local repositories, rather than placing a form ahead of
conversations; clones still do not offer publication. The desktop/phone lab
checks the actual open layer, not merely absence of a hidden form.

The normal suite also exposed an existing empty-composer replacement race:
late status 404s from the child just closed could redirect the new view into
missing native history before route-effect cleanup. It initially passed 3/3
isolated repetitions but failed again after integration, so it was fixed rather
than waived as a timeout. The old view epoch is now fenced synchronously before
handoff/cleanup, and its completion cannot clear the new view's busy state. A
new ownership regression fails on the old implementation and passes on the fix.
Five browser repetitions then passed. Stress repetitions also encountered native
close refusals; their conservative writer/empty-history checks were not weakened
or retried. Temporary diagnostic instrumentation was removed byte-for-byte.

RAM was checked before heavy runs (6–7 GiB available for the final iterations).
Private polling avoids the shared inotify limit; serial heavy phases avoid
adding our own Go process churn during browser native-source census. No machine
limit, household service or other worker's processes were changed.


## Final clean gate

The complete clean gate **passed** on commit
`d8a7d74c0b3d4ef996767ca95cecada7c4daaeaf`, tree
`7929411c7af6aa12b07869287f509f405264db0a`, in **526 s**, with no phase reuse:

- 133 app tests and 126 component tests; format, lint and typecheck.
- 176 normal browser cases passed, two intentional opt-in visual skips.
- All 31 lab cases passed, including publication, drawer navigation, Git layer,
  direct creation, archive geometry and the integrated opening/extension fixes.
- Go/race, generated contracts, fixtures, docs, licenses, Storybook and the VM
  fixture self-test passed. Root-only live VM boot/isolation is not implied.
- Packaging: 2500-entry native fixture, byte-identical archives, verification,
  re-signed unsafe unit/inventory rejection, relocation and tamper rejection.
- Issue doctor, generated drift and clean-tree checks passed.

Command: `CHOKIDAR_USEPOLLING=1 OH_GATE_SERIAL_HEAVY=1 OH_PORT_BASE=27700
OH_BROWSER_WORKERS=2 ./scripts/ci-local.sh --clean --json` (one shell command).
Receipt in the shared Git directory:
`open-habitat-gate-receipts/7929411c7af6aa12b07869287f509f405264db0a.json`.
Detailed local log: `/var/tmp/oh-workspace-complete-clean-gate.log`.
Later evidence/closure commits are documentation-only, not a claim of a clean
gate receipt for a different tree.


## Delivery

The conversation feature was delivered first at `05775a7f` / pilot.140. The
workspace feature followed as a guarded fast-forward into clean main and a
non-force fetch/rebase/push of **d8a7d74c0b3d4ef996767ca95cecada7c4daaeaf**. The standing watcher deployed
it as **0.0.0-pilot.147**: `verified`, `ungated`, `within_limit`,
**41.408 s**. The exact deployed tree matches the clean gate above.
The watcher's normal disposable-test policy is ungated even though this runnable
tree has a clean gate receipt.

Archive SHA-256: `51a1b8c80f5d0ee5f48bc92586e4448d269e7f184aa1cdfde35a92f1cee1c7ff`.
Manifest SHA-256: `1bc6947c2d04b56f2fd3df718988ebeae3cd225713e0daa28bb4bb0905bfcb4b`.
Operator receipt:
`~/.local/state/open-habitat-test-watch/release-d8a7d74c0b3d4ef996767ca95cecada7c4daaeaf-attempt-4/release-test-receipt.json`.
Three pre-staging attempts were refused by transient Fleetrepo cleanliness;
automatic watcher backoff recovered without touching another worker's edits or
starting a second operator. No guest stage had run in those refused attempts.
Anonymous public curl probes returned **200** for `/healthz` and `/`. Python's
default urllib client received an edge 403; no access policy was changed.
These are deployment/public-route checks, not real browser login or provider
turns. Jari's remaining authenticated checks are in `KOKEILTAVAA.md`.

No follow-up issue was filed. The final Taskfleet merge closes exact run
`01m51na4j4jxs0v685269kx0re` after these evidence-only updates are pushed.
