---
created: 2026-10-20
updated: 2026-10-20
type: improvement
reporter: jari
status: open
priority: normal
lane: composer
lane_seq: 3
collision: [web/src/components/composer]
---

# / command list: show only commands that make sense in the browser; fix the chip's left-edge shading

_Source: chat:jari-test-2026-10-20b_

## Description

Jari 2026-10-20: the / list contains Pi's own built-in commands and their options; are they all meaningful through the web UI? Go through what the list shows (Pi built-ins, skills, prompt templates, extensions) and decide per command whether it works and is useful from the browser composer; hide or mark the rest (some already show 'vain Pi:n päätteessä'). Also the chip after a command name has a dark shade on its left edge that looks like a parenthesis and is not visually pleasing; restyle. Record the per-command decision table in the issue.
