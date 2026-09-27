---
created: 2026-09-27
updated: 2026-09-27
type: bug
status: open
priority: high
lane: auth-incident
collision: [internal/provision/]
---

# Investigate first-login broker denial

## Description

Pilot.4 browser login now passes GitHub callback issuer check and token exchange, but redirects with identity_mapping_denied; gateway JSONL shows broker_denied. Read-only guest snapshot after attempt: allowlist one, bindings zero, no pending markers/JIT account, Alder gh api user ID matches allowlist. Determine whether ensure transport rejected, broker writer refused pre-provision, or another guard failed; distinguish exact live evidence vs source hypotheses. Assess operator-safe reason logging if current broker returns only generic failure; never publish IDs/tokens/unredacted guest logs. No mutating real guest state in investigation; produce redacted report and actionable fix/retest recommendation. Keep parent investigate-first-login open.
