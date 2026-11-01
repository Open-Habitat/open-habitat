---
created: 2026-11-01
updated: 2026-11-01
type: bug
reporter: conductor
status: fixed
priority: high
lane: ui-reference-drift-blocks-release
lane_seq: 2
related: ['@agent-knows-habitat-ui']
preparation: ready
closed: 2026-11-01
---

# UI reference drift blocks test releases again; generate it at build

The test-release watcher refused `6f4c040d` at prepare again (1.11.): the
UI reference was stale for `app--settingsIndex.ts.md`,
`text--settingsIndex.ts.md` and `text--viewLinks.ts.md`. The view-address
worker branched before `ui-reference-drift-blocks-release` added the check
to the fast web checks, so it never saw it. Any parallel worker that changes
UI text can block test releases this way, and only a new commit unblocks
them.

Regenerate the reference on current main now. Then remove the failure mode:
the reference is generated output of the same source the release builds, so
the release can generate it while packaging (and the gate can check the
generator still runs) instead of committing a copy that must be kept in step
by hand. Decide between generating at build/package time (no committed
copy) and keeping the committed copy with an automatic regeneration step;
record the choice under "Decisions for later review".
