---
created: 2026-10-19
updated: 2026-10-19
type: feature
reporter: jari
status: open
priority: high
related: ['@research-shell-editor']
lane: provision-boot
lane_seq: 2
collision: [internal/provision/]
preparation: ready
---

# Broker enables lingering for each account

Jari accepted on 2026-10-19 (`research-shell-editor` decision 2): the root broker enables lingering (`loginctl enable-linger <user>`) when it creates an account, so the person's tmux server and editor can run as `systemd-run --user` services that outlive daemon restarts and upgrades; Taskfleet spinoffs need the same. This widens the broker's root acts by exactly that one; it reads nothing from the person and stores nothing new. Existing accounts get it at the broker's next start (or a one-time idempotent pass). Security boundary change: independent review required.
