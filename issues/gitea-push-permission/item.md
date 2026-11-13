---
created: 2026-10-24
updated: 2026-10-25
type: improvement
reporter: jari
status: done
priority: normal
provenance: chat
source_ref: taskfleet:01m5p6xkmgyx9p3jzpqdrsrfte/plan-unit:gitea-push-permission
originating_run: 01m5p6xkmgyx9p3jzpqdrsrfte
originating_run_kind: spinoff
preparation: ready
related: []
lane: gitea
collision: [internal/nativegitea/]
closed: 2026-10-25
closed_by: claude
---

# Qualify Gitea read-only push denial and separately authorized write PAT

## Description

## Goal

Deferred until Jari explicitly authorizes a push/write test, its private test repository/branch and a write:repository PAT (plus required user read). The read-only connector approval is not that permission. Do not create credentials, attempt even a denied push, or write to Fleetrepo main before permission.

Once authorized, prove read-only PAT push denial and separately allowed native Git push using the same tea-owned native adapter, ordinary account/branch permissions and protected-branch rules. No new browser push/publish product surface, second credential store or tea clone. Record scope and target, and restore/read-observe the intended local grant explicitly.

## Plan and approval

Implements @fleetrepo-gitea-habitat [implementation-plan.md](../fleetrepo-gitea-habitat/implementation-plan.md), section 6 (permission-gated push follow-on). Read [ADR 0031](../../docs/decisions/adr-0031-native-gitea-connections.md) and [native evidence](../fleetrepo-gitea-habitat/native-auth-evidence.md). The latest parent Decision (Jari 2026-10-24) supersedes older proposal-only network/authorization wording: core tea ownership, network boundary and read-only first scope are approved for scheduling. Detailed mechanics remain implementation proposals, not new architecture authority. No URL-only substitute, login/admission change, server routing work or additional write permission.

## UI specification

No UI specified or approved for push; native Git test only.

Prototype evidence and verdicts: [connect](../fleetrepo-gitea-habitat/prototypes/connect/NOTES.md), [connect-riff](../fleetrepo-gitea-habitat/prototypes/connect-riff/NOTES.md), [workspace-import](../fleetrepo-gitea-habitat/prototypes/workspace-import/NOTES.md).

## Proposed scheduling (not assigned)

No lane: deferred pending the explicit permission above.
Dependencies: @gitea-readonly-acceptance. Collision tokens: `internal/nativegitea/`.
The shared `contracts/v1/` and `web/src/app/GitHubOnboarding` tokens use the current site-onboarding spelling; the latter conservatively serializes shared repository chooser/onboarding regression work. Other tokens reserve the named adapter, clone job, UI or release hot surface.

## Acceptance Criteria

- [x] Explicit authorization, disposable private target and branch are recorded before executing any push test.
- [x] On the qualified server, read-only push is denied and separately authorized write-PAT push succeeds only as permitted; clone/fetch and replacement remain correct without leaked credentials.
- [x] Focused helper/provider regressions pass; independent /llm-review covers any credential/write-boundary changes. Result names exact scopes, version, branch policy and permission limits.

## Validation and review

Use TESTING.md focused Go/contract/web/host-backed checks for touched surfaces, contract generation and drift checks where relevant. Credential fixtures use umask 077 and short disk-backed TMPDIR under /var/tmp, isolated HOME/config and synthetic grants. Browser checks on Alder use the documented remote runner, not local Playwright. Independent /llm-review is required wherever credentials cross the daemon boundary or native auth, contracts or daemon state change. Resolve confirmed findings and record result.md evidence/limits; never report unrun real-UID/provider checks as passed. New runtime dependency/release proof must precede connector publication; the first slice remains synthetic until then.

## Comments

### 2026-10-24T05:45:30Z · @intake

Deferred: Awaiting Jari’s explicit push/write-test authorization and target/write PAT.

## Decisions

### 2026-10-24T15:43:17Z · @jari

Jari 2026-10-24: the push test is done on birch once Open Habitat runs there; the write PAT and the private test repository are created at that point with Jari.

### 2026-10-25T09:59:49Z · @jari

Jari 2026-10-25: authorizes the push test now ('Pistä tekeytymään'). On Birch against Alder's Gitea (https://alder.example-tailnet.ts.net, 1.25.4) with a disposable private test repository under Jari's account and test PATs (read-only and write:repository + read:user) created through Gitea's admin CLI by the agent. Jari's own read-only connection on Birch stays as it is. Blockers: Birch runs Open Habitat (pilot.11), so habitat-birch-install's condition holds; the real-provider read-only proof of gitea-readonly-acceptance is done in the same run first.

### 2026-10-25T10:08:46Z · @jari

Jari 2026-10-25: the test may replace, rotate, revoke and disconnect his own Gitea connection on Birch freely; clones can be recloned later. End with a working read-only connection for him on a fresh token.
