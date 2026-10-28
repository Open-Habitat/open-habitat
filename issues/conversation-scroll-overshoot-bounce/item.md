---
created: 2026-10-28
updated: 2026-10-28
type: bug
reporter: jari
status: open
priority: normal
provenance: chat
source_ref: chat:2026-10-28/conversation-scroll-overshoot-bounce
lane: conversation-scroll
preparation: ready
---

# Conversation scroll overshoots its end, creeps back and then jumps

## Description

Jari 2026-10-28 (Birch ja Contoso, pilot.13): kun rullaan agentin keskustelunäkymää ylöspäin (tai alas) luonnollisen päätepisteen yli, näkymä menee yli, tulee hitaasti vähän takaisin kohti normaalia ja hetken päästä pomppaa normaaliin kohtaan. Samaa pomppimista on hetken, kun tekstikenttä kasvaa rivinvaihdon takia. Todennäköisesti oma scroll-ankkurointi tai 'pysy alhaalla' -logiikka taistelee selaimen omaa vieritystä ja overscrollia vastaan, ja kentän korkeuden muutos siirtää näkymää. Vieritys ei saa ylittää loppua eikä pomppia; kentän kasvu ei saa liikuttaa keskustelua nykivästi.

## Acceptance Criteria

- [ ] Ei ylitystä eikä viivästettyä hyppyä vieritettäessä loppuun asti; kentän kasvu ei pomputa näkymää; työpöytä (trackpad) ja puhelin
