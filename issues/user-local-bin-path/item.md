---
created: 2026-10-20
updated: 2026-10-20
type: bug
reporter: jari
status: fixed
priority: high
lane: daemon-env
lane_seq: 1
collision: [daemon-env]
closed: 2026-10-20
---

# Tools the agent installs in ~/.local/bin are not found afterwards

_Source: chat:ville-test-2026-10-20_

## Description

Ville asked his agent to install uv (2026-10-20, pilot.237). The agent used the official installer, which put uv and uvx in /home/ville-svg/.local/bin. That directory is not on PATH: the daemon process environment has PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/snap/bin and a login shell for the user lacks ~/.local/bin too (no ~/.profile). So the next conversation, the browser shell and spinoffs do not find uv. Make the user's own bin directories (~/.local/bin, and the conventional per-tool ones the native installers use if justified, e.g. ~/.cargo/bin) part of PATH for everything the daemon starts on the person's behalf (Pi, browser shell/tmux, taskfleet, editor), the way a normal login would. Keep the daemon's own internal helper commands on fixed system PATHs (they deliberately use /usr/bin:/bin). Done: after installing a tool into ~/.local/bin, a new conversation and the browser shell find it; tested.

## Acceptance Criteria

- [x] A new conversation finds tools installed in `~/.local/bin`; fake Pi child execution proves discovery from the mapped home.
- [x] A new browser shell finds tools in `~/.local/bin`, including on a surviving tmux server with an old PATH.
- [x] Pi, Taskfleet, shell and editor share the per-home PATH, including Cargo's conventional bin directory, without changing restricted internal helpers.

## Result

See [validation and scope](result.md).
