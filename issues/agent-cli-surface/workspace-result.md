# Partial delivery: workspace and destruction batch

Taskfleet run `01m5f054b9ns4k81j5xxe7m971`; the issue stays open.

This batch exposes native workspace observations with source/per-workspace
freshness tokens, create/display/visibility operations, GitHub repository
catalog/lookup/local-checkout observations, existing daemon clone jobs and their
explicit cancel/restart/dismiss/interrupted-removal operations, Git worktree
listing and single/bulk cleanup, workspace deletion checks and Trash lifecycle.
Unreadable presentation annotations retain native discovery with explicit unknown
visibility. The agent skill records the workflows and the reasons native git/gh/tmux/
Taskfleet operations are not wrapped.

The agent table is default-deny and kernel own-UID only. New adapters select an
explicit path and peer predicate on the shared operation handlers, not the
browser mux; they never change the browser trust predicate or reach gateway or
broker operations. Clone routes use the same live CloneJobs instance as the
browser, not a new job registry. Existing native checks, writer locks,
observation/listing tokens and typed force/permanent-delete confirmations are
unchanged. Workspace settings and visibility are separate selective updates.
No credential input, new socket, Fleetrepo change or persistent store is added.

Writes are never automatically retried. Unsupported dry-run is explicit rather
than pretending to reserve native safety state. Partial/blocked mutations exit
nonzero and retain their complete native result in `error.result`. Clone
creation returns a job ID and show/list observes native progress. List file
exports refuse overwrite and preserve source/listing observations, completeness
and interrupted destinations. Contracts add the workspace observation fields;
Go and TypeScript bindings and the example are regenerated together. There is no
browser behavior change.

## Remaining

- Integration and credential configuration with secrets only from stdin/file,
  redacted replies and logs.
- Native history discovery/export, receipts, processes, attachments and
  browser-local file requests.
- Whole-surface canon completion, including the existing retry/progress limits
  retained by this batch. `CONFORMANCE.md` does not claim a full pass.
- Live acceptance after deployment of these bytes. No installed-host or provider
  behavior is claimed from synthetic tests. No Fleetrepo change is needed.

## Verification

Tested runnable code: `bf2b70017419de9623bc728bfa345a345b0ec47e`; the following evidence-only commit
changes no runnable inputs.

All native fixture commands use `umask 077` and disk-backed `TMPDIR=/var/tmp`.
No full gate, installed binary change, Fleetrepo edit or live operation was run.

The initial full affected `-race -count=1` run passed in **108 s** (CLI 8.783 s,
daemon 90.132 s, transport 2.212 s). Initial distinct-UID socket/activation/broker
checks passed in **111 s**, including root/gateway/other-user denial on every new
path even with permissive socket modes. These were rerun after review fixes;
final evidence follows below. The contract example was updated alongside the
new required observation fields; 60 schemas, 61 fixtures, 39 scenarios and 17
negative checks pass. The fast web suite passed (bindings-only web change).

Native socket tests use browser trust set false. They prove stale source/workspace
observations refuse writes, typed Trash and forced-worktree deletion still need
exact names, changed native worktrees and merged listings are refused, native
clone success/failure is observed without leaked stderr/credential URLs, corrupt
annotation state does not erase native workspace discovery, and unauthorized
peers cannot read native state. Existing native deletion, ownership, writer and
worktree tests run with the affected package suite rather than being reimplemented.

`project-canon review --profile cli --run <worktree-local binary> --json .`
completed as an advisory; scoped canon-v4 judgment is in `CONFORMANCE.md`. The
probe repeats its documented data-envelope/doctor-positional/Rust-layout false
positives. Retry and progress gaps remain explicitly partial, not a full pass.
`issuectl doctor --json`, `python3 scripts/validate-project-view.py` and
`git diff --check` also pass.

Final repaired-tree checks:

- `go test -race -count=1 ./internal/cli ./internal/daemon ./internal/transport`:
  pass (CLI **8.286 s**, daemon **81.586 s**, transport **2.084 s**).
