---
created: 2026-10-16
updated: 2026-10-16
type: improvement
reporter: jari
status: open
priority: high
lane: web
lane_seq: 3
collision: [web/src/app/, web/src/components/]
preparation: ready
---

# Refresh UI state without the serialized session reads; no model catalog on route entry

Step 1 of `issues/ui-responsiveness-review/analysis.md`, accepted by Jari 2026-10-16. After every write the browser runs four sequential round trips (write → `/auth/session` → snapshot → `/auth/session`) before the screen changes (`web/src/app/App.tsx` refresh effect), ~0.2 s each live. Fetch the snapshot directly; keep identity separation through `web_identity_id` and 401s; do the CSRF/session read in parallel or only on identity change. Take `loadPiModels` (Node catalog helper, ≥0.4 s) off workspace-route entry; reread it on settings saves and identity change only.

## Acceptance Criteria
- [ ] Lab: workspace hide at 200 ms latency drops from ~881 ms to ~450 ms or better (`issues/ui-responsiveness-review/measure-actions.mjs`); identity-change and 401 paths still tested.
