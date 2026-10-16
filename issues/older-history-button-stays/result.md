# Result

## Cause and fix

Reproduced on the production-bundle synthetic lab at `OH_PORT_BASE=29400`, based on `4259260a`. After eight real-controller/fake-Pi turns the button incorrectly appeared although the first native entry remained loaded. After a cold reload and loading every older page, the button disappeared, then returned on **Tiedot → Tarkista keskustelun tila**. Before-fix captures show both occurrences.

The daemon's `older_complete` and `next_before` were correct. `ConversationStore.applyPage` used `old.next ?? page.next_before` when joining overlapping tail/reconnect pages. An undefined cursor meant an exhausted left boundary, but the fallback replaced it with the newest page's cursor. It also failed to clear a previous cursor when a refresh proved the same oldest entry complete.

The merged window now takes its cursor from whichever page owns its first entry. A retained left edge keeps its cursor, including known exhaustion; a newly established left edge takes the incoming page's completeness/cursor. No extra history storage, persistence, cache flag or contract change.

## Browser evidence and design comparison

Lab captures use invented Alice, the real daemon controller and fake Pi (or synthetic read-only native files), Chromium 1440×900, light theme. They prove synthetic browser/host behavior, not real Pi/provider or live-host behavior. Initially the issue contained only `item.md`. During validation, main gained Jari's `lataa-seuraava-sivu.png` and a comment about the read-only pager. The first merge stopped on that issue-text conflict; the rebase preserved Jari's comment and screenshot and retained the completed acceptance checkbox. The additional read-only correction below addresses that live finding too.

Paired image/static-HTML evidence under `evidence/`:

| State | Before | Fixed |
| --- | --- | --- |
| Eight settled turns, oldest native entry loaded | `before-live-complete` | `after-live-complete` |
| All older pages loaded, explicit status/history refresh, details open | `before-refreshed-complete` | `after-refreshed-complete` |

Images are AVIF and adjacent HTML files are inert synthetic snapshots. `capture.mjs` reproduces the lab journey from the repository root; set `PHASE=after` for the fixed captures. Its PNG output was encoded with `avifenc -j 2 -s 8 -q 80`. Captures identify the base commit in their HTML header; fixed captures include this change's then-uncommitted store fix.

Compared the fixed oldest-loaded/settled view against `evidence/prototype-settled-oldest.avif`, built from `design-system/prototypes/agentin-vuoro` with `(cd design-system/prototypes && node build.mjs agentin-vuoro --out /var/tmp/older-history-prototype.html)`. Both show native conversation content without an older-history action above a fully loaded history. This is a state/affordance comparison, not a pixel-equality assertion; the prototype has no native paging implementation.

Differences and their reasons:

- Removing the incorrect pager moves the first user message upward; this is the intended correction, not a spacing redesign. The initial cursor fix changed no markup. The follow-up read-only fix moves its existing button above the timeline and wraps it in the same `ah-history-pager` column container as controlled conversations. No CSS, typography or tokens changed.
- The prototype's design-tool toolbar, centered frame, Status-skripti content, GPT model, recap and Jari account differ from the full-viewport lab's invented Alice, fake-Pi replies and absent recap. These are existing prototype/fixture differences, not new product decisions. The production process/spinoff availability notices remain unchanged and are not suppressed for the capture.
- The second fixed live capture follows repeated manual synthetic creations, so its sidebar contains additional same-title conversations. Native IDs, timestamps and temporary workspace paths also differ. These do not affect the matched conversation state or cursor behavior.
- The corrected live capture uses an explicit reader scroll, showing **Viimeisimpään**; the original capture used programmatic scrolling without reader intent. This existing reading-position behavior is independent of paging.
- **Reload distinction:** a short conversation still has no pager after reload. A cold reload of a long conversation intentionally reads only 25 newest native entries, so the pager must reappear until older pages are loaded again. Persisting the previous complete window across reload would contradict the documented in-memory native viewer architecture. No persistence was added to satisfy a literal reading of “does not reappear after reload”.

## Validation and focused self-review

