---
created: 2026-10-26
updated: 2026-10-26
type: feature
reporter: jari
status: done
priority: normal
lane: context-impl
lane_seq: 1
collision: [contracts/v1/]
preparation: ready
closed: 2026-10-26
---

# Context-use ring with percentage in the conversation top bar

## Description

Implement Jari's accepted 'Rengas' (proto-context-basic; prototype in issues/proto-context-basic/prototypes/context-basic): ring and percentage of the model's context window in the top bar beside model and thinking level, behaviour near the limit and after compaction, unknown state, phone. Read usage from Pi's and Claude Code's native session data through the daemon (the prototype's result.md lists which facts exist); no separate store.

## Acceptance Criteria

- [x] Indicator live for Pi and Claude Code conversations, after reload too; Go and browser tests; screenshots for Jari.

