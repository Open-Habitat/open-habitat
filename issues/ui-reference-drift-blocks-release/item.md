---
created: 2026-11-01
updated: 2026-11-01
type: bug
reporter: conductor
status: fixed
priority: high
lane: ui-reference-drift-blocks-release
lane_seq: 1
preparation: ready
closed: 2026-11-01
---

# UI reference drift blocks test releases; workers never see the check

The test-release watcher refused `2ce028dd` at prepare (1.11.): the
packager's `scripts/generate-ui-reference.py --check` (added by
`agent-knows-habitat-ui`) found the UI reference stale for
`app--WorkspaceEditor.tsx.md` and `components--BrowserEditor.tsx.md`,
because `editor-header-one-row` changed editor UI text in parallel and its
worker never ran the check. The check works; workers just do not meet it:
it runs only in the full clean gate and in packaging, which workers do not
run.

1. Regenerate the reference on current main so test releases flow again.
2. Make the drift visible where workers look: run the check in
   `scripts/test-focused.sh --area web` (and wherever the fast web checks
   run), with a message naming the one command that fixes it, and say in
   `web/AGENTS.md` that UI text changes regenerate the reference.
