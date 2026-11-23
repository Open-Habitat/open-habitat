---
created: 2026-11-23
updated: 2026-11-23
type: improvement
reporter: jari
status: done
priority: normal
provenance: chat
source_ref: taskfleet:01m84cm6et0wv9gssez4eb9zj3/brief
originating_run: 01m84cm6et0wv9gssez4eb9zj3
originating_run_kind: spinoff
closed: 2026-11-23
closed_by: claude
---

# Rethink the server browser skill for the agent that reads it

## Description

Jari asked on 23.11.2026 for the agent instructions to be rethought with
`/rethink-instructions`. This item covers `internal/daemon/browser-skill/SKILL.md`,
the Pi skill for the experimental signed-in server browser
(`open-habitat skill print browser`).

The file had grown into a manual that repeats the CLI's own `--help` (command
list, limits, flags, return fields) and states its consent and credential
rules as emphasized prohibitions without their reasons. Every line costs the
reading agent's context. The rewrite should say what is at stake in the
person's signed-in browser, keep the traps the CLI help does not reveal, and
point to `--help` for operational detail.

## Resolution

### 2026-11-23T14:29:59Z · @claude

Skill rewritten; account in result.md.
