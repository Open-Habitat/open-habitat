---
created: 2026-10-24
updated: 2026-10-24
type: improvement
reporter: jari
status: done
priority: normal
provenance: chat
source_ref: taskfleet:01m5p6xkmgyx9p3jzpqdrsrfte/plan-unit:gitea-production-ui
originating_run: 01m5p6xkmgyx9p3jzpqdrsrfte
originating_run_kind: spinoff
preparation: ready
related: []
blocked_by: ['@gitea-common-catalog']
collision: [web/src/app/NewWorkspacePage, web/src/components/ClonePage, web/src/app/GitHubOnboarding, contracts/v1/, design-system/, web/src/app/, web/src/components/]
lane: gitea
lane_seq: 5
closed: 2026-10-24
closed_by: claude
---

# Gitea production component coverage and fixture acceptance

## Description

## Goal

Complete the production Integrations dialog and existing NewWorkspacePage/ClonePage extension with shared components and Storybook/preview/browser-host fixtures. Do not copy the prototype layout. Show origin, common search, independent source error/incomplete results and same-name repository distinctions. Preserve current job/navigation behavior and native-state observation after uncertain connect. No persistent browser PAT.

Approved dialog: simple address/PAT form, error below header outside the scrolling region with focus, agent-access warning, infer missing https only at blur/submit, never guess host spelling, no programming ligatures for URL/code. Preserve fields on error. Show changes for Jari in the existing production component.

The exact source-filter control, wider layout/sidebar, new details panel and redesigned import flow are NOT approved. No new filter is needed for the minimal common list; if one is proposed, stop that addition at a separate prototype/decision issue and obtain Jari's verdict rather than treating round 3 as approval.

## Plan and approval

Implements @fleetrepo-gitea-habitat [implementation-plan.md](../fleetrepo-gitea-habitat/implementation-plan.md), section 5. Read [ADR 0031](../../docs/decisions/adr-0031-native-gitea-connections.md) and [native evidence](../fleetrepo-gitea-habitat/native-auth-evidence.md). The latest parent Decision (Jari 2026-10-24) supersedes older proposal-only network/authorization wording: core tea ownership, network boundary and read-only first scope are approved for scheduling. Detailed mechanics remain implementation proposals, not new architecture authority. No URL-only substitute, login/admission change, server routing work or additional write permission.

## UI specification

connect round 1 Lomake, connect-riff round 2 Yläreunassa plus URL feedback; workspace-import round 3 Yhteinen lista with its explicit approval limits. No open visual choice is silently resolved as an approved redesign.

Prototype evidence and verdicts: [connect](../fleetrepo-gitea-habitat/prototypes/connect/NOTES.md), [connect-riff](../fleetrepo-gitea-habitat/prototypes/connect-riff/NOTES.md), [workspace-import](../fleetrepo-gitea-habitat/prototypes/workspace-import/NOTES.md).

## Proposed scheduling (not assigned)

Proposed lane `gitea`, lane_seq 50; head `gitea-native-owner`. Filing policy leaves this issue unlaned/untriaged for the later human scheduling decision.
Dependencies: @gitea-common-catalog. Collision tokens: `web/src/app/NewWorkspacePage`, `web/src/components/ClonePage`, `web/src/app/`, `web/src/components/`, `web/src/app/GitHubOnboarding`, `contracts/v1/`, `design-system/`.
The broad `web/src/app/` and `web/src/components/` tokens also match `reconnect-live-cause` in the current DAG. The shared `contracts/v1/` and `web/src/app/GitHubOnboarding` tokens use the current site-onboarding spelling; the latter conservatively serializes shared repository chooser/onboarding regression work. Other tokens reserve the named adapter, clone job, UI or release hot surface.

## Acceptance Criteria

- [x] Integrations/NewWorkspacePage/cloneJobs unit tests and clone-page, integrations, github-first-onboarding host-backed browser specs cover session/route switches, same names, name conflict, uncertain connect, cancel/retry and navigation-surviving jobs.
- [x] Measure the complete error rectangle against viewport and clipping ancestors at 390×568 with instructions open; keyboard/focus/axe, literal URL ligatures, light/dark and reduced-motion cases pass.
- [x] Provide synthetic screenshots plus adjacent static HTML and Storybook fixtures for Jari; perform focused web checks and independent /llm-review of credential form/state boundaries. Run touched specs green and one whole browser suite, distinguishing unrelated main failures.

## Validation and review

Use TESTING.md focused Go/contract/web/host-backed checks for touched surfaces, contract generation and drift checks where relevant. Credential fixtures use umask 077 and short disk-backed TMPDIR under /var/tmp, isolated HOME/config and synthetic grants. Browser checks on Alder use the documented remote runner, not local Playwright. Independent /llm-review is required wherever credentials cross the daemon boundary or native auth, contracts or daemon state change. Resolve confirmed findings and record result.md evidence/limits; never report unrun real-UID/provider checks as passed. New runtime dependency/release proof must precede connector publication; the first slice remains synthetic until then.

## Resolution

### 2026-10-24T23:00:00Z · @claude

Coverage, fixtures and review material landed; see result.md.
