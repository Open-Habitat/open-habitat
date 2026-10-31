---
created: 2026-10-31
updated: 2026-10-31
type: bug
status: untriaged
priority: normal
provenance: other
provenance_detail: pilot.17 clean gate failure
source_ref: taskfleet:01m68gbvm72txr17m5kz12h0nd/gate-failure:test-browser-hosts-orphan
originating_run: 01m68gbvm72txr17m5kz12h0nd
originating_run_kind: spinoff
---

# Stray browser host detection misses orphans adopted by an invisible user manager (Birch)

## Description

The pilot.17 clean gate on Birch (candidate a9690ebb, 31.10.) failed in
go-and-contracts on `scripts/test-browser-hosts.py`
`test_report_and_kill_orphan`: `rows[0]` IndexError, so `browser-hosts.py`
reported no stray for a deliberately orphaned fake host. It fails every time,
alone and in a fresh `systemd-run --user` unit, so it is not a load flake.
The same test passed in pilot.16's gate on 30.10. at 12:19.

Cause: Birch rebooted on 30.10. at 14:39. Since then maintainer's systemd
user manager (`user@32000.service`, pid 1055), which as subreaper adopts every
orphan, is invisible to the account's own processes under /proc
`hidepid=invisible` (pgrep cannot see it either; it is presumably no longer
ptrace-readable). `browser-hosts.py` decided that a host was reparented by
reading the parent's `comm`, which it can no longer do, so a real stray
synthetic host under that manager was not reported and `--kill` could not
clean it up.

Fix: a parent with no visible /proc entry counts as the adopting reaper. The
launcher of a synthetic host is always the same-user test runner and stays
visible, and a lab host with a live recorded owner is still exempt.
