---
created: 2026-10-21
updated: 2026-10-25
type: feature
reporter: jari
status: done
priority: normal
related: ['@agent-cli-notices']
lane: agent-cli
lane_seq: 4
collision: [agent-cli]
preparation: ready
closed: 2026-10-21
---

# Agent CLI slice 3: the rest of the personal surface in bounded batches

_Source: chat:agent-cli-2026-10-21_

Third slice of ADR 0027 (`docs/decisions/adr-0027-agent-cli-route.md`); see [implementation notes](../agent-cli/adr-0027-notes.md), section B and slice 3, and the inventory in [research](../agent-cli/research.md). Jari's decisions 2 and 4 apply: the agent may steer other own conversations and change global defaults, the browser-confirmation set is empty, and ordering is the implementer's call.

Deliver, in batches that each land independently: conversation control including other own conversations (messages, steer, follow-up, queue, resume, interrupt, stop, archive, close, titles, recaps); global model defaults and Git identity; workspace, repository, clone, worktree and Trash operations; integrations and credential configuration with secrets from stdin or file and redacted replies; history, receipts, processes, attachments and local-file requests. Existing ownership, one-writer, observation-token and typed-delete checks apply unchanged; native `git`, `gh`, `tmux` and `taskfleet` are not wrapped. No gateway or broker operations.

Done when: every daemon-owned inventory row in the research is either a working `agent` command or marked native with its reason; the `agent` skill documents the workflows; the canon review passes for the whole agent surface.

## Partial delivery

The global-defaults batch adds `agent model list/update`; Git identity stays native `git config --global`, with its reason in the bundled skill. [Results and remaining batches](result.md) track the partial delivery. The conversation-control batch adds explicit own-conversation list/create, message/steer/follow-up, queue control, resume, interrupt/stop, archive/empty-close, titles and recaps; [conversation evidence](conversation-result.md) records its limits and checks. The workspace/destruction batch adds workspace observations/create/settings/visibility, repository catalog/lookup/checkout observations, native clone-job controls, token-bound worktree cleanup and typed Trash destruction; [workspace evidence](workspace-result.md) records its checks and native-operation boundaries. The integrations/protected-input batch adds native integration listing, app-password account creation/password replacement/local removal, and Pi API-key presence/save/remove using bounded stdin/private-file input; [integration evidence](integrations-result.md) records its checks and limits. The history/auxiliary batch adds native history discovery and revision-bound page/block exports, original-command receipt reads, native process list/output/stop/finished-clear with owner/token fences, attachment upload/download, and browser-local folder/file requests; [history evidence](history-result.md) records its checks. The [reconciled inventory](../agent-cli/research.md#slice-3-reconciliation--2026-10-21) now names every daemon-owned row and its command or native owner with its reason. Whole-surface canon review is recorded in `CONFORMANCE.md`, retaining inherited partial rows rather than claiming a full pass.

The final adapters add explicit question answer/cancel, agent-owned integration
OAuth start/status/redirect/folder-selection/cancel, Pi device-code login and
Claude subscription login. [Final evidence](final-adapters-result.md) records
validation and independent security assessment. Browser leases are not exposed.
Whole-surface canon review is complete with inherited partial mandates retained
in `CONFORMANCE.md`; this is not a full canon-conformance claim. No Fleetrepo
change is needed. Live acceptance belongs to the conductor after deployment.

## Acceptance Criteria

- [x] Every daemon-owned inventory row has a working command or a named native owner with its reason.
- [x] The bundled agent skill documents the implemented workflows and consent/secret-input boundaries.
- [x] Required synthetic validation and independent security assessment completed; final results recorded.

## Comments

### 2026-10-25T03:26:10Z · @agent

Legacy scratch retirement (2026-10-25): the eligible closed-issue paths cited here have been copied to rowan:/Volumes/BACKUP-EXT/backup/alder-var-tmp-retirement-20261025/<same-basename>, with a clean rsync checksum verification. Source-to-backup mapping and retained exceptions: Fleetrepo issues/alder-root-disk-growth/retirement-20261025.md. Local removal is guarded by a final live-run/open-file/reference/age recheck; the action log is /var/tmp/agent-keep/alder-root-disk-growth/retirement-20261025/actions.jsonl.
