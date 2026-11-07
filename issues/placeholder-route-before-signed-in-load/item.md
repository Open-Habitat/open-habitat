---
created: 2026-11-07
updated: 2026-11-07
type: bug
status: fixed
priority: normal
provenance: ci
source_ref: taskfleet:01m6v4fwchjk9y365ebg4cn7t6/gate:placeholder-route
originating_run: 01m6v4fwchjk9y365ebg4cn7t6
originating_run_kind: spinoff
closed: 2026-11-07
commits:
- hash: 6f59b532b
  summary: wait for the signed-in app before routing
---

# Placeholder spec routed creation while the signed-in page was still loading; the POST went out unheld (new-conversation-placeholder.spec.ts:127)

## Description

Observed in the conductor's clean gate on 2026-11-07 (`~/.local/state/oh-conductor/gate-r66b/stdout.json`): `tests/new-conversation-placeholder.spec.ts:127` timed out in `page.waitForResponse` for the creation POST. Passes alone.

Reproduced 3 times in about 550 runs of that case with `OH_CPU_THROTTLE=6` and 8 workers. With request/response listeners added right after `open()`, every failing run had no request events at all for the signed-in document (not even its `GET /api/v1/conversations`), `posts` stayed 0, and the creation completed unheld and navigated to the new conversation before the test released it; the trace shows the main frame was still loading `/workspaces` (the OAuth callback landing) when `open()` returned and the test installed its route. A route or listener added in that window missed the whole document's requests, so the POST it waited for had already been answered.

Fix: `open()` waits until the signed-in app shows the workspace's + button before the test routes anything. 0 failures in 288 runs at the same throttle after the change.
