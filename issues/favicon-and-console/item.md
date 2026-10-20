---
created: 2026-10-20
updated: 2026-10-20
type: improvement
reporter: jari
status: done
priority: normal
lane: web-chrome
lane_seq: 1
collision: [web/index]
closed: 2026-10-20
---

# No favicon; console noise on a fresh load

_Source: chat:jari-test-2026-10-20b_

## Description

Jari 2026-10-20: the app needs a favicon (from the design-system mark; Jari wants it for prototyping too, so prototypes get it as well). On a fresh load the console shows favicon.ico 404, Ajv warnings 'unknown format "date-time"/"uuid" ignored in schema' (add ajv-formats or register the formats), and [reconnect] debug logs (gate them behind a debug flag). Clean console on load.

## Acceptance Criteria

- [x] Production HTML serves the design-system mark as its favicon.
- [x] Prototype builds embed the same favicon without external dependencies.
- [x] Fresh authenticated loads emit no console messages; schema formats are registered.
- [x] Reconnect diagnostics are silent by default and explicitly opt-in per tab.

## Result

See [verification and review](result.md).