- Red browser regression: extending the existing eight-turn lab journey failed on the original store at the assertion that no older-history button exists (`Expected 0; Received 1`).
- `./scripts/test-focused.sh --area web`: static checks, 144 unit tests and 133 component tests passed. Repeated after the final test changes.
- `./scripts/test-focused.sh --area browser --spec lab-conversation.spec.ts --tag 'exhausted older history'`: passed, including one-turn short history/reload, growth beyond a page, long cold-reload paging to exhaustion, explicit history refresh, another live turn and daemon-restart reconnect retaining the oldest entry. Repeated after strengthening response/application waits.
- `./scripts/test-focused.sh --area browser --spec native-history.spec.ts`: 10 passed, covering read-only native history and its older-page anchor.
- Added cheap store boundary tests for both tail/reconnect exhaustion, a same-edge completeness proof, a page extending the left edge, and disjoint replacement restoring a genuine cursor.
- Self-review: checked cursor ownership against overlapping, older, disjoint and empty-page joins; no change to boundary/order validation, identity fencing, event buffering or retained history bounds. Kept changes out of the parallel workspace-icon implementation.
- Full clean gate attempted on implementation commit `3a53e544` (tree `c422bee7c2c163fff6b056eca3600f31f85af683`), port base 29400. **Not a pass; no clean-gate receipt.** First attempt stopped during dependency installation with npm `ETIMEDOUT`; retry completed setup and web checks but the browser suite had 192 passed / 2 intentional visual skips / 1 account-settings timeout (`native key add, suffix, provider switch and confirmed removal`). That case passed immediately in isolation. Many native Go tests rejected group-writable synthetic homes: the shell umask was `0002` and Go 1.27's `testing.TempDir` creates its numbered child with mode `0777`. Representative credential, workspace, gateway and archive tests all passed with `umask 077`.
- Third gate attempt used `umask 077`: web checks passed again, browser suite had 192 passed / 2 intentional visual skips / 1 archive/restore timeout (`restart offers native continuation and archive without a handle`, missing restore action within 5 seconds). Go had just `TestCloseEmptyBrowserChild/empty` failing with `409 control_uncertain`; the previous broad permission failures were gone. The gate stopped before lab, generated-contract checks and packaging. These are outside this change's cursor join and are not hidden as a passing gate. Final isolation/lab/contract results are recorded below.
- `free -g` checked before each heavy run; available memory remained above 2 GiB (5–7 GiB, including reclaimable cache). Focused build scratch uses `/var/tmp/oh-older-build`; the gate itself pins disk-backed `/var/tmp`.

### Final isolated checks

With `umask 077`, `go test -race ./internal/daemon -run '^TestCloseEmptyBrowserChild$' -count=1` passed, and the archive/restore browser case passed in isolation. The complete `lab-conversation.spec.ts` then passed **12/12**, including the history regression. `./scripts/test-focused.sh --area contracts` passed generated drift, 41 schemas / 28 fixture files / 34 scenarios / 12 negative checks and the implementation map. `issuectl doctor --json`, project-view validation and `git diff --check` passed. These checks cover the initial cursor fix; the subsequent read-only amendment was validated again as described below.

The unrelated isolated-passing failures are recorded rather than blocking this scoped fix, as directed in the worker brief. Full-gate packaging was not reached and no release-readiness claim is made.

## Read-only finding received during merge

Jari's supplied live screenshot shows the native read-only view at the latest reply, with **Lataa seuraava sivu** below the timeline and left of the message column. That control actually loads **older** entries: even a legitimate cursor does not belong after the newest reply. `HistoryView` now uses the controlled view's top-of-stream pager wrapper and the explicit **Lataa vanhempi historiasivu** label. Exhaustion is still determined by the shared corrected store, not by whether the viewport is at the newest end.

Extended the existing read-only short-history journey to prove that loading all 51 entries removes the control and a snapshot/history refresh does not resurrect it. Extended its existing older-page reading-anchor case with relative browser geometry assertions: the pager must be above the first loaded entry, with the same column left edge and width. This would reject the bare footer button in Jari's live screenshot. Existing anchor behavior remains asserted. No new redundant browser journey.

After the amendment, fast web checks passed again (144 unit / 133 component tests), the full native-history spec passed 10/10 (including the new exhaustion and geometry assertions), and the controlled-history regression passed again. Focused self-review verified both conversation renderers now share the same left-edge cursor semantics and pager wrapper, and the older-page anchor still passes.

Compared Jari's supplied `lataa-seuraava-sivu.png` with these paired synthetic AVIF/static-HTML captures:

- `evidence/readonly-partial-newest`: same read-only/newest-end state; no older-history control below the last entry, even while older entries remain unloaded.
- `evidence/readonly-partial-oldest`: scroll to the earliest currently loaded entry; the legitimate older-history control is above it, centered in the message column, not half-width at the left edge.
- `evidence/readonly-complete-refreshed-newest`: all 51 native entries loaded and explicitly refreshed; no history control remains, at either end.

The live image has browser/desktop chrome, a much wider viewport, a recap and real assistant/process replies. The lab uses invented ordinary-dir security-test history (user rows, a long text and an unknown entry), Alice and no recap. These are content/environment differences, not changes to the live layout or authority model. The comparison establishes pager placement/absence in the matching read-only states, not pixel identity. `capture-readonly.mjs` recreates the invented `ordinary-dir` inside a guarded `/tmp/oh-browser-*/alice/src` synthetic home, then uses the lab's existing native-history seam; it refuses any other path or a missing lab marker. The raw PNG captures were encoded to AVIF as above.

A final clean-gate attempt follows on the amended committed tree, with private umask, two browser workers and the documented serial-heavy mode to reduce contention; result recorded below.

Live verification remains on `KOKEILTAVAA.md`; this worker did not access real user history or capture the live server. Only the screenshot Jari supplied in the issue was inspected.
