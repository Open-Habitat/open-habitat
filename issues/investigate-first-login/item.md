---
created: 2026-09-27
updated: 2026-09-27
type: bug
status: open
priority: high
lane: auth-incident
---

# Investigate first live GitHub login failure

## Description

Jari first attempted live GitHub login on 2026-09-27 around 14:55 local time on Brave, then Chrome. GitHub sent OAuth authorization email for omega-habitat-test (gist, read:org, repo), but both browsers landed at /workspaces?auth_error=invalid_request without a session. Investigate before fixing: correlate callback validation, ingress/proxy and live host logs; establish exactly how far account provisioning progressed and whether partial Unix user, credential, socket or native gh state exists; assess current observability and recommend safe structured logging and diagnostics. Produce a redacted incident report distinguishing observed evidence from hypotheses. No secrets or host-specific identifiers in public repo; no mutating real user state, no fresh OAuth login or browser automation without Jari taking credentials himself. Fleetrepo owns private deployment evidence.