- `./scripts/test-agent-uids.sh`: pass, **95 s** total, real distinct kernel UIDs
  in the disposable networkless container; no installed-host/provider claim.
- Verbose focused `-race -count=1` regression run: pass, **2 s** total,
  no skips for any new parser/socket/native clone/worktree/annotation regression.
- `./scripts/test-focused.sh --area contracts`: pass, generated bindings clean;
  **60 schemas, 61 fixtures, 39 scenarios, 17 negative checks**.
- `./scripts/test-web-fast.sh`: pass. There is no browser behavior change, so no
  Playwright run; this proves static/unit/component checks, not a browser journey.
- Combined Go/contracts/web process: **116 s** total; final CLI/artifact check
  after the bundled workflow update and the advisory canon probe also pass.

Logs: `/var/tmp/oh-workspace-reviewed-{packages,uids,regressions,contracts,web}.log`,
`/var/tmp/oh-workspace-final-artifacts.log`, `/var/tmp/oh-workspace-canon-final.json`.

## Independent security review and assessment

`/llm-review` critical scope, finder `claude-fable-5-1`: no own-UID/security bypass;
three concrete reply/availability findings were confirmed locally and repaired:

1. Permanent workspace deletion can keep the moved directory in Trash after its
   final safety recheck, returning `state: trashed` plus `kept_reason`. The CLI now
   exits nonzero and retains the full result, rather than implying permanent removal.
2. Native clone cancellation can reply with a still-running job after its bounded
   wait, or with a cancelled job whose destination was kept. `clone stop` now
   reports those outcomes incomplete; a running `clone create` remains successful
   job admission. Show/list remain valid observations even when a job failed.
3. A corrupt presentation annotation file previously made the new workspace list
   fail entirely. Discovery and native tokens now remain available, explicitly
   reporting `annotation_state: unreadable` and `hidden: null`. The loader/writes
   still refuse corrupt annotations; no unknown visibility is invented as false.

Assessment: all three **CONFIRMED / OCCASIONAL / NEUTRAL / HIGH**; F1/F2
architecture NONE, F3 MINOR; **FIX**, applied with focused regression tests.
No residual issue filed. Finder/verifier/assessment scratch lives under
`history/`; this document carries the substantive evidence independently.

## Tool/sub-workflow inventory

Recovered development failures: the first daemon subset lacked installed
checkout-local Pi fixture dependencies and restrictive umask; installed them
and reran correctly. The first new socket tests retained the fixture's production
socket path rather than the synthetic paired daemon path; repaired the test
configuration. The first contract check caught the old example missing the new
required fields; updated it and reran. The finder independently hit the same
umask/TMPDIR prerequisite and passed with a private scratch directory. Exploratory
lookups used a nonexistent contracts fixture directory and tried to read the
canon report through a nonexistent `data` envelope; corrected the paths/shape.
These are recovered fixture/read-only lookup failures, not unfinished product
checks. Logs are `/var/tmp/oh-workspace-{first,focused,contracts}.log` and
`/var/tmp/oh-workspace-finder.log`.


Independent verifier `gpt-6-astra` inspected the repaired final diff and ran the
focused regressions. All three original findings are repaired, with no remaining
adapter bypass or credential/native-error leak found. It specifically checked
that unreadable annotations still block the existing last-visible-workspace
safety check; degraded observation does not grant destructive authority.
Its direct distinct-UID test skipped without the container fixture; the local
`./scripts/test-agent-uids.sh` ran successfully on the repaired tree in **95 s**.

Optional model-performance corpus logging failed once: helper exit 3, SSH exit
255 (`alder: Permission denied (publickey,password)`). No configuration change,
alternate corpus write or retry was attempted; product review, assessment and
testing do not depend on that optional delivery. Log:
`/var/tmp/oh-workspace-model-perf.log`. This is disclosed in the terminal report.
