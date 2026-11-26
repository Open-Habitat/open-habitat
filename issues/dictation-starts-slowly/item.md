---
created: 2026-11-26
updated: 2026-11-26
type: bug
reporter: jari
status: open
priority: normal
lane: unlaned
preparation: ready
---

# Dictation starts slowly and loses the first word

## Observed (Jari 26.11.2026, v0.1.8)

Starting dictation sometimes has a long delay before it listens, and the first word is lost.
It should start snappily: what the person says right after pressing the button must end up
in the text.

## Done when

- Audio capture starts at the press, before the speech service connection (token fetch,
  WebSocket open, service handshake) is ready; captured audio is buffered and sent once the
  connection is up, so the first word is not lost even when the connection is slow.
- The cause of the long delay is found and measured (microphone permission/getUserMedia,
  AudioWorklet start, token request to the daemon, WebSocket connect, the service's first
  response), with the slowest step removed or overlapped (e.g. pre-warming a token or the
  audio graph when the composer gets focus, if that is cheap and safe).
- The button shows "listening" as soon as audio is being captured, not only when the service
  answers.
- Tests cover buffered audio reaching the service after a delayed connect.

## Resolution

### 2026-11-26T05:42:07Z · @issuectl

Implemented; see result.md.

## Reopen Notes — 2026-11-26

_Add rationale for reopening here._

## Decisions

### 2026-11-26T05:49:08Z · @jari

Jari 26.11.2026: activation must be as fast as possible; this is very important for usability. Next action (approved): measure press-to-capturing on real browsers and remove every avoidable step; report the remaining floor and what only a product decision could remove (e.g. keeping the microphone open).
