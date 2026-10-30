---
created: 2026-10-30
updated: 2026-10-30
type: improvement
reporter: jari
status: open
priority: normal
lane: speech-input
lane_seq: 21
preparation: ready
---

# Dictation shortcut ⌘+§ instead of ⌘⇧Space

## Description


## Description

Jari 30.10. (pilot.522): "Olisiko ⌘+§ mahdollinen? Toi ⌘⇧Välilyönti on
hankala." `dictation-fast-start-keys` valitsi sanelun pikanäppäimeksi
⌘⇧Space / Ctrl+Shift+Space.

## Acceptance Criteria

- [ ] ⌘+§ (Mac) käynnistää ja lopettaa sanelun samoin kuin nykyinen
      pikanäppäin; muilla järjestelmillä vastaava (Ctrl+§ tai paras
      perusteltu vaihtoehto, kun §-näppäintä ei ole).
- [ ] Tunnistus toimii suomalaisella ISO-näppäimistöllä Macissa ja PC:llä
      (`event.key` ja `event.code`, Chromen Mac-ISO-vaihto
      `Backquote`/`IntlBackslash` huomioiden), ei törmää macOS:n
      ikkunanvaihtoon (⌘+< / ⌘+`).
- [ ] Vihje ja `aria-keyshortcuts` päivitetty; selainspec.
