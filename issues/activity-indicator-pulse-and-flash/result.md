# Result

The turn's working label now uses the shared pulsing `StatusMark`; reduced motion leaves the mark visible without animation. Normal completion and title/settings metadata no longer become temporary status notices below the answer. Error, abort, retry, compaction, extension and unsupported-event reporting remain visible.

## Diagnosis and review

Read-only inspection through Fleetrepo's pinned helper found a normal final assistant answer (`stopReason: stop`) followed by session-info updates and the recap in the named native session. No live state was changed or captured. The renderer converted `agent_end` and `session_info_changed` into provisional signal notices, even though completion/title metadata is already represented elsewhere; native catch-up then removed those notices. Historical native JSONL does not preserve the exact browser paint or event timing.

Self-review against `design-system/prototypes/lib/quiet.js` and `quiet.css`: retain the quiet work disclosure, accent dot, activity and right-aligned clock. Reviewed all four synthetic captures below: the line fits at 390 px, activity truncates rather than pushing out the clock, and the dot uses the shared motion token in both themes. The inherited phone label size is preserved. No model-menu changes.

One targeted review by `claude-fable-5-1` found no functional defects; its phone font-inheritance observation was corrected. The unrelated scroll-to-latest pill was not changed.

## Validation

Tested the final runnable diff against base `09f7159128218df62252db35ca99fac0433b8501` (the delivered revision is the commit carrying this result):

- `npm ci --prefix web` — passed.
- `./scripts/test-focused.sh --area web` — format, lint, TypeScript, 92 test files / 535 tests passed.
- `./scripts/test-focused.sh --area browser --spec activity-line.spec.ts` — 2 passed: actual dot animation, reduced motion, stationary activity line, work disclosure and axe at desktop/390 px.
- `./scripts/test-focused.sh --area browser --spec lifecycle-frames.spec.ts` — passed: four completed native synthetic turns, DOM-mutation and animation-frame samples contain no transient notices or unsupported rows; reload remains clean.
- `./scripts/test-focused.sh --area browser --spec lab-activity-line.spec.ts` — passed: held native synthetic turn, axe and four paired PNG/static HTML captures in `review/` (1440/390 px, light/dark).
- `npm run build-storybook --prefix web` — passed; includes the production-component completion story.

Browser commands used Fleetrepo's routed warm Linux ARM64 synthetic runner, serially; no live provider or distinct-UID isolation claim. No Go or contract changes, so those checks and the full clean gate were not run.

Initial format and CSS-specificity checks failed and were corrected before the final passing runs. One foreground validation invocation timed out and was replaced by a managed final run. Initial remote evidence retrieval found an evicted warm workspace; recapture plus immediate pinned-route retrieval succeeded. All required validation and captures were subsequently completed.

## Visual evidence

Each image has an adjacent self-contained static HTML snapshot, captured only from the synthetic lab:

- [Desktop light](review/activity-1440-light.png) · [HTML](review/activity-1440-light.html)
- [Desktop dark](review/activity-1440-dark.png) · [HTML](review/activity-1440-dark.html)
- [390 px light](review/activity-390-light.png) · [HTML](review/activity-390-light.html)
- [390 px dark](review/activity-390-dark.png) · [HTML](review/activity-390-dark.html)
