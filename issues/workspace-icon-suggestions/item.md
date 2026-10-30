---
created: 2026-10-30
updated: 2026-10-30
type: feature
reporter: jari
status: open
priority: normal
lane: workspace-icons
lane_seq: 3
blocked_by: ['@workspace-icon-setting']
preparation: ready
---

# Model-generated workspace icon suggestions under the page header (Sirut)

## Description


## Description

Jari 30.10. valitsi `proto-workspace-icon-setting`-kierroksen 2 suunnan
**Sirut** (`prototypes/ehdotus-sparraus/`, result.md "Kierros 2"): työtilan
sivun otsikon alla rivi, jossa viisi mallin ehdottamaa kuvaketta
perusteluineen, vapaa toivekenttä, pikatoiveet (*Leikkisämpi*,
*Asiallisempi*, *Kirjaimet*, *Toisia*) ja aiemmat kierrokset nuolilla.
Hyväksyntä yhdellä klikkauksella kirjoittaa `.open-habitat.yaml` `icon`-
kentän ja commitoi hiljaa (`workspace-icon-setting`). Lataus-, ei mallia- ja
aikakatkaisutilat sekä fallback prototyypin mukaan.

Kapellimestarin ratkaisut avoimiin kysymyksiin (Jari ei vastannut):
`icon: auto` on pysyvä "ei ehdotuksia" (ketjun oletus ilman riviä; litteä
`icon`-muoto saa neljännen arvon), ja ehdotusapuri lataa Claude-sillan, jotta
pelkällä Claude-tilauksella saa ehdotuksia.

## Acceptance Criteria

- [ ] Ehdotukset henkilön omilla mallitunnuksilla samaa natiivia reittiä kuin
      otsikointi (`internal/daemon/title_linux.go`), ei uutta palveluasiakasta;
      malli näkee vain prototyypin luettelemat tiedot.
- [ ] Sirut työpöydällä ja puhelimella; `icon: auto` piilottaa rivin pysyvästi.
- [ ] Saman kokeellisen kytkimen takana kuin työtilan kuvakkeet; selainspec;
      KOKEILTAVAA-rivi.
