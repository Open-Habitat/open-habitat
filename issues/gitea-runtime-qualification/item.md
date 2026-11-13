---
created: 2026-10-24
updated: 2026-10-24
type: improvement
reporter: jari
status: done
priority: normal
provenance: chat
source_ref: taskfleet:01m5p6xkmgyx9p3jzpqdrsrfte/plan-unit:gitea-runtime-qualification
originating_run: 01m5p6xkmgyx9p3jzpqdrsrfte
originating_run_kind: spinoff
preparation: ready
related: []
blocked_by: ['@gitea-native-owner']
collision: [internal/nativegitea/, release/manifest, internal/hostop]
lane: gitea
lane_seq: 6
closed: 2026-10-24
---

# Qualify tea runtime and stable Git helper across releases

## Description

## Goal

Package the approved tea native dependency reproducibly in the integrations runtime profile. Qualify a locked non-Ubuntu artifact, or an available Ubuntu-owned package with a qualified minimum, with checksums/architectures and MIT/transitive notices. Start from runtime/profiles/integrations/artifact-lock.json, NOTICE, scripts/build-profile-runtime.sh and host closure/startup checks. Do not global/source-install tea or modify Fleetrepo fleet as a test side effect.

Qualify the actual installed tea config/lock/helper protocol against native-auth-evidence.md, rather than claiming source inspection is runtime evidence. Native Git + the Habitat adapter is the safe transfer path, not tea clone's secret-in-argv backend. Ensure a stable installed absolute helper entrypoint survives release switch and removal of the old release, fixing the release path before connector publication if absent. Avoid inventing version-specific path guesses.

## Plan and approval

Implements @fleetrepo-gitea-habitat [implementation-plan.md](../fleetrepo-gitea-habitat/implementation-plan.md), section 6 (runtime/package). Read [ADR 0031](../../docs/decisions/adr-0031-native-gitea-connections.md) and [native evidence](../fleetrepo-gitea-habitat/native-auth-evidence.md). The latest parent Decision (Jari 2026-10-24) supersedes older proposal-only network/authorization wording: core tea ownership, network boundary and read-only first scope are approved for scheduling. Detailed mechanics remain implementation proposals, not new architecture authority. No URL-only substitute, login/admission change, server routing work or additional write permission.

## UI specification

No new UI; readiness messaging must use the approved connect-riff dialog, not invent a runtime setup wizard.

Prototype evidence and verdicts: [connect](../fleetrepo-gitea-habitat/prototypes/connect/NOTES.md), [connect-riff](../fleetrepo-gitea-habitat/prototypes/connect-riff/NOTES.md), [workspace-import](../fleetrepo-gitea-habitat/prototypes/workspace-import/NOTES.md).

## Proposed scheduling (not assigned)

Proposed lane `gitea`, lane_seq 60; head `gitea-native-owner`. Filing policy leaves this issue unlaned/untriaged for the later human scheduling decision.
Dependencies: @gitea-native-owner. Collision tokens: `internal/nativegitea/`, `release/manifest`, `internal/hostop`.
The shared `contracts/v1/` and `web/src/app/GitHubOnboarding` tokens use the current site-onboarding spelling; the latter conservatively serializes shared repository chooser/onboarding regression work. Other tokens reserve the named adapter, clone job, UI or release hot surface.

## Acceptance Criteria

- [x] Installed CLI/config compatibility, architecture/checksum/license closure and minimal mapped-user HOME/XDG/PATH tests pass; shared tea/native adapter reads/writes interoperate.
- [x] Exercise release switch and old-release removal with an existing clone: helper still runs and next clone/fetch works without a second token store or token argv/logs.
- [x] Focused runtime/host/build-profile tests pass; independent /llm-review covers installed credential helper and release/state boundary. Record exact artifacts and limits; no global installation drift.

## Validation and review

Use TESTING.md focused Go/contract/web/host-backed checks for touched surfaces, contract generation and drift checks where relevant. Credential fixtures use umask 077 and short disk-backed TMPDIR under /var/tmp, isolated HOME/config and synthetic grants. Browser checks on Alder use the documented remote runner, not local Playwright. Independent /llm-review is required wherever credentials cross the daemon boundary or native auth, contracts or daemon state change. Resolve confirmed findings and record result.md evidence/limits; never report unrun real-UID/provider checks as passed. New runtime dependency/release proof must precede connector publication; the first slice remains synthetic until then.
