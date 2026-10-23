---
created: 2026-10-23
updated: 2026-10-23
type: bug
reporter: jari
status: open
priority: normal
preparation: ready
lane: vm-tests
lane_seq: 1
collision: [scripts/vm]
---

# VM qualification reserves 6 GiB although the guest is capped at 3.5 GiB

## Description

Jari 2026-10-23: the local VM qualification refuses to start below 6 GiB available RAM (`scripts/test-core-runtime-vm.sh`, `runtime_vm_capacity_unavailable`), although the guest's container is hard-capped at `--memory=3500m`. The extra ~2.5 GiB margin has no measured basis and blocked the pilot release for half an hour on a shared Alder. Lower the admission to the cap plus a small measured margin (≈ 4 GiB), applied consistently in every VM script that copies this guard, and state the reason next to it.

Follow-up worth weighing: run VM qualification on a short-lived Hetzner amd64 VM (Fleetrepo-provisioned, cents per hour, real amd64 instead of emulation) instead of Alder.

## Acceptance Criteria

- [ ] All VM scripts admit at cap + measured margin with the reason in a comment; script tests updated.
