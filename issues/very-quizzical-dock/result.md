# Result — one Microsoft device code

The daemon requests one union-scope device grant (files, mail, calendars,
contacts, offline access and identity scopes). The only prompt retires before
Graph work. A same-user adapter then imports that grant through pinned MSAL's
refresh-token migration API (`forceCache: true`), verifies the expected account
and Outlook scopes, and uses the MCP package's own encrypted cache/selection
storage. rclone gets its native token configuration. Existing publication,
rollback and explicit removal remain native-store operations; no new credential
store or connection registry exists.

## Qualification

- `integrations` profile: MCP **0.170.1**, MSAL **5.6.0**, Node **22.21.1**, complete
  npm lock, notices and per-file/component inventory. Both executable wrappers
  select their own interpreter/modules. No global/developer npm install.
- Synthetic work and personal grants: exactly one device-code request from the
  catalog, actual MSAL cache creation, actual MCP CLI account reload, actual
  rclone **1.71.2** config reload/refresh/rotation through loopback OAuth/Graph.
- The pinned MCP AuthManager separately reloads and silently refreshes encrypted
  native state. Expected-account mismatch, omitted Outlook scope, provider
  refusal and injected transport cancellation preserve existing native bytes.
- Go regressions cover pending, slow_down/backoff, expiry, spent-code retirement,
  cancellation during native import and failed replacement rollback. Diagnostics
  describe the one combined `flow=microsoft`, expose actual polling counts and
  fixed transitions, and never include raw native output, codes or credentials.
- Browser: one displayed code, code-free completion, final success before the
  past-tense skipped-site explanation. Storybook imports that same component;
  the obsolete second-code story was removed.

Final command receipts and targeted-review assessment are recorded below.

## Visual review

`review/` contains 12 paired AVIF/static-HTML captures: code, discovery and partial
completion, at 1280/390 px, light/dark. Compared against the integration prototype
(`design-system/prototypes/rounds/2026-10-18-integraatiot/round.js`, code/modal
layout), the current settings reference and shared tokens. The old prototype's
two-code sequencing is superseded by Jari's accepted one-code decision, not
copied. No CSS/token overrides; monospace code, single primary provider link,
visible cancellation, and success/warning/final-action order remain intact.
All four size/theme pairs were inspected; no horizontal overflow or clipped
controls. These are review material, not automated visual-diff acceptance.

Examples: [desktop light code](review/files-1280-light.avif) /
[HTML](review/files-1280-light.html), [phone dark code](review/files-390-dark.avif) /
[HTML](review/files-390-dark.html).

## Decisions for later review

- Keep the daemon's already observable device polling and use MSAL's documented
  refresh-token migration instead of moving device polling into a subprocess.
  This provides one code and complete per-response counters without inventing
  MSAL cache records or parsing raw native logs.
- Package both the MCP CLI and adapter in the new optional `integrations`
  profile, including their own locked Node. The existing test installation uses
  a separately pinned Fleetrepo MCP wrapper; production now requires the new
  `microsoft-native` tool declaration. Do not fall back to two codes when it is
  missing. `docs/operations.md` gives the merged config paths.

## Deployment and live limit

No VM or Fleetrepo file was changed; no live account was accessed. The conductor
must ship/install the profile and merge its two tool paths into the existing
integrations config before inviting a retry. Keep rclone, Pi, the existing
public Entra app and other providers' settings. The new native wrapper and MCP
wrapper must come from the same sealed closure, not the former standalone npm
bundle. Jari's next real connect is the live consent/policy/refresh acceptance.
The original same-code-resubmission incident is not retrospectively explained
by synthetic tests; the repaired flow has no second device grant to confuse
with the first.

## Workflow failures recovered

- Initial native import test returned `account_mismatch`: MSAL's refresh-token
  migration does not populate an empty cache without `forceCache: true`.
  Corrected the documented API request, rebuilt, and qualified real native
  reload/refresh. Initial log: `/var/tmp/ms-native-test.log` (subsequently replaced
  by successful native qualification); final receipts are listed below.
- The first standalone Node probes imported the MCP logger before setting a
  synthetic HOME. Its native logger created two synthetic-only log files under
  the development user's existing MCP log directory (no account credentials).
  Changed test imports to occur only after synthetic HOME/LOG_DIR setup; removed
  only those two verified newly created files, retaining recovery copies in
  `/var/tmp/oh-ms-accidental-synthetic-logs`. The pre-existing directory and any
  unrelated state were retained. Go subprocess tests already had synthetic HOME.
