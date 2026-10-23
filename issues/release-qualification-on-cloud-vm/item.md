---
created: 2026-10-23
updated: 2026-10-23
type: improvement
reporter: jari
status: in-progress
priority: normal
preparation: ready
lane: vm-tests
lane_seq: 2
collision: [scripts/vm]
---

# Release qualification on a short-lived real Hetzner VM instead of emulated guests

## Description

Lesson from the Northwind pilot installation (2026-10-23): six release+fresh-installer rounds each found one deployment defect (site validation, OS package drift, proc gid, Hetzner mirror, config parent mode, port 443) that our qualification never met, because it ran on emulated QEMU guests on Cedar/Alder and on a Fleetrepo-managed test server with high ports and Fleetrepo-provided pieces. Jari: test lighter and earlier, package and deploy once everything works.

Replace the emulated union qualification with a **short-lived real amd64 cloud VM** (Hetzner, provisioned per run by Fleetrepo's test-project credentials, cents per run, destroyed afterwards), booted from the stock Ubuntu 24.04 image with current security updates and the stock Hetzner mirror, installing exactly like a customer (separate /home volume, port 443, TLS) — so customer conditions are the test conditions. Keep the clean fresh-installer experiment only as the final acceptance before a customer release.

## Acceptance Criteria

- [ ] One command runs prepare/apply/upgrade/reboot qualification on a fresh cloud VM and tears it down; documented in TESTING.md; replaces the emulated union path for release qualification.
