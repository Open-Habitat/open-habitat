---
created: 2026-11-22
updated: 2026-11-22
type: bug
reporter: jari
status: cannot-reproduce
priority: normal
provenance: chat
source_ref: habitat:pi-current/2026-11-22-changes-missing
lane: unlaned
preparation: ready
closed: 2026-11-22
related: ['@rewind-tracks-all-changes', '@turn-changes-service-design']
---

# Muutokset cards missing in a conversation

## Description

A conversation appears to have no turn-change cards despite file edits. Investigate native tool-call shapes, script-based edits and turn-card rendering.

## Outcome

No rendering defect reproduced. Shell-script edits are outside the current tracker; the eligible native batch edit renders in the synthetic regression. See result.md for the evidence and the live-browser limitation.
