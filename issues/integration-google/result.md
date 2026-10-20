# Landing retry — 2026-10-20

Run `01m5cksn4ek7yb0r1tbdyhzk05` preserved the earlier implementation by
cherry-picking `6e9a5f63666a3020c011a84ea99bb59b14b74b78` onto the fresh
current-main branch as `4b268085c64876e362cc6a64fe647150570720a2`.
Runtime source is unchanged from the reviewed implementation. The earlier
worker's implementation/review narrative remains in `item.md`; this result
supersedes its validation status only. **Not merged or closed:** the required
daemon package check fails, and the runner spool is full again.

## Evidence

All commands used `umask 077` and `TMPDIR=/var/tmp`, with remote-only execution.
The clean tested revision is `4b268085c64876e362cc6a64fe647150570720a2`, tree
`cb739aa39532fe327bcc7f76dce7cdfe50b74b55`. Later edits are evidence only.

- `python3 scripts/browser-focused.py --task oh-go --task-arg=./internal/daemon --task-arg=./internal/daemon/integrations --task-arg=./test/browser-host`
  — job `40c6d6390f3c1d4baa2096182019b9cfbbce535ae4882eca66efbde97bfc54d6`,
  **test-exit**. Vet succeeded; integration and browser-host race tests passed.
  Daemon race tests failed in five existing terminal tests (below).
- `./scripts/test-focused.sh --area contracts` — job
  `7a422a525b3b4593ac7340d16b8b90ee1acb7b02415f25f6257875c4bbf5a03e`,
  **success**: drift/generation checks; 56 schemas, 56 fixtures, 37 scenarios,
  17 negative checks.
- `./scripts/test-focused.sh --area web` — job
  `4abcdfd2dfcb950bae9b5f7a205e84b46828c351d253c1d09fcc71d30d1ec8fd`,
  **success**: static, unit and component checks, 192 tests in 31 files.
- `./scripts/test-focused.sh --area browser --spec integrations.spec.ts` — job
  `aa72736391ba70af40dcabb001f1b1f0340f897d6c88cb96b5a78f9638e6ba1b`,
  **success**: all five cases, including Google pasted redirect, quota/removal,
  device relay/cancellation and desktop/phone axe checks. Synthetic same-UID
  evidence, not live Google or distinct-UID isolation proof.

Retained responses/artifacts respectively: `/var/tmp/oh-browser-dipgz1a9`,
`/var/tmp/oh-browser-1zk_h_xv`, `/var/tmp/oh-browser-137shh8_`,
`/var/tmp/oh-browser-6ee8gamz`.

## Failure and incomplete-step inventory

The daemon failures are:

- `TestTerminalShellRunsAsPersonInWorkspaceAndSurvivesBrowser`: shell missing
  from listing after disconnect.
- `TestTerminalBusyShellAndClose`: busy shell absent from listing.
- `TestTerminalTaskfleetAttachIsReadOnly`: no Taskfleet windows listed.
- `TestTerminalLingeringStartsServerAsUserService`: no ready message, close 4503.
- `TestTerminalNewShellFindsInstalledToolWithOldServerPath`: second shell creation
  fails, close 4503.

A full verbose retry of the same packages, with a selected untracked temporary
terminal diagnostic, job
`46bc72bc1ec2b74c9ff2531edb048c567166e130e38e63cabe0490e807613846`,
reproduced all five failures. Integrations and browser-host race tests passed
again, including Google concurrency/cancellation regressions. Artifact:
`/var/tmp/oh-browser-l6gvpl6n`. The diagnostic confirmed guest tmux 3.4 but
omitted creation of its own socket parent, so its missing-directory output is
not evidence for the suite failures. The diagnostic was corrected, but the
next capture was refused by `spool_quota`: retained input exceeds 8 GiB after
lossless compaction. Refusal evidence: `/var/tmp/oh-browser-tkutx8km`; requested
job ID `d44300830c9ef064f577a04b16d9e7ccbe54ceb43e2738f4e9f4d7983976cd57`
was not admitted. The temporary diagnostic was removed, and no product/test
logic was changed to mask these failures. No local fallback or shared-runner
maintenance was attempted. The first shell create and subsequent listing
failures are not established as infrastructure-only failures.

The first chained command stopped after Go failed; contracts, web and browser
were subsequently run separately and passed. Exploratory reads of a nonexistent
prior `result.md`, guessed shell issue paths, and a guessed runner log filename
were corrected using the actual issue body/git history and fetched artifact
archive; no discovery remains blocked. Issue skill refresh and doctor succeeded.
Cheap final checks: `git diff --check`, project-view validator and issue doctor
passed (doctor reports pre-existing image-format advisories, no schema errors).

No required daemon pass is claimed. Closure and merge remain blocked. Lab
before/after captures remain deferred under Alder's capture policy, without
requesting an exception. Full gate, live Google, deployment and push were not
run, as instructed. Native rclone/real-provider and distinct-UID cases skipped
by the ordinary guest remain outside these claims. No new issues were filed.

## Review

Retain the earlier independent finder `claude-fable-5-1`, verifier
`gpt-6-astra`, assessment and critical repair verification described in
`item.md`. OAuth/native credentials and destructive sync warrant that review.
This retry changes no reviewed runtime or fixture surface, so another review
would duplicate it; focused source/diff inspection found no integration change
needed. The finder's earlier unauthorized local-test evidence remains excluded.

## Exact operator handoff

Install gog **v0.39.1** and rclone **v1.71.2** as trusted root-owned executables.
Merge exact keys **`tools.gog`**, **`tools.rclone`**, **`google.client_id`** and
**`google.client_secret`** into `/opt/open-habitat/integrations.json`, preserving
other integrations. Use the existing SOPS-held Desktop client, redirect
`http://localhost`; enable Drive, Gmail, Calendar and People APIs and allow all
testers/additional accounts in the consent screen. No Fleetrepo edit, secrets
read, test-server access or remote Git write was performed.

After runner maintenance and resolution of the terminal package failures, rerun
the required Go command above, then close and merge only on success. Existing
`shell-panel-open-direct` carries related live tmux create-failed evidence, but
the synthetic failures' root cause is not yet proven. The conductor owns
Fleetrepo configuration/deployment and the live consent, upload/download,
gog mail/calendar/contacts, second-account, restart and removal check with Jari;
Testing-mode refresh-token expiry is seven days.
