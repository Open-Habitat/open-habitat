# Result

An empty Hiljaiset uses the same static heading layout as the other now-sections, without a chevron or an expand button. The section still has its labelled heading and inline status. Conversations hidden only by the workspace filter retain folding, the filter menu and its empty-result explanation.

## Verification

- `./scripts/test-focused.sh --area web`: passed, 255 files / 2156 tests, including QuietSection rendering and filtered-empty regression coverage.
- `OH_BROWSER_WORKERS=2 OH_PORT_BASE=15740 ./scripts/test-focused.sh --area browser --spec rail-section-filter.spec.ts`: passed, 6 cases.
- Same spec through Playwright with `--repeat-each 3`, two workers and 0–60 ms reply jitter: 18 passed.
- Browser assertions cover Finnish and English, ordinary and adaptive desktop rails, and the phone drawer with both preference settings. All three empty title spans start at the same x (within one CSS pixel); no empty quiet button exists. Axe checks passed.
- Synthetic screenshots and HTML: `/var/tmp/agent-keep/quiet-empty-chevron/{locale}-{adaptive}-{phone}.{png,html}`. Inspected the Finnish adaptive desktop and ordinary phone images. Logs are alongside these files. No live installation data was used.
- Initial checks caught a test's incorrect assumption that the filter explanation had a status role; corrected the test to use its existing show-all control. Browser setup initially lacked the pinned Pi SDK fixture; installed it and reran successfully.

Focused self-review was proportionate: this is a rendering-only conditional, with no session, contract, daemon or authorization changes. Checked the unfiltered row-count boundary, retained accessible label, populated/folded behavior and shared heading styling. AdaptiveRail measures actual section geometry and shares this component; it needs no separate implementation change.

## Decisions for later review

None beyond the requested behavior. Keep the stored folded preference unchanged when the list empties, so conversations returning later respect the person's choice.

## Live check

After deployment, open a rail with no conversations. Hiljaiset should have no chevron and align with Sinun vuorosi and Käynnissä. Check ordinary and adaptive desktop rails and the phone drawer. With quiet conversations present but excluded by the workspace filter, the filter explanation and show-all action should remain. Live deployment verification is left to the conductor; this worker verified the host-backed synthetic UI only.
