---
created: 2026-10-19
updated: 2026-10-19
type: bug
reporter: jari
status: fixed
priority: high
lane: gate-health
lane_seq: 4
collision: [test/browser-host]
preparation: ready
closed: 2026-10-19
---

# Test browser hosts outlive their runs and pile up on alder

Jari, 2026-10-19: "Tämä testien feilaaminen ja kuorma ovat uusia asioita, ja tämä toimi moitteettomasti viikkoja. Onko mahdollista, että täällä on jotakin zombieprosesseja?"

Yes. On alder the conductor found 48 orphaned test-host processes (`.cache/browser-host` and their synthetic Pi children `browser-host /synthetic/pi/dist/bundle/cli.js --mode rpc`), reparented to `systemd --user` (PID 1905), between 2 hours and 19 days old, all from worktrees that no longer exist (e.g. `native-agent-host__worktrees/wt-835g33xn0f-persist-browser-sign-in`, `…/wt-h6yrzm7m0v-user-storage-quotas`, `.cache/browser-host web/dist` from `scripts/lab.sh`-style runs). They held inotify instances (system total fell from 90 to 66 of the 128 per-user limit after killing them) and ports. The earlier gate flakes (`downright-public-cub`: "watcher could not start", inotify exhaustion) and today's load-sensitive failures plausibly share this cause. Killed by the conductor at 11:43 UTC.

Fix: a browser host (from `web/tests/worker-host.ts`, `host-build.ts`, `scripts/lab.sh`, the gate) must never outlive the process that started it: e.g. Linux `Pdeathsig` (`SysProcAttr.Pdeathsig = SIGKILL`) in `test/browser-host/main.go` for itself and the synthetic Pi it spawns, its own process group killed on teardown, and a watchdog that exits when its parent PID changes or its worktree directory disappears. Add a check (in the gate's preflight or `scripts/`) that reports and, with a flag, cleans browser-host processes whose worktree no longer exists or whose parent is init/systemd, so a worker that is killed (OOM, cancel) cannot leak them again.

## Acceptance Criteria

- [x] Killing a launcher with SIGKILL ends its real browser host and synthetic Pi within five seconds.
- [x] Direct host SIGKILL and worktree removal/replacement cannot leave a live synthetic host/Pi.
- [x] A documented same-UID stray report requires explicit `--kill` for cleanup and is tested against a fake orphan.
- [x] The gate preflight reports strays without killing them; focused Go, contracts, fast web, browser and lab lifecycle checks pass.

See `result.md` for the evidence, failed attempts, limits and decisions for later review.
