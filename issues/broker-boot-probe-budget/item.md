---
created: 2026-10-24
updated: 2026-10-24
type: bug
status: fixed
priority: normal
preparation: ready
provenance: chat
lane: unlaned
collision: [internal/provision, systemd/]
closed: 2026-10-24
---

# Broker stops on a slow boot because each startup probe has a fixed 3 s budget

## Description

The provisioning broker's startup is all-or-nothing with `Restart=no`, and each probe command it runs through `linuxCommand` (`internal/provision/executor_linux.go`) has a fixed 3 s budget. On a busy boot (observed under emulated TCG load with cloud-init and snapd, see `greatly-grey-milk` result.md) one `systemctl show` outlived the 3 s budget, the probe failed, startup refused (fail closed), and no person's listener was restored until an operator restarted the broker. Everyone on the installation is locked out after such a boot.

Jari 2026-10-24: fix this before the pilot.8 release that goes to the pilot and Birch at the same time.

## Goal

A slow boot no longer leaves the broker stopped. Keep fail-closed semantics for real refusals (a probe that answers with an unexpected or unsafe state still refuses); only slowness is tolerated. Possible directions: a longer budget for read-only `systemctl show` probes at startup, a bounded retry of startup with backoff, or a systemd `Restart=on-failure` with a start limit in the neutral unit template. Choose by judgement and record it under "Decisions for later review".

## Acceptance Criteria

- [x] A startup probe that is slow but eventually answers correctly lets the broker start (unit test with an injected slow `run`).
- [x] A probe that answers with a refusing state still refuses; the boundary is not loosened.
- [x] If the systemd unit template changes, the change is noted for the Fleetrepo installation in result.md (the release watcher refuses unit changes Fleetrepo does not know about).
