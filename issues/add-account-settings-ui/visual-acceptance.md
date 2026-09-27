# Account shelf and settings — visual decision pending

These are **synthetic browser-fixture screenshots**, not Jari's visual acceptance or a live host / native credential test. Playwright Chromium, Linux headless, 1280×720, light theme, standalone loopback TLS fixture with disposable Alice/Bob identities. The test intercepts the authenticated snapshot response to vary only `auth.native_github.state`; the production UI reads the same validated snapshot contract. No real browser profile, GitHub credentials, user home or live Pi session was used. `VITE_ENABLE_TEST_FIXTURES` is absent from the production bundle.

| State | Screenshot | Browser assertion |
|---|---|---|
| Connected | [Connected settings](assets/connected.avif) | Native connected state shown, provider numeric ID hidden, disconnect disabled with reason; keyboard menu Escape restores trigger, Enter opens Settings and focuses heading. |
| Partial | [Partial settings](assets/partial.avif) | Snapshot partial state warns Git operations cannot be assumed ready. |
| Unknown | [Unknown settings](assets/unknown.avif) | Reloaded unknown state is not presented as connected. |
| Unavailable | [Unavailable snapshot](assets/unavailable.avif) | No previous identity or rail shown after snapshot failure. |

Command: `PATH="$PWD/.tools/go/bin:$PATH" PLAYWRIGHT_BROWSERS_PATH="$PWD/.cache/ms-playwright" npm run test:e2e --prefix web -- --grep @account-settings` — 3 passed. PNGs under ignored `web/test-results/evidence/` converted to issue-local AVIF using `avifenc -q 75 --speed 6`. Browser assertions also cover workspace-route return and focus, Settings deep-link reload, logout then Bob sign-in, and native disconnect remaining disabled. These tests do **not** prove the native disconnect flow: its authenticated backend and fresh-auth confirmation do not exist. Jari's visual decision for this slice is outstanding; @build-history-view has its own independent visual decision.
