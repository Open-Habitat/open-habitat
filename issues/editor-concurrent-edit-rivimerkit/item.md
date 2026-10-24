---
created: 2026-10-24
updated: 2026-10-24
type: improvement
reporter: jari
status: open
priority: normal
related: ['@proto-concurrent-file-edit']
preparation: ready
lane: unlaned
---

# Editor: concurrent agent edits with line marks and a typing pause

## Description

Implement the concurrent-edit design Jari chose on 2026-10-24: `proto-concurrent-file-edit` round 2, direction **Rivimerkit** with a two-second typing pause (result.md "Kierros 2", round source `design-system/prototypes/rounds/` concurrent-edit round 2, https://glasspad.example.test/p/oez2lhaom63slfc4wzcjti2axm/). Detect an on-disk change immediately (agent edit/write tool calls from the conversation, plus a version check on focus and before save); mark the incoming lines and show "Agentin N muutosta odottaa" with *Tuo nyt*; import after the pause and at the latest on Save; per-line conflicts *Sinun / Agentin / Molemmat*; Ctrl+Z undoes the import as one step; a visible conversation note with *Kerro agentille* when the saved file dropped agent changes; neutral "Tiedosto muuttui levyllä" when not from an agent tool. Three-way merge from a mature small library (round 2 recorded the candidate and its license). Replaces the interim guard from `editor-keep-own-drops-agent-changes`. The daemon's `base_version` rule stays.

## Acceptance Criteria

- [ ] Behaviour per round 2 in production; browser tests for pause import, save-time import, conflict choices, undo/redo of the import, the conversation note and the neutral wording; mobile layout; review: focused unless the daemon contract changes.