- First fast-web run timed out in the unchanged five-second provider-page
  component case (`/var/tmp/ms-single-web.log`); the complete identical fast suite
  passed on retry (`/var/tmp/ms-single-web-retry.log`). No timeout was raised and
  no product workaround was added.
- Initial lab run timed out finding the connect control because the inherited
  spec used the removed Finnish URL. Updated it to `/settings/integrations`;
  all four lab cases then passed (`/var/tmp/ms-single-lab-retry.log`). The ordinary
  integration spec had already passed.
- The first targeted-review invocation supplied `--diff-files` without its
  required value; no model ran. Retried with documented `--diff-base HEAD`.
- Biome was first invoked from repository root and refused the nested web root
  config. Retried from `web/`, then the full fast-web check passed.
- The installed issuectl is newer than the loaded skill: `skill print issue`
  refused its obsolete positional argument, and an attempted JSON decode of
  `skill print --json` failed because that command prints Markdown. Read the
  complete current bundled skill text instead; no installed configuration was
  changed. Optional exploratory reads/searches also named absent scoped files
  and a first gofmt brace expression named nonexistent files; exact-path reads
  and formatting recovered them. No required source, test or tool was omitted.

## Final validation

All build/test scratch used `/var/tmp`; browser suites ran one at a time through
the installed remote placement. No full clean gate was required or claimed.

- Fresh integrations profile build and sealed inventory/wrapper check passed
  (`/var/tmp/ms-profile-build-final.log`, `/var/tmp/ms-profile-inventory-final.log`).
  `qualification.json` binds the final archive digest and pin set. The production
  archive excludes the synthetic fixture/test entry points.
- Pinned-node native MCP AuthManager qualification passed work/personal,
  account/scope mismatch, provider refusal and cancellation preservation.
- `./scripts/test-focused.sh --area go --go-package ./internal/daemon/integrations`
  passed with the opt-in real native runtime/rclone tests enabled; daemon
  `TestAgentCredentialsAndIntegrationRoutes` passed; focused contracts passed
  generation and positive/negative checks. Final log:
  `/var/tmp/ms-single-qualified-profile.log`.
- `./scripts/test-focused.sh --area web`: **90 files, 504 tests passed** on the
  complete retry (`/var/tmp/ms-single-web-retry.log`); includes format/lint/types.
- `./scripts/test-focused.sh --area browser --spec integrations.spec.ts`:
  **6 passed**, including a11y (`/var/tmp/ms-single-browser.log`).
- `./scripts/test-focused.sh --area browser --spec lab-microsoft-login.spec.ts`:
  **4 passed**, auditing/capturing code, code-free discovery and partial completion
  (`/var/tmp/ms-single-lab-retry.log`). The English-route correction is test-only;
  the captured production components are unchanged from the passing web check.
- `issuectl doctor --json`, `python3 scripts/validate-project-view.py`, and
  `git diff --check` passed. Doctor's historical image warnings are not new
  failures. No separate Storybook build or installed-UID VM proof is claimed.

## Targeted review assessment

One `claude-fable-5-1` review completed (raw output:
`/var/tmp/ms-single-review.txt`). It inspected the adapter, Go login/commit,
sealed archive and pinned native library source, confirming one-code scope and
consumer authority handling, MSAL `forceCache` interoperability, preservation
and packaging. **No confirmed actionable regression.**

The reviewer proposed a personal-account alias mismatch: Graph might return a
synthetic Outlook UPN while MSAL uses a non-Microsoft primary email. It explicitly
could not verify that premise offline and requested a real personal-account
response. Local assessment: **UNABLE_TO_VERIFY / DROP as a finding**, retained as
a live-acceptance uncertainty, not filed. The old flow already chose Graph UPN
and compared the MCP username against it, so this is not an established
single-code regression. Our synthetic personal identity uses matching Graph and
MSAL addresses and cannot settle that external-provider behavior. No real
personal account is available/authorized for this worker; no raw claim/token
was requested or published, and no JWT parsing/identity-authority change was
invented to fix a recalled-but-unverified premise.

A second explicit live limit is Microsoft's refresh-token lineage behavior
when the two native clients refresh independently. Synthetic native rotation
qualifies the stores and libraries, not Microsoft policy. Jari's next work
connect is the immediate live acceptance; a later personal-account alias test
would settle the separate uncertainty. No second reviewer was called, as the
brief requests one targeted reviewer only.

Closure note: requesting `fixed` for the adapter task was refused by issuectl's
bug-only transition rule; retried successfully as `done`. The original bug is
`fixed`. Both issues are closed; no schema rule was bypassed or type changed.
