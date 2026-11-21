---
created: 2026-11-21
updated: 2026-11-21
type: feature
status: untriaged
priority: normal
provenance: other
provenance_detail: ADR 0037 implementation (technical decision run)
source_ref: taskfleet:01m7yk9bnzwbee7v6r48ecfy6e/adr-0037-implementation:broker
originating_run: 01m7yk9bnzwbee7v6r48ecfy6e
originating_run_kind: technical-decision
preparation: pending
related: ['@person-removal']
---

# Broker: person removal lifecycle (close-out, scheduled data removal, UID reuse proof)

## Description

# Broker: person removal lifecycle in the ledger

Implements sections 1, 5 and 6 of ADR 0037 (`docs/decisions/adr-0037-person-removal.md`) in `internal/provision`, once Jari has accepted its authority changes.

- A `removal` record on a committed binding (due time, actor, stage) and new operations from the gateway socket and root's control socket: schedule (with immediate as due = now), cancel, and read. Refuse when any admission source admits the subject (`operator_owned` for site.json).
- Stage 1 close-out from committed state: withdraw as today, then expire the account (`usermod --expiredate 1`), disable linger, stop `user@<uid>.service`, `loginctl terminate-user`, kill what is left in `user-<uid>.slice`. Cancel unexpires.
- Stage 2 data removal, each step observe-then-act and repeatable: files outside the home (crontab, at, mail spool, UID-owned files on /tmp, /var/tmp, /dev/shm without following symlinks, user journal files); home deletion by descriptor (`O_NOFOLLOW`, owner check, rename to `.open-habitat-removing-<uid>` inside /home, descriptor-relative unlinkat, no mount crossing); zero kernel quota usage (blocks and inodes) under user quotas or `files_remain`; clear the quota record; disable socket instances, remove socket dir, named `user:<uid>:--x` ACLs, `daemon-<name>.json`; `userdel` without `-r`, `groupdel`; drop the binding (generation + 1) and the subject's runtime entry, member record and `revoked` entry.
- The broker runs due removals at start and hourly; `broker_removal` journal events with subject, stage, outcome and fixed reason.
- `ensure`/`authorize`/restore/quota operations refuse a subject with a removal record (`removal_pending`).
- The allocator's availability check additionally requires zero kernel quota usage for a candidate UID under user quotas.
- Tests: fake executor covering every interruption point being repeated to completion; a privileged lab check on a disposable host.
- `docs/operations.md`: replace "no supported … deprovision" with the removal description in the same commit; move the rules the code cannot show into `internal/AGENTS.md`.
