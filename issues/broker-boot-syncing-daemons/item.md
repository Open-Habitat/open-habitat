---
created: 2026-10-18
updated: 2026-10-18
type: feature
reporter: jari
status: open
priority: high
epic: agent-integrations
preparation: ready
lane: integrations
lane_seq: 1
collision: [internal/provision/]
---

# Broker starts syncing users' daemons at boot

ADR 0026: at boot the root broker, which already restores each committed user's daemon socket, also starts the daemon service of users who have at least one syncing integration (read from the person's integration directory under their home, without following links), so file sync resumes after a reboot. Widens the broker's allowed systemd action by exactly that; no new account, identity or data. Security boundary change: independent review required.

## Acceptance Criteria
- [ ] Broker change with tests (three-UID proof that it starts only the right users' services and reads nothing else); reboot behaviour on the test VM.

Follows ADR 0026 (integrations catalog, accepted by Jari 2026-10-18) and the prototype `proto-integrations` (direction Tili; `design-system/prototypes/rounds/2026-10-18-integraatiot/`; feasibility findings and Jari's decisions in its `result.md`). Every tool runs as the person; tokens stay in the tool's own store in their home; nothing about connections is stored by the host.
