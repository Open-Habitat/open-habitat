---
created: 2026-11-17
updated: 2026-11-17
type: bug
reporter: jari
status: open
priority: normal
provenance: chat
source_ref: chat:2026-11-17/turn-changes-only-latest-turn
lane: unlaned
lane_seq: 1
preparation: ready
---

# Changes block shows only under the latest reply, not after every turn that changed files

## Description

Jari 17.11.2026 (test server): the turn's 'Changes' block appears only under the bottom-most reply. It should appear after every turn in which the agent's work ended with file changes. The code renders TurnChangesSource per turn group, but reads the calls lazily when the turn comes near the viewport (useNear) and shows nothing when the read fails (catch → no card) or the read never starts. Likely causes: the lazy read never triggers for older turns (sentinel / near detection inside the scrolled timeline, history pages loaded later), the read fails for older entries (native_revision, blocks not readable, the file moved on), or the cache/key logic. A turn whose read fails silently gives no hint.
