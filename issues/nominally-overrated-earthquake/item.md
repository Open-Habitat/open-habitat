---
created: 2026-10-24
updated: 2026-10-24
type: bug
status: untriaged
priority: normal
provenance: ai-review
source_ref: taskfleet:01m5q2hs1p0mw4a2nqzg8js3r0/review-finding:msal-refusal-masked
review_source: ai-review
originating_run: 01m5q2hs1p0mw4a2nqzg8js3r0
originating_run_kind: spinoff
labels:
- ai-review-model:gpt-6-astra
assessment_classification: CONFIRMED
assessment_outcome: SPIN_OFF
review_confidence: high
review_severity: should-fix
review_target: 44d6dc1c
---

# Microsoft Outlook: a refused MSAL grant reads as unreachable, not as an expired sign-in

## Description

## Description

`microsoftMCPState` (internal/daemon/integrations/microsoft_linux.go) classifies the Outlook tool's `--verify-login` result by substrings ("No valid token found", "no token received", "invalid_grant"). The pinned `@softeria/ms-365-mcp-server` 0.170.1 catches every `acquireTokenSilent` failure and rethrows the generic `Silent token acquisition failed` (dist/auth.js 765–779; `testLogin` returns `Login failed: <message>`, 944–949), so the refusal's AADSTS code never reaches the daemon.

Effect: when an account's MSAL grant is expired or revoked, Mail/Kalenteri/Yhteystiedot read *Palvelimeen ei saada yhteyttä* (`unreachable`) instead of *Kirjautuminen vanhentunut*, and the card offers no *Kirjaudu uudelleen*. A mail-only account whose grant the server's new tenant refuses is likewise retried on every check instead of showing the reason (`tenant_changed`).

Possible fix: add a verify mode to the `microsoft-native` adapter (runtime/profiles/integrations/microsoft-native-cli.mjs) that runs MSAL's silent acquisition itself and returns a fixed code (refused / unreachable) from the error's `errorCode`/`suberror`, never its text.

Found by the review of `microsoft-account-tenant-rewrite`.
