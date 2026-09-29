---
created: 2026-09-29
updated: 2026-09-29
type: task
status: done
priority: high
related: ['@github-repos-first-onboarding', '@connect-github-workspaces']
lane: github-clone
collision: [internal/gateway/, internal/daemon/]
blocked_by: ['@pre-pi-github-repo-catalog']
closed: 2026-09-29
commits:
- hash: '7536608'
  summary: implement mapped-UID import
- hash: b7b7293
  summary: integrate offline gh and git
- hash: fc40a2e
  summary: verify renamed source refusal
- hash: 07c2741
  summary: record evidence and limits
---

# Clone selected GitHub repositories before Pi sign-in

## Description

After an authenticated browser chooses an exact repository from the pre-Pi GitHub catalog, let the mapped-UID daemon perform one explicitly requested native gh/Git HTTPS clone into its own ~/src. The browser cannot choose UID, filesystem path, clone URL or credential. Gateway enforces session+CSRF and forwards only a validated exact owner/repo selection. Revalidate the repository identity via native gh before mutation; check own ~/src path and no symlink escape, duplicate name, partial/in-flight result, and recover only by read-only filesystem observation rather than automatic retry. Bound network/subprocess work and verify final checkout before reporting success; fail closed on unknown and retain honest diagnosis. No workspace registry or gateway GitHub secrets; preserve all Pi gates outside this narrow onboarding import. Synthetic separate-UID and browser contract tests cover cross-user, denial, path/URL injection, collision, cancellation and uncertainty. Separate from full create/push/delete in @connect-github-workspaces. Record tests and limitations, clean CI. Must follow @pre-pi-github-repo-catalog catalog contract.

## Acceptance Criteria

- [x] Mapped-session and CSRF-gated exact owner/repo request; daemon independently binds native gh identity and validates fresh clone metadata.
- [x] Descriptor-relative checkout rejects symlinks, collisions and uncertain results; native Git checkout and remote verified before success.
- [x] Offline gateway→daemon→gh/git fixture and networkless distinct-kernel-UID container test pass; clean committed-tree CI passed at `07c2741` before the distinct-UID fixture extension.

## Resolution

### 2026-09-29T05:32:10Z · @issuectl

Native single-repo import and offline two-subject integration landed. Clean ./scripts/ci-local.sh --clean --json passed at committed 07c2741; synthetic only, no live provider or distinct-kernel-UID clone claim.
