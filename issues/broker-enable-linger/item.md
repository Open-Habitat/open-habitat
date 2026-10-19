---
created: 2026-10-19
updated: 2026-10-19
type: feature
reporter: jari
status: done
priority: high
related: ['@research-shell-editor']
lane: provision-boot
lane_seq: 2
collision: [internal/provision/]
preparation: ready
closed: 2026-10-19
---

# Broker enables lingering for each account

Jari accepted on 2026-10-19 (`research-shell-editor` decision 2): the root broker enables lingering (`loginctl enable-linger <user>`) when it creates an account, so the person's tmux server and editor can run as `systemd-run --user` services that outlive daemon restarts and upgrades; Taskfleet spinoffs need the same. This widens the broker's root acts by exactly that one; it reads nothing from the person and stores nothing new. Existing accounts get it at the broker's next start (or a one-time idempotent pass). Security boundary change: independent review required.

## Acceptance Criteria

- [x] Only durably committed, admitted accounts can reach the fixed linger operation, after successful activation.
- [x] Existing accounts receive an idempotent attempt at broker start; failed attempts are logged without blocking other accounts.
- [x] Distinct-UID/NSS boundary tests, focused package/caller checks, contract checks, and independent security review are recorded in `result.md`.
- [x] Post-release logind and daemon-restart checks are documented for the disposable test VM.
