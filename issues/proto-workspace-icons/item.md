---
created: 2026-10-30
updated: 2026-10-30
type: feature
reporter: jari
status: done
priority: normal
lane: proto-workspace-icons
lane_seq: 1
preparation: pending
closed: 2026-10-30
---

# Prototype: an icon for every workspace in the rail

## Description


## Description

Jari 2026-10-30 08.51, Birch (pilot.15), kuvakaappaus
`attachments/birch-2026-10-30-0851.png`: sivupalkin *Käynnissä*-osiossa
keskustelun yläpuolella on erillinen työtilan otsikkorivi (*open-habitat 1*).
"Mä haluaisin, että Open Habitatissa generoidaan jokaiselle repolle oma
ikoni. Se, että missä kohtaa tämä tulee ja miten se konffataan, voisi olla
sellainen mitä nyt pohditaan, mutta pointtina on, että esim. tässä valikossa
voisi säästyä tältä ylimääräiseltä nimeltä, kun se repo/työtila-ikoni on
siinä sen edessä. Meillä voisi olla jotakin random-ikoneita, joita päätellään
nimestä, mutta jos on sisältöä, niin se tulisi siitä. Aiemmin meillä oli
jokaisella repolla oma hymiö ja se toimi hyvin (terminaaliympäristössä).
Toimisiko se myös tässä?"

Taustaa: terminaaliympäristössä jokaisella repolla on emoji
(`.workmux.yaml` `window_prefix`, tw:n `projects.conf`), jolla tmux-ikkunat
ja Telegram-ilmoitukset erotetaan toisistaan.

Yksi näkymä: sivupalkki (työtilat ja keskustelut, myös *Käynnissä* ja
kapea kaistale), jossa ikoni korvaa toistuvan työtilan nimen.

## Acceptance Criteria

- [ ] 2–3 suuntaa: mistä ikoni tulee (repon oma sisältö tai asetus, nimestä
      johdettu oletus), miten sen vaihtaa ja missä nimi silti näkyy.
- [ ] Host-puolen faktat ja ehdotus siitä, mistä ikoni luetaan, result.md:ssä;
      tuotantokoodi ennallaan.

## Decisions

### 2026-10-30T08:40:08Z · @jari

Jari 30.10.: Lähdeketju. Ei integroida tässä vaiheessa workmux-konffiin: repossa on Open Habitatin oma konffi, ja kuvake on siellä. Kuvakkeen voi asettaa ja muokata repon etusivulla; asettaminen prototyypataan (proto-workspace-icon-setting). Toteutus: workspace-icon-chain.
