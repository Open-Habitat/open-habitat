# Visual acceptance package

## Artifact and environment

- Product revision: `9fc0840`.
- Design input: `62c0ae6833301bcdd0901053ea08ef514a929153`.
- Browser: Chrome for Testing / Chromium `153.0.8010.12` from Playwright `1.63.0`.
- OS: Linux `7.0.0-31-generic`, x86_64 GNU/Linux.
- Standard viewport: Playwright Desktop Chrome, 1280 × 720 CSS pixels; screenshots are full-page.
- Zoom check: 1280 physical pixels at 200% represented as a 640 CSS-pixel viewport.
- Data: deterministic, test-only Finnish display models enabled by `VITE_ENABLE_TEST_FIXTURES=true`; production builds tree-shake the preview and contain no fixture marker.

## Scenarios and assertions

### Happy state, both themes

The fixture shows a connected host, long workspace and agent titles, textual activity/control state, host facts, user and assistant messages, unified diff and a working-agent Composer. Assertions require the shared production heading, textual “Työskentelee” state and enabled follow-up action. The dark and light captures use the same component modules and fixtures.

![Light theme: workspace rail, agent facts, messages, diff and Composer](./assets/design-happy-light.avif)

![Dark theme: the same production modules and deterministic happy state](./assets/design-happy-dark.avif)

### Relevant unhappy states

The fixture combines stale readable content with host read-only behavior, explicit unknown title/process state, an uncertain command that is never resent automatically, stale steering/follow-up queues with disabled whole-clear reason and a partial operation whose confirmed and unknown effects remain separate. The Composer preserves its value as a read-only field. Assertions require every named state and reason independently of colour.

![Stale and read-only state with uncertain command, queue reason and partial operation](./assets/design-unhappy-light.avif)

### Keyboard, focus, zoom and motion

- Tab reaches “Siirry keskusteluun”; activation focuses `main`.
- Component tests verify dialog title initial focus, focus trapping behavior supplied by React Aria, Escape close policy, return focus, menu End/Escape and tab ArrowRight.
- IME composition does not submit; pending send blocks Enter without disabling/focus-dropping the action.
- At effective 200% zoom the 1280 px desktop fixture has no page-level horizontal overflow.
- With `prefers-reduced-motion: reduce`, running status remains textual and visible while animation-name is `none`.
- Axe reports zero violations for happy and unhappy fixtures in both light and dark themes.

## Exact commands and results

```sh
PLAYWRIGHT_BROWSERS_PATH="$PWD/.cache/ms-playwright" npm run test:visual --prefix web
# 6 passed

PLAYWRIGHT_BROWSERS_PATH="$PWD/.cache/ms-playwright" npm run test:a11y --prefix web
# 2 Playwright tests passed; design test iterated happy/unhappy × light/dark

npm run test:component --prefix web
# 15 passed

npm run storybook:test --prefix web
# executable static Storybook build completed successfully

mkdir -p "$PWD/.cache/ci-tmp"
export TMPDIR="$PWD/.cache/ci-tmp" PATH="$PWD/.tools/go/bin:$PATH"
./scripts/ci-local.sh --clean --json
# {"schema_version":1,"data":{"status":"passed","clean":true},"warnings":[]}
```

The screenshots supplement these assertions; no acceptance claim depends on pixel comparison alone.

## Jari checkpoint

Decision pending. The conductor should present this package and record Jari's explicit dated accept/change decision in this issue. This worker does not self-accept or close it.
