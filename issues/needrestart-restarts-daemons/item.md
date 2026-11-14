---
created: 2026-11-14
updated: 2026-11-14
type: bug
status: open
priority: normal
preparation: ready
lane: host-os-updates
lane_seq: 1
---

# An unattended OS update restarts every daemon and cuts all running turns

## Observed (13.–14.11.2026)

At 06:10 a host's unattended-upgrades installed a libc6 security update.
needrestart then restarted every service linked against the old libc,
including the per-person `open-habitat-daemon@<user>.service`. Every running
conversation's Pi ended mid-turn at an unattended moment, with no warning in
Habitat, and the person found all agents interrupted in the morning.

Ubuntu enables unattended-upgrades and needrestart's automatic restart mode
by default, so every installation is exposed (`host apply` itself already
runs apt with `NEEDRESTART_MODE=l`, but installs nothing for later upgrades).

## Expected

A routine OS update does not cut people's running turns. Options to weigh:
`host apply` installs a needrestart override (`/etc/needrestart/conf.d/`)
so Open Habitat's units are listed but not auto-restarted, and the product
restarts a daemon itself when that person has no running turn or process
(or reports a pending restart to the administrator) so security updates
still take effect.
