---
created: 2026-10-24
updated: 2026-10-24
type: improvement
reporter: jari
status: open
priority: normal
provenance: chat
source_ref: taskfleet:01m5p6xkmgyx9p3jzpqdrsrfte/plan-unit:gitea-connect-slice
originating_run: 01m5p6xkmgyx9p3jzpqdrsrfte
originating_run_kind: spinoff
preparation: ready
related: ['@fleetrepo-gitea-habitat']
blocked_by: ['@gitea-native-owner']
collision: [contracts/v1/, internal/nativegitea/, internal/daemon/github_jobs_linux.go, web/src/app/NewWorkspacePage, web/src/components/ClonePage, web/src/app/GitHubOnboarding, web/src/app/, web/src/components/]
lane: gitea
lane_seq: 2
---

# Gitea typed contracts and first connect-to-workspace slice

## Description

## Goal

Add typed Gitea connect/change/disconnect to the existing integrations catalog, not the email-shaped PasswordAccount. Share the native adapter with the repo catalog. Accounts reads native files only; network Check is explicit. Contract identities distinguish connection/repo/provider and observable API versus Git readiness, source failures and incompleteness. PAT is request-only. Gateway authenticates, enforces CSRF/body limits and proxies to the session socket; it never interprets/persists/logs credentials or calls Gitea. The mapped daemon derives identity from its own state, never browser UID/HOME/socket/arbitrary HTTP instructions.

Build one synthetic HTTPS/API/Git walking path: approved form → one Gitea source in the existing common list → selected nonempty private fixture repo → existing CloneJobs → ordinary workspace → fetch. Include only the transfer minimum needed for this slice; the transfer issue extends its failure coverage rather than adding another engine. Do not publish a half-connected API-only path. Keep GitHub admission, gh and Pi readiness unchanged. Register mutations through mutations.ts and validate generated responses; clear PAT from form memory after use, never persist it in browser storage. Handle uncertain writes by native observation and require cancel/wait before disconnecting an active daemon clone.

## Plan and approval

Implements @fleetrepo-gitea-habitat [implementation-plan.md](../fleetrepo-gitea-habitat/implementation-plan.md), section 2. Read [ADR 0031](../../docs/decisions/adr-0031-native-gitea-connections.md) and [native evidence](../fleetrepo-gitea-habitat/native-auth-evidence.md). The latest parent Decision (Jari 2026-10-24) supersedes older proposal-only network/authorization wording: core tea ownership, network boundary and read-only first scope are approved for scheduling. Detailed mechanics remain implementation proposals, not new architecture authority. No URL-only substitute, login/admission change, server routing work or additional write permission.

## UI specification

connect round 1 Lomake → connect-riff round 2 Yläreunassa; workspace-import round 3 Yhteinen lista ONLY within current NewWorkspacePage/ClonePage. No new sidebar/detail/import redesign or source-filter control.

Prototype evidence and verdicts: [connect](../fleetrepo-gitea-habitat/prototypes/connect/NOTES.md), [connect-riff](../fleetrepo-gitea-habitat/prototypes/connect-riff/NOTES.md), [workspace-import](../fleetrepo-gitea-habitat/prototypes/workspace-import/NOTES.md).

## Proposed scheduling (not assigned)

Proposed lane `gitea`, lane_seq 20; head `gitea-native-owner`. Filing policy leaves this issue unlaned/untriaged for the later human scheduling decision.
Dependencies: @gitea-native-owner. Collision tokens: `contracts/v1/`, `internal/nativegitea/`, `internal/daemon/github_jobs_linux.go`, `web/src/app/NewWorkspacePage`, `web/src/components/ClonePage`, `web/src/app/`, `web/src/components/`, `web/src/app/GitHubOnboarding`.
The broad `web/src/app/` and `web/src/components/` tokens also match `reconnect-live-cause` in the current DAG. The shared `contracts/v1/` and `web/src/app/GitHubOnboarding` tokens use the current site-onboarding spelling; the latter conservatively serializes shared repository chooser/onboarding regression work. Other tokens reserve the named adapter, clone job, UI or release hot surface.

## Acceptance Criteria

- [ ] Closed-schema negative provider/account cases, CSRF/session switching, stale previous-user replies, peer failures and body/response caps pass with fixed redacted errors.
- [ ] Contract generation, contracts focused tests and check-generated.sh pass; focused daemon/gateway/web tests plus integrations and clone-page host-backed specs exercise connect → list → clone → fetch.
- [ ] Independent /llm-review verifies credentials crossing the gateway/daemon boundary, authority routing and contract/state changes. GitHub-first-onboarding and helper regression checks remain intact.

## Validation and review

Use TESTING.md focused Go/contract/web/host-backed checks for touched surfaces, contract generation and drift checks where relevant. Credential fixtures use umask 077 and short disk-backed TMPDIR under /var/tmp, isolated HOME/config and synthetic grants. Browser checks on Alder use the documented remote runner, not local Playwright. Independent /llm-review is required wherever credentials cross the daemon boundary or native auth, contracts or daemon state change. Resolve confirmed findings and record result.md evidence/limits; never report unrun real-UID/provider checks as passed. New runtime dependency/release proof must precede connector publication; the first slice remains synthetic until then.
