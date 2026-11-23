# Fact-check result — 2026-11-23

Checked the three injected instructions against main at `061843ca9`, the
installed CLI help, and their referenced skills. The preceding rewrite is
`6b7e6ea4d` (@rethink-agent-guide). Only facts in `host-context.md` and
`helpers-context.md` changed; `multiplayer-context.md` needed no correction.
Headings, recipes and the division between the three files remain intact.

## Corrections and evidence

| Correction | Evidence |
| --- | --- |
| Code-host settings include GitLab, not just GitHub and Gitea. | `web/src/app/settingsIndex.ts` includes GitLab in that section; the installed `agent code-host` surface supports it. |
| Renaming a workspace in the browser changes its display name, not its directory. | `internal/daemon/workspace_manage_linux.go` and the workspace operations in `internal/cli/agent/SKILL.md` distinguish display-name annotation from native paths. |
| The wake recipe now takes a future timestamp in `WAKE_AT`, not the already-past November 19, 2026 example. RFC 3339 permits an offset or `Z`. | `internal/cli/wake_linux.go` rejects non-future timestamps before exchange; daemon `parseWakeTime` uses RFC 3339. Installed and freshly built help agree. |
| A wake whose response was lost may exist; inspect the list instead of asserting that no reminder was set. A user manager is needed to wake a stopped daemon, not to store a wake or fire its in-process timer. | `createWake` in `scheduled_wake_linux.go` saves before replying; `reconcileWakes` separately attempts the user timer and logs failure; the in-process timer remains. The agent skill already advises listing after uncertainty. |
| A Taskfleet wait returning does not prove completion: attention and timeout need different handling. | Installed `taskfleet run wait --help`: terminal, stalled and attention conditions; exit 2 for timeout. Updated both host and helper guidance without changing the turn-notified wait mechanism. |
| Code-host checking requires the exact connection ID, obtained from integration list. | Installed and freshly built `agent code-host check --help`, and `internal/cli/agent/SKILL.md`. |
| Quotas are optional. `not_in_use` means shared filesystem space without user limits, unlike `unavailable`; filesystem capacity is separate. A site administrator can raise a quota as well as an operator. | `agentEnvironment` in `internal/daemon/agent_linux.go`; `internal/gateway/quota.go` has administrator-authorized quota writes; `web/src/app/StoragePressure.tsx` uses the 85% threshold. Corrected the authority section's matching statement too. |
| Exhausting a quota can refuse or shorten writes; it does not necessarily cut every write mid-file. | `internal/storagequota/probe_linux.go` observes EDQUOT from write/fsync; allocation failure is not proof of a partial write in every case. No new kernel experiment was run. |
| Attachments need not be selected one at a time. | The file input in `web/src/components/composer/Composer.tsx` has `multiple`; the existing composer tests exercise file selection. |
| Ordinary workers cannot resume for another round after finishing, but live Pi workers can receive a message. | Installed `taskfleet run message --help` explicitly distinguishes live adapter delivery from resident round resumption. |
| Archiving hides helpers; it does not interrupt an active helper round. Restoration displays them without starting another round. | `internal/daemon/resident_linux.go`, `archive_linux.go`, and `web/src/app/helpersArchive.test.ts`: archive changes presentation, while Taskfleet retains process authority; the browser distinguishes working and waiting helpers. |

## Claims retained

The following groups were checked against their owning source/help rather than
changed merely for wording:

- **Injection:** `launchContext` in `pi_rpc_linux.go` always includes the host
  text, adds helpers only for conversation launches, and adds multiplayer only
  when its experiment is enabled. Thus not every launch gets all three files.
- **Identity, discovery and trust:** own-UID agent routes and launch-generation
  checks in `agent_linux.go`; site address in `site_origin_linux.go`; workspace
  operations in `workspace_manage_linux.go`; trust decisions in
  `project_trust_linux.go` and `runtime/core/agent-bin/pi`; personal PATH in
  `agent_path_linux.go`; `NoNewPrivileges` in the daemon service. The permission
  boundary is a product rule, not a claim that arbitrary pre-existing personal
  accounts cannot possess additional grants outside Habitat.
- **Conversation/rail/lifetimes:** `agent_section_linux.go`, `pi_activity_linux.go`,
  `pi_rpc_linux.go`, `web/src/app/railNow.ts`, and daemon systemd configuration.
  The ten-minute idle rule, turn-scoped section override and creator-session
  attribution remain. `terminal_linux.go` distinguishes user-manager-backed
  tmux from daemon-lifetime fallback and gives Taskfleet output a read-only path.
