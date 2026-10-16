# Result

## Cause and fix

Reproduced on the production-bundle synthetic lab at `OH_PORT_BASE=29400`, based on `4259260a`. After eight real-controller/fake-Pi turns the button incorrectly appeared although the first native entry remained loaded. After a cold reload and loading every older page, the button disappeared, then returned on **Tiedot → Tarkista keskustelun tila**. Before-fix captures show both occurrences.

The daemon's `older_complete` and `next_before` were correct. `ConversationStore.applyPage` used `old.next ?? page.next_before` when joining overlapping tail/reconnect pages. An undefined cursor meant an exhausted left boundary, but the fallback replaced it with the newest page's cursor. It also failed to clear a previous cursor when a refresh proved the same oldest entry complete.

The merged window now takes its cursor from whichever page owns its first entry. A retained left edge keeps its cursor, including known exhaustion; a newly established left edge takes the incoming page's completeness/cursor. No extra history storage, persistence, cache flag or contract change.

## Browser evidence and design comparison

All captures use invented Alice, the real daemon controller and fake Pi, Chromium 1440×900, light theme. They prove synthetic browser/host behavior, not real Pi/provider or live-host behavior. The issue contained only `item.md`: no live screenshot was attached, so no live image comparison is claimed.

Paired image/static-HTML evidence under `evidence/`:

| State | Before | Fixed |
| --- | --- | --- |
| Eight settled turns, oldest native entry loaded | `before-live-complete` | `after-live-complete` |
| All older pages loaded, explicit status/history refresh, details open | `before-refreshed-complete` | `after-refreshed-complete` |

Images are AVIF and adjacent HTML files are inert synthetic snapshots. `capture.mjs` reproduces the lab journey from the repository root; set `PHASE=after` for the fixed captures. Captures identify the base commit in their HTML header; fixed captures include this change's then-uncommitted store fix.

Compared the fixed oldest-loaded/settled view against `evidence/prototype-settled-oldest.avif`, built from `design-system/prototypes/agentin-vuoro` with `(cd design-system/prototypes && node build.mjs agentin-vuoro --out /var/tmp/older-history-prototype.html)`. Both show native conversation content without an older-history action above a fully loaded history. This is a state/affordance comparison, not a pixel-equality assertion; the prototype has no native paging implementation.

Differences and their reasons:

- Removing the incorrect pager moves the first user message upward; this is the intended correction, not a spacing redesign. No component markup, CSS, typography or tokens changed.
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
- Full clean gate: pending below. `free -g` checked before heavy validation; Linux available memory remained above 2 GiB (5–7 GiB, including reclaimable cache). Build scratch uses `/var/tmp/oh-older-build`.

Live verification remains on `KOKEILTAVAA.md`; this worker did not access real user history or capture the live server.
