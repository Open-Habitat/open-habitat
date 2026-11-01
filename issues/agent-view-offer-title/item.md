---
created: 2026-11-01
updated: 2026-11-01
type: improvement
reporter: jari
status: open
priority: normal
lane: agent-view-offer-title
lane_seq: 1
preparation: ready
---

# Agents give every offered view a descriptive title

Jari 1.11.: view cards show the file name (`raide.html`, `index.html`) because agents never pass `--title`. The agent guidance (`internal/daemon/host-context.md`, `internal/cli/agent/SKILL.md`, the command's help) should tell the agent to always give a short descriptive title in the person's language, e.g. *Viimeisimmät sivupalkissa – prototyyppi, kierros 2*, and the same for `file offer` if it has a title. Consider whether a missing title should default to the HTML document's `<title>` before the file name.
