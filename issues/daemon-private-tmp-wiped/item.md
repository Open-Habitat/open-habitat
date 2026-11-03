---
created: 2026-11-03
updated: 2026-11-03
type: bug
reporter: jari
status: fixed
priority: high
lane: daemon-tmp
lane_seq: 1
collision: [systemd/]
preparation: ready
closed: 2026-11-03
---

# Agents lose /var/tmp whenever the daemon restarts (PrivateTmp)

## Description

Jari 3.11. (found by another agent investigating lost morning-review
evidence on Birch): a browser agent's `/var/tmp` is not the machine's
`/var/tmp` but the daemon unit's private one
(`/tmp/systemd-private-…-open-habitat-daemon@<user>.service-…/tmp`, mounted
on `/var/tmp`; `/tmp` likewise), because `systemd/open-habitat-daemon@.service`
sets `PrivateTmp=yes`. systemd deletes it every time the daemon restarts,
i.e. on every upgrade. Pi, its tools and Taskfleet supervisors and workers
started from Habitat all inherit it (verified 3.11. in `/proc/*/mountinfo`).
So scratch, build caches, evidence and anything a person or agent saved
under `/var/tmp` — which by convention survives reboots — vanish at the next
upgrade. The repository's own instructions tell agents to keep evidence in
`/var/tmp/agent-keep` and scratch in `/var/tmp/agent-scratch`.

Keep what PrivateTmp protects (one person's temporary files are not visible
to another's, no shared world-writable `/tmp` races between users) while
making `/var/tmp` persist across daemon restarts as it does over SSH. A
likely shape: a per-user persistent directory (owned by the user, 0700, on
the same disk-backed volume, e.g. under the user's home or a per-user
directory created by tmpfiles) bind-mounted on `/var/tmp` for the unit, and
`/tmp` staying private and disposable; or `PrivateTmp=disconnected`-style
semantics if the installed systemd supports it (Birch has 255). Decide with
evidence, record it under "Decisions for later review", keep per-user
separation, and size/expiry so it does not grow without bound (the quota
already counts it if it lives with the user's data).

A unit change needs its Fleetrepo installation change in the same round
(AGENTS-WORKFLOW: otherwise the test-release watcher refuses the release).

## Acceptance Criteria

- [x] A file an agent writes under `/var/tmp` survives a daemon restart; another user cannot see it; `/tmp` stays private.
- [x] Unit test / host check covers it; `docs/operations.md` says where agents' `/var/tmp` lives; Fleetrepo change named or made.
- [x] Independent review (sandbox and per-user separation).
