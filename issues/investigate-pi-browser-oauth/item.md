---
created: 2026-09-29
updated: 2026-09-29
type: task
reporter: jari
status: open
priority: normal
lane: oauth-design
collision: [docs/, internal/gateway/, internal/daemon/]
---

# Investigate Pi browser OAuth callback

## Context
Jari approved a bounded investigation of ordinary OpenAI browser OAuth as an alternative to Pi's device-code sign-in, not a provider login or an architecture change. Pi 0.85.1 currently hardcodes `http://localhost:1455/auth/callback`. An unauthenticated probe encountered anti-bot 403 and did not establish whether OpenAI accepts an HTTPS test-server callback.

## Scope and decision gate
- First design a safe state/PKCE exchange bound to browser session AND mapped Unix UID; check callback origin, per-user Pi ownership, revocation, timeouts and cross-user isolation. Decide whether the gateway/daemon authority boundary would change, and take that architectural choice to Jari before changing it.
- Identify a consented provider experiment with a verified return route and rollback; inform Jari **before** any real provider test. Never bypass anti-bot, use a real browser session, or persist a real credential during a synthetic proof.
- Use synthetic tests/probes without a real home or identity. If provider compatibility cannot be established safely, report that limitation rather than implement speculative callback handling.

## Acceptance
- Evidence and recommendation recorded here, distinguishing synthetic and live results; a scoped implementation issue only after the architectural decision and provider feasibility are clear.
- No new authorization route or live provider login is implied by this issue.
