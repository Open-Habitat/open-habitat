---
created: 2026-11-15
updated: 2026-11-15
type: feature
reporter: jari
status: done
priority: normal
provenance: chat
source_ref: chat:2026-11-15/switcher-search
lane: switcher-impl
lane_seq: 1
collision: [contracts/v1/]
preparation: ready
closed: 2026-11-15
---

# ⌘K switcher with full-text search across conversations

## Description

Jari 15.11.2026 accepted the ⌘K switcher: rounds 2 and 3 of
`proto-rail-keyboard-navigation` (`design-system/prototypes/rounds/2026-11-15-switcher-search/`
for the key, search engine research and jump-to-message;
`design-system/prototypes/rounds/2026-11-15-switcher-list/` direction
**1 Keskustelut** for the list). Real full-text search across the person's
agent conversations, backed by a rebuildable SQLite FTS5 index in the
person's own daemon (about 15 MB for two months of an active person's
history).
