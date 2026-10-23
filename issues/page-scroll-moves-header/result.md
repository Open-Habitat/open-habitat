# Result

The authenticated shell is bounded to the dynamic viewport and cannot become a
page scroll surface. Conversation `main` cannot scroll independently of the
thread; the full-width stream (including both empty margins) owns scrolling and
contains overscroll at either end. No wheel interception, state, header/menu or
message-component changes.

Added light/dark **Production/Shell scroll** Storybook stories using the real
AppShell, sidebar and ConversationFrame. The browser regression covers sidebar
and single-workspace top-bar layouts, 1440 px and 390 px widths, 900 px and
600 px heights, both margins, both scroll boundaries, and shell accessibility in
both themes.

## Validation

Tested against base `09f71591` plus this commit's shell CSS, story and regression.
All build scratch used `/var/tmp`; the installed Fleetrepo command wrappers routed
heavy checks to the synthetic warm runner. Browser suites ran sequentially.

- `npm ci --prefix web` — passed.
- `./scripts/test-focused.sh --area web` — final static/unit/component checks passed.
- `./scripts/test-focused.sh --area browser --spec phone-composer-keyboard.spec.ts`
  — 2 passed, including emulated Safari viewport pan and Android keyboard resize.
- `./scripts/test-focused.sh --area browser --spec shell-accessibility.spec.ts`
  — 3 passed, keyboard/focus and axe checks.
- `./scripts/test-focused.sh --area browser --spec lab-page-scroll-header.spec.ts`
  — final margin/boundary regression and shell axe audits passed.
- `npm run storybook:test --prefix web` — passed.
- `git diff --check` and `issuectl doctor --json` — checked before landing.

No contracts or Go changed; those checks and the full gate were not needed.
This is synthetic Chromium evidence, not a live-host or native Safari check.

## Visual review

`evidence/scroll-{1440,390}-{light,dark}.{png,html}` pairs show the synthetic
conversation after scrolling away from the tail. Compared with
`design-system/drafts/Agentin vuoro.proto.html`: retained the bounded flex frame,
full-width scrolling stream with a centered reading column, fixed-in-frame
header/footer and contained overscroll. Existing token-based colors, column
width, gutters, typography and controls are unchanged. The ordinary tall-thread
lab fixture already behaved correctly before the change; this fix removes the
remaining ancestor scroll surfaces rather than claiming that fixture reproduced
Jari's original live occurrence.

## Check iterations and limits

- Initial exploratory source-path guesses were absent; located the shell in
  `Navigation.tsx` and the scroll layout in `components.css`. No prerequisite was
  missing.
- First new browser run used an encoded `/agents/` identity the legacy route does
  not decode. Corrected the test to the canonical workspace conversation query.
- An initial whole-page axe scan exposed existing repeated `Agentin vuoro`
  region names in the native feed. This worker does not edit message components;
  the final audit explicitly excludes `.ah-feed` and covers the changed shell.
- Theme-switch scans initially caught intermediate transition colors. Reduced
  motion makes the synthetic theme checks deterministic; final audits passed.
- A phone resize iteration aimed at pre-resize stream coordinates before the
  visualViewport listener updated the shell. The test now waits for the shell
  height before measuring its margins.
- Early web runs rejected unformatted diagnostic code, an obsolete CSS lint
  suppression, unsafe test null assertions, an array-index story key and a
  missing required story Button size. All were corrected and the complete
  focused web checks rerun. No checks were bypassed.

No architecture or product decisions need later review.
