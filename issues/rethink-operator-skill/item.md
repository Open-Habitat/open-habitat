---
created: 2026-11-23
updated: 2026-11-23
type: improvement
reporter: jari
status: done
priority: normal
provenance: chat
originating_run: 01m84cm5y2s3f1kk6xe89scnjq
originating_run_kind: spinoff
preparation: ready
closed: 2026-11-23
closed_by: claude
---

# Rethink the operator skill for its reader

## Description

Jari asked on 23.11.2026 for the agent instructions the product ships to be rethought with `/rethink-instructions`. This issue covers the operator skill, `internal/cli/operator/SKILL.md`, which `open-habitat skill print operator` prints and the release package carries as `operator/SKILL.md`.

Its reader is an administrator's agent operating an installation as root: host apply, upgrades, people and site keys. The file had grown into a dense compressed copy of the operator guide in which the purpose, the stakes and the few real limits were hard to find. The rewrite should say what the work is for and what is at stake, keep the knowledge the reader cannot get from `--help` or the site schema, and point to those sources instead of copying them.

Fact-checking the claims is separate, later work.

## Resolution

### 2026-11-23T14:27:31Z · @claude

Rewritten in place; result.md carries what changed and the open questions for Jari.
