---
created: 2026-10-26
updated: 2026-10-26
type: bug
reporter: conductor
status: open
priority: normal
lane: unlaned
collision: [internal/daemon/github]
preparation: ready
---

# Habitat's GitHub token in gh stops working overnight while settings say Yhdistetty

## Description

Observed 2026-10-26 on Birch (account maintainer): `git push` over HTTPS and
`gh auth status` fail with "token … is invalid". The token in
`~/.config/gh/hosts.yml` (written by Habitat's GitHub connection, 2026-10-25
18:11) worked for pushes until about 22:30 and was invalid by the morning.
The evening before, Settings › Yhteydet showed GitHub "Yhdistetty". SSH to
GitHub has no key for this account, so HTTPS via gh is the only push path.

Suspected (unverified): a GitHub App user-to-server token, which expires after
8 hours, written to gh without its refresh token or a refresh path. Find the
cause; if the token expires by design, Habitat must refresh it (or store what
gh needs to refresh) and the settings row must show an expired connection
truthfully rather than "Yhdistetty". Never log or print tokens.

## Acceptance Criteria

- [ ] Cause established; a GitHub connection keeps working for days, or the
  person sees it expire and reconnects in one step; tests at the boundary.

