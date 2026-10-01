---
created: 2026-10-01
updated: 2026-10-01
type: task
status: untriaged
priority: normal
provenance: ai-review
source_ref: taskfleet:01m3wbw6e29bqam9d1pt6hdxtz/review-finding:sha1:c82729306ec36720983fe1e6520b52106ebc51ff
review_source: ai-review
originating_run: 01m3wbw6e29bqam9d1pt6hdxtz
originating_run_kind: spinoff
labels:
- ai-review-model:claude-fable-5-1
- ai-review-model:gpt-6-astra
assessment_classification: CONFIRMED
assessment_outcome: SPIN_OFF
review_confidence: high
review_severity: high
review_target: 5199976^..5199976
---

# Make targeted session revocation reliable across admission changes

## Description

# Make targeted revocation reliable across admission changes

`internal/gateway/revoke.go:20-35` asks the broker to `authorize` the subject before deleting its browser sessions. The broker refuses authorization when the subject has been removed from the allowlist or their daemon socket is unavailable (`internal/provision/writer_linux.go`). With login-only broker authorization, `internal/gateway/auth.go:authenticated` now continues to accept a previously issued session while the broker is unavailable or policy has changed. An operator who edits admission first then invokes `RevokeSubject` receives `DENIED`, leaving that session usable until idle or absolute expiry or a full gateway restart. The existing revoke test explicitly preserves sessions on broker failure.

ADR 0006 currently requires revoke-before-edit and a ready socket. That ordering is important but has a gap: its OAuth cutoff deliberately permits a new login after revocation, so a login between revoke and the allowlist edit creates a session that cannot be targeted by a second revoke once admission is denied. The gap matters when removing a person's web access; a stopped daemon socket limits native work while down, but restarting it can expose the same still-valid session.

Decide how the root-only revocation path can reliably invalidate sessions without changing the Unix-user boundary. Options to assess: let the root-authenticated gateway remove its own sessions without a broker route check; or add a broker operation that validates the committed binding independently of current admission/socket readiness, together with an operationally safe order for preventing new logins. The first option changes ADR 0006's broker-approval authority and must not be silently folded into the gateway authorize-once change. Keep callback-time ensure/authorize and the revocation cutoff race checks intact. Add deterministic tests for edited allowlist, unavailable socket, concurrent new login and preservation of other subjects' sessions.
