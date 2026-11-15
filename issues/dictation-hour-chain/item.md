---
created: 2026-11-15
updated: 2026-11-15
type: feature
reporter: jari
status: open
priority: normal
provenance: chat
source_ref: chat:2026-11-15/dictation-hour-chain
lane: dictation-impl
lane_seq: 1
collision: [web/src/app/dictation.ts]
preparation: ready
---

# Dictation up to an hour with chained sessions, audible warning, text kept

## Description

Jari 15.11.2026 accepted direction 2 **Tunnin ketju** of prototype round 1
(`design-system/prototypes/rounds/2026-11-15-dictation-limit/`, issue
`proto-dictation-limit`): Soniox sessions chained seamlessly at pauses every
10 minutes, one dictation up to one hour; in the last minute the timer shows
the time left with a warning above the field and a soft beep at one minute
and 10 s and at the limit (screen readers hear each once); at the limit the
text stays in the composer, a notice says the microphone is closed, and one
button *Jatka sanelua* continues after the text.
