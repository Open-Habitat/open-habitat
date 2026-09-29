---
created: 2026-09-29
updated: 2026-09-29
type: task
status: done
priority: high
related: ['@github-repos-first-onboarding']
lane: github-catalog
collision: [internal/gateway/, internal/daemon/, contracts/v1/]
closed: 2026-09-29
commits:
- hash: 7c5e33c
  summary: synthetic gh and cross-UID verification
---

# List checkoutable GitHub repos before Pi onboarding

## Description

Provide one narrowly scoped authenticated pre-Pi read-only API route for the current mapped UID to discover checkoutable GitHub repositories using native gh and the already installed per-UID GitHub authorization. Browser identity never chooses UID or owner. Gate all existing workspace, history and conversation routes on Pi as before. Enforce exact request shapes, bounded pagination, cancellation/deadline and output allowlist of repository metadata; avoid opaque credential logs, raw gh error output, speculative caches and user registry. Include explicit private/org repos available to this gh identity, sensible sorted display metadata and statuses for auth missing, native unavailable and an empty list. Contract v1/generated clients if needed, two separate UID synthetic gh fixtures and gateway-to-daemon tests including forged identity and failure. Does not implement clone or change onboarding page; @github-repos-first-onboarding owns chooser/checkout and final visual integration. Record security boundary, evidence and limits in issue result; run clean CI on committed tree.

## Acceptance Criteria

- [x] Broker-mapped session alone selects the daemon UID; forged identity and owner input cannot redirect the catalog.
- [x] Pre-Pi listing is bounded, read-only and limited to projected GitHub metadata; normal native routes remain Pi gated.
- [x] Synthetic two-UID container and gateway-to-daemon-to-gh fixture tests pass; clean CI passed on committed implementation.

## Resolution

### 2026-09-29T05:13:40Z · @issuectl

Read-only mapped-UID GitHub catalog delivered. Full clean gate passed at 7c5e33c; distinct UID synthetic guest and gateway-to-daemon-to-fake-gh integration passed. No live provider or release claim.
