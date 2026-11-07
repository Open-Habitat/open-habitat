# Result

A failed lazy import now reaches a small React boundary inside the router,
which renders the existing translated version-change/reload banner instead of
React Router's raw error page. Vite's preload-error event identifies the exact
thrown value (including preload dependency failures); unrelated render failures
are not disguised as upgrades. Reload is explicit and reuses the existing action.

## Evidence

Tested the issue commit's runnable tree on Birch, based on b5befbe4e:

- `npm ci --prefix web` and Pi SDK fixture installation succeeded.
- `OH_WEB_WORKERS=2 ./scripts/test-focused.sh --area web`: static checks,
  TypeScript and all 180 files / 1352 tests passed. The new unit case checks
  both Vite-reported errors and unrelated lookalike errors.
- `OH_PORT_BASE=16000 OH_BROWSER_WORKERS=2 ./scripts/test-focused.sh --area browser --spec stale-tab-chunk-load.spec.ts`:
  passed. A production BrowserDocument chunk returns 404 on opening the editor;
  the banner appears without raw error/asset details or reconnect; explicit
  reload restores the composer draft and the editor opens successfully.
- Same browser command for `server-version-reload.spec.ts`: all 3 passed.
- Focused self-review: checked Vite rejection propagation (preventDefault would
  resolve an undefined module), boundary placement inside React Router, no
  automatic reload/replay, translated existing UI, and draft survival.

Browser evidence is host-backed synthetic Chromium, not a live upgrade or
separate-UID proof. No Go, contracts, session state or authority code changed.
No full gate or whole browser suite was run.

Initial eight-worker web run had two unrelated 5-second test timeouts
(GitLabConnection and Integrations); a retry was cut off by the tool's 200-second
budget. The final two-worker run with a longer command budget passed fully.
The description's `stale-tab-chunk-load-after-upgrade` issue is absent, with no
matching deleted file in local history; the available closed
`reconnect-after-version-change` issue and its result supplied the agreed banner.

## Decisions for later review

- Offer the existing reload banner for any Vite-reported lazy-load failure,
  without waiting for a second index read. Alternatives: require a confirmed
  version change or leave a generic error when offline. A failed cached lazy
  import cannot recover in this document anyway; the explicit action remains
  available even if the index read would also fail. No automatic reload occurs.
- Replace the failed application subtree with the banner. Alternatives: install
  separate boundaries around every lazy component or preserve a partly broken
  screen. One boundary covers current and future lazy views consistently;
  conversation drafts already persist per tab and the browser test proves that
  path. This does not add persistence for unsaved file edits.
