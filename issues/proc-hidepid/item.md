---
created: 2026-10-20
updated: 2026-10-20
type: bug
reporter: jari
status: fixed
priority: high
lane: install-hardening
lane_seq: 1
collision: [install-templates]
closed: 2026-10-20
---

# Every user sees every other user's processes and command lines

_Source: chat:ville-test-2026-10-20_

## Description

Live isolation check on the test server 2026-10-20 (pilot.237, users maintainer 21032 and ville-svg 21033): homes, Pi auth.json, gh config, /run/user/<uid>, daemon sockets and tmux sockets were all denied in both directions. But /proc is mounted without hidepid, so 'ps -u <other> -o args' as one person lists the other's processes with full argv (daemon config path with username, tmux socket path, and whatever Pi, git, builds or tools put on their command lines: repo names, file paths, potentially tokens). Under the project's model (Unix users are the boundary) this is a product defect.

Fix in the neutral installation templates (systemd/, tmpfiles.d/ or an equivalent mount unit) and document it in docs/operations.md: mount /proc with hidepid=invisible (or 2) and a gid exemption only for components that genuinely need it (check gateway, broker, systemd-logind/polkit, the daemon's own process scans for trash busy-checks and processes, which only need the user's own processes). Verify the daemon's per-user process inspection still works. Fleetrepo applies it to the test server; note what Fleetrepo must change in the report.

Done: on a two-user lab or the test server, one user's ps/proc shows only own processes; trash busy-check, process tray, Taskfleet integration still pass their tests.

## Acceptance Criteria

- [x] Neutral templates hide foreign processes host-wide, with a dedicated exemption only for logind and polkit.
- [x] A real two-UID Ubuntu 24.04 lab proves own-only ps/proc and own-process inspection; trash, process tray and Taskfleet tests pass.
- [x] Operator instructions identify installation, reboot and compatibility verification, without changing the test server.

## Result

Implemented on base `43965dd607cf72537cba160d6f2c8e0ad2058f4d`; the fixing
commit's tree contains the tested changes. No live host policy or test-server
state was changed.

Evidence (2026-10-20):

- `TMPDIR=/var/tmp ./scripts/test-proc-hidepid-uids.sh` passes in a networkless,
  rootless Ubuntu 24.04 container with private PID/mount namespaces and actual
  mapped kernel UIDs 21001 and 21002. Both users enumerate only their own
  numeric proc directories; foreign `cmdline` and `stat` return ENOENT and
  `ps -e` omits the other person. Both still find their own busy workspace
  process through the production trash scan; hidden processes do not make the
  Pi writer scan uncertain. A third UID with only the exempt supplementary GID
  can read foreign process details. The displayed gid=121003 is the kernel's
  namespace-mapped value of synthetic GID 21004, not a production allocation.
- The same lab executes Ubuntu's actual unprivileged polkitd with the exempt
  supplementary group and successfully authorizes a synthetic process subject
  for each user's running process through D-Bus/pkcheck. Ubuntu systemd's
  verifier accepts the proc service and the actual logind/polkit units with
  their drop-ins. Logind's shipped bounding set lacks CAP_SYS_PTRACE, so it
  receives the same narrow service-only exemption rather than relying on UID 0.
- The lab also passes 13 existing process tray/Taskfleet contract tests under
  the restricted mount. `umask 077; TMPDIR=/var/tmp
  ./scripts/test-focused.sh --area go --go-package ./internal/daemon` passes
  the whole daemon package with race detection (74.095 s), including trash,
  native Pi processes and Taskfleet. Pi fixture dependencies were installed
  first with `npm ci --prefix internal/daemon/pi-device-test --ignore-scripts`.
- `./scripts/test-focused.sh --area contracts` passes generation and validation
  (54 schemas, 51 fixtures, 36 scenarios, 17 negative checks).
- `npm ci --prefix web`, `npm run build --prefix web`, two
  `scripts/package-release.sh` builds at version `0.0.0-proc-test`, byte
  comparison, `scripts/verify-release.sh --archive ... --json`, and
  `scripts/test-package-socket.sh <archive>` pass. Re-signed packages with
  hidepid disabled, private mount policy, wrong exemption, ordinary group
  membership or a missing daemon policy dependency are rejected.
- `python3 scripts/validate-project-view.py`, shell syntax checks and
  `git diff --check` pass. No browser UI changed; no captures needed.

Source audit: the gateway's `/processes` paths are HTTP routes, not procfs
access. Neither gateway nor broker enumerates foreign procfs. Daemon Pi writer
(single and batch) and trash/worktree scans filter by their own UID; its other
procfs uses are self/own-daemon descriptor paths. No product component needs
membership in the exemption group.

Limits: this is real distinct-UID kernel evidence on Ubuntu 24.04 userland with
the lab host's kernel, not a booted Ubuntu kernel or live installation receipt.
Systemd syntax/dependency checks and a real polkit process-subject round trip
do not establish logind session/linger lifecycle or reboot persistence. Those
remain installation checks for the conductor. A successful oneshot is not a
continuous monitor for later administrator remounts. The full clean gate was
not run: runtime/auth/contracts/build dependencies did not change; focused
daemon, contracts, packaging, and distinct-UID checks cover the changed boundary.

Validation recovery: the first ordinary rootless container remount was denied
because its runtime locks `/proc`; the isolated lab overmounts its own procfs
with namespace-only SYS_ADMIN, then executes the shipped remount. An initial
fixture used an unsearchable temporary ancestor; it was corrected and the lab
rerun successfully. The first daemon run inherited umask 0002, making synthetic
homes group-writable and causing expected security refusals (and a downstream
fixture panic); rerunning unchanged code with umask 077 passed. Root sudo is
unavailable and was not needed. No required check remains waived.

Fleetrepo must install the new `open-habitat-proc.service` and both nested
service drop-ins in their actual `/etc/systemd/system/` locations, create the
empty `open-habitat-proc` group (without reapplying a dynamic gateway allocation
if it owns a fixed one), retain the new product service Requires/After edges,
enable the proc policy at boot, reload systemd, and apply running logind/polkit
supplementary groups during planned maintenance. Verify actual mount options,
service groups, two-user proc/ps denial, own process/trash/Taskfleet behavior,
polkit process-subject authorization, loginctl session/linger operations and
persistence after reboot before admitting users. Do not grant the gateway or
mapped people exemption membership. Adapt installation/archive allowlists to
ship the new service and nested drop-ins; package copy now preserves directories.

Independent critical-risk `/llm-review` used claude-fable-5-1 as finder and
GPT-6 Astra as verifier (two calls), followed by `/assess-findings`. Two
should-fix findings were locally confirmed and fixed: host-service drop-ins now
use Wants+After (product Requires+After remains), so policy restarts/failures do
not unnecessarily take logind/polkit down; the guide now removes drop-ins and
reloads systemd before deleting the exemption group to avoid 216/GROUP. The
verifier inspected the final fixes and mapped-account creation and found no
remaining isolation/startup bypass in scope. The finder additionally verified
that polkit process-subject authorization fails without the exempt group and
works with it. No residual finding needed an issue. Performance-corpus logging
was disabled because this task forbids pushing.

After the review fixes, the entire UID lab, daemon race suite (70.091 s),
contracts check, two byte-identical package builds, archive verification,
unsafe-package regression and project-view validator were rerun successfully.
`issuectl doctor --json` also passes after closing the issue. No required test
or review is incomplete.
