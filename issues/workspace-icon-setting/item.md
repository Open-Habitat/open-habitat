---
created: 2026-10-30
updated: 2026-10-30
type: feature
reporter: jari
status: open
priority: normal
lane: workspace-icons
lane_seq: 2
blocked_by: ['@workspace-icon-chain']
preparation: ready
---

# Set the workspace icon from its page header (Otsikko), committed silently

## Description


## Description

Jari 30.10. `proto-workspace-icon-setting`-prototyypistä
(`prototypes/kuvakkeen-asetus/`, result.md): suunta **Otsikko**. Työtilan
sivun otsikon kuvake on painike, joka avaa valitsimen (emoji, repon logo,
johdettu tunnus, kirjaimet); valinta kirjoitetaan `.open-habitat.yaml`-
tiedoston `icon`-kenttään ja **commitoidaan automaattisesti kyselemättä ja
siitä mitään sanomatta** (vain tämä tiedosto, ei pushia). Otsikon alla lukee,
mistä kuvake tulee. Litteä `icon`-muoto (emoji | kuvan polku | 1–3 kirjainta)
kelpaa myös käsin kirjoitettavaksi. Mallin tuottamat ehdotukset otsikon alle
tulevat erikseen kierroksen 2 prototyypin jälkeen.

## Acceptance Criteria

- [ ] Otsikon valitsin prototyypin mukaan, työpöytä ja puhelin; hiljainen
      commit vain konffitiedostosta; ei-Git-hakemistossa vain tiedosto.
- [ ] Saman kokeellisen kytkimen takana kuin `workspace-icon-chain`;
      selainspec; KOKEILTAVAA-rivi.
