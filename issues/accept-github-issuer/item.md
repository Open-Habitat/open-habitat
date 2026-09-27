---
created: 2026-09-27
updated: 2026-09-27
type: bug
status: open
priority: high
lane: auth-incident
collision: [internal/gateway/auth.go]
---

# Accept pinned GitHub issuer in OAuth callback

## Description

Pilot.3 live Chrome retest logged shape_extra_key. A targeted local Chrome History query inspected only callback query key names and iss scheme/host/path; callback includes code,state,iss with issuer URL https://github.com/login/oauth. Strict gateway exact() rejects this before token exchange and JIT provisioning. Modify callback shape to accept at most one nonempty iss only if its value exactly equals the pinned GitHub OAuth issuer. Preserve fail-closed code/state/error checks, query key rejection, flow single-use and PKCE. Add synthetic tests for valid issuer, wrong issuer, duplicate iss, extra key, malformed issuer and successful end-to-end callback progression. Do not log code/state/raw issuer or include sensitive callback URL in issues. Full clean CI and independent security review. Leave investigate-first-login open until live repeat succeeds.
