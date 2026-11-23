---
created: 2026-11-23
updated: 2026-11-23
type: improvement
reporter: jari
status: done
priority: normal
provenance: chat
source_ref: taskfleet:01m84cdwph8a9pqwrkbm6akyzk/rethink-agent-guide
originating_run: 01m84cdwph8a9pqwrkbm6akyzk
originating_run_kind: spinoff
preparation: ready
closed: 2026-11-23
closed_by: claude
---

# Rethink the agent guide injected into every Habitat conversation

## Description

The guide Open Habitat injects into every browser-started Pi conversation
(`internal/daemon/host-context.md`, with `helpers-context.md` and
`multiplayer-context.md` for conversation launches) has grown by accretion to
about 350 lines. Its reader is the person's own Pi agent, on whichever model
the person picked, and every line costs context in every conversation. Much of
it is phrased as rules and prohibitions without the reason behind them, and
operational detail is copied from command help and the agent skill.

Rewrite the three files with `/rethink-instructions`: say what the environment
is, what the agent could not know, what is at stake and where the detail
lives, and keep the exact interfaces the agent needs. The substance of the
rail `running` rule stays. Fact-checking is separate work afterwards.

Done when the rewrite is its own commit, the tests that pin the guide's
wording agree with it, and `result.md` says what the original protected, what
changed and where the maintainer's knowledge is needed.

## Resolution

### 2026-11-23T14:28:17Z · @claude

Rewritten in 5d854911c; result.md has the account and the open points for Jari.
