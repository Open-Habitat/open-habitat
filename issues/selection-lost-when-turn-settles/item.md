---
created: 2026-10-28
updated: 2026-10-28
type: bug
status: untriaged
priority: normal
provenance: other
provenance_detail: worker lab observation
source_ref: taskfleet:01m608am2kbdwtcgffgwf7x9c4/settle-remount
originating_run: 01m608am2kbdwtcgffgwf7x9c4
originating_run_kind: spinoff
---

# A selection in an agent reply is lost when the turn settles

## Description

Observed in the lab (scenario `pi-deltas`, prompt "pitkä virta", 2026-10-28):
a mouse selection made in a live agent reply survives the stream, but is lost
the moment the turn settles.

When native history catches up, `BrowserConversation` drops the live timeline
item (`live-turn-<command>`, steps keyed by provisional live ids, text nodes
rendered as `<Markdown>`) and `timelineItems` renders the turn as the history
item `turn:<user entry_key>` with steps keyed `<entry_key>:<index>` and
rendered through `OrderedBlocks`. React therefore remounts the whole turn once.
Besides the selection, the remount resets any per-turn state (opened stages,
code-block view mode, Mermaid render) and may contribute to the visible jump
when a reply finishes.

Fix direction: give the running turn the same timeline id and step identities
before and after it is saved, so settling updates the turn in place.
