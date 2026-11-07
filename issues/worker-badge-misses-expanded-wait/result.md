# Result

The worker badge and panel now receive the same live expanded wait IDs that the reminder recognizes. The companion shares its static-first/live-argv resolver between the reminder and process inventory; the daemon validates those IDs and retains them through its existing browser response. No badge styling, catalog, browser contract or authority change.

## Evidence

Tested base b5befbe4e40fbec0f43b098a69b7bcd7a2e6fd36 plus this issue's diff on Birch, umask 077, scratch `/var/tmp/oh-badge.ovvqVD` (logs `/var/tmp/oh-r65-badge`).

- Installed locked web and Pi fixture dependencies; disposable uv venv for requirements-ci.txt.
- Node companion/reminder tests: 8 passed. The existing real-shell/native-child expansion regression now checks inventory IDs too: only the expanded run is covered, exited/unreadable expansions remain empty, and literal waits still work. Companion socket test checks ID transport.
- `./scripts/test-focused.sh --area go --go-package ./internal/daemon`: passed (383 s). New socket-boundary regression checks expanded IDs survive into process/waiting inventory and rejects malformed/oversized IDs.
- `./scripts/test-focused.sh --area web`: static/type checks and 179 test files, 1351 tests passed.
- Focused browser: spinoffs.spec.ts 5 passed; worker-panel.spec.ts 2 passed (including accessibility and English coverage), OH_PORT_BASE=16200 and OH_BROWSER_WORKERS=2. First invocation repeated --spec and selected only the last spec; ran worker-panel separately to complete the intended coverage.
- `issuectl doctor --json`, `python3 scripts/validate-project-view.py`, and `git diff --check`: passed (doctor reports existing non-error attachment listings).
- Independent llm-review: claude-fable-5-1 finder and gpt-6-astra verifier. Assessment dropped two low candidates: missing optional metadata does not lose the ID-based wait badge, and theoretical traversal-budget contention was not a demonstrated regression. No unresolved actionable finding. Local review/assessment: history/review-worker-badge-expanded-wait.md and history/assessment-worker-badge-expanded-wait.{json,md}.

These are synthetic native-process/socket and host-backed browser checks, not installed-host acceptance. No whole browser suite or clean gate run. No visual changes or new screenshots. Product commits are not pushed.

## Decisions for later review

- Unknown live-argv observations yield no invented run IDs; they do not mark every worker as waited merely because the reminder conservatively stays silent. Only positively identified runs gain the wait badge. The alternative would incorrectly mark unrelated workers.
- Expanded waits are observed only while live. Ended processes cannot reconstruct vanished argv, and no parallel process-history cache was added. Literal commands remain recognizable after exit as before.
- Bound the whole inventory's live scans (200 ms before starting another bounded scan), retain the existing 200-ID wire limit, and leave optional Taskfleet metadata enrichment separate. The alternative of dropping IDs above its 20-run enrichment limit would falsely remove valid wait marks.