- **Notices, views and files:** installed command help, `notices_linux.go`,
  `views_linux.go`, `fileoffers_linux.go`, and the gateway view CSP. Persistence
  is explicitly reported, offers are frozen copies, view network access is
  denied, and publication links are not agent operations. No notice or offer
  was created on the live installation.
- **Editor references:** `web/src/app/editor.ts` and its tests cover relative
  paths/line ranges and reject paths outside the workspace; the Markdown
  renderer supplies the links.
- **Skills and integrations:** read the agent, browser and UI skills. The
  UI skill points to generated Finnish/English catalogs. The generated
  personal-data skill's authoring path is
  `internal/daemon/integrations/skill_linux.go`; its full-skill tests cover
  two-way and one-way cloud folders. The fixed personal-data destination,
  secret-input flags, native credential ownership, default models and
  human OAuth consent are present in the CLI and referenced agent skill.
- **Trash and uploads:** workspace delete/Trash handlers retain native checks;
  `attachments_linux.go` defines 20 MiB per file and 1 GiB total. Archive is a
  presentation annotation, not a history deletion.
- **Resident protocol:** installed create/land/message/interrupt/list/wait help
  matches the recipe and the installed Taskfleet overview. Read-only dry-runs
  reject both doubled and trailing hyphens with `invalid_resident_name`,
  confirming the stricter name rule not fully spelled out in the create help.
- **Participants:** `process-extension.mjs` defines `oh-participant-message`,
  attributed content, owner release lines, history-derived turn modes and the
  `tool_call` guard; `pi-device-test/turn-modes.test.mjs` covers those boundaries.
  The instruction that owner input does not silently adopt an earlier guest
  request agrees with the stated authority model. No change was needed.

## Installed tools versus main

Observed help/version surfaces: Open Habitat `0.1.6` at `41c214dcb`, Pi `1.5.2`,
Taskfleet `0.20.0` at `6ad8d7ca`, and issuectl `0.21.0`. Taskfleet uses
`taskfleet version --json`, not `--version`. All four top-level help surfaces
were inspected, along with the relevant Taskfleet and Habitat subcommands.

The installed Habitat predates the rewrite and the rail guidance change
(`6b7e6ea4d`, `c567b31e5`). Its relevant commands are already present. The
corrections describe main as requested, not the older installed prose. A
scratch build of `cmd/open-habitat` also verified the wake, code-host, view and
file help directly from this worktree; no binary was installed or updated.

## Validation

- `umask 077; ./scripts/test-focused.sh --area go --go-package ./internal/daemon`
  passed on the final instruction content: 309.972 s, including the existing
  prompt/injection contracts. An earlier attempt exceeded the tool's 200-second
  budget; its interrupted result was not counted as a pass. A subsequent run
  before the final small wording adjustment also passed (273.108 s).
- The existing phrase contracts in `host_context_linux_test.go` still apply;
  none pins a corrected phrase, so no test weakening or replacement was needed.
- Fresh scratch `go build ./cmd/open-habitat` and non-mutating help checks passed.
- `git diff --check`, `python3 scripts/validate-project-view.py` and
  `issuectl doctor --json` passed; the project view reports 13 valid pages and
  doctor reports no findings.

No browser suite, live account operation, restart, quota fill, provider login,
cloud mutation or resident lifecycle experiment was performed. The focused Go
suite is not installed-host or distinct-UID systemd acceptance evidence.

## Limits and decisions

No new product decision is required for these factual repairs. The preceding
rewrite's suggestions about reducing injected context remain outside this task.
The scope did not authorize edits to the agent skill or CLI help, which still
carry the old fixed-date wake example; the agent skill also describes a working
user manager as a scheduling prerequisite more broadly than the implementation.
Those parallel owners should use the wake evidence above.

The Gitea statement that a read-only token is *usually* the cause of fetch-success/
push-403 is troubleshooting advice, not a measured frequency established here.
Repository protection and token permissions are supported by the source, but
real provider behavior, configured sync folders, current storage pressure and
individual account capabilities were deliberately not inspected. User-facing
screen behavior was checked in source and existing tests, not by driving a live
person's browser. No claim of deployment or real-service verification is made.
