---
created: 2026-09-29
updated: 2026-09-30
type: task
reporter: jari
status: wontfix
priority: high
lane: provision-deprovision
collision: [internal/provision/, docs/]
closed: 2026-09-30
disposition_reason: superseded
---

# Deprovision bound Unix user safely

## Resolution

The immediate need was a clean test environment for first use. The full test
server rebuild replaced the single-account removal requested on 2026-09-29;
Fleetrepo records that decision and its execution in
`@prepare-jari-reset-release` and `@rebuild-test-vm-first-use`.

On 2026-09-30 Jari confirmed that resetting the whole test system is sufficient
for the current work. This implementation task is closed as superseded, without
implementing individual account removal.

## Later needs

Jari identified two later capabilities: a user-facing “delete me” action and an
administrator CLI command for removing an individual user from the system.
Neither is needed or scheduled now. Their scope and architecture remain to be
designed when the work becomes relevant; the old tombstone, permanent UID
reservation and migration proposal is not an approved implementation contract.

[ADR 0007](../../docs/adr-0007-bound-user-deprovision.md) preserves the reason
account removal needs coordinated design. Removing a Unix account differs from
browser logout and disconnecting native GitHub or OpenAI credentials.
