---
created: 2026-11-15
updated: 2026-11-15
type: improvement
reporter: jari
status: done
priority: normal
provenance: chat
source_ref: chat:2026-11-15/trash-item-delete
lane: unlaned
lane_seq: 1
preparation: ready
closed: 2026-11-15
---

# Deleting one Trash item needs typing its name; make it a simple confirmation

## Description

Jari 15.11.2026: in Settings › Storage, permanently deleting a single folder from the Trash is exceedingly hard: it asks the person to type the item's name to confirm (`web/src/text/trash.tsx` `typeToConfirm`, error `confirmation_mismatch`), while emptying the whole Trash is a simple button. Deleting one item should be a click-click confirmation too.

## Acceptance Criteria

- [x] Single-item deletion shows name, size and irreversible warning, without typing.
- [x] Daemon deletion stays bound to the confirmed Trash identity and refuses a changed listing.
- [x] Emptying still works; daemon, browser, CLI and web regressions pass.
- [x] Explain mode and generated UI/agent references describe the new flow.
