---
created: 2026-10-27
updated: 2026-10-27
type: bug
reporter: jari
status: fixed
priority: normal
provenance: chat
source_ref: chat:2026-10-27/github-reconnect-keeps-old-token
lane: github-auth
collision: [internal/gateway/auth.go]
preparation: ready
closed: 2026-10-27
---

# GitHub reconnect while the old token still works keeps the old token and revokes the new one

## Description

Found by github-token-expires-daily (2026-10-27): when the person reconnects GitHub from Koodipalvelut while gh's current token is still valid, the sign-in keeps the old (possibly soon-expiring) token and revokes the newly issued one (github_token_revoke, reason unused_by_native_gh). A deliberate reconnect must replace gh's token with the new one, so that e.g. a fresh non-expiring token after the OAuth app opt-out takes effect without waiting for the old one to expire.

## Acceptance Criteria

- [ ] An explicit reconnect from Koodipalvelut installs the new token for gh and revokes the old one; ordinary sign-ins keep today's behaviour; test at the boundary
