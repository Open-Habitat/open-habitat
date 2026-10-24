---
created: 2026-10-24
updated: 2026-10-24
type: bug
status: fixed
priority: normal
preparation: ready
provenance: other
lane: unlaned
collision: [internal/hostop, release/manifest]
closed: 2026-10-24
---

# host apply fails with EXDEV when /var and /opt are separate filesystems

## Description

Observed 2026-10-24 installing pilot.8 arm64 on birch (Fleetrepo run 01m5qj6kqa4csq9pgfhtx0wm9w): `host apply` publishes the staged generation with renameat2() from `/var/lib/open-habitat/staging` to `/opt/open-habitat/generations`. On a host where /var is a separate filesystem (birch since its disk split; a common server layout) the rename fails with EXDEV (errno 18), the CLI reports it as `host_observation_unavailable`, and the apply is fenced in "staging" (operation 1aefab95aef14e19812b579cc53dc980, entry verified_closed). Nothing was published. Host-side workarounds do not pass the product's checks (symlinks refused per component; bind mounts still EXDEV).

## Goal

Installation works when /var, /opt and / are separate filesystems: stage a generation on the same filesystem as its publish target (e.g. under /opt/open-habitat), keep the atomic publish, and report a cross-device condition as a typed error rather than `host_observation_unavailable`. A host where an earlier release fenced an apply in staging this way continues through a supported path with the successor (no journal reset, no manual fence deletion), so birch's operation 1aefab95… completes after upgrading the staged release.

## Acceptance Criteria

- [x] Prepare/apply/upgrade pass on a host with separate /var and /opt filesystems (test fixture or VM scenario).
- [x] A fenced staging operation left by the EXDEV failure continues to completion with the fixed release.
- [x] Typed EXDEV error with an operator-readable message.
