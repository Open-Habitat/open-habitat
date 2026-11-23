---
created: 2026-11-23
updated: 2026-11-23
type: improvement
reporter: jari
status: done
priority: normal
provenance: chat
source_ref: taskfleet:01m84cm5ert5fas8f8ckddcd0b/brief
originating_run: 01m84cm5ert5fas8f8ckddcd0b
originating_run_kind: spinoff
closed: 2026-11-23
closed_by: claude
---

# Rethink the agent skill (internal/cli/agent/SKILL.md) for its reader

## Description

Jari asked on 23.11.2026 for the shipped agent skill to be rethought with /rethink-instructions. Its reader is the person's own Pi agent (any model, often not the strongest), which prints it with `open-habitat skill print agent` when it needs a host operation. The file had grown to 44 KB of per-command procedure, much of it repeating each subcommand's `--help` and restating the same retry and token rules section by section. Wanted: a version that tells the reader which capabilities exist, when each matters and what the help cannot say, at a fraction of the context cost. Rethink only; fact-checking follows separately.

## Resolution

### 2026-11-23T15:07:45Z · @claude

Rewritten in place; result.md carries the account and the points that need Jari.
