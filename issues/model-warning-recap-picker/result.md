# Result

The unsupported-model notice now lives in a bounded footer area outside the shrinking conversation history. A recap cannot scroll it out of sight. The header popover stays mounted through the native recap, and its model choice appears before the long facts list so the select is reachable without scrolling the popover. Choosing a model still changes only Pi's default for **new** conversations.

## Evidence

- Synthetic lab, 1100 × 600: [before](before-recap.png) ([static HTML](before-recap.html)) and [after](after-recap.png) ([static HTML](after-recap.html)). The fake Pi emits an unsupported-model error; a native recap is then requested while the model picker is open. Before, the selector falls below the visible part of the popover; after, it is directly available. Both screenshots are synthetic, not live-server evidence.
- Focused synthetic host browser checks passed on the changed worktree (base `3d038a6d`): the existing unsupported-model selection journey and the new recap/picker journey. The latter verifies that the warning remains in the viewport, the popover stays open through the native recap, and the chosen default is persisted through the host API.
- `./scripts/test-focused.sh --area web` passed (format, lint, typecheck, unit and component). `git diff --check` passed.

The original test-server sequence did not reproduce identically in the lab: a manually requested recap did **not** close the popover or remove the warning on the baseline bundle. This fixes the vulnerable layout and establishes a host-backed regression test, but live test-server behavior remains to be checked after deployment. The lab uses a manually requested native recap because an unsuccessful first Pi turn is not eligible for automatic recap generation in the synthetic controller.

Full non-clean gate did not pass, so there is no clean-gate receipt. Attempt 1 stopped at `npm ci` with a registry timeout. Attempt 2 passed all 163 browser cases but failed `TestCloseEmptyBrowserChild/empty` with a writer conflict; that Go race test passed alone. Attempt 3 passed web checks and Go packages except `TestExternalPiAppendReachesTwoStreamsAndNativeHistory` (inotify watcher could not start); its browser phase had one unrelated archive-navigation timeout out of 165 cases. Both attempt-3 failures passed in isolation (`go test -race ./internal/daemon -run '^TestExternalPiAppendReachesTwoStreamsAndNativeHistory$' -count=1 -v` and the focused archive browser case). None of these failures occurred in the new recap case. The full gate has **not** been marked green.
