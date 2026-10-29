---
created: 2026-10-29
updated: 2026-10-29
type: feature
status: untriaged
priority: normal
provenance: other
provenance_detail: follow-up from own-machine-access implementation
source_ref: taskfleet:01m647w2602m0ntrk9tn09nmqs/followup:own-machines-conversation
originating_run: 01m647w2602m0ntrk9tn09nmqs
originating_run_kind: spinoff
---

# Own machines: machine chip and open-connection mark in the conversation

## Description

# Own machines: what the conversation shows when the agent uses one

`own-machine-access` landed the settings page and guided setup (prototype direction Ohjattu) and the daemon side. The prototype `proto-own-machine-access` also specified the conversation side, which is not built yet:

- **Machine chip on `ssh <name>` tool rows.** `web/src/components/BashToolCard.tsx` shows the command; a chip naming the machine (from the names in `~/.ssh/config.d/habitat-*.conf`, which the daemon already reads in `internal/daemon/own_machines_linux.go` `readMachines`) would tell the person at a glance that a command ran on their own computer, not on the server.
- **"Yhteys auki" in the conversation header.** The daemon already reports `connection_open` per machine from the ControlMaster socket (`$XDG_RUNTIME_DIR/habitat-tailscale/ssh-<name>`); the conversation header could show it while a connection is open. No usage log is kept (decided in the prototype).

Impact: today the person sees only the raw `ssh name -- cmd` line, so a command run on their Mac is easy to miss among server commands. The settings page shows "Yhteys auki" only there.

Also left from the prototype: Windows guidance (OpenSSH Server, the `administrators_authorized_keys` branch for admin accounts) is not offered; Windows peers are shown disabled as "Windows myöhemmin".
