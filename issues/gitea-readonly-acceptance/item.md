---
created: 2026-10-24
updated: 2026-10-25
type: improvement
reporter: jari
status: testing
priority: normal
provenance: chat
source_ref: taskfleet:01m5p6xkmgyx9p3jzpqdrsrfte/plan-unit:gitea-readonly-acceptance
originating_run: 01m5p6xkmgyx9p3jzpqdrsrfte
originating_run_kind: spinoff
preparation: ready
related: []
blocked_by: ['@gitea-production-ui', '@gitea-runtime-qualification']
collision: [contracts/v1/, internal/nativegitea/, internal/daemon/github_jobs_linux.go]
lane: gitea
lane_seq: 7
---

# Gitea two-UID isolation and installed read-only acceptance

## Description

## Goal

Prove the complete read-only connector under two actual kernel UIDs, then an authorized harmless private Gitea test repository, never the real Fleetrepo repository/history. Extend test-repo-catalog-uids.sh and TestRepoCatalogDistinctUIDs with integration/helper/clone/disconnect ownership tests. Same-UID browser-host is a separate weaker proof, not isolation evidence.

Use read:user + read:repository, verify actual server version/TLS/CA and own/org/collaborator pagination behavior, HTTPS clone/fetch, token replacement/revocation/local disconnect and preserved clones. Verify installed browser and Pi/shell use the same native grant under their actual environments. Network routing/DNS/VPN/firewall and OS CA trust are operator prerequisites configured by hand on that server; report blocked if absent, never repair networking or install CA through the connector. LAN/VPN and explicitly configured loopback are allowed with verified TLS; no link-local/metadata/unspecified/multicast, including resolved IPv6.

No push attempt, write PAT, real Fleetrepo import, SSH setup, LFS/submodule auth or wider Gitea/Forgejo support claim. Push denial and allowed push belong to the separate permission-gated issue.

## Plan and approval

Implements @fleetrepo-gitea-habitat [implementation-plan.md](../fleetrepo-gitea-habitat/implementation-plan.md), section 6 (UID + read-only provider proof). Read [ADR 0031](../../docs/decisions/adr-0031-native-gitea-connections.md) and [native evidence](../fleetrepo-gitea-habitat/native-auth-evidence.md). The latest parent Decision (Jari 2026-10-24) supersedes older proposal-only network/authorization wording: core tea ownership, network boundary and read-only first scope are approved for scheduling. Detailed mechanics remain implementation proposals, not new architecture authority. No URL-only substitute, login/admission change, server routing work or additional write permission.

## UI specification

Validate the accepted connect-riff dialog and minimal common list (workspace-import round 3) on installed product; request Jari's product verdict, without claiming fixture acceptance is provider proof.

Prototype evidence and verdicts: [connect](../fleetrepo-gitea-habitat/prototypes/connect/NOTES.md), [connect-riff](../fleetrepo-gitea-habitat/prototypes/connect-riff/NOTES.md), [workspace-import](../fleetrepo-gitea-habitat/prototypes/workspace-import/NOTES.md).

## Proposed scheduling (not assigned)

Proposed lane `gitea`, lane_seq 70; head `gitea-native-owner`. Filing policy leaves this issue unlaned/untriaged for the later human scheduling decision.
Dependencies: @gitea-production-ui, @gitea-runtime-qualification. Collision tokens: `contracts/v1/`, `internal/nativegitea/`, `internal/daemon/github_jobs_linux.go`.
The shared `contracts/v1/` and `web/src/app/GitHubOnboarding` tokens use the current site-onboarding spelling; the latter conservatively serializes shared repository chooser/onboarding regression work. Other tokens reserve the named adapter, clone job, UI or release hot surface.

## Acceptance Criteria

- [x] Two real UIDs with distinct PATs cannot read each other's tea state, select connection IDs, clone/cancel/disconnect jobs or route a foreign session socket; wrong owner/peer is refused.
- [ ] Installed CLI/browser/Pi/shell read-only paths pass against the harmless private repo; record exact server/version/scopes/CA and observed pagination, rotation/revocation and clone retention.
- [ ] Keep four proof levels separate in result.md: unit fixture, host-backed browser, real UID/runtime, real provider + Jari review. Run focused UID/runtime/provider checks and round clean gate per TESTING.md; independent /llm-review covers all credential/daemon isolation changes before release.

## Validation and review

Use TESTING.md focused Go/contract/web/host-backed checks for touched surfaces, contract generation and drift checks where relevant. Credential fixtures use umask 077 and short disk-backed TMPDIR under /var/tmp, isolated HOME/config and synthetic grants. Browser checks on Alder use the documented remote runner, not local Playwright. Independent /llm-review is required wherever credentials cross the daemon boundary or native auth, contracts or daemon state change. Resolve confirmed findings and record result.md evidence/limits; never report unrun real-UID/provider checks as passed. New runtime dependency/release proof must precede connector publication; the first slice remains synthetic until then.
