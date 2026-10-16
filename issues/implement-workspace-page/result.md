# Result

Implemented direction 1, **Keskustelut edellä**, from the accepted workspace
round. The page leads with the same native recap cards as home, ordered by
attention. Valmiit and Arkisto are folded. There is no worktree-agent placeholder
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

Full clean gate, feature merges, push and test-server deployment are recorded
below once verified. This result claims synthetic same-UID/browser evidence,
not distinct-UID isolation, real provider behavior or live sign-in.
