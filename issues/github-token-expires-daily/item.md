---
created: 2026-10-27
updated: 2026-10-27
type: bug
reporter: jari
status: fixed
priority: high
provenance: chat
source_ref: chat:2026-10-27/github-token-expires-daily
lane: github-auth
collision: [internal/gateway/auth.go]
preparation: ready
closed: 2026-10-27
---

# GitHub connection on Birch expires daily: gh token invalid every morning

## Description

Jari 2026-10-27: 'Tämä on nyt päivittäinen ongelma ja on tosi häiritsevä.' On Birch (pilot.12) gh's token in ~/.config/gh/hosts.yml of maintainer is invalid ('The token … is invalid'), so git fetch/push over HTTPS fails, and Jari has to reconnect GitHub from Koodipalvelut almost daily. Candidate causes to check with evidence (gateway/daemon logs on Birch, timestamps of hosts.yml changes, GitHub's view of the OAuth app's tokens): the sign-in revoke added by github-sign-in-tokens-revoke-gh-login (internal/gateway/auth.go github_token_revoke, reason unused_by_native_gh) revoking the token gh actually uses (e.g. when a second browser or device signs in, or when the reconnect flow writes a new token); GitHub OAuth token expiry or the per-app token limit; the daily or sign-in-time rotation. Fix the cause so the native gh login stays valid across sign-ins and days.

## Acceptance Criteria

- [ ] Cause shown with evidence; fix keeps gh auth status valid across repeated sign-ins and overnight; regression test at the boundary
