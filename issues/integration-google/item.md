---
created: 2026-10-18
updated: 2026-10-20
type: feature
reporter: jari
status: open
priority: high
epic: agent-integrations
preparation: ready
lane: integrations
lane_seq: 2
collision: [internal/daemon/integrations]
blocked_by: ['@integrations-catalog-core']
---

# Integration: Google (Drive sync, Gmail, Calendar, Contacts)

Google entries on the catalog core: Drive continuous two-way sync with rclone into `~/cloud/google-drive/<account>/`; Gmail, Calendar and Contacts via `gog`; several accounts. Needs the operator's Google OAuth client configured host-wide (Fleetrepo for the test server; a Testing-mode client with Jari's accounts is enough there, tokens expire after 7 days). The personal-data skill gains the Google accounts.

## Acceptance Criteria
- [ ] Connect, use from an agent, add a second account, remove; tested in a disposable home with fakes and live once on the test server with Jari.

Follows ADR 0026 (integrations catalog, accepted by Jari 2026-10-18) and the prototype `proto-integrations` (direction Tili; `design-system/prototypes/rounds/2026-10-18-integraatiot/`; feasibility findings and Jari's decisions in its `result.md`). Every tool runs as the person; tokens stay in the tool's own store in their home; nothing about connections is stored by the host.

## Comments

### 2026-10-20T10:42:45Z · @conductor

Operator Google client for the test server exists (2026-10-20): project open-habitat-test, Desktop/installed client 874065012797-su3pbteijgklso1gkm5en4jcevkec1p0.apps.googleusercontent.com, redirect http://localhost. The client JSON is held on Alder at ~/.local/state/open-habitat-integration-apps/google-client.json (0600) until this integration ships and Fleetrepo writes it into the test server's integrations.json.

### 2026-10-20T10:52:26Z · @conductor

Correction: the Google client is now stored SOPS-encrypted in Fleetrepo infra/secrets/open-habitat-test-integrations.yaml (key google); the plain copies on Alder and in Jari's Downloads were removed.

## Worker result

The landing retry's current validation and blockers are in [result.md](result.md).
The following is the preserved first worker's implementation/review record.

Implemented the production Google entry with a daemon-completed Desktop-client
PKCE exchange and verified identity/complete-service consent. Tokens are imported
into gog's native file keyring and rclone's native per-account config; no host
connection store or gateway/broker authority was added. Drive uses the same
quota-checked, explicitly initialized cloud-preferred union and supervised
bisync policy as Dropbox. Normal passes do not resync automatically. Multiple
accounts, per-service checks, removal of both native token stores, interrupted
new-login rollback, and the generated personal-data skill are covered with fakes.

Only ordinary My Drive files participate in filesystem sync. Google-native
documents and shortcuts are intentionally excluded; the skill directs agents to
`gog drive` online for these rather than implying that exported Office copies
are editable native documents. Shared Drives are not selected.

Operator requirements are documented in `docs/operations.md`: install gog
**v0.39.1** and rclone **v1.71.2** as trusted root-owned executables. Merge exact
keys **`tools.gog`**, **`tools.rclone`**, **`google.client_id`** and
**`google.client_secret`** into `/opt/open-habitat/integrations.json`, preserving
other integrations. Use the existing SOPS-held Desktop client, redirect
`http://localhost`; enable Drive, Gmail, Calendar and People APIs and allow all
testers/additional accounts in the consent screen. No secrets were read by this
worker, and Fleetrepo, the test server and remote Git were not modified.

### Validation

Final runtime validation is **blocked**, so this worker did not merge or close
the issue. Independent review and assessment are complete. Source base is `b779dafa85444c17bd293056167ed4e117d47955`; the implementation
and tests are the staged files in the accompanying fix commit. No full clean gate
was requested. The integration-specific browser fixture was updated to replace
its native Google entry with the synthetic one; focused browser-host and relay
checks are selected rather than claiming broad release/isolation evidence.

Manual offline native-tool evidence: gog **v0.39.1 (6895139a)**, synthetic
credentials/refresh strings in a disposable `/var/tmp` home; credentials set,
two token imports, account list, removal and re-list succeeded. The native token
key names match inventory/removal and files were 0600. This does not prove Google
consent, API access or live synchronization. Installed distro rclone is old
**v1.60.1-DEV**, so no claim is made that it validates v1.71.2 Drive behavior.

Review: independent finder **claude-fable-5-1**, verifier **gpt-6-astra**; selected
because OAuth/native credentials and destructive two-way sync warrant review even
though no new UID/gateway/broker authority is introduced. Three locally confirmed
findings (multi-account status deadline queuing; expired grants shown as network
outages; cancellation reporting failure while retaining a new connection during
final reconciliation) were fixed and regression cases added. A critical narrow
verifier continuation confirmed all repaired invariants from current source.
Completion now atomically wins or loses against cancellation before independent
refreshers start; per-account check locks retain native replacement exclusion. The finder's direct local Go
execution bypassed the intended remote policy; its test claims are excluded from
acceptance evidence. Review/assessment scratch is in `history/` and is not needed
to understand either fix. No review-derived issues were filed.

### Deferred conductor verification

No live test or deployment was authorized for this worker. After configuring the
operator tools/client, the conductor and Jari should exercise consent, initial
sync, local upload/cloud download, gog mail/calendar/contacts, second account,
daemon restart and removal once on the disposable test server. Testing-mode token
expiry is seven days. Browser captures are deferred under Alder's remote-only
capture policy; the maintained integration Playwright suite is the browser check.

### Failure and incomplete-step inventory

- Initial remote integration Go job
  `2f50c50efb92d34b999f5153bff27632e1e36994b836d114e9682878d71180df`
  failed the pre-existing assertion that IMAP was the first production provider.
  Fixed the assertion to check every provider's availability without depending
  on tile order. No final pass is claimed for this early snapshot.
- Remote integration browser job
  `8813a4c1a06ba3cf2025751233ec03873816a3a36f6677d03d51dc1767bfbeba`
  ran five cases: three passed; Google redirect and a11y timed out because the
  new production Google entry shadowed the fixture entry and disabled Connect.
  Fixed fixture selection to remove native Google/Microsoft entries before
  adding their synthetic replacements. Final rerun was blocked before capture.
- Two intermediate remote Go observers/jobs were cancelled deliberately after
  review changed their code snapshot; these are superseded, not acceptance
  evidence. Final source has the expanded native-Drive concurrency barrier and
  both cancellation-completion barrier cases.
- The attempted combined `oh-go-contracts` command with package arguments was
  refused locally (`invalid literal task arguments`): that declared task does
  not allow arguments. Corrected to `oh-go` with literal package arguments,
  followed by a separate contracts task. No execution occurred for the refused
  invocation.
- Repeated final Go/browser captures failed with `spool_quota`: retained input
  exceeds **8 GiB** after automatic lossless compaction. Last response directory
  `/var/tmp/oh-browser-m6ovtpyg`; the separate final browser refusal is at
  `/var/tmp/oh-browser-t90ykrvx`. No job was admitted for these refusals.
  Consequently final Go/vet/race, contracts, web-fast and browser checks are
  **not passed**. No local fallback or shared-runner state manipulation was used.
- A status lookup for an earlier quota-refused job returned `not_found`, as no
  job had been admitted; this was a diagnostic lookup, not a failed test.
- The finder model's wrapper-triggered local Go command failed; its subsequent
  direct-toolchain bypass is outside the authorized remote policy. Its reported
  local pass/vet results are excluded. Verifier and critical continuation were
  static/read-only. Model-performance corpus writes were intentionally disabled
  because this run may not edit Fleetrepo or push.
- The optional scoped `internal/daemon/integrations/AGENTS.md` and historical
  prototype result path were absent; relevant parent instructions, issue notes,
  Dropbox implementation and current native-tool CLI help supplied the context.
- Live provider use, test-server deployment and visual captures were not run,
  as required by this worker's authorization/capture policy.

Passing final cheap checks: `git diff --check`, `git diff --cached --check`,
`python3 scripts/validate-project-view.py`, and `issuectl doctor --json` (no
warnings). Native gog offline evidence and static independent review are described
above; neither substitutes for the blocked runtime checks.

### Resume after runner maintenance

Have the shared-runner operator archive retained terminal inputs without losing
captured source evidence; this worker did not alter that shared state. Then run:

```sh
TMPDIR=/var/tmp python3 scripts/browser-focused.py --task oh-go \
  --task-arg=./internal/daemon \
  --task-arg=./internal/daemon/integrations \
  --task-arg=./test/browser-host
TMPDIR=/var/tmp ./scripts/test-focused.sh --area contracts
TMPDIR=/var/tmp ./scripts/test-focused.sh --area web
TMPDIR=/var/tmp ./scripts/test-focused.sh --area browser --spec integrations.spec.ts
```

Fix any actual failures, record passing job IDs against the final source, close
the issue and land it only after the required checks pass. The live Google check
then belongs to the conductor after operator configuration/deployment.
