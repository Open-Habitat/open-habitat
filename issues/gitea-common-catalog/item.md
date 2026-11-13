---
created: 2026-10-24
updated: 2026-11-07
type: improvement
reporter: jari
status: done
priority: normal
provenance: chat
source_ref: taskfleet:01m5p6xkmgyx9p3jzpqdrsrfte/plan-unit:gitea-common-catalog
originating_run: 01m5p6xkmgyx9p3jzpqdrsrfte
originating_run_kind: spinoff
preparation: ready
related: []
closed: 2026-10-24
collision: [contracts/v1/, internal/nativegitea/, web/src/app/NewWorkspacePage, web/src/components/ClonePage, web/src/app/GitHubOnboarding, web/src/app/, web/src/components/]
lane: gitea
lane_seq: 4
---

# Gitea common catalog, source identities and existing clone matching

## Description

## Goal

Generalize the slice to a common source-qualified catalog without changing GitHub subject checks. Gitea uses native tea state, never GH_API_URL. Identify provider + canonical base + connection + upstream repo ID; two accounts are separate grants. Return independent source failures/incompleteness so a Gitea timeout cannot erase GitHub results or appear as empty success.

Bound /user/repos pagination by time/pages/results/bytes; server-shortened pages do not imply completion. Validate same-base links, loops/repeated IDs, wrong service/HTML, 401/403 and timeouts. Project actual owned/org/collaborator/archive/size data. Search the common loaded list; exact lookup is source-qualified, not broadcast global search.

Daemon matches canonical credential-free origins to repositories and returns safe match facts, not raw remotes. Existing clone open must not rewrite account selection. Different-origin same-name directory is conflict. SSH/HTTPS equivalence remains conservatively unknown without proof; no workspace registry.

## Plan and approval

Implements @fleetrepo-gitea-habitat [implementation-plan.md](../fleetrepo-gitea-habitat/implementation-plan.md), section 4. Read [ADR 0031](../../docs/decisions/adr-0031-native-gitea-connections.md) and [native evidence](../fleetrepo-gitea-habitat/native-auth-evidence.md). The latest parent Decision (Jari 2026-10-24) supersedes older proposal-only network/authorization wording: core tea ownership, network boundary and read-only first scope are approved for scheduling. Detailed mechanics remain implementation proposals, not new architecture authority. No URL-only substitute, login/admission change, server routing work or additional write permission.

## UI specification

workspace-import round 3 Yhteinen lista in current production components. Visible origin and common search are approved; precise source-filter control remains open and is not implemented here.

Prototype evidence and verdicts: [connect](../fleetrepo-gitea-habitat/prototypes/connect/NOTES.md), [connect-riff](../fleetrepo-gitea-habitat/prototypes/connect-riff/NOTES.md), [workspace-import](../fleetrepo-gitea-habitat/prototypes/workspace-import/NOTES.md).

## Proposed scheduling (not assigned)

Proposed lane `gitea`, lane_seq 40; head `gitea-native-owner`. Filing policy leaves this issue unlaned/untriaged for the later human scheduling decision.
Dependencies: @gitea-clone-jobs. Collision tokens: `contracts/v1/`, `internal/nativegitea/`, `web/src/app/NewWorkspacePage`, `web/src/components/ClonePage`, `web/src/app/`, `web/src/components/`, `web/src/app/GitHubOnboarding`.
The broad `web/src/app/` and `web/src/components/` tokens also match `reconnect-live-cause` in the current DAG. The shared `contracts/v1/` and `web/src/app/GitHubOnboarding` tokens use the current site-onboarding spelling; the latter conservatively serializes shared repository chooser/onboarding regression work. Other tokens reserve the named adapter, clone job, UI or release hot surface.

## Acceptance Criteria

- [ ] Fixture tests cover multiple small pages, partial timeout/caps, link loops, redirects/cross-host/base boundaries, wrong service, auth rotation and 401 versus 403.
- [ ] Two hosts with identical owner/repo and two same-host accounts remain distinct; renamed/deleted repos, unknown origin and same/taken matching pass daemon workspace_remote and NewWorkspacePage tests.
- [ ] Focused daemon/contracts/web checks pass; independent /llm-review covers source/connection identity, native credential selection and changed contract/state.

## Validation and review

Use TESTING.md focused Go/contract/web/host-backed checks for touched surfaces, contract generation and drift checks where relevant. Credential fixtures use umask 077 and short disk-backed TMPDIR under /var/tmp, isolated HOME/config and synthetic grants. Browser checks on Alder use the documented remote runner, not local Playwright. Independent /llm-review is required wherever credentials cross the daemon boundary or native auth, contracts or daemon state change. Resolve confirmed findings and record result.md evidence/limits; never report unrun real-UID/provider checks as passed. New runtime dependency/release proof must precede connector publication; the first slice remains synthetic until then.
