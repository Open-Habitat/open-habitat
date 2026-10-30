---
created: 2026-10-30
updated: 2026-10-30
type: bug
reporter: jari
status: open
priority: normal
lane: speech-input
lane_seq: 22
preparation: ready
---

# Dictation writes at the cursor; shortcut is ⌘ + the key below Esc on any layout

## Description


## Description

Jari 30.10. (pilot.522–523):

- **Sanelu kirjoittaa kentän loppuun**, ei kohtaan, jossa kursori on.
  Sanelun pitää kirjoittaa kursorin kohdalle (tai valinnan tilalle), koska
  tekstiä voi haluta puhua muuallekin kuin loppuun.
- **Pikanäppäin on ⌘ + näppäimistön vasemmanpuoleisin näppäin Escin
  alapuolella**, millä tahansa näppäimistöllä: suomalaisella se on §, muilla
  mikä se siinä kohdassa onkin (esim. ` ANSI-näppäimistöllä). Nykyinen
  toteutus (`dictation-shortcut-cmd-section`) tunnistaa merkin § ja antaa
  ANSI-Maceille ⌘⇧Space.

## Acceptance Criteria

- [ ] Sanelu lisää tekstin kursorin kohdalle tai korvaa valinnan, ja kursori
      jää lisätyn tekstin perään; väliaikainen teksti näkyy samassa kohdassa.
- [ ] Pikanäppäin tunnistetaan fyysisestä paikasta (Escin alla) kaikilla
      asetteluilla, Chromen Mac-ISO-koodivaihto huomioiden; jos käyttöjärjestelmä
      vie yhdistelmän jollain asettelulla (macOS ⌘+` ikkunanvaihto ANSI:lla), se
      kerrotaan result.md:ssä ja vihje näyttää toimivan vaihtoehdon.
- [ ] Yksikkötestit ja speech-input.spec.
