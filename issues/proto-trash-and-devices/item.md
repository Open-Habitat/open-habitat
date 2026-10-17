---
created: 2026-10-16
updated: 2026-10-16
type: task
reporter: conductor
status: done
priority: normal
lane: unlaned
collision: [design-system/prototypes/rounds/proto-trash-and-devices]
closed: 2026-10-16
---

# Prototype: workspace Trash view; phone sign-in QR and session list

## Description

Two prototype rounds for features accepted at the architecture level whose views are not
yet designed: workspace deletion and the Trash (ADR 0019 with Jari's amendment in
`implement-workspace-trash`) in `design-system/prototypes/rounds/2026-10-17-roskakori/`, and
phone sign-in by QR with the session list (ADR 0018) in
`design-system/prototypes/rounds/2026-10-17-laitteet/`. Each shows three directions on one
named axis for Jari to choose from; `result.md` records them.

## Decisions

Jari, 2026-10-17 ~07.05, round `2026-10-17-laitteet`:
1. **Laitteet-osio** (direction 2).
2. Far less text throughout. The QR dialog (qr-liikaa-tekstia.avif) does not explain what happens or warn ("ei tarvitse kertoa mitä tapahtuu eikä varoitella"): title, code, expiry and Peruuta are enough. The entry card (kortti-liikaa-tekstia.avif) likewise: a title and the button, at most a few words.
3. The phone's "Kirjauduttu" page (kirjauduttu-siirtyy.avif) disappears after a moment and moves on to the phone's home view on its own; no explanatory text.
Roskakori round: not yet chosen.

Jari, 2026-10-17 ~07.20, round `2026-10-17-roskakori`:
1. **Tallennustilassa** (direction 3): the Trash lives in Asetukset › Tallennustila beside the quota bar. Discoverability (conductor's proposal, accepted): the Palauta notice after a move says "Löytyy: Asetukset › Tallennustila" as a link, and the delete dialog names the place in a word.
2. Git-ignored files simply go: they never move a clean, fully pushed repo to the Trash.
3. Fetch before a permanent delete: yes. If the fetch fails, the workspace goes to the Trash instead.
4. A clean, fully pushed repo is deleted permanently, with no "Siirrä silti roskakoriin" option.
5. "Tyhjennä roskakori" in Tallennustila, with confirmation.
