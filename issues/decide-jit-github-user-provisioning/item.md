---
created: 2026-09-24
updated: 2026-09-24
type: task
status: done
priority: high
lane: auth-jit
lane_seq: 10
collision: [docs/]
closed: 2026-09-24
closed_by: agent
---

# Decide safe first-GitHub-login Unix user creation

## Goal
Record the user-approved change from pre-created Unix accounts and static GitHub-ID→UID mapping to **first GitHub OAuth login creates a local Unix user**, then establishes one web session and provisions the same user's native `gh` HTTPS credential via the already designed single consent. This is web login, NOT GitHub-to-SSH login. Initial test authorization is a root-owned, operator-updatable allowlist of Jari's and Kaisa's stable numeric GitHub IDs. A GitHub handle such as `maintainer` can be the initial Unix username only if safe and unoccupied, and MUST NOT be the permanent identity key after renames; number is authoritative. Their Unix users may each own many agents. Existing inert `alice`/`bob` on the dedicated guest must not be silently adopted/deleted. No public ingress or credentials until safe live proof and independent host-key validation.

## Acceptance Criteria
- [x] Compare at least: current pre-created/static mapping, root-running gateway, and least-privilege root-owned local provisioner/broker invoked on the verified OAuth callback. Pick the minimal viable mechanism; document first-login ordering (identity -> allowlist -> no-squatting/collision -> atomic/recoverable account mapping -> socket/config/unit readiness -> single token handoff -> session), rerun idempotence, concurrent logins, failure state/rollback, provider rename, allowlist updates/revocation and denial before any user operation.
- [x] Explicitly reconcile/supersede accepted ADR 0003's pre-existing account requirement and ADR 0001's administrator-owned mapping without weakening the gateway-no-home/no-root rule or browser-no-UID-selection rule. Record a new ADR in `docs/` and update `docs/decisions.md`, plus issue result with precise implementation boundaries and test matrix. No implementation, guest, OAuth, DNS or Cloudflare changes in this decision task.
- [x] Specify Fleetrepo boundary (private allowlist, root service, config, secrets and live guest apply) versus public app boundary (OAuth flow, broker protocol/interface, privilege-separation and generic contract). Exclude actual Pi conversation control from the login success claim.
