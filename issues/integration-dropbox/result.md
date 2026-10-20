# Result: Dropbox integration

Implemented on the catalog core without a gateway/broker authority change. The
person's daemon completes Dropbox's PKCE authorization-code flow, verifies the
provider-reported email, and writes only rclone's private native account config.
No loopback listener or public callback is created. Configured accounts live in
`~/.config/rclone/open-habitat-dropbox/<email>.conf`; rclone owns refresh and
bisync listings. Existing manually configured rclone remotes are untouched.

The whole Dropbox is offered as one quota-checked folder choice. First sync is
an explicit cloud-preferred union with local overwrite backups; subsequent
minute-spaced bisync passes never automatically resync. The native-default 50% deletion
fence and numbered conflict preservation remain enabled. Supervisor restart and
the existing boot signal keep sync independent of browser sessions. Removal
stops native refreshers before deleting config/listings and leaves files unless
Trash was requested. Interrupted initial setup can be retried by signing in
again. Both the host context and personal-data skill point to
`~/cloud/dropbox/<lowercase-email>/` and warn about live two-way changes.

## Operator handoff (Fleetrepo/Jari)

1. Create a **Scoped access / Full Dropbox** app in the Dropbox App Console.
   Register exactly **`http://localhost:53682/`**. This is authorization code
   with **PKCE**, `token_access_type=offline`, not device flow or implicit
   grant. No inbound port, listener or gateway callback is needed. The person
   pastes the final browser URL back into the host.
2. Enable these permissions: `account_info.read`, `files.metadata.read`,
   `files.metadata.write`, `files.content.read`, `files.content.write`,
   `sharing.read`, `sharing.write`. Enable additional development users so
   **Ville** can authorize the app; arrange Dropbox production approval before
   exceeding development limits.
3. Install **rclone v1.71.2** on the test server through Fleetrepo in a root-owned,
   non-user-writable tree; recommended path
   `/opt/open-habitat/tools/rclone-v1.71.2/rclone`. The distro's rclone 1.60 is
   insufficient for the chosen bisync recovery/conflict flags.
4. Merge the pinned executable and app credentials into the installation's
   root-owned, mapped-user-readable `/opt/open-habitat/integrations.json`,
   preserving any Himalaya entry:

   ```json
   {
     "tools": {"rclone": "/opt/open-habitat/tools/rclone-v1.71.2/rclone"},
     "dropbox": {"client_id": "<app key>", "client_secret": "<app secret>"}
   }
   ```

   Suggested mode `root:root 0644` with root-owned non-user-writable ancestors.
   Actual app values belong in Fleetrepo's installation secret input, not git,
   shell arguments, or a person's host binding. No person's tokens go here.
5. Conductor deploys the product and restarts the affected daemons, then Ville
   connects Dropbox in Settings → Integrations. Verify real consent, download,
   local edit upload, cloud edit download, and daemon-restart continuation.
   No server or Fleetrepo edits, pushes or deployments were made by this worker.

Without both the operator app settings and installed executable, Dropbox's tile
is unavailable on this server. The operator guide has the same installation
requirements. Initial local overwrite backups are under
`~/.local/share/rclone/dropbox-backups/<account>/`; do not bypass a bisync
safeguard or blindly resync a damaged native listing.

## Evidence

Tested implementation commit `d59e507a1c83c08361b4ac3f141be8b24f7b7ecb`,
tree `01876b772e187c9d83be29f05b47ceee6005c6fd` (the eventual closing commit
adds only issue evidence/metadata). On Linux all build/test scratch used
`TMPDIR=/var/tmp/oh-dropbox-build`; credential/browser checks used `umask 077`.

- `npm ci --prefix internal/daemon/pi-device-test --ignore-scripts`: passed.
- `OH_TEST_RCLONE=/var/tmp/oh-dropbox-native/rclone-v1.71.2-linux-amd64/rclone ./scripts/test-focused.sh --area go --go-package ./internal/daemon/integrations`:
  passed with race detector, 7.113 s; optional native tests **ran**, not skipped.
- `./scripts/test-focused.sh --area go --go-package ./internal/daemon`:
  passed with race detector, 72.537 s.
- `./scripts/test-focused.sh --area contracts`: passed generated drift check,
  55 schemas/fixtures, 37 scenarios and 17 negative checks. No contract/schema
  or dependency input was changed.
- `npm ci --prefix web` and `./scripts/test-focused.sh --area web`: passed
  formatting, lint, TypeScript, 264 unit and 191 component tests.
- `python3 scripts/validate-project-view.py` and `git diff --check`: passed.
- `issuectl doctor --json`: passed; existing non-AVIF/large-image advisories
  elsewhere in the tracker remain unchanged (no new image artifacts here).
- `./scripts/test-focused.sh --area browser --spec integrations.spec.ts --writers-paused`:
  **passed**, five Chromium journeys including desktop/phone axe checks
  (26.9 s execution; 1623 s total including FIFO wait/preparation). Remote job
  `0731c5bd503be87ce04c256b9a4dc20dc4585bafae0870d27bd87186b63ccd0e`,
  snapshot `c2dd1d27ecde9e33b58834bde88223aee8e438ee1d5a3dd212ab799a594ab133`,
  terminal `success`, exit 0, **stale false**, Linux ARM64. Evidence directory
  `/var/tmp/oh-browser-dmlh5o_j/`. This is focused synthetic browser evidence,
  not a clean-gate, release or distinct-UID receipt.

