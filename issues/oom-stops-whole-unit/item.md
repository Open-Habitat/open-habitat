---
created: 2026-10-31
updated: 2026-10-31
type: bug
reporter: agent
status: open
priority: normal
lane: oom-stops-whole-unit
lane_seq: 1
preparation: ready
---

# One OOM-killed process may stop a person's whole daemon or tmux unit

## Description

Found by the herdr benchmark (`issues/benchmark-herdr/report.md`, 31.10.):
neither `systemd/open-habitat-daemon@.service` nor the `systemd-run` unit
that holds the person's tmux sets `OOMPolicy=`. systemd's default for a
unit without `Delegate=` is `stop`, so when the kernel OOM-kills one process
in the unit (a build an agent started), systemd may stop the whole unit:
all of that person's Pi conversations, or all their browser shells.
Inferred from systemd.service(5), not reproduced.

## Acceptance Criteria

- [ ] Reproduced or refuted in a disposable unit (a `timeout`-bounded memory
      hog under a small `MemoryMax`, as the person's user, never on Alder).
- [ ] If real: `OOMPolicy=continue` (or the right choice) in the neutral
      templates and the tmux unit, with a test; the Fleetrepo installation
      change named exactly for the conductor.

## Comments
