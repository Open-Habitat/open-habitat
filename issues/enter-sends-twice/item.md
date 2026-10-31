---
created: 2026-10-31
updated: 2026-10-31
type: bug
reporter: jari
status: open
priority: high
lane: send-path
lane_seq: 2
preparation: ready
---

# Enter sends twice: duplicate steer queued, and a delivered send shown as 'Tila muuttui' (Birch pilot.16)

## Description

Jari 31.10. ~11.46 local, Birch (still `0.1.0-pilot.16`; pilot.17 install
pending), conductor conversation `pi:467240ec-ccd8-41eb-a8f5-9c32ad6ddd80`
while its agent was working:

1. `attachments/hylatty-tila-muuttui.png`: after sending *Teetä siellä
   ensimmäiset verkkosivut ätlle.* the stream showed *Hylätty · teksti
   säilytettiin* and *Tila muuttui. Viestiä ei lähetetty. Tarkista
   keskustelun tila.* The message was in fact delivered: Pi's session has
   the user entry at 09:46:24.078Z, once.
2. `attachments/ohjaus-kahdesti.png`: one Enter on the next message (the
   bug report itself) queued it **twice** as *Ohjaus* under *Odottaa
   agenttia 2*. Pi's session got it once as a user entry at 09:46:57.953Z
   (check whether the second steer was also delivered).

`send-rejected-after-delivery` (1140b5b4, in pilot.17, not on Birch yet)
fixed one cause of (1): a repeated send with a spent command ID answered
409. (1) here may be that cause or another refusal (*Tila muuttui* = state
changed, e.g. a send racing the agent starting/ending a turn). (2) is a
double submission from one keypress on the steer path.

## Acceptance Criteria

- [ ] Cause of each named against main (and whether pilot.16 alone explains
      it); a browser spec for each that fails without the fix.
- [ ] One Enter never queues or sends twice; a delivered message is never
      shown as refused, on the send and the steer paths.

## Comments
