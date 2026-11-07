# Result

Reduced-motion mode keeps the steady working status and elapsed clock, without the rapidly changing per-tool activity label. Work details still open normally. Normal-motion mode is unchanged, including switching the OS preference during a turn. The turn-end 12 px step is untouched.

## Decisions for later review

- Hide the per-tool activity label while reduced motion is requested, rather than throttle its updates or add a text transition. The existing label already swapped without a transition: rapid content replacement itself caused the visual churn. The steady working label conveys liveness, the clock remains useful, and the disclosure retains the actual tools. No timer, delayed state or alternate wording is needed.

## Evidence and review

Tested the working tree based on the run's initial commit with the CSS and browser regression in this commit:

- `./scripts/test-focused.sh --area web`: passed, 181 files / 1381 tests plus static checks.
- `./scripts/test-focused.sh --area browser --spec activity-line.spec.ts`: 4 passed. Chromium synthetic component preview; reduced-motion changes across seven stream phases at 1440 and 390 px, no animations, stable row geometry, preference switching, and retained tool disclosure. Existing normal-motion/a11y cases pass too.
- `./scripts/test-focused.sh --area browser --spec quiet-work.spec.ts`: 2 passed, including reduced-motion reveal and disclosure stability/a11y.
- Focused self-review: change is scoped to the activity span under the media query; no session/contract/daemon changes. Global reduced-motion animation suppression, tool disclosure, status mark and the end-spacing implementation remain intact. No coloured edge stripe added.

Browser checks used `OH_PORT_BASE=16900`, two workers and private disk-backed TMPDIR under umask 077. No whole suite or clean gate. Real macOS/pilot perception awaits the KOKEILTAVAA check. No screenshot evidence retained: the snapshot helper correctly refused the component-preview origin (not the synthetic lab); this is not a visual comparison claim.

## Resolved tooling attempts

- Initial web check rejected non-null assertions in the new test. Replaced bounding-box nullable reads with direct DOM geometry reads; final web check passed.
- Passing two `--spec` flags selected only the last spec. Ran activity-line separately and verified all four cases.
- Optional screenshot capture failed its synthetic-lab origin guard. Removed that capture attempt without bypassing the guard; all four final browser cases pass.
- Exploratory ripgrep globs for nonexistent motion/gap specs returned missing-path diagnostics; scoped searches located the actual activity-line and quiet-work specs.