Risk/review choice: **critical independent /llm-review**, not self-review only,
because OAuth native storage/refresh/removal and irreversible two-way writes
are involved. Finder `claude-fable-5-1`, independent verifier `gpt-6-astra`;
/assess-findings: five actionable candidates fixed, one dropped as an additional
defect (native deletion protection intentionally requires deliberate recovery).
The verifier's remaining responsiveness finding was fixed with `TryLock` and
an explicit regression proving refused writes do not execute later. Initial
import no longer inherits the consent deadline; partial listings no longer
mean ready; pending skill/status and reconnect recovery are explicit; rejected
grants have fixed login-expired status; full local hashes run only initially.
A local native refresh test also caught/fixed **verbatim OAuth client secret
storage**—rclone OAuth client_secret is not an obscured password field.
No new review issue was justified. Scratch review/assessment artifacts are at
`/var/tmp/oh-dropbox-review-final/`; the conclusions are recorded here so this
result does not depend on scratch files. No model-performance write was made
to Fleetrepo, respecting the worker scope.

The first import serializes this person's integration writes. Competing
mutations fail promptly with fixed `503 native_unavailable` rather than waiting
hours and then executing after a browser timeout. Explicit cancellation in the
login dialog remains available; other people's daemons and agents are not
blocked. The blocked-native-sync UI currently reports generic restarts; it
does not approve mass deletions.

All checks use disposable homes and synthetic credentials. Native rclone tests
use a synthetic local alias backend, not a Dropbox account. These prove command
compatibility, initial backups, two-way changes, conflict retention, deletion
safeguards and native OAuth secret loading; they do not prove real-provider
consent, refresh-token lifetimes, Dropbox policy, boot/systemd or distinct-UID
isolation. Real Dropbox consent and sync are the conductor's live follow-up.

Visual before/after captures were deferred: TESTING.md's Alder remote pilot
forbids lab/capture runs. Existing production UI is reused; the allowed focused
browser spec includes the relayed-login/folder-choice/removal and a11y journeys.

## Failures and incomplete steps

| Failed/incomplete attempt | Resolution / final status |
| --- | --- |
| Exploratory reads of nonexistent `entry_linux.go`, `config_linux.go`, `internal/daemon/AGENTS.md`, and an obsolete pi-processes skill path; `from-history.sh` found no deleted ADR matching its glob | Read the actual `catalog_linux.go`, nearest `internal/AGENTS.md`, declared npm skill location, and the **existing** `docs/decisions/adr-0026-integrations-catalog.md`. No implementation step omitted. |
| Upstream rclone `cmd/bisync/bisync.go` fetch returned 404 | Read the pinned `cmd/bisync/cmd.go`, `operations.go` and OAuth/config source instead. Native downloaded v1.71.2 confirms commands. |
| One exact replacement matched two relay blocks | Tool refused without editing; replaced the intended scoped blocks and formatted/tested them. |
| Initial native bisync test: same-size/time local collision was not imported as intended | Explicit checksum comparison added to **initial union only**; native backup/union/conflict tests pass. |
| Missing-listing test initially left valid native recovery backups and unexpectedly recovered | Corrected the test to remove **all** native listing versions when asserting missing-state refusal. Recovery itself was not a failure. Final native suite passes. |
| First focused web run stopped on existing formatting in `web/lab/claude-default-model.mjs` | Formatting-only prerequisite commit `210a4b05`; no helper behavior changed. |
| First direct Biome formatting invocation from repository root refused nested root configuration | Reran in `web/`, then final maintained web checks pass. |
| Browser captures `3b77d98ea61aec8479bc6bfc5f66ff06f6e961b5c68bba369b8c6733f6284ba1` and `ef5c564d199eadd985015f8bc16365035c880cb87b41e9f49ef9e54ceed27db6` became stale while still queued | Explicitly cancelled both via adapter/process cancellation and `fleetrepo-exec cancel`; terminal cancelled states confirmed. Neither is counted as a test pass. The replacement job `0731c5bd503be87ce04c256b9a4dc20dc4585bafae0870d27bd87186b63ccd0e` passed on the final committed implementation (stale false). |
| Manual before/after captures and full clean gate | Intentionally not run: prohibited on Alder by the remote-pilot policy. Allowed focused browser evidence is used; no clean-gate receipt claimed. |

Both independent model calls completed successfully. No required review was
skipped. `npm ci` also reported two existing web dependency audit advisories
and the final web check printed pre-existing informational lint/jsdom notices;
none was introduced by a dependency change, and they did not fail the checks.
No unresolved required tool failure remains.

## Decisions for later review

- **Whole Dropbox as one choice**, rather than a subfolder picker: meets the
  immediate access need with one honest size/quota check and the existing
  catalog flow. Selective Dropbox sync remains outside this delivery; an
  oversized whole account will not fit the person's current quota.
- **Daemon-completed PKCE exchange**, rather than rclone's shared loopback
  listener: explicitly permitted by ADR 0026 and avoids any multi-user TCP
  login endpoint. The exact loopback URL is a pasted carrier only.
- **Cancellable, serialized first import**, rather than a new persistent host
  initialization marker: rclone's own listings remain the only sync state.
  Other integration writes fail promptly while it runs; no other person or
  agent is blocked. A richer background-initialization experience would need
  a reason to add more state or change native supervision.
- **Native-default deletion guard retained**, rather than automatic force or
  resync: a large deletion needs deliberate native inspection. Current UI
  reports generic restarts and has no mass-deletion approval action. Removal
  and reconnection are **not** deletion approval because resync is a union.

