# Result

Foreground bash waits now reach the worker badge and panel, including `cd … && taskfleet run wait $(tr '\n' ' ' < active.txt) --any --output json 2>&1 | grep … | head -4`.

The shell grammar was not the defect: the exact pipeline passed the existing live-argv scanner. The missing path was foreground bash, which has no pi-processes background record. A new regression first showed the scanner finding the expanded ID while the companion inventory lost it. The companion now observes this Pi's own descendants while a bash tool executes, excluding managed background roots (their wake policy stays separate). It sends validated foreground run IDs through the existing process inventory. The browser marks matching live workers without inventing a background row or stop target. No host-wide process scan, new authority, persistent store or shell execution was added.

## Evidence

Base fb1c9c0dbff9c15eb8b836eeb550e42b0380f9da plus this issue's diff; Birch, Go under umask 077. Logs in `/var/tmp/oh-badgewait.PzfWBx/`.

- Installed locked web/Pi fixture dependencies and a disposable uv environment from requirements-ci.txt.
- Node companion/reminder tests: 10 passed. Real bash parent, command substitution, compiled synthetic taskfleet child, grep/head pipeline; foreground transport, managed-root exclusion, ended tool, foreign UID refusal, malformed/oversized argv, bounded concurrency retry.
- `go test ./internal/daemon -run 'TestProcessInventory|TestTaskfleetWait' -count=1`: passed. Foreground IDs survive the socket boundary; malformed and oversized lists are rejected.
- `./scripts/test-focused.sh --area contracts`: passed (97 schemas, 154 fixture files, 43 scenarios).
- `./scripts/test-focused.sh --area go --go-package ./internal/daemon`: completed; only `TestAgentCommandPathIsPerHomeAndInherited` failed, reproducing on main 9c458c8de92a80b4bfb54eb3adf4a6b6b4855b1d. Already tracked in `agent-path-test-misses-core-tools`; no duplicate filed or foreign issue edited. Final log: go-final-with-python.log. An intermediate rerun omitted the venv PATH and failed schema checks; restored PATH and reran the whole package, removing those failures.
- `./scripts/test-focused.sh --area web`: passed, 193 files / 1449 tests; after rebasing onto main fbbdf15eedfb1065f880987583c58bbc72877bc4, passed again (194 files / 1460 tests).
- Named browser spec `worker-panel.spec.ts`: 2 passed with OH_PORT_BASE=12600 and OH_BROWSER_WORKERS=2, including accessibility and English. Existing journey now distinguishes foreground wait marking from a background wait's stop control. Passed again after rebase; only the shared KOKEILTAVAA insertion conflicted, and both sides' entries were retained.
- Independent llm-review (claude-fable-5-1 finder, gpt-6-astra verifier) and assess-findings: removed unnecessary global refresh hints on ordinary bash calls; replaced completion-sensitive revision dropping with one bounded rescan. Lifecycle regressions pass. Existing unsupported-name/unknown-scan limitation retained. Local review/assessment under history/review-worker-badge-pipeline.md and history/assessment-worker-badge-pipeline.{json,md}.

Evidence is synthetic native-process/socket and host-backed browser coverage, not installed-host acceptance or separate-kernel-UID qualification. No whole browser suite or clean gate. No visual redesign or new controls.

## Decisions for later review

- Foreground bash counts as the agent waiting because the tool result resumes that turn. Background processes retain their existing notification/wake policy. Alternative: treating every live descendant as waking would wrongly cover non-waking managed backgrounds.
- Add optional `foreground_run_ids` to the process inventory rather than fabricated controllable background records. Only run IDs cross the wire; no PID or raw argv. Existing agent stop remains the way to interrupt foreground work.
- Use the existing two-second inventory polling rather than invalidating the entire browser snapshot on every bash start/end. Very short waits can finish between polls; the reported multi-minute wait is observed without imposing traffic on ordinary commands.
- Unknown/incomplete scans claim no IDs. One retry tolerates a parallel tool completing during observation; repeated churn stays bounded. Unsupported named-worker argv remains unknown as before; this fix is for expanded explicit run IDs, not a new name-resolution mechanism.
