# Continue here: restore fast test feedback

## User goal and ownership — latest direction wins

Jari is going to sleep and wants this fixed when he returns. His explicit goal is
**tests as fast as possible**, not maximizing offload or merely demonstrating that
remote execution works. Do not ask another generic approval round. Carry through
implementation, proportionate validation, push and deployment; report measured
ordinary-command elapsed times honestly. Security/authority changes still require
care; preserve other agents' work and the household/inference services.

**The conductor belongs in Open Habitat**, not Fleetrepo. Start the new conversation
in `~/Sources/open-habitat`. This issue is accepted and its next implementation
action approved; use live issuectl DAG/Taskfleet state rather than a copied schedule.
Fleetrepo (`~/Sources/fleetrepo`, @orx-background-runner) owns only backend changes.

The previous session technically made the runner work but failed the performance
objective. It repeatedly tuned infrastructure and ran redundant verification while
other agents queued. Do not call that success or repeat the same process.

## First bounded task — NOT implemented yet

Restore **ordinary native fast feedback**: `scripts/test-web-fast.sh`, its focused
web entrypoint, lint, typecheck and fast unit/component checks should not capture
source, SSH, queue, reinstall dependencies and fetch an artifact for each check.
Evaluate the small contract validator similarly. Keep the distinction explicit,
not an environment-variable local fallback for a failed heavy remote job.

Make the source and Fleetrepo dispatch policy agree. Important current paths:

- `scripts/test-web-fast.sh` currently probes placement and submits `oh-web-fast`
  on Alder before doing anything else.
- `scripts/test-focused.sh` currently submits web/contracts/Go areas remotely.
- `scripts/browser-focused.py` treats Alder as `remote`; its `--web-script`
  frontends submit even pure static/logic checks. `scripts/web-commands.json`
  already provides direct local Biome/tsc/Vitest command vectors.
- Fleetrepo `software/execution-runner/routing.json` maps **all** these npm scripts
  through `npm_declared_tasks`. `hbexec/owned_dispatch.py` returns the generic
  remote foreground path when that mapping exists. Changing only one repository
  will not restore native ordinary commands.
- `dotfiles/src/bin/fleetrepo-heavy-command` is the ordinary command wrapper;
  explicit `fleetrepo-exec` APIs and genuinely heavy placement must remain honest.
- `scripts/ci-local.sh` still forces serial heavy phases in a verified guest even
  though the original3GiB/2CPU reservation has been replaced. Reassess that forced
  serial mode against the now-larger bounded job instead of rerunning four suites
  to discover the same errors repeatedly.

**No fast-local or parallel-slot implementation was written before this handoff.**
The previous assistant had only read these files when context handoff was requested.

Next, address heavy-work throughput, not just a higher per-job maximum. There is
still **one global FIFO slot for every repository/agent**. Five workers each
submitting3–6 checks produced long head-of-line blocking. Do not just change a
count to two: inspect UID/process/mount/port/cache/registry isolation, cancellation,
unknown-state ownership and restart semantics. Use mature native components and
stay within the host's total reservation. A second UID/slot and disjoint port range
inside the existing VM was considered but **not implemented or validated**. It is
not a settled design. The user has not approved blindly putting all heavy builds
back on Alder; the preceding blanket rollback proposal was superseded by the
fast-local/heavy-throughput correction.

## Performance evidence (not a green application gate)

Jari relayed another conductor's three-hour measurements:

- 4–5 workers queued, UTC00:41–00:53: **11–43min/check**.
- Nearly empty queue, UTC01:23–01:37: **2–8min/check**.
- `test-web-fast`: approximately **6s native Alder**, **2–5min remote** even
  without contention. Full gate: about **5min native**, **8.5min remote**.

Our later expanded-capacity measurements, on the frozen verification tree:

| Check | Queue | Dispatch/preparation | Run/collection | Capture-complete→terminal |
|---|---:|---:|---:|---:|
| Full Go | not separately observed | not separated | **74s unit lifetime**, from guest journal |728.0s (included earlier admission pause) |
| Ordinary browser |175.5s|10.2s|169.4s|355.0s|
| Lab browser |89.8s|12.3s|51.0s|153.1s|
| ARM clean health |202.9s|10.3s|300.4s|513.6s|

Go passed; ordinary browser, lab and ARM clean health returned real `test-exit`.
Browser averaged about6 CPUs and peaked at6.9GB memory, so the increased capacity
was actually used. These times still **do not meet the feedback objective**.
State timing is about2s resolution and includes collection; do not label it pure
framework time. Actual full-Go unit journal was01:25:03→01:26:17 UTC.

Durable jobs:

- Go `6eb3c124ebe19ce8b18a32fd63063dabd5c1d09c3bc26fe12593a1d98e74c045`
- Browser `d8ddcb50437ced2c5661e16a19faf4fadfb23364c342e41daf014e292366ce1d`
- Lab `1c58c3b5c0eca0b09a20cc34b877f6d49f49ef554dae47e22e42a84b961cb73b`
- ARM health `40879dcebab857f285b6ab0870feeebd8749899bcba676eda35c108d165e7b1e`

