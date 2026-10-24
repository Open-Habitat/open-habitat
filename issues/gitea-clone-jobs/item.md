---
created: 2026-10-24
updated: 2026-10-24
type: improvement
reporter: jari
status: untriaged
priority: normal
provenance: chat
source_ref: taskfleet:01m5p6xkmgyx9p3jzpqdrsrfte/plan-unit:gitea-clone-jobs
originating_run: 01m5p6xkmgyx9p3jzpqdrsrfte
originating_run_kind: spinoff
preparation: ready
related: ['@fleetrepo-gitea-habitat']
blocked_by: ['@gitea-connect-slice']
collision: [internal/daemon/github_jobs_linux.go, internal/nativegitea/, contracts/v1/]
---

# Gitea clone and fetch hardening in the existing daemon jobs

## Description

## Goal

Extend the existing CloneJobs provider-source validation and native fetch, not a second job system. Recheck connection/repo before start and accept only the exact native-validated credential-free HTTPS origin/base/repo path. Full clone, no GitHub partial-clone assumptions. Reject empty repositories before starting with an explicit unsupported reason; empty-repo support is not this scope.

Disable managed HTTP redirects; inspect effective insteadOf/pushInsteadOf, helper and HTTP overrides and refuse alternate authenticated endpoints. Reject local/file/ext and arbitrary helpers; no recursive submodules or LFS claim. Preserve descriptor, quota, target-name, symlink/mount and verification guarantees, job survival across navigation/stream loss, process-group cancellation and explicit retry/remove after restart. If a process died before origin was recorded, retain the ambiguous directory as conflict, never invent ownership/delete it.

Exercise browser clone/fetch and Pi/shell environments with mapped HOME/XDG, minimal PATH and no SSH_AUTH_SOCK. Rotation uses the new PAT on next fetch; disconnect never falls back to another account. Preserve ordinary remotes and native Git identity. Do not route Gitea to github_publish_linux.go.

## Plan and approval

Implements @fleetrepo-gitea-habitat [implementation-plan.md](../fleetrepo-gitea-habitat/implementation-plan.md), section 3. Read [ADR 0031](../../docs/decisions/adr-0031-native-gitea-connections.md) and [native evidence](../fleetrepo-gitea-habitat/native-auth-evidence.md). The latest parent Decision (Jari 2026-10-24) supersedes older proposal-only network/authorization wording: core tea ownership, network boundary and read-only first scope are approved for scheduling. Detailed mechanics remain implementation proposals, not new architecture authority. No URL-only substitute, login/admission change, server routing work or additional write permission.

## UI specification

Keep current production job/progress controls. Round 3 selected only the common repository list, NOT its replacement import workflow.

Prototype evidence and verdicts: [connect](../fleetrepo-gitea-habitat/prototypes/connect/NOTES.md), [connect-riff](../fleetrepo-gitea-habitat/prototypes/connect-riff/NOTES.md), [workspace-import](../fleetrepo-gitea-habitat/prototypes/workspace-import/NOTES.md).

## Proposed scheduling (not assigned)

Proposed lane `gitea`, lane_seq 30; head `gitea-native-owner`. Filing policy leaves this issue unlaned/untriaged for the later human scheduling decision.
Dependencies: @gitea-connect-slice. Collision tokens: `internal/daemon/github_jobs_linux.go`, `internal/nativegitea/`, `contracts/v1/`.
The shared `contracts/v1/` and `web/src/app/GitHubOnboarding` tokens use the current site-onboarding spelling; the latter conservatively serializes shared repository chooser/onboarding regression work. Other tokens reserve the named adapter, clone job, UI or release hot surface.

## Acceptance Criteria

- [ ] Extend TestCloneJobOutlivesItsStream, TestCloneInterruptedAfterRestartAndExplicitActions and TestCloneJobVerificationFailureKeepsTheDownload for Gitea; include quota/name/link/mount conflicts, cancellation and empty-repo refusal.
- [ ] Actual Git tests exercise helper under nativeCommandInput, cloneProgressCommand, agentPath and terminalHost.env; reject cross-host clone_url, redirects and effective URL rewrites with no token leakage.
- [ ] Focused daemon/contract tests and clone-page browser cases pass; independent /llm-review covers native credentials, job state and transfer endpoint policy.

## Validation and review

Use TESTING.md focused Go/contract/web/host-backed checks for touched surfaces, contract generation and drift checks where relevant. Credential fixtures use umask 077 and short disk-backed TMPDIR under /var/tmp, isolated HOME/config and synthetic grants. Browser checks on Alder use the documented remote runner, not local Playwright. Independent /llm-review is required wherever credentials cross the daemon boundary or native auth, contracts or daemon state change. Resolve confirmed findings and record result.md evidence/limits; never report unrun real-UID/provider checks as passed. New runtime dependency/release proof must precede connector publication; the first slice remains synthetic until then.
