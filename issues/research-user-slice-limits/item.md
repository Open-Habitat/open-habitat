---
created: 2026-10-31
updated: 2026-10-31
type: task
reporter: jari
status: done
priority: normal
lane: research-user-slice-limits
lane_seq: 1
preparation: ready
closed: 2026-10-31
---

# Research: per-person resource limits for daemon-run Pi and tools

## Description

Jari 31.10. (research only, no implementation yet). Today the browser-started Pi conversations and their tools run as children of `open-habitat-daemon@<user>.service` in `system.slice` with no memory or task limit, outside `user-<uid>.slice` where `docs/operations.md` points per-person budgets (see untriaged `daemon-pi-outside-user-slice`, the JupyterHub benchmark `issues/benchmark-jupyterhub/report.md` and the Orca benchmark's per-terminal MemoryMax). Research how a per-person resource group could be implemented: options such as product-declared MemoryMax/TasksMax/CPUWeight on the daemon instance from the site declaration, running Pi in the person's user manager (`user@<uid>.service`, transient scopes via systemd-run --user, as the tmux and editor units already do), a per-person slice that both the daemon instance and the user manager join, cgroup delegation; how each interacts with OOMPolicy=continue (landed today), quota, idle stop, upgrades (Pi surviving daemon restarts), Fleetrepo installation, the authority split (daemon/gateway/provision) and what JupyterHub SystemdSpawner and Orca do. Measure on Birch where safe (read-only cgroup inspection; disposable transient units only, `timeout`-bounded). Report in Finnish in `report.md` with a recommendation and what an ADR would need to decide.

## Acceptance Criteria

- [x] Finnish sourced research report compares resource-group alternatives, records safe Birch experiments and identifies the recommendation and ADR questions; no product implementation. See [report.md](report.md) and [result.md](result.md).

## Comments
