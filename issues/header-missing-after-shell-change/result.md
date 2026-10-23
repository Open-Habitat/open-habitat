# Result

The authenticated shell is now anchored to the viewport in every view, rather
than merely given a viewport height. On phones, workspace-list and settings
navigation stays sticky inside the scrolling main area; conversations retain
the existing fixed-in-frame toolbar and their single scrolling stream. The
visualViewport keyboard handling now covers all authenticated views.

The new regression reproduced the 390 px workspace-list header disappearing
with a viewport intersection ratio of zero after scrolling. The earlier scroll
change bounded the shell but left ordinary-view navigation inside scrolling
`main`; its regression only exercised conversations. The baseline desktop
conversation test already passed, so this is not a claim to have reproduced
Jari's exact desktop/live-browser occurrence. Anchoring the whole shell removes
its remaining document-displacement path on desktop as well.

## Validation

Base `da3ccf6a` plus this change; focused synthetic checks, not a clean-gate or
live-host receipt. Builds/scratch used `/var/tmp`; the installed Fleetrepo
wrappers placed heavy checks on the warm runner. Browser suites ran serially.

- `npm ci --prefix web` — passed.
- `./scripts/test-focused.sh --area web` — final complete retry passed static
  checks and all 93 files / 537 tests.
- `./scripts/test-focused.sh --area browser --spec lab-shell-header.spec.ts`
  — 4 passed: workspace list, conversation and settings; 1440/390 px; sidebar
  and single-workspace top bar; header fully in viewport after load and after
  wheel/scroll-boundary jumps; shell axe audits in both themes.
- `./scripts/test-focused.sh --area browser --spec lab-page-scroll-header.spec.ts`
  — 4 passed: conversation margin/boundary scrolling, both layouts and widths,
  900/600 px heights, both themes and shell axe audits.
- `./scripts/test-focused.sh --area browser --spec phone-composer-keyboard.spec.ts`
  — 2 passed, including emulated Safari pan and Android resize.
- `./scripts/test-focused.sh --area browser --spec shell-accessibility.spec.ts`
  — 3 passed, keyboard/focus and axe checks.
- `npm run storybook:test --prefix web` — passed.
- `python3 scripts/validate-project-view.py`, `issuectl doctor --json` and
  `git diff --check` — passed before close.

No contracts, Go, message rendering, model picker or application state changed.
No external reviewer was required for this shell-only CSS change. Native Safari
and the deployed test server remain unverified here; the conductor should deploy
and check Jari's reported browser after landing.

## Visual self-review

Reviewed all four `evidence/conversation-{1440,390}-{light,dark}.{png,html}`
pairs from the synthetic lab against `design-system/drafts/Agentin vuoro.proto.html`:
header stays above the bounded stream, the reading column stays centred, and
light/dark surfaces, gutters and controls retain their existing tokens. The
phone header wraps but remains fully visible. This is human review material,
not an automated pixel comparison. Added light/dark long-page Storybook states
using the production AppShell, beside the existing conversation states.

## Failed attempts and limits

- Initial exploratory file guesses (`BrowserShell.css`, `ConnectionBanner.tsx`,
  `WorkspaceRail.css`, `Navigation.css`, `AccountSettings.css`) were absent;
  located the actual styles in `components.css` and related imported modules.
  Local `web/test-results` was also absent because browser artifacts were on
  the warm runner; the four screenshot/HTML pairs were fetched from that runner.
  Initial dependency-directory discovery also found no installed dependencies;
  `npm ci` resolved that prerequisite. These were discovery misses, not skipped
  checks.
- The first new browser run selected an agent before enabling the long-history
  fixture, and failed on an undefined agent. Added `/fixture/open-at-end` before
  sign-in and reran the full spec successfully.
- The next browser run intentionally exposed the bug: the phone workspace-list
  toolbar left the viewport. Sticky navigation fixed it; all final browser
  suites above passed. The old conversation-only regression passed before the
  fix, explaining why it had not caught this ordinary-view failure.
- The first final focused web run passed 536/537 tests but timed out waiting
  for lazy Markdown rendering in the unchanged `StartHere.test.tsx` (expected
  `strong` content had not appeared). The earlier full web run passed 537/537;
  the required complete check was rerun and passed all 537 tests, rather than
  accepting the partial run.
  Logs: `/var/tmp/header-final-web.log` and
  `/var/tmp/header-final-web-retry.log`. No unrelated message/test code changed.
- Axe excludes `.ah-feed`, matching the existing shell regression, because
  conversation-message accessibility is outside this worker's scope. No
  message-component accessibility claim is made.
