---
created: 2026-10-20
updated: 2026-10-20
type: improvement
reporter: jari
status: open
priority: normal
lane: web-chrome
lane_seq: 1
collision: [web/index]
---

# No favicon; console noise on a fresh load

_Source: chat:jari-test-2026-10-20b_

## Description

Jari 2026-10-20: the app needs a favicon (from the design-system mark; Jari wants it for prototyping too, so prototypes get it as well). On a fresh load the console shows favicon.ico 404, Ajv warnings 'unknown format "date-time"/"uuid" ignored in schema' (add ajv-formats or register the formats), and [reconnect] debug logs (gate them behind a debug flag). Clean console on load.
