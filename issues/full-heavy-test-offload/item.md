---
created: 2026-10-20
updated: 2026-10-21
type: task
status: open
priority: normal
provenance: chat
source_ref: taskfleet:01m5ce8pjvq2k8x4v2f1dvkdn8/request
originating_run: 01m5ce8pjvq2k8x4v2f1dvkdn8
originating_run_kind: spinoff
assignee: pi
lane: test-throughput
preparation: ready
---

# Restore fast Open Habitat test feedback

## Description

## Description

The maintained browser command and local CI entrypoint on Alder refuse full suites, lab and tags, and normal web/Go checks still run locally. Extend the shared runner consumer beyond the focused pilot: named repository tasks, ordinary commands, verified nonrecursive guest execution, real ARM test health separately attributed from native amd64 packaging, and explicit output exports. Requested by Jari through the Fleetrepo shared-runner parent; the earlier focused pilot is not this scope.

## Acceptance Criteria

- [x] Ordinary browser/lab/focused/tag, web checks, Go/contracts and CI health dispatch before heavy local setup on Alder, without fallback.
- [x] Cheap hermetic regression checks cover dispatch, failures and trusted guest identity; other native Linux hosts retain local execution.
- [ ] Full live ordinary/lab/gate proofs run after parent installs runner 0.2; actual application failures remain failures.

## Verification

Live acceptance depends on the parent's main-only shared runner upgrade. Installed version at worker start is 0.1.0; no upgrade is authorized here.

## Agent Runs

### 2026-10-20T14:53:44Z · @pi

Live expansion follow-through, not just the focused browser pilot: ordinary web build/typecheck, Go package compile, complete go test -race -count=1 ./..., release packaging and direct npx playwright test tests/theme.spec.ts now execute through the shared Cedar guest. Direct npx initially hit the owned-frontend parent guard; Fleetrepo 5e3aaa23 delegates it to the declared browser parent without loosening that guard, and the actual retry passed 3/3. Genuine linux-amd64 artifacts returned through protected writeback and executed on Alder.

The normal serialized deployment watcher then published pilot.250 (aaa7aab6) and .251 (53ff4459), both verified by pinned guest selector/binary and public 200/302 readback. Both are honestly over_limit versus 100s (800.271/856.601s including FIFO preparation), not latency acceptance or a new deployment path. Watcher dispatch PATH, private preparation logs and separate FIFO-aware budget are deployed; interruption ownership fixes have 378 passing operator fixtures. Active watcher resumed from durable next pilot 252.

No all-green product gate is claimed: earlier full ordinary browser 267 passed/10 failed/3 skipped; lab 58 passed/5 failed. Complete ordinary Go race run 34cc40210b516c84a7d52ae8d196428381e4871013f41650d85b26ed7d3bfb20 passed other packages but left five daemon terminal assertions red. The tmux3.4 raw-vs-literal separator incompatibility is separately filed as @terminal-tmux34-field-separator; do not waive those assertions or call ARM results native amd64 certification. Source failures, performance target and intake disposition stay explicit; this note does not close or triage the issue.

### 2026-10-21T02:14:09Z · @agent

Taskfleet 01m5e3jpkysjyj30jhd0avwr91 (first bounded task): restored native fast web, contracts and explicit-package Go paths; removed their remote task declarations. Alder single-run /usr/bin/time -p measurements after npm ci --prefix web: test-web-fast.sh 27.14 s (above the 6–20 s estimate, but seconds rather than queued minutes), focused contracts 0.67 s, focused gateway 9.41 s. Fast web executes JSON tool vectors directly and cannot reach browser-focused submission; hermetic dispatch checks confirm no placement or submission on fast paths, while heavy paths still submit. All six fast npm scripts passed with native npm; the still-installed Fleetrepo npm shim initially rejected the changed frontend catalog, so its routing update remains the parallel Fleetrepo worker’s responsibility. Existing hermetic script suite: 33 tests pass; project-view validator, shell syntax and diff checks pass. Focused self-review completed. Guest gate no longer forces serial phases or old 2CPU/3GiB defaults; it inherits trusted runner budgets. No full remote gate or throughput round run, no assertions changed; this issue stays open for heavy-throughput work.

## Decisions

### 2026-10-21T02:01:10Z · @pi

Jari2026-10-21: fix the execution SNAFU so tests run as fast as possible, not maximize offload. He is going to sleep and authorizes continuing implementation/testing/deployment without further generic check-ins. Primary conductor belongs in Open Habitat; Fleetrepo is the execution backend. Observed baseline: test-web-fast ~6s local vs2–5min remote even without queue, full gate ~5min local vs~8.5min remote, four–five workers saw11–43min per check. Required next action: restore native fast checks, remove shared-runner throughput bottlenecks for genuinely heavy work, avoid redundant full rounds, and demonstrate ordinary-command wall-clock performance. No approval was given to blindly restore all heavy execution to Alder or weaken assertions/isolation. Read throughput-handoff-20261021.md before work.

### 2026-10-21T02:20:28Z · @claude

Jari 2026-10-21: the goal is total test time. Before offloading, everything ran on Alder in under 120 s in total, heavy tests included; that is the target. Offload to Cedar only where it is actually faster; otherwise do not offload. Conductor: measured remote (browser ~355 s without queue, full gate ~8.5 min vs ~5 min native, plus the FIFO queue) is not faster, so Open Habitat tests return to native execution on Alder and the work continues by cutting the largest native time contributors toward under 120 s.