Private machine-local timing file: `/var/tmp/oh-expanded-capacity-timings.json`;
Go journal extraction `/var/tmp/oh-expanded-go-unit-timing.log`. Inputs/logs may be
subject to the current retention policy. Use existing failed-job artifacts to
understand failures, not another complete run merely to get their names.

## What is actually installed

- Cedar is Apple M5 Max,18 cores,128GiB RAM. Lima `hb-exec-p1` is **native ARM64
  via Apple vz**, not x86 emulation/Rosetta. Current reservation12CPU/32GiB.
- Shared job: CPUQuota1000%, MemoryMax24GiB, TasksMax2048. Root worker defaults
  GOMAXPROCS10, GOFLAGS-p8, browsers8, Cargo/Rayon/npm10. Still one slot.
- Fleetrepo commits `e51fe983` (capacity), `0e7955ca` (preserved previously deployed
  archive guards), `8eaaff19` (admission compressor ceiling32GiB instead of24),
  `99e4c37a` and `8e1e6c12` (records). Guest code receipt was0e7955ca.
- OH `55c50019` removes frontend hardcoded2-worker/p1 overrides, honoring the
  trusted guest budget. It does NOT make any checks local.
- Toolchain hash was unchanged:
  `27798935848f6d2d28d2a462ec612f3a0b9ccc3aab396c0457342da6b7a85d39`.
- An admission pilot limit blocked the queue despite healthy77%-free pressure
  and unchanged paging. Compressor bound is now32GiB; pressure, fresh paging,
  thermal, disk and loaded-model health/identity checks remain. Do not disable
  those checks wholesale or unload models. The old network_unknown journal
  entries were stale after strict host-key recovery, not the later real blocker.
- Planned VZ reboot changed its SSH hostkey. It was independently read through
  the trusted Cedar/Lima root channel before repinning the runner-only known_hosts.
  Never bypass StrictHostKeyChecking. Backend operator details/evidence belong in
  Fleetrepo `issues/orx-background-runner/capacity-upgrade-20261021.json`.

Other conductor records now say Jari chose **24h runner retention without archive**
(Fleetrepo @remarkably-psychotic-nail). Do not resurrect this session's older
no-expiry/archive premise or overwrite deployed retention guards. This does not
permit deleting pending/running/unknown inputs. Do not delete external archives
or other agent work as incidental cleanup.

## Delivered product fix, separate from the performance problem

Tmux compatibility @terminal-tmux34-field-separator is fixed and landed
(code `c861345b` / `3588e53b`, result in that issue). Real tmux3.4 terminal/workspace
race tests and contracts passed;3.6 native formatting probes and independent
identity-boundary review completed. Unsafe fields are blanked before framing;
never blindly decode escaped field text into workspace/user identities.
The fix was verified live in pilot.265, source17845cfb; later releases may exist.
Check watcher's **installed**, not just source, before a current-live claim.

## Owned runs / no silent background continuation

- `01m5dwx4trprqfhv1486vsnj13`: done, landed tmux fix.
- `01m5dxwbnwr18mmrt5fmjffb90`: cancelled, old2-worker verification.
- `01m5e0afdvsherkftb6bp5tx4r`: cancelled, expanded-capacity verification.
- Earlier Fleetrepo dedup `01m5cknggt5cb4w8z3hfja3nzs` and Rust gates
  `01m5cm3nvp4cs8xh5tsfmdr24h`: done and landed.

All five showed empty `preserved_work`; their recorded worktree directories no
longer existed when checked. No own background process or overnight fix worker
was running at handoff. Do not wait for these cancelled runs or claim a future
notification will fix anything. Start the new bounded work explicitly.

Own redundant queued Go retest `b7ed5b38aa787a800554d5992c62502de810233c95e3899be712bb6b720b1823`
was cancelled to stop consuming shared capacity. The ARM health had already
failed before that cancellation. During the capacity upgrade, CI job
`427101d4ddb4a285848119f1a87c17073f44a5d934feaba2b1df99f1a082c012`
was explicitly cancelled after a480s drain window; its inputs/logs were retained.
Do not call these test passes or silently retry other conductors' jobs.

## Execution bar for the next context

Deliver one real native `./scripts/test-web-fast.sh` early and time its exact
ordinary-command wall clock on the same checkout/dependencies. Compare against
~6s, not minutes. Include focused checks for dispatch: no job submission on that
path, no hidden heavy local fallback, no altered test assertions. Do not launch
four complete measurement suites or a review/report-only worker just to prove a
small routing fix. Then prove concurrent heavy throughput and warm setup only
with tests that distinguish the changed behavior. Keep tests/queue/transfer/setup
and total waiting separate, but **the user's total waiting time is the outcome**.

Workers merge locally; conductor pushes exact intended SHA and deploys relevant
changes. Fleetrepo backend and product source are separate repositories. Keep
main clean between logical commits, preserve other sessions' changes, and do not
claim finished until the ordinary workflow is measurably fast.
