---
created: 2026-10-31
updated: 2026-10-31
type: bug
reporter: jari
status: open
priority: normal
lane: next-waiting
lane_seq: 1
preparation: ready
---

# Next-waiting queue: archiving the waiting ones leaves a stale round; Mac hints say Alt

## Description

## Description

Kaksi Jarin havaintoa 30.10. (testikone pilot.536, kokeellinen Jono, `next-waiting-queue`):

1. **Jono jää näkyviin, kun odottavat on arkistoitu.** Jari arkistoi kierroksen kaksi muuta keskustelua, jolloin jäljelle jäi vain lähtökeskustelu. Kentän yllä näkyy silti jono *2/2 hoidettu · ↑ Alt+↑ · Viestin lähetysongel… lähtö · ✓ Viide… · ✓ Teemme testejä. T… · Seuraava Alt+↓ · ✕*, vaikka hoidettavaa ei ole eikä arkistoituja voi enää avata. Kierros kai päättyy vasta ✕:llä (`web/src/components/NextWaitingQueue.tsx`).
2. **Näppäinvihjeet sanovat Macilla *Alt*.** Macissa näppäin on Option (⌥), joten *Käy läpi sinua odottavat (Alt+↓)* (`web/src/components/NextWaitingRow.tsx:41`) ja muut jonon Alt-vihjeet pitää näyttää Macilla muodossa ⌥↓ / ⌥↑, kuten editorin ⌘⌥K (`web/src/app/editor.ts:151`).

## Acceptance Criteria

- [ ] Arkistoitu (tai muuten pois kadonnut) keskustelu poistuu kierroksesta; kun hoidettavaa ei jää, kierros päättyy itsestään yhteenvetoon.
- [ ] Jonon kaikki näppäinvihjeet ovat Macilla ⌥-muodossa ja muualla Alt; selainspec molemmille.
