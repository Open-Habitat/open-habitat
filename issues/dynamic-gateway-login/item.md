---
created: 2026-09-24
updated: 2026-09-24
type: task
status: done
priority: high
lane: auth-gateway
lane_seq: 10
collision: [internal/gateway/]
blocked_by: ['@package-root-broker']
closed: 2026-09-24
closed_by: agent
---

# Implement dynamic gateway login authorization

## Goal
Replace fixed preconfigured identity login with ADR 0004's GitHub `/user` verified canonical numeric identity and broker authorization; preserve HTTPS Origin/CSRF/session constraints.

## Acceptance Criteria
- [x] After state/PKCE and verified GitHub `/user`, ensure binding through broker; recheck epoch before issuing session and authorize every existing session-backed API request against broker, failing closed on revocation, binding drift or outage. If streams exist, authorize connection/heartbeat and close on revocation. No browser-supplied subject or token in broker.
- [x] Test concurrent callbacks, revoked/existing sessions, outages, failed/lost handoff and authorization races hermetically. Do not enable real OAuth, live ingress or fixture endpoints for manual browsing.
- [x] Run `./scripts/ci-local.sh --clean --json` on clean committed tree and independent security review of final diff; record tests and limits in `result.md`. See `issues/prepare-login-pilot/plan.md` and ADR 0004. Coordinate broker service contract before completing integration.
