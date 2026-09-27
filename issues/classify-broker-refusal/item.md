---
created: 2026-09-27
updated: 2026-09-27
type: task
status: open
priority: high
lane: auth-incident
collision: [internal/provision/, internal/gateway/auth.go]
---

# Classify first-login broker refusal safely

## Description

Read issues/investigate-broker-denial/analysis.md. Pilot.4 Chrome login reaches broker_denied, but gateway combines ensure and authorize failures; CLI gatewayBroker.Exchange collapses provision protocol failure enums into generic errors. Preserve safe typed broker failure class (transport, unavailable, denied, name_collision, drift, invalid reply) through adapter and log fixed operation/reason enums with server-owned attempt ID at gateway without changing fail-closed auth responses or broker trust boundary. Add synthetic tests for each relevant branch and assert no identity/token/UID/path/raw error leaks. If gateway-level classification cannot distinguish concrete pre-publish guard, add narrowly scoped root-only broker event reasons without personal data; no logging of raw request. Do not mutate or login to live host. Full clean CI and independent security review. Leave incident open until live retest.
