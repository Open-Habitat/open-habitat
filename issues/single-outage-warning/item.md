---
created: 2026-10-15
updated: 2026-10-18
type: bug
reporter: jari
status: fixed
priority: high
lane: reauth
lane_seq: 11
collision: [web/src/app/, web/src/components/]
preparation: ready
closed: 2026-10-15
---

# One connection warning, and the send button aligned to the field

Jari, 2026-10-15, on the screenshot in `issues/pi-not-answering-live/`: the
view shows two warnings in different places, "Yhteys katkesi. Näytetään
viimeisin tunnettu tila." above the composer and "Odota vahvistettua
joutotilaa; epävarmaa viestiä ei lähetetä uudelleen." under the field. "Se on
sekavaa ja järjetöntä että on kaksi." The line under the field also pushes the
send button down, so it is no longer aligned with the field.

`conversation-stuck-reauth` claimed to fix a duplicated warning and the send
button placement (anchored to the editor rectangle); this is either a
regression or a state that fix did not cover (disconnected while a turn was
believed running, composer in steer mode).

## Acceptance Criteria

- [x] In every outage/uncertain state the person sees one warning that says
      what happened and what they can do; the composer carries at most the
      disabled reason for its own button, not a second account of the outage.
- [x] The send button stays aligned with the field's editor rectangle whatever
      text appears under the field (browser test with geometry, as in
      `resilience-states.spec.ts`).
- [x] Lab screenshots of the disconnected-while-working state before and after.
