# Foundation visual acceptance evidence

## Product and environment

- Product revision: `079694adf0f9cdabddf6cc7289672d1d813a521f`.
- Accepted implementation input: `b87b1aae5d6fefcd914d4f06c0e510b5ca124f60`.
- Browser: Playwright 1.63.0, Google Chrome for Testing 153.0.8010.12, headless Chromium project.
- OS: Linux 7.0.0-31-generic x86_64 GNU/Linux on the disposable development host context.
- Viewport/device profile: Playwright `Desktop Chrome`.
- Server: Vite development server bound to `127.0.0.1:4173` by the checked-in Playwright config.

No real browser session, OAuth provider, Unix user mapping, home directory, Pi history or daemon was used. `VITE_ENABLE_TEST_FIXTURES=true` exists only in `web/playwright.config.ts`; the package gate proves fixture marker strings are absent from `web/dist` and rejects a fixture-bearing release input.

## Deterministic scenarios and assertions

The checked-in test is `web/tests/foundation.spec.ts`.

1. **Authenticated foundation shell / happy scaffold state**
   - Fixture: `ready` (`schema_version:1`, authenticated, synthetic server label).
   - Route: `/workspaces?fixture=ready`.
   - Assertions: visible `Native Agent Host` heading; displayed route is exactly `/workspaces`; visible text says write operations are not implemented.
   - Evidence: [foundation-ready.avif](foundation-ready.avif).
2. **Authentication required**
   - Fixture: `auth`.
   - Route: `/?fixture=auth`.
   - Assertions: persistent alert says the session is missing/stale; the GitHub provider control is visible; explanatory text says the browser does not choose a Linux user.
   - Evidence: [foundation-auth.avif](foundation-auth.avif).
3. **Mapped daemon unavailable**
   - Fixture: `daemon`, with a synthetic safe problem.
   - Route: `/workspaces?fixture=daemon`.
   - Assertions: `Yhteyttä ei saatu` heading is visible; the page says the last command will not be resent automatically.
   - Evidence: [foundation-daemon-error.avif](foundation-daemon-error.avif).
4. **Accessibility across all three states**
   - Axe runs against `ready`, `auth` and `daemon` after the main region is visible.
   - Assertion: zero Axe violations for every state. Browser assertions, not screenshots, determine pass/fail.

## Commands and results

```sh
export PLAYWRIGHT_BROWSERS_PATH="$PWD/.cache/ms-playwright"
npm exec --prefix web playwright install chromium
npm run test:e2e --prefix web
npm run test:a11y --prefix web
```

Observed on the product revision's UI sources:

- `test:e2e`: 3 passed using one Chromium worker.
- `test:a11y`: 1 passed; the test iterated all three critical states with zero Axe violations.
- The same commands also passed inside `./scripts/ci-local.sh --clean --json`.

The AVIF files are essential visual evidence captured from those deterministic scenarios. They are supplementary: route, copy, role, provider and no-auto-resend behavior are asserted in Playwright.

## Human checkpoint

This report is ready for Jari's visual acceptance. The issue remains `testing`; this worker does not accept or close it. The conductor must show Jari this exact revision and evidence, then record his explicit dated accept/change decision before releasing the next `ui-v1` lane member.
