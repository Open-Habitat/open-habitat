---
created: 2026-09-27
updated: 2026-09-27
type: bug
status: fixed
priority: high
lane: auth-incident
collision: [internal/provision/]
closed: 2026-09-27
closed_by: pi
---

# Investigate first-login broker denial

## Description

Pilot.4 browser login now passes GitHub callback issuer check and token exchange, but redirects with identity_mapping_denied; gateway JSONL shows broker_denied. Read-only guest snapshot after attempt: allowlist one, bindings zero, no pending markers/JIT account, Alder gh api user ID matches allowlist. Determine whether ensure transport rejected, broker writer refused pre-provision, or another guard failed; distinguish exact live evidence vs source hypotheses. Assess operator-safe reason logging if current broker returns only generic failure; never publish IDs/tokens/unredacted guest logs. No mutating real guest state in investigation; produce redacted report and actionable fix/retest recommendation. Keep parent investigate-first-login open.

## Comments

### 2026-09-27T14:55:11Z · @pi

2026-09-27 pilot.5 Chrome retest: browser auth_error=identity_mapping_denied. Bounded gateway event rejected broker_denied with broker_operation=ensure, broker_reason=drift. Root broker bounded JSONL logged one parent_policy guard event in the same operator-held window (no cross-component attempt ID; time correlation only). Guest read-only stat of exact parent paths found the installed protected configuration directory root:gateway 0750, while internal/provision/executor_linux.go Available checks owner(configBase, root, root, 0755); all other checked parent owners/modes matched policy. This precise code/host incompatibility is the leading diagnosis and can explain pre-reservation failure without binding or pending marker. Do not broaden guest config permissions; fix expected protected mode in product and retest. No account changes.

### 2026-09-27T16:57:44Z · @pi

2026-09-27 resolved by protected config parent guard and separate daemon binding hierarchy; pilot.7 live retest completed first JIT account and credential handoff. Prior gateway drift/root parent_policy cause was code/host mode mismatch, not allowlist refusal. No pending marker, binding exists, browser session and mapped native gh verified.

## Resolution

### 2026-09-27T16:57:44Z · @pi

Live first-login re-test passed after parent guard, directory split, native gh and helper fixes.
