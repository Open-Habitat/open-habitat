---
created: 2026-10-24
updated: 2026-10-24
type: bug
reporter: jari
status: fixed
priority: normal
preparation: ready
lane: unlaned
collision: [internal/nativegh]
closed: 2026-10-24
closed_by: claude
---

# Pilot sign-in fails forever once the native gh token is revoked

## Description

Northwind pilot (open-habitat.acme.test, 0.1.0-pilot.7), 2026-10-24 04:35 UTC: Jari's sign-in failed every time with "Kirjautumisessa tapahtui virhe". Journal: `native_gh_install failed native_install_unavailable` → `credential_handoff failed` → `oauth_callback rejected handoff_failed`.

Cause found by the conductor: the gh token installed at first login (2026-10-23 10:45) had become invalid on GitHub (`gh auth status`: "The token in …/hosts.yml is invalid"), yet Ubuntu's gh 2.45.0 `gh auth status --hostname github.com` **exits 0** for an invalid token. `nativegh.Adapter.Install` (internal/nativegh/native.go) treats exit 0 as an existing login, `observe` fails, and Install returns `denied` without installing the fresh token — so a stale token blocks every later sign-in permanently. The conductor unblocked the pilot by `gh auth logout` of the invalid entry (nothing lost).

Two things to deliver:
1. Re-login must replace a gh login that GitHub rejects (401/invalid), while still never overwriting or cleaning up a working login that belongs to someone else or one the adapter cannot positively classify. Decide the exact rule from evidence (gh exit codes and output across the pinned/apt gh versions; `gh api user` 401 vs network failure must differ — a network failure must not be treated as invalid).
2. Why the token became invalid within ~18 h for an OAuth App (`Ov23…` client id, tokens do not expire): investigate likely causes in our flow (e.g. a second OAuth exchange or token reuse, gateway or test-server behaviour, GitHub's per-app token limit, revocation on some path) from code and the pilot journal (read-only SSH as documented in Northwind `open-habitat-server/README.md`), and fix it if it is ours; otherwise record the finding.

## Acceptance Criteria

- [ ] A stale/revoked gh token no longer blocks sign-in (test with a fake gh that exits 0 on invalid token, and a network-failure case that must not replace); root cause of the invalidation recorded and fixed if ours.
