# Native Pi status in Settings — result

Settings now reads `/api/v1/onboarding/pi/status` on entry, independently of the first-load Pi gate. It displays native credential availability beside GitHub without treating it as an OpenAI identity or a proven provider connection. Missing offers the existing device sign-in view; unknown, failed reads and a pending read do not claim success. A 401 returns to browser login. Navigating away aborts the read, and a later Settings entry checks again.

## Decisions for review

- Retain the initial gate on every fresh visit, including `/settings`: missing or uncertain Pi credentials still lead to onboarding. A missing result *after* the page is open offers the existing explicit sign-in route (`?pi_sign_in=1`); uncertainty does not initiate a device attempt.
- Label `usable` as native Pi credentials available on this server, explicitly not proof of an OpenAI account or working provider call. Show `missing` as absent native credentials, and `unknown` or failed fetch as unverifiable; no OpenAI identity, disconnect or speculative reconnect behavior is shown.
- Read once per Settings entry rather than polling or copying the first-load observation. This allows a later change to appear without generating status traffic during unrelated conversations. The status read does not authorize a write.

## Validation and limits

- Final clean gate passed on committed runtime/test tree `c68d9554d1b7a0757ef18373353ea33c24e047e8`: `TMPDIR=/var/tmp/nah-pi-settings PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright NAH_PORT_BASE=14820 ./scripts/ci-local.sh --clean --json` → `{"status":"passed","clean":true}`. Log: `/var/tmp/nah-pi-settings/gate-retry.log`. Browser suite: 134/134 passed. `./scripts/test-web-fast.sh` also passed (100 unit, 84 component) before the final test-only adjustment; the full gate covers the final version. No runnable code changed after that gate.
- Component tests cover all native status labels, lack of an implied provider identity and the missing-only action. Host browser tests cover usable, missing-to-existing-sign-in, unknown and HTTP failure after page entry, and missing/unknown first-load checks for direct `/settings` visits. A conversation browser test asserts that opening Settings reads Pi once, without reads on return to the conversation.
- [Usable screenshot](pi-usable-synthetic.avif) / [inert HTML](pi-usable-synthetic.html) and [missing screenshot](pi-missing-synthetic.avif) / [inert HTML](pi-missing-synthetic.html) are synthetic lab captures at 1440×900 after first-load sign-in. Missing was simulated by intercepting the later status response; it is not a live provider or host credential test. In these captures GitHub's native status is unknown in the fixture. Jari's visual verdict and real provider success remain unverified.
- Focused self-review of the final diff checked that no daemon or gateway authority changed, initial gate still precedes settings, the sign-in button appears only on a confirmed missing read, failure cannot render as connected, and aborted reads cannot update a later view. UI-local changes with component and host browser coverage do not warrant a separate model review; no independent review was run.

## Attempts

- The first clean gate on `09865d9` ran 133/134 browser cases successfully; an existing conversation test expected zero Pi reads when entering Settings. The new entry read made that expectation obsolete. The test now asserts one read and no extra read on return, and the full gate passed on `c68d955`.
- The initial fast check had missing web dependencies (`npm ci --prefix web` fixed this), then formatting and a redundant-dependency lint complaint; formatting and using the identity guard corrected these and fast checks passed. An `npm exec --prefix web -- biome format` attempt from the repository root encountered nested configuration; formatting from `web/` succeeded. No required step remains incomplete. The full gate was not rerun after issue-only evidence and screenshots.
