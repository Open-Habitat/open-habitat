---
created: 2026-09-29
updated: 2026-09-29
type: task
status: open
priority: high
related: ['@github-repos-first-onboarding']
lane: github-catalog
collision: [internal/gateway/, internal/daemon/, contracts/v1/]
---

# List checkoutable GitHub repos before Pi onboarding

## Description

Provide one narrowly scoped authenticated pre-Pi read-only API route for the current mapped UID to discover checkoutable GitHub repositories using native gh and the already installed per-UID GitHub authorization. Browser identity never chooses UID or owner. Gate all existing workspace, history and conversation routes on Pi as before. Enforce exact request shapes, bounded pagination, cancellation/deadline and output allowlist of repository metadata; avoid opaque credential logs, raw gh error output, speculative caches and user registry. Include explicit private/org repos available to this gh identity, sensible sorted display metadata and statuses for auth missing, native unavailable and an empty list. Contract v1/generated clients if needed, two separate UID synthetic gh fixtures and gateway-to-daemon tests including forged identity and failure. Does not implement clone or change onboarding page; @github-repos-first-onboarding owns chooser/checkout and final visual integration. Record security boundary, evidence and limits in issue result; run clean CI on committed tree.
