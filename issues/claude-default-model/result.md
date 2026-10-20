# Result

Pi 1.3's `findInitialModel` has no built-in default for extension providers.
With only Claude available it falls back to the first bridge catalog entry,
Fable. The browser was not choosing that model.

After the native Claude login process succeeds and native status confirms the
subscription, the daemon now uses its existing validated model/settings helper
to initialize Pi's own settings. With neither a saved provider nor model it
selects `claude-bridge/claude-opus-5-5`, medium thinking, and the installed bridge
extension (also usable from native Pi). Existing thinking preferences take
precedence. A saved provider or model makes initialization a no-op, even if that
choice is unavailable or belongs to another provider. This is not a migration
of earlier Fable defaults: those might be deliberate choices.

Reads and restarts do not initialize settings. Claude tokens remain only in
Claude's native store; Pi's model runtime may create an empty `auth.json` but
receives no Claude credential copy. Failed initialization is not reported as a
completed login attempt; a later status read still observes native login truth.

## Evidence

Revision: the fix commit carrying this result, based on `e824aba7` (the composer
rewrite is already in its ancestry). All commands use disk-backed
`TMPDIR=/var/tmp/open-habitat-build`, synthetic homes and `umask 077`.

- Dependencies: `npm ci --prefix internal/daemon/pi-device-test --ignore-scripts`
  and `npm ci --prefix web`.
- Native regression: `node --test internal/daemon/pi-device-test/claude-default.test.mjs internal/daemon/pi-device-test/models.test.mjs`.
  Covers initialization, per-model medium, extension preservation, unchanged
  bytes for saved choices (Claude/other provider/partial settings/repeated
  sign-in), preserved explicit thinking, and read-only list behavior.
- `./scripts/test-focused.sh --area go --go-package ./internal/daemon`:
  includes a native-SDK-backed successful Claude login lease test using a
  synthetic Claude CLI, and verifies the persisted Opus/medium default.
- `./scripts/test-focused.sh --area contracts`.
- `./scripts/test-focused.sh --area web`.
- `./scripts/test-focused.sh --area browser --spec settings-model-picker.spec.ts`
  with `OH_PORT_BASE=19474 OH_BROWSER_WORKERS=2` and the shared Chromium cache.
- `git diff --check`, `issuectl doctor --json` and
  `python3 scripts/validate-project-view.py`.

All final checks passed: 5 native Node cases, daemon package with race detector,
contract generation/validation, fast web checks, and 3 model-picker browser
cases. The final daemon package run took 101 seconds.

[Before](before.html) / [after](after.html), with adjacent PNG screenshots, show
production settings components in the synthetic lab. `web/lab/claude-default-model.mjs`
replays the native helper's real catalog/default response into the lab; before
shows the effective first-row Fable fallback, after uses the initialized
Opus/medium response. Claude login status is synthetic. These are illustrative
captures, not a real Claude sign-in or an automated visual comparison.

Focused self-review is proportionate: only the default-setting policy and
successful-login completion hook changed. Existing mapped-UID, credential and
settings-path validation, subprocess environment filtering and authority
boundaries are reused unchanged. Reviewed no-op behavior, error handling,
read-versus-write separation and existing choice preservation. No security
boundary or installation hardening change; no independent LLM review required.

## Failures and limits

The first Go run caught the old test's assumption that Pi auth.json must not
exist; ModelRuntime now runs after login and creates an empty native store.
The assertion now checks the actual invariant: it contains no credentials.
The first capture attempt used a relative URL without a browser baseURL;
corrected to the synthetic lab origin and rerun. Optional discovery probes for
nonexistent skill/spec glob paths were replaced by the actual paths. No
required check is waived. The lab process was intentionally stopped after
capture. No push, deployment, live provider call or test-server modification.
No Fleetrepo change is needed. Full clean gate and live provider/UID-isolation
checks are outside this settings-only fix's scope.
