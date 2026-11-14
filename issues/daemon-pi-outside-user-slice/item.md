---
created: 2026-10-31
updated: 2026-11-14
type: bug
status: open
priority: normal
provenance: agent
source_ref: taskfleet:01m68hqwwm215yz17mbzpnw471/observation:daemon-cgroup-outside-user-slice
originating_run: 01m68hqwwm215yz17mbzpnw471
originating_run_kind: research
lane: pi-holder
lane_seq: 2
preparation: pending
---

# Pi children of the daemon run outside user-<uid>.slice, so the documented per-person memory budget does not bound them

## Description

Observed on birch 2026-10-31 during the JupyterHub benchmark (issues/benchmark-jupyterhub/report.md).

A person's browser-started Pi and every process its tools start (for example
`npm run dev` and its `node` child, 1.7 GB RSS) run inside the system unit
`open-habitat-daemon@<user>.service`, in
`system.slice/system-open\x2dhabitat\x2ddaemon.slice/`. At the time of the
observation that cgroup held 8.7 GB with `memory.max = max`; the parent slice
is also unbounded.

`docs/operations.md` tells the operator to "Put resource budgets on user
slices" and says `MemoryMax=`, `TasksMax=` and `CPUWeight=` remain customer
policy. A budget on `user-<uid>.slice` bounds only what runs under the
person's user manager (terminals' tmux, the editor, Taskfleet workers). It
does not bound the daemon's Pi children. The operator also cannot set a
per-person limit on the daemon unit itself, because host apply/verify refuse
any drop-in on product units (`unitFragmentMatches` requires empty
`DropInPaths`). A drop-in on the shared daemon slice would bound all people
together, not each person.

Effect: one person's runaway agent build or test can take the whole host's
memory, and the kernel OOM killer then picks among every person's processes
and the product services. `maxLiveConversations = 4` bounds how many Pi
processes run, not their memory. JupyterHub's SystemdSpawner shows the
established shape: each person's server is its own systemd unit with
`MemoryMax`/`CPUQuota` from site configuration.

Decision needed: where the per-person budget lives. One option is to run the
daemon's Pi children (or the daemon itself) in the person's
`user-<uid>.slice`, so the existing operator guidance becomes true. Another
is a product-declared per-person `MemoryMax`/`TasksMax` on the daemon
instance taken from root's site declaration. Either way the guide should
describe what the limit actually covers.
