---
created: 2026-11-22
updated: 2026-11-22
type: bug
reporter: jari
status: open
priority: normal
related: ['@upgrade-preview-counts-history-as-active']
lane: release-runtime
lane_seq: 4
preparation: ready
---

# Upgrade preview does not see background work behind an idle conversation

## Problem

The upgrade's busy observation (fixed 22.11.2026 in `upgrade-preview-counts-history-as-active`) counts only daemon controller turns. Its review confirmed blind spots that predate the fix: work that continues in a conversation after its turn has ended or behind an idle controller state is invisible — a command the person ran from the browser through the conversation, Pi background processes the agent started (preview servers, long test runs), Habitat's own small jobs (title naming, settle window), handle-less title work, and controllers whose workspace cannot be resolved. An unattended upgrade can therefore cut such work without warning.

## Expected

The preview sees this work and waits for a quiet window (or names it in the plan), staying fail-closed for anything unknown; Taskfleet workers and terminal Pi outside the daemon remain out of scope because the upgrade does not stop them.

## Decisions

- Jari 22.11.2026: take it up now.
