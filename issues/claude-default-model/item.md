---
created: 2026-10-20
updated: 2026-10-20
type: bug
reporter: jari
status: open
priority: normal
lane: models
lane_seq: 1
collision: [default-model]
---

# Signing in to Claude makes Fable the default model; Opus / medium is the better default

_Source: chat:ville-test-2026-10-20_

## Description

When Ville signed in to Claude (2026-10-20, pilot.237) his default model immediately became Fable. Jari: Opus with medium thinking is the better default for a newly signed-in Claude account. Find where the default is chosen on first provider sign-in (product or Pi's own default) and choose Opus 5.5 / medium when no default has been saved by the person; never override an explicit saved choice.
