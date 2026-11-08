---
created: 2026-11-08
updated: 2026-11-08
type: bug
reporter: jari
status: open
priority: high
lane: unlaned
preparation: ready
---

# Message sent across a test-server restart stays 'uncertain' with three notices although it arrived

## Description

Jari 8.11.2026 19:30, test server, during the restart that installed
pilot.648 (e415be007): he was writing or sending *Päällä ovat.* when the
services restarted (`evidence/jari-2026-11-08-uncertain.png`). Afterwards the
conversation shows, at once:

- his message as a delivered *SINÄ* bubble, and the agent working on it
  (*Agentti työskentelee · Vastaa 0:08*),
- the same text again as a dashed (uncertain) bubble below,
- *? Ei tiedossa, vastaanottiko agentti viestin. Viestiä ei lähetetä
  uudelleen automaattisesti.* with *Kopioi teksti*,
- the lone *Tarkista keskustelun tila* button,
- a card *Aiemman pyynnön tulos epävarma · Alkuperäisen viestin kuittaus ei
  vahvista tulosta. Viestiä ei lähetetä uudelleen.*

So the send was uncertain across the restart, but history proves it arrived
and the agent is answering; the uncertain state is never reconciled with the
history, and three overlapping notices say the same thing. Every push
restarts the test server while Jari tests (AGENTS-WORKFLOW), so this recurs.

Fix: when history (or the live stream) shows the user message, resolve the
uncertain send as delivered and remove the dashed bubble and all three
notices; when it is truly unknown, show one notice (the shared
`WarningBanner`) with one clear action, not three. Reproduce with a browser
spec that restarts the synthetic host between send and acknowledgement.

Jari 19:33: reloading the page does not clear it, so the uncertain state is
persisted (browser storage or a host record), not only in memory; the fix must
reconcile the persisted record too.

## Acceptance Criteria

- [ ] A message that reached history after a restart shows once, delivered, with no uncertainty notices.
- [ ] A truly uncertain send shows one warning with one action.
- [ ] Touched specs green; `KOKEILTAVAA.md` line.
