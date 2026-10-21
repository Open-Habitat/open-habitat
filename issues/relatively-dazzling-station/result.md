# Result

The production fix already landed in `de0cab26e9446b43db111fbd64bc5861c14df7ea` (interim-reply stages), after this report was filed. No additional production change is needed: `BrowserConversation.tsx` retires saved streamed prefixes by native tool-call ID, while `HistoryView.tsx` joins the saved entries and live tail under the native user-message turn identity. Neither compares message text.

Added `web/tests/native-live-join.spec.ts`: the real controller and synthetic Pi hold a tool while native history catches up, then resume streaming and settle. Mutation samples assert a single turn throughout and no premature completion during the held phase; they also establish continued answer streaming before completion and an anchored composer (at most 2 px movement). Reload verifies the final saved turn and single interim reply. This extends the existing held-tool stage journey with transient-duplication, continued-stream and layout coverage; it is not evidence about a real provider or distinct-UID isolation.

Validation on base `48c80edc` plus this regression:

- `./scripts/test-web-fast.sh`: passed; 81 files / 478 tests, 30 seconds overall (Vitest 27.57 seconds).
- `cd web && npx playwright test tests/native-live-join.spec.ts`: final strengthened regression passed; Playwright 17.1 seconds, routed command 46 seconds including preparation. Initial regression also passed (18.5 seconds / 135 seconds with cold remote preparation).
- `issuectl doctor --json`, `python3 scripts/validate-project-view.py`, `git diff --check`: passed.
- No Go or contracts change; no full gate or deployment. No new user-visible behavior to announce in `KOKEILTAVAA.md`.

Failure inventory: no required check failed. Early source-discovery probes used nonexistent guessed filenames/globs; symbol searches located the actual modules. Web dependencies were absent and installed successfully with `npm ci --prefix web`. Fast checks emitted existing informational lint/canvas notices; the browser build emitted peer-dependency/PostCSS/chunk-size warnings but passed. Logs: `/var/tmp/oh-native-join-fast.log`, `/var/tmp/oh-native-join-browser.log`, `/var/tmp/oh-native-join-final-browser.log`.
