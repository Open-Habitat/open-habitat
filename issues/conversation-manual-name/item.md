---
created: 2026-10-30
updated: 2026-10-30
type: feature
reporter: jari
status: open
priority: normal
lane: conversation-name
lane_seq: 1
preparation: ready
---

# Name a conversation by hand; goal-started conversations get the goal's name

## Description


## Description

Jari 30.10.: "Olisi toisinaan kiva itse asiassa nimetä itse käsin toi
keskustelu. Ja niissä frontpage-näkymissä, joista lähdetään liikkeelle
tietyistä prosesseista, keskustelu voisi olla nimetty jollain tietyllä
tavalla, ainakin mahdollisesti. Kyllä mä tykkäisin nyt saada nimetä ton
itse."

Nykyään otsikon voi vain generoida uudelleen (`retitleHistory`,
`internal/daemon/history_title_linux.go`); käsin nimeämistä ei ole.
Etusivun tavoitteet: `.agents/start-page.md`, `web/src/components/StartHere.tsx`,
`GoalChip`.

## Acceptance Criteria

- [ ] Keskustelun voi nimetä käsin keskustelun otsakkeesta ja sivupalkin
      valikosta (työpöytä ja puhelin); nimi tallentuu Pi:n natiiviin istuntoon
      (esim. Pi:n session name), ei uuteen tietovarastoon, ja käsin annettu nimi
      voittaa automaattisen otsikon.
- [ ] Etusivun tavoitteesta aloitettu keskustelu saa tavoitteen nimen
      (tai tavoitteen määrittämän nimen), kunnes sen nimeää uudelleen.
- [ ] Ei kokeellista kytkintä (Jari haluaa nyt); selainspec; KOKEILTAVAA-rivi.
