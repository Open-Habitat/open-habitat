---
created: 2026-11-09
updated: 2026-11-09
type: improvement
reporter: jari
status: done
priority: normal
lane: unlaned
preparation: ready
closed: 2026-11-09
---

# Rail row's worker ball pulses inside the branch icon, not as a dot past the row edge

## Description

Jari 9.11.2026, test server (screenshot `evidence/`): in the left rail, a
conversation with a working worker shows the branch icon and, after it, the
pulsing worker ball (`worker-badges-pallot`), which sits on and past the
row's rounded right edge. Jari wants the ball inside the branch icon itself:
the branch glyph is the worker mark and the ball pulses in it (for example
in the glyph's node or end point), so the worker's activity has its own
image and nothing protrudes. This was offered in a worker-badge prototype
and the separate dot was chosen then; Jari now asks for this exact change,
so no new prototype.

Keep the agreed vocabulary of `worker-badges-pallot` (working pulses, your
turn yellow, done green, unfinished red; waited-on ring) inside the icon,
the rail-mark hiding under hover actions (`rail-worker-mark-under-hover-actions`),
the accessible description, and reduced motion (no pulse). Several workers
in different states: say how the icon shows them (decide; record it).

## Acceptance Criteria

- [x] The rail row shows one branch icon whose ball carries the worker state and pulses while working; nothing passes the row edge at 1440 and 390, light and dark.
- [x] Explain-mode card updated; worker-badge and rail specs green; before/after screenshots.
