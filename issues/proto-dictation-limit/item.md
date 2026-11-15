---
created: 2026-11-15
updated: 2026-11-15
type: feature
reporter: jari
status: open
priority: normal
provenance: chat
source_ref: chat:2026-11-15/dictation-limit
lane: dictation-limit-proto
lane_seq: 1
preparation: pending
---

# Dictation limit: warn before it, keep what was said after it

## Description

Reported by a pilot user (15.11.2026): dictation stops at 10 minutes. The
user did not notice and five minutes of explanation were lost. A warning
sound or similar was suggested.

Jari 15.11.2026: prototype first. Decide what the right dictation length
is, warn as the limit approaches, and when it is reached, what was said must
not be lost: it is offered as text in the composer.

Today: one dictation's ceiling is 600 s (`internal/daemon/speech_linux.go`
`SpeechMaxSessionSeconds`, Soniox ends the stream there; the browser warns at
`warnAtMs` one minute before and stops two seconds before,
`web/src/app/dictation.ts`).
