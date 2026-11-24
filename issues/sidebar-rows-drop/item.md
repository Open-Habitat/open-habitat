---
created: 2026-11-24
updated: 2026-11-24
type: improvement
reporter: jari
status: open
priority: normal
lane: unlaned
preparation: ready
---

# Sidebar rows: drop the workspace name, the icon identifies it

## Observed (Jari 24.11.2026, v0.1.7)

In the sidebar's conversation rows (Sinun vuorosi etc.), each row shows the workspace
icon, the conversation title, the workspace's name in monospace, and the age. The
workspace name is unnecessary: the icon already identifies the repository, and the name
takes space from the title, which gets truncated.

## Done when

- Rail rows no longer show the workspace name next to the title; the icon identifies the
  workspace, and the title gets the space.
- The workspace stays discoverable where it matters: the row's accessible name and
  tooltip still name the workspace, and a workspace without a chosen icon still has a
  distinguishable default (check what the icon fallback is; if two workspaces can look
  identical, say so in result.md and choose a sensible fallback).
- Phone layout and Explain mode texts follow; touched browser specs and UI references
  updated.
