# Result

Each listed failure was reproduced on main 6d72ce3c. Five causes cover them: two product regressions, two landings that changed accepted behaviour without updating older specs, and two test races. (Gate logs are not on this host, so everything here was reproduced from scratch.)

## Causes and fixes

### Product regressions

- **settings-search.spec.ts:76** (`/` finds a setting): fails every time. The ⌘K switcher (3c7f2d2b, 15.11.) listens for `/` on the window in the capture phase and opens the switcher outside text fields, so Settings' own handler for `/` never saw the key. Fix: the Settings page marks itself `data-owns-slash`, and the switcher leaves `/` to it. ⌘K/Ctrl+K still opens the switcher in Settings.
- **browser-conversation.spec.ts:3944** (archive offer rides in the next header): fails every time. 7ecb34fe (15.11.) scoped *every* archive notice to the view that raised it, so restore refusals would stop following the person. That also removed the undo offer from the next conversation's top bar (the design from 28.10., "Notices as a quiet row inside the page's top bar"). Fix: only a refusal (`problem`) is tied to its view. The undo offer travels until it expires, as before. A late refusal replaces this conversation's travelling offer where it now is, and still never raises a banner in an unrelated view. 7ecb34fe's own specs (archive-damaged-history, rail-archive) still pass.

### Specs encoding behaviour a newer landing changed on purpose

- **thread-fill.spec.ts**, **context-ring.spec.ts:179** (normal reply), **lab-composer-stack-gaps.spec.ts:43** at 390/800/1024/1440: fail every time. Bisected to e2367697 (first-message-flicker, 15.11.). It deliberately makes a conversation started in the current view grow down from its first message ("This intentionally changes the placement of the new-view start page as well as its first turn"). All three specs create the conversation in the view and then measure bottom alignment, or the gap between the last transcript row and the composer. Fix: thread-fill now asserts top growth for the conversation created in the view. It then reloads the page, and the 16.10./29.10./30.10. bottom-alignment assertions run unchanged on the reopened conversation. The compaction-rhythm and stack-gaps cases reopen the conversation before measuring, as the held-message variant already did.
- **lab-composer-lists-in-field.spec.ts:204** (command preview starts at the top): fails every time. 47366ebf (14.11.) lists the built-ins compact and new before the skills, so there were 4 options and the first one was `/compact`. `Home` never moved the list selection; it only worked because alpha used to be first. Fix: the spec counts the two synthetic skills, steps down to alpha with the arrow keys, and checks scroll reset on ↓ and ↑ as before.
- **lab-yaml-preview.spec.ts:11** at 390/1440 fi/en-US: fails every time. The spec asserted the explain card's wording ("YAML-esikatselu"), which the card copy no longer contains. TESTING.md rules out testing wording. Fix: it asserts the card part (`data-card`, already there), the page language (`<html lang>`) and a non-empty card.

### Load-induced races in tests (product correct)

- **lab-reply-selection.spec.ts:44**: failed 1–2 times in 12–24 runs under 4× CPU throttle, reply jitter and CPU hogs. The live selection came back empty. Instrumented: the spec measured a line, then follow-latest scrolled the stream as the reply grew (the reader was at the end) before the mouse press landed, so the press hit the header or another line. Fix: the spec scrolls back with the wheel like a reader, which stops following, and waits for `jump-latest` before aiming. The selection is still made in the live, growing reply. Afterwards 24/24 passed under the same load.
- **TestArchiveStopsIdlePiButNotBackgroundWork** (internal/daemon): `converse` waits for status idle and an accepted receipt. But on `agent_settled` the daemon sets the state to idle, releases the lock, and only then publishes the turn's native history (and may still be naming the conversation). In that window `heldActivity` correctly answers `turn`, so `busySessions` reported `turn` instead of `processes`. Fix: wait with the existing `quiescent` helper before archiving. The gate failure did not reproduce here (90 runs, with and without `-race`, under 7–8 CPU hogs), so this fix rests on reading the code. That window is exactly what `quiescent`'s comment describes.

## Verification

- Each listed browser case: 3 consecutive runs (`--repeat-each 3`, 3 workers), all passed. Ordinary 4 cases; lab 10 cases (27 + 3 runs).
- lab-reply-selection: 24/24 with `OH_CPU_THROTTLE=4 OH_REPLY_DELAY_MS=250`, 4 workers, 5 CPU hogs.
- Go test: `-race -count=20` with 8 CPU hogs, passed. `./scripts/test-focused.sh --area go --go-package ./internal/daemon` passed.
- `./scripts/test-focused.sh --area web` passed.
- Neighbours of the two product changes, once each, all passed: switcher-search, settings-search, rail-archive, archive-damaged-history, helper-archive, mutation-layer, next-waiting-row, workspace-count-rail, archive-quick-succession, account-settings, the archive/compaction cases of browser-conversation, context-ring, browser-editor:1229; lab: lab-composer-lists-in-field, lab-composer-builtins, lab-first-message-flicker, lab-workspace-icon-suggestions, lab-workspace-page, lab-idle-pi-slots, lab-workspace-trash.
- Not run: the whole ordinary and lab suites and the clean gate, because no shared fixture or browser host changed. The conductor reruns the gate.
- Seen along the way: rail-archive.spec.ts:16 (outline CSS) failed once and then passed 4/4. 7ecb34fe's result already recorded it as transient. Filed unlaned as `rail-archive-outline-flake`.

## Decisions for later review

- **Top growth of a conversation started in the view wins over "Alhaalta" for that view only.** e2367697 made this change on purpose and recorded it under its own decisions for later review. It contradicts Jari's 16.10. "Alhaalta" rule for a conversation created in the view. Alternatives: revert to bottom alignment and give up the flicker fix's under-1 px rule for the first message, or keep it and adapt the specs. Chosen: keep the newest landed design and adapt the specs. Bottom alignment is still asserted for every reopened conversation. If Jari prefers Alhaalta here too, the change is the CSS rule in `composerStack.css` (`[data-created-here]`), and these specs would need their earlier assertions back.
- **The undo offer travels; a refusal does not.** This restores the 28.10. top-bar design and keeps 7ecb34fe's "a refusal does not follow into another conversation". Alternative: keep everything view-scoped and drop the travelling offer. Rejected: that removed an accepted design without saying so.
- **Settings keeps `/`.** A page-local search beats the global switcher shortcut; ⌘K still opens the switcher there. Alternative: let `/` open the switcher everywhere and give settings search another key. Rejected: the newer landing gave no reason to take the key from Settings, and its notes never mention Settings.
