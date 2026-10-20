# Result

Both subscription providers now share the bounded onboarding card. A labelled
provider choice shows one set of instructions at a time; switching keeps the
components mounted so an in-flight native attempt and entered Claude code are
not silently discarded. Claude uses a single-column form in onboarding rather
than the account-settings row. Its two steps distinguish opening the provider
page from pasting the returned code. The step indicator says “AI-tili”, not
“OpenAI”; the API-key alternative is a disclosure below the selected provider.
Account settings retain their existing row layout.

## Evidence

All captures are synthetic lab screenshots paired with inert offline HTML.
No real profiles, credentials or live host were used. Claude's lab runtime is
unavailable, so the capture script supplies a schema-valid synthetic code-state
reply through Playwright routing. This proves production rendering, not real
Claude/provider authentication. OpenAI uses the lab's native fake Pi attempt.
Reduced motion is enabled to avoid capturing intermediate theme transitions.

Before: production sources at `b299fd079477e01b8eb8c1897a86c18f39636f23`.
After: this fix's worktree. Tested `web/src` path/blob SHA-256:
`d7693a90ad855f0ba799774e40078eafa6bcd490b62bdcbb119e12e28c10f7d3`
(sorted tracked paths, each followed by `git hash-object` and a newline).

Each image below has an adjacent `.html` with the same basename:

| Provider / viewport / theme | Before | After |
|---|---|---|
| OpenAI desktop light | [image](before-openai-desktop-light.avif) | [image](after-openai-desktop-light.avif) |
| OpenAI desktop dark | [image](before-openai-desktop-dark.avif) | [image](after-openai-desktop-dark.avif) |
| OpenAI phone light | [image](before-openai-phone-light.avif) | [image](after-openai-phone-light.avif) |
| OpenAI phone dark | [image](before-openai-phone-dark.avif) | [image](after-openai-phone-dark.avif) |
| Claude desktop light | [image](before-claude-desktop-light.avif) | [image](after-claude-desktop-light.avif) |
| Claude desktop dark | [image](before-claude-desktop-dark.avif) | [image](after-claude-desktop-dark.avif) |
| Claude phone light | [image](before-claude-phone-light.avif) | [image](after-claude-phone-light.avif) |
| Claude phone dark | [image](before-claude-phone-dark.avif) | [image](after-claude-phone-dark.avif) |

Desktop viewport: 1440 × 1000. Phone viewport: 390 × 844. Full-page captures
include vertically scrollable content; vertical scrolling is intentional.
`web/lab/capture-provider-login-layout.mjs before|after` regenerates the matrix
against the bundle served by `PROVIDER_LAB_ORIGIN` (default loopback port 16471).
The baseline lab used an archived baseline source bundle on port 16472.

## Verification

- `TMPDIR=/var/tmp/open-habitat-build ./scripts/test-focused.sh --area web`:
  passed format, lint, TypeScript, 264 unit tests and 183 component tests.
- `./scripts/test-focused.sh --area browser --spec provider-login-layout.spec.ts`:
  four cases passed (1440/390 × light/dark). Assert no horizontal document
  overflow, only selected instructions visible, accessible code entry, reachable
  confirmation button, preserved OpenAI code after switching back, and Axe on
  both selected providers.
- `./scripts/test-focused.sh --area browser --spec pi-onboarding-host.spec.ts`:
  three existing native-attempt/cancel/uncertainty cases passed.
- `./scripts/test-focused.sh --area browser --spec github-first-onboarding.spec.ts`:
  five existing onboarding/repository-selection cases passed.
- `./scripts/test-focused.sh --area browser --spec account-settings.spec.ts`:
  all 12 cases passed after installing the native credential-test package and
  using private umask with one worker.
- `npm run build --prefix web`: passed production build and fixture exclusion.
- `git diff --check`, `issuectl doctor --json` and
  `python3 scripts/validate-project-view.py`: passed.
- Final format, lint and TypeScript checks passed after capture-script changes.

Browser checks used `TMPDIR=/var/tmp/open-habitat-build`, `OH_PORT_BASE=16570`,
`OH_BROWSER_WORKERS=2` (final account run: `1`, with `umask 077`), and
`PLAYWRIGHT_BROWSERS_PATH=$HOME/.cache/ms-playwright`.

## Review and limits

Focused self-review is proportionate: only presentation, local provider-choice
state and browser regression tests changed. Session binding, credential handling,
mutation behavior, host authority and Unix-user isolation were not changed.
The existing native-attempt tests and adjacent account journey check that moving
the components does not replace their native flows. No independent LLM review
or full gate was needed for this bounded UI fix. No deployment or push was done;
the conductor owns deployment. No Fleetrepo changes are required; all three checked-in service templates
already declare `UMask=0077`.

## Failed attempts and recovery

- Initial Claude capture timed out because the synthetic reply used an invalid
  attempt ID and provider URL. Replaced both with schema-valid invented values;
  the complete before matrix then passed. Initial captures caught intermediate
  theme-transition colors, so both matrices were regenerated with reduced motion.
- Initial web check caught a group needing a semantic fieldset, a CSS selector
  ordering warning, and non-null assertions in the new test. Fixed all three;
  the focused web checks subsequently passed.
- Initial new browser spec navigated to the default Vite fixture origin instead
  of the isolated host and timed out at GitHub login. Set explicit `hostOrigin`
  and HTTPS options, as the existing host specs do; all four cases then passed.
  The chained native spec did not run in the failed attempt; it passed on retry.
- Exploratory `rg` commands named nonexistent candidate paths (pages/provider
  components/styles/Account CSS/ControlElements CSS/pi-credentials spec). Scoped
  searches of the actual source and test directories found the relevant files.
  No code, evidence or required checks depend on those unsuccessful searches.

- The adjacent account suite initially passed 11/12 cases; native API-key entry
  was unavailable because this fresh worktree lacked the pinned Pi SDK fixture
  package. Installed with `npm ci --prefix internal/daemon/pi-device-test
  --ignore-scripts` before rerunning the suite. No production or test code was
  changed for this environment prerequisite. Capture-time credential state was
  unavailable (the API-key disclosure is closed in the after views).

- The installed-SDK account retry reached key save but failed on later removal;
  a one-worker retry reproduced it. A disposable lab API probe showed credential
  GET changing from 200 to 503 immediately after a successful save. The SDK
  created `settings.json` with mode 0664 under Alder’s inherited umask 0002; the
  daemon’s existing settings validation correctly refused it. The same synthetic
  helper read succeeded directly, isolating the mode check. The account suite
  was rerun with `umask 077`; TESTING.md now states both prerequisites. No security
  check or runtime code was weakened.

- With private umask, the API-key case passed. The two-worker account suite
  then hit a different failure: an existing conversation-reload case did not
  find its composer within five seconds. The complete suite then passed all
  12 cases serially with private umask. An attempted read of its error context after the next
  suite started found it already cleared by Playwright; the command log retains
  the failing assertion.

Final status: all selected checks passed; no required step remains incomplete.
All disposable lab processes were intentionally stopped after capture/diagnosis.
