---
created: 2026-11-21
updated: 2026-11-21
type: bug
status: fixed
priority: normal
provenance: other
provenance_detail: observed by a worker running the focused web check
source_ref: taskfleet:01m7zbxs4sc2a2kmjkfb4dpxeh/observed:conversation-store-test-lint
originating_run: 01m7zbxs4sc2a2kmjkfb4dpxeh
originating_run_kind: spinoff
lane: gate-red
lane_seq: 2
preparation: ready
closed: 2026-11-21
---

# Fast web check lint fails on main: useLiteralKeys in conversationStore.test.tsx

## Description

`npx biome check --error-on-warnings .` in `web/` fails on `main` at
3f8ab4e8 with two `lint/complexity/useLiteralKeys` errors in
`web/src/app/conversationStore.test.tsx` (lines 1591 and 1886). The fast web
check (`scripts/test-focused.sh --area web`) therefore reports lint errors
for every worker, which hides new ones. Both are marked FIXABLE by biome.
