---
created: 2026-09-27
updated: 2026-09-27
type: bug
status: in-progress
priority: high
related: ['@design-first-use-onboarding']
lane: native-gh-status
collision: [internal/daemon/snapshot_linux.go]
---

# Verify native GitHub status in user snapshot

## Goal

Report a fresh, truthful native GitHub connection state in the mapped user's session instead of unconditionally returning `unknown` after successful first login.

## Context

The first real pilot login verified `gh auth status` and numeric identity under the mapped Unix UID, but the app still displayed “Natiivin GitHub-yhteyden tila ei ole tiedossa”. `internal/daemon/snapshot_linux.go` currently hardcodes `native_github.state = unknown`. Jari requires usable native `gh` authorization to be verified in onboarding before the normal view. Keep browser-web identity distinct from native authorization and preserve explicit unknown/partial on failed verification. @design-first-use-onboarding owns the larger wizard and settings design; this slice only exposes a trustworthy non-secret status for their use.

## Acceptance Criteria

- [ ] Define an honest bounded status check under the mapped daemon UID, using existing native gh integration and verifying that the observed GitHub numeric identity matches the authenticated binding (not merely that some token exists). No gateway home read or token exposure. Prevent slow/hung gh from blocking the snapshot indefinitely.
- [ ] Return connected only on a fresh positive check; distinguish not connected from unverified/error without a false green state. Avoid spuriously invalidating web sessions when gh is unavailable.
- [ ] Synthetic per-UID tests cover correct identity, wrong identity, missing auth, tool failure/timeout, no credential/log leak and no cross-user data. Retain UI warning only for genuine unknown/partial state; no made-up success for a missing check.
- [ ] Run ./scripts/ci-local.sh --clean --json and focused tests; record exact evidence in result.md. Do not test with live Jari credentials or alter host state.
