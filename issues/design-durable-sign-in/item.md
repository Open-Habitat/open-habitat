---
created: 2026-10-04
updated: 2026-10-04
type: task
status: open
priority: normal
related: ['@rethink-project-docs']
labels: [human-review]
lane: planning
---

# Design durable browser sign-in

## Purpose

People should stay signed in during ordinary use and across gateway restarts
and upgrades. Jari rejected routine repeated sign-in while reviewing
`docs/architecture/identity-and-trust.md` on 2026-10-04.

The gateway currently keeps sessions only in memory and expires them after
eight idle hours or 24 hours in total. Its cookie also has no persistent
expiry. These implementation choices do not satisfy the intended experience.
The behavior is in `internal/gateway`; the current description is in
[identity and trust](../../docs/architecture/identity-and-trust.md).

## Design

Recommend how to preserve browser sign-in across normal returns to the app
and service restarts, with reasons for the storage and lifetime choices.
Bring changes to persistence and authentication authority to Jari before
implementation. No particular session store, token format or expiry duration
has been chosen.

User removal, the broader logout behavior and access revocation will be
designed separately when brought into scope. Jari explicitly excluded building
that functionality in this documentation round. Existing logout and the
limited operator revocation mechanism remain implemented behavior, not a
requirement to expand them or a prerequisite for durable sign-in.

## Acceptance Criteria

- [ ] An agreed design explains how normal use avoids repeated sign-in and how login survives gateway restarts and upgrades.
- [ ] The architectural decision and a bounded implementation task are recorded, with user removal and broader logout/revocation design kept outside this task.
