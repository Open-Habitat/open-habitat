---
created: 2026-10-24
updated: 2026-10-24
type: improvement
reporter: jari
status: done
priority: normal
provenance: chat
source_ref: taskfleet:01m5p6xkmgyx9p3jzpqdrsrfte/plan-unit:gitea-native-owner
originating_run: 01m5p6xkmgyx9p3jzpqdrsrfte
originating_run_kind: spinoff
preparation: ready
related: []
collision: [internal/nativegitea/, internal/cli/]
lane: gitea
lane_seq: 1
closed: 2026-10-24
closed_by: agent
---

# Gitea native tea owner, credential helper and safe lifecycle

## Description

## Goal

Implement the bounded adapter in the existing binary, using tea v0.16.0 native PAT YAML as the only durable connection/secret truth. Preserve external entries, unknown nodes, preferences and defaults; use tea's XDG/fallback selection. Validate /user identity and exact HTTPS origin/base/account, including two accounts on one host. No tea clone or automatic tea helper setup; no separate secret copy, broker or registry.

Use descriptor-based ancestry/UID/link/mode/size checks, tea-compatible flock, reread under lock and atomic replace/fsync. Malformed or ambiguous native state is unavailable, not an empty list. Replacement must preserve account identity and old bytes on refusal. Explicit removal is local only; expose lifecycle operations for the daemon to guard active jobs. Lost write replies require observation, not replay.

Implement bounded Git get/store/erase: only get emits a credential to Git, store/erase are no-ops. Match HTTPS host:port/base boundary/username uniquely, never first/default. URL-scoped helper registration uses a stable absolute installed entrypoint, useHttpPath and ordinary per-clone credential username; never change GitHub's helper or put secrets in Git config. Remove owned settings only if still exactly ours. Document the Git-protocol CLI exception in CONFORMANCE.md.

## Plan and approval

Implements @fleetrepo-gitea-habitat [implementation-plan.md](../fleetrepo-gitea-habitat/implementation-plan.md), section 1. Read [ADR 0031](../../docs/decisions/adr-0031-native-gitea-connections.md) and [native evidence](../fleetrepo-gitea-habitat/native-auth-evidence.md). The latest parent Decision (Jari 2026-10-24) supersedes older proposal-only network/authorization wording: core tea ownership, network boundary and read-only first scope are approved for scheduling. Detailed mechanics remain implementation proposals, not new architecture authority. No URL-only substitute, login/admission change, server routing work or additional write permission.

Network implementation follows the accepted boundary: canonical HTTPS only, explicit ports/base paths, no userinfo/query/fragment/ambiguous encodings or silent host correction. Allow intended LAN/VPN and explicitly configured loopback, reject link-local/metadata/unspecified/multicast at dial time after DNS, including IPv6. Verified TLS uses the operator-approved OS CA store; no insecure mode or dialog CA installation. No API redirects or arbitrary authenticated HTTP proxy; only bounded version/user/repos/exact-repo reads. Git URL matching and managed transfer checks keep the same origin/base restriction. Server routing and trust configuration are manual operator prerequisites, never connector authority.

## UI specification

No new visual surface; lifecycle UI is specified by connect-riff round 2 and integrated in the slice/UI issues.

Prototype evidence and verdicts: [connect](../fleetrepo-gitea-habitat/prototypes/connect/NOTES.md), [connect-riff](../fleetrepo-gitea-habitat/prototypes/connect-riff/NOTES.md), [workspace-import](../fleetrepo-gitea-habitat/prototypes/workspace-import/NOTES.md).

## Proposed scheduling (not assigned)

Proposed lane `gitea`, lane_seq 10; head `gitea-native-owner`. Filing policy leaves this issue unlaned/untriaged for the later human scheduling decision.
Dependencies: none. Collision tokens: `internal/nativegitea/`, `internal/cli/`.
The shared `contracts/v1/` and `web/src/app/GitHubOnboarding` tokens use the current site-onboarding spelling; the latter conservatively serializes shared repository chooser/onboarding regression work. Other tokens reserve the named adapter, clone job, UI or release hot surface.

## Acceptance Criteria

- [ ] Native fixtures cover wrong UID/mode, symlink/hardlink, malformed/legacy YAML, preserved fields, concurrent tea flock, quota/rename/write failures and rejected replacement.
- [ ] Helper tests cover two same-host accounts, two base paths, ports, absent username, duplicate entry and cross-host requests even with explicit selection; actual git credential fill in disposable HOME works without a second credential-store copy.
- [ ] Focused nativegitea and CLI Go tests pass; independent /llm-review covers credential handling, native writes and target matching before integration.

## Validation and review

Use TESTING.md focused Go/contract/web/host-backed checks for touched surfaces, contract generation and drift checks where relevant. Credential fixtures use umask 077 and short disk-backed TMPDIR under /var/tmp, isolated HOME/config and synthetic grants. Browser checks on Alder use the documented remote runner, not local Playwright. Independent /llm-review is required wherever credentials cross the daemon boundary or native auth, contracts or daemon state change. Resolve confirmed findings and record result.md evidence/limits; never report unrun real-UID/provider checks as passed. New runtime dependency/release proof must precede connector publication; the first slice remains synthetic until then.

## Resolution

### 2026-10-24T06:24:55Z · @agent

Delivered: internal/nativegitea (tea v0.16.0 owner, safe lifecycle, dial filter, Git helper registration) and the gitea git-credential leaf; independent review findings fixed. Evidence and decisions in result.md.
