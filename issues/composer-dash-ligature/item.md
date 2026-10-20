---
created: 2026-10-20
updated: 2026-10-20
type: bug
reporter: jari
status: open
priority: normal
lane: composer
lane_seq: 4
collision: [web/src/components/composer]
---

# Typing -- in the composer renders as a different dash

_Source: chat:jari-test-2026-10-20b_

## Description

Jari 2026-10-20: writing a ! command with a long option (e.g. '!uv --version') the two hyphens visually turn into another dash in the composer field (font ligature or contextual alternates). Commands and code must show exactly what is typed: disable ligatures/contextual alternates in the composer and in command/code blocks (font-variant-ligatures: none; font-feature-settings), and verify nothing replaces characters on input.
