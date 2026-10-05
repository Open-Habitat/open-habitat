---
created: 2026-10-05
updated: 2026-10-05
type: task
reporter: jari
status: open
priority: normal
---

# Gate issue execution on joint preparation

## Description

Keep issue lifecycle status separate from preparation approval. A joint reading approves the **next defined work** of an issue, not all later implementation or use of real people. This applies to small fixes as well as large features. The DAG still owns dependency order, lanes and collisions; it must not present unapproved work as executable.

## Decision and rollout

Use a separate preparation state (`pending`, `reviewing`, `ready`). `pending` awaits joint reading; `reviewing` means the reading or its supporting artifact is underway, not approved; `ready` means Jari has accepted the next work described in the issue. If that work changes materially, revisit the approval. Real-person participation and credentials always require their own consent. An unready lane head blocks its lane; do not skip it to start the next issue. A design, investigation or verification issue can be ready for *that* work without authorizing a subsequent implementation. Split a mixed issue into decision/design and implementation issues when an actual approval boundary sits between them; don't build a generic stage machine.

A first inventory on 2026-10-05 found 45 active issues: 42 in the DAG, three unscheduled, and four already `testing`. The four testing issues continue toward their existing verdict without invented retroactive preparation approvals. Existing lane membership and Git history are evidence to read, not permission to mass-mark `ready`. Overnight rethink edits without Jari do not count as joint approval, and even jointly approved issue prose may leave a plan or architectural decision outstanding (for example `decide-logging-policy`). The unscheduled `untriaged` issue remains in intake, not in the preparation queue. Start joint review with the near-term DAG frontier rather than a 45-issue approval marathon.

The issuectl CLI owns the machine-readable gate. The implementation belongs in the issuectl repository, where opt-in semantics must leave unrelated repositories unchanged. Do not claim the port is active here until a released CLI is installed through Fleetrepo and this repository's schema/config and orchestration guidance are updated and tested against that binary. During the transition, no conductor may interpret the current `spawnable: true` alone as Jari's approval. The first individual example to settle is `decide-logging-policy`: its next approved step is an implementation plan, not coding.

## Acceptance Criteria

- [x] The running issuectl version reports preparation state and why an unapproved lane head is not spawnable, without skipping it or changing status/lane semantics.
- [x] Repository opt-in and validated preparation updates are available; agents' issue and stint instructions reflect the same gate.
- [x] Existing active issues have been inventoried without blanket `ready` assignments; work already in `testing` is not silently reset.
- [ ] Jari and the conductor review the near-term issues one at a time, record the accepted next work, and separate mixed approval boundaries when needed.
- [x] A reservation-aware DAG read demonstrates that an unapproved issue cannot start and an approved one can when other blockers clear.
